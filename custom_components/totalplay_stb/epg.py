"""Authenticated Home Assistant proxy for optional public Mexican XMLTV listings."""

import asyncio
import logging
import time

from aiohttp import ClientError, ClientResponseError, ClientTimeout, web
from homeassistant.components.http import HomeAssistantView
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .epg_data import MAX_GUIDE_BYTES, parse_xmltv

_LOGGER = logging.getLogger(__name__)
# These are independent public XMLTV sources, not the decoder's native EPG.
GUIDE_URL = "https://iptv-epg.org/files/epg-mx.xml"
BACKUP_GUIDE_URL = "https://iptv-org.github.io/epg/guides/mx/gatotv.com.epg.xml"
GUIDE_SOURCES = (GUIDE_URL, BACKUP_GUIDE_URL)
_CACHE_SECONDS = 15 * 60
_RETRY_SECONDS = 5 * 60


def _error_description(exc: Exception) -> str:
    """Give users an actionable category without exposing private request details."""
    if isinstance(exc, ClientResponseError):
        return f"HTTP {exc.status} from the XMLTV provider"
    if isinstance(exc, (asyncio.TimeoutError, TimeoutError)):
        return "XMLTV download timed out"
    if isinstance(exc, ClientError):
        return f"XMLTV network error ({type(exc).__name__})"
    if isinstance(exc, ValueError):
        return f"XMLTV content error: {exc}"
    return f"XMLTV processing error ({type(exc).__name__})"


class TotalplayGuideView(HomeAssistantView):
    """Expose programme listings, not a claim about Totalplay channel numbering."""

    url = "/api/totalplay_stb/epg"
    name = "api:totalplay_stb:epg"
    requires_auth = True

    def __init__(self, hass):
        self._hass = hass
        self._lock = asyncio.Lock()
        self._guide = {"channels": [], "updated": None, "error": "Guide not loaded"}
        self._next_refresh = 0.0

    async def get(self, request: web.Request) -> web.Response:
        """Return cached guide; only one frontend request fetches remote XMLTV."""
        if time.monotonic() >= self._next_refresh:
            async with self._lock:
                if time.monotonic() >= self._next_refresh:
                    await self._refresh()
        return self.json(self._guide)

    async def _download(self, url: str) -> dict:
        """Bound download and parsing resources, independent of browser CORS."""
        session = async_get_clientsession(self._hass)
        async with session.get(url, timeout=ClientTimeout(total=30)) as response:
            response.raise_for_status()
            length = response.content_length
            if length is not None and length > MAX_GUIDE_BYTES:
                raise ValueError("Guide exceeds the XMLTV size limit")
            raw = await response.content.read(MAX_GUIDE_BYTES + 1)
            if len(raw) > MAX_GUIDE_BYTES:
                raise ValueError("Guide exceeds the XMLTV size limit")
        parsed = await self._hass.async_add_executor_job(parse_xmltv, raw)
        if not parsed["channels"] or not parsed["programme_count"]:
            raise ValueError("Guide contains no usable channels or programmes")
        return parsed

    async def _refresh(self) -> None:
        """Try a second public guide when the primary fails; preserve existing data."""
        errors = []
        for index, url in enumerate(GUIDE_SOURCES):
            try:
                parsed = await self._download(url)
                # An XMLTV file with only historical listings should not stop
                # us from trying an independent provider with live programmes.
                if not parsed.get("window_programme_count"):
                    raise ValueError("No programmes in the current eight-hour window")
                self._guide = {**parsed, "error": None, "source": url, "fallback": index > 0}
                self._next_refresh = time.monotonic() + _CACHE_SECONDS
                if index:
                    _LOGGER.info("Totalplay EPG using the alternative Mexican XMLTV source")
                return
            except Exception as exc:  # Optional EPG never blocks decoder control.
                reason = _error_description(exc)
                _LOGGER.warning("Totalplay XMLTV provider %s unavailable: %s", index + 1, reason)
                errors.append(f"provider {index + 1}: {reason}")

        # Preserve the previous guide if it exists; the UI filters expired
        # programmes by their timestamps and never invents a current schedule.
        self._guide = {
            **self._guide,
            "error": "EPG download failed (" + "; ".join(errors) + ")",
            "source_errors": errors,
            "using_cached_guide": bool(self._guide.get("channels")),
        }
        self._next_refresh = time.monotonic() + _RETRY_SECONDS
