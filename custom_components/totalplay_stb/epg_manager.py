"""Backend-managed, preloaded Totalplay guide with bounded rolling programme data."""

import asyncio
from datetime import datetime, timezone
import time

from homeassistant.helpers.event import async_track_time_change

from .epg import TotalplayGuideView

# These are wall-clock boundaries, not 30 minutes after a startup/manual fetch.
_CLOCK_REFRESH_MINUTES = (0, 30)


class TotalplayCachedGuideView(TotalplayGuideView):
    """Warm the shared EPG on integration startup, not on each dashboard open."""

    def __init__(self, hass):
        super().__init__(hass)
        self._startup_task = None
        self._unsubscribe_refresh = None
        self._last_prune_minute = None

    def async_start(self) -> None:
        """Start one clock-aligned refresh listener and populate the cache."""
        if self._unsubscribe_refresh is not None:
            return
        self._unsubscribe_refresh = async_track_time_change(
            self._hass, self._scheduled_refresh,
            minute=list(_CLOCK_REFRESH_MINUTES), second=0,
        )
        self._startup_task = self._hass.async_create_task(self.async_refresh())

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
        """Serialize source downloads; never make dashboard visitors parse XMLTV."""
        if self._lock.locked():
            # A startup, scheduled, or manual refresh is already under way.
            # Reuse its result rather than downloading the same guide twice.
            async with self._lock:
                self._prune_ended(force=True)
            return
        async with self._lock:
            await self._refresh()
            self._prune_ended(force=True)

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

    async def get(self, request):
        """Respond from the prepared cache; only an explicit request forces refresh."""
        if getattr(request, "query", {}).get("refresh") == "1":
            await self.async_refresh()
        elif self._startup_task is not None and not self._startup_task.done():
            # An immediate visit during startup shares the one initial fetch.
            await asyncio.shield(self._startup_task)
        elif not self._guide.get("channels") and time.monotonic() >= self._next_refresh:
            # Recover if the startup download failed before the first tick.
            await self.async_refresh()
        self._prune_ended()
        response = self.json(self._guide)
        compress = getattr(response, "enable_compression", None)
        if callable(compress):
            compress()
        return response
