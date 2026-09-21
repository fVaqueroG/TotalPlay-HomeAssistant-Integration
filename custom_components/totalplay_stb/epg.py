"""Authenticated Home Assistant proxy for optional public Mexican XMLTV listings."""

import asyncio
import logging
import time

from aiohttp import ClientTimeout, web
from homeassistant.components.http import HomeAssistantView
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .epg_data import MAX_GUIDE_BYTES, parse_xmltv

_LOGGER = logging.getLogger(__name__)
GUIDE_URL = "https://iptv-epg.org/files/epg-mx.xml"
_CACHE_SECONDS = 15 * 60
_RETRY_SECONDS = 5 * 60


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

    async def _refresh(self) -> None:
        """Fetch via Home Assistant so browsers never need XMLTV-site CORS access."""
        try:
            session = async_get_clientsession(self._hass)
            async with session.get(GUIDE_URL, timeout=ClientTimeout(total=35)) as response:
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
            self._guide = {**parsed, "error": None, "source": GUIDE_URL}
            self._next_refresh = time.monotonic() + _CACHE_SECONDS
        except (Exception) as exc:  # A failed optional guide must never break STB control.
            _LOGGER.warning("Totalplay optional EPG unavailable: %s", exc)
            self._guide = {**self._guide, "error": "Guide temporarily unavailable"}
            self._next_refresh = time.monotonic() + _RETRY_SECONDS
