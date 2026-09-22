"""Backend-managed, preloaded Totalplay guide with a persistent last-good cache."""

import asyncio
from datetime import datetime, timezone
import logging
import time

from homeassistant.helpers.event import async_track_time_change
from homeassistant.helpers.storage import Store

from .epg import TotalplayGuideView

_LOGGER = logging.getLogger(__name__)
_CLOCK_REFRESH_MINUTES = (0, 30)
_CACHE_KEY = "totalplay_stb_epg_last_good"


class TotalplayCachedGuideView(TotalplayGuideView):
    """Warm and persist the guide independently of browser/dashboard visits."""

    def __init__(self, hass):
        super().__init__(hass)
        self._startup_task = None
        self._unsubscribe_refresh = None
        self._last_prune_minute = None
        self._store = Store(hass, 1, _CACHE_KEY)

    async def _load_cache_and_refresh(self) -> None:
        """Use yesterday's still-upcoming listings while live feeds download."""
        try:
            cached = await self._store.async_load()
            if (isinstance(cached, dict) and isinstance(cached.get("channels"), list)
                    and cached["channels"] and not self._guide.get("channels")):
                self._guide = {
                    **cached,
                    "error": None,
                    "using_cached_guide": True,
                }
                self._prune_ended(force=True)
                _LOGGER.info("Totalplay EPG restored %s stations from the saved guide",
                             len(self._guide["channels"]))
        except Exception:
            _LOGGER.exception("Unable to restore the last successful Totalplay EPG cache")
        await self.async_refresh()

    def async_start(self) -> None:
        """Start one clock-aligned refresh listener and restore the saved guide."""
        if self._unsubscribe_refresh is not None:
            return
        self._unsubscribe_refresh = async_track_time_change(
            self._hass, self._scheduled_refresh,
            minute=list(_CLOCK_REFRESH_MINUTES), second=0,
        )
        self._startup_task = self._hass.async_create_task(self._load_cache_and_refresh())

    def async_stop(self) -> None:
        """Stop work when the last Totalplay config entry is unloaded."""
        if self._unsubscribe_refresh is not None:
            self._unsubscribe_refresh()
            self._unsubscribe_refresh = None
        if self._startup_task is not None and not self._startup_task.done():
            self._startup_task.cancel()
        self._startup_task = None

    async def _scheduled_refresh(self, _now) -> None:
        await self.async_refresh()

    async def async_refresh(self) -> None:
        """Serialize downloads and persist only a newly downloaded valid guide."""
        if self._lock.locked():
            async with self._lock:
                self._prune_ended(force=True)
            return
        async with self._lock:
            await self._refresh()
            self._prune_ended(force=True)
            if (not self._guide.get("using_cached_guide") and not self._guide.get("error")
                    and self._guide.get("channels") and self._guide.get("window_programme_count", 0)):
                try:
                    await self._store.async_save(self._guide)
                except Exception:
                    _LOGGER.exception("Could not save the last successful Totalplay EPG cache")

    def _prune_ended(self, *, force: bool = False) -> None:
        """Discard only ended programs, never a show already underway."""
        now = datetime.now(timezone.utc)
        minute = int(now.timestamp() // 60)
        if not force and minute == self._last_prune_minute:
            return
        self._last_prune_minute = minute
        channels = self._guide.get("channels", [])
        total = active_stations = 0
        for station in channels:
            current = []
            for programme in station.get("schedule", []):
                try:
                    stop = datetime.fromisoformat(
                        str(programme["stop"]).replace("Z", "+00:00")
                    ).astimezone(timezone.utc)
                except (ValueError, TypeError, KeyError):
                    continue
                if stop > now:
                    current.append(programme)
            station["schedule"] = current
            total += len(current)
            active_stations += bool(current)
        if channels:
            self._guide["window_programme_count"] = total
            self._guide["scheduled_channel_count"] = active_stations
            if self._guide.get("using_cached_guide") and not total:
                self._guide["error"] = "The saved EPG has no remaining current programmes; live sources are unavailable."

    async def get(self, request):
        """Serve usable cached data without waiting for a slow background refresh."""
        if getattr(request, "query", {}).get("refresh") == "1":
            await self.async_refresh()
        elif (self._startup_task is not None and not self._startup_task.done()
              and not self._guide.get("window_programme_count", 0)):
            # On a fresh install with no saved data, share the initial download.
            # With saved data, visitors get an immediate response instead.
            await asyncio.shield(self._startup_task)
        elif not self._guide.get("channels") and time.monotonic() >= self._next_refresh:
            await self.async_refresh()
        self._prune_ended()
        response = self.json(self._guide)
        compress = getattr(response, "enable_compression", None)
        if callable(compress):
            compress()
        return response
