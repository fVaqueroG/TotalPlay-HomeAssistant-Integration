"""Authenticated Home Assistant proxy for optional public XMLTV guide listings.

Programme metadata only; decoder tuning is always local to Totalplay.
"""

import asyncio
import gzip
import io
import logging
import time
import xml.etree.ElementTree as ET

from aiohttp import ClientError, ClientResponseError, ClientTimeout, web
from homeassistant.components.http import HomeAssistantView
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .epg_data import MAX_GUIDE_BYTES, MAX_STREAMED_XMLTV_BYTES, parse_xmltv, parse_xmltv_stream

_LOGGER = logging.getLogger(__name__)
# The GitHub-hosted Latino guide includes Mexican stations and publishes an
# independently updated status page. Keep the other sources as alternatives;
# they are not Totalplay's proprietary schedule or a package/channel mapping.
GUIDE_URL = "https://raw.githubusercontent.com/acidjesuz/EPGTalk/master/Latino_guide.xml.gz"
BACKUP_GUIDE_URL = "https://epgshare01.online/epgshare01/epg_ripper_MX1.xml.gz"
THIRD_GUIDE_URL = "https://iptv-epg.org/files/epg-mx.xml"
GUIDE_SOURCES = (GUIDE_URL, BACKUP_GUIDE_URL, THIRD_GUIDE_URL)
SOURCE_NAMES = ("EPGTalk Latino / Mexico", "EPGshare Mexico MX1", "IPTV-EPG Mexico")
MAX_EXPANDED_GUIDE_BYTES = MAX_STREAMED_XMLTV_BYTES
_CACHE_SECONDS = 15 * 60
_RETRY_SECONDS = 5 * 60


def _error_description(exc: Exception) -> str:
    """Expose useful categories without leaking URLs or private connection data."""
    if isinstance(exc, ClientResponseError):
        return f"HTTP {exc.status} from the XMLTV provider"
    if isinstance(exc, (asyncio.TimeoutError, TimeoutError)):
        return "XMLTV download timed out"
    if isinstance(exc, ClientError):
        return f"XMLTV network error ({type(exc).__name__})"
    if isinstance(exc, ET.ParseError):
        return "XMLTV content error: provider did not return a valid XMLTV document"
    if isinstance(exc, ValueError):
        return f"XMLTV content error: {exc}"
    return f"XMLTV processing error ({type(exc).__name__})"


def _parse_guide_bytes(raw: bytes) -> dict:
    """Stream gzip XMLTV with capped inflation; retain small plain XML support."""
    if len(raw) > MAX_GUIDE_BYTES:
        raise ValueError("Guide exceeds the XMLTV download size limit")
    if raw.startswith(b"\x1f\x8b"):
        try:
            with gzip.GzipFile(fileobj=io.BytesIO(raw)) as stream:
                return parse_xmltv_stream(stream, max_bytes=MAX_EXPANDED_GUIDE_BYTES)
        except (OSError, EOFError) as exc:
            raise ValueError("Invalid compressed XMLTV guide") from exc
    return parse_xmltv(raw)


class TotalplayGuideView(HomeAssistantView):
    """Expose public programme data via an authenticated Home Assistant API."""

    url = "/api/totalplay_stb/epg"
    name = "api:totalplay_stb:epg"
    requires_auth = True

    def __init__(self, hass):
        self._hass = hass
        self._lock = asyncio.Lock()
        self._guide = {"channels": [], "updated": None, "error": "Guide not loaded"}
        self._next_refresh = 0.0

    async def get(self, request: web.Request) -> web.Response:
        """Share the same cached result between all dashboard viewers."""
        if time.monotonic() >= self._next_refresh:
            async with self._lock:
                if time.monotonic() >= self._next_refresh:
                    await self._refresh()
        return self.json(self._guide)

    async def _download(self, url: str) -> dict:
        """Cap transfer size and parse work off the event loop."""
        session = async_get_clientsession(self._hass)
        async with session.get(url, timeout=ClientTimeout(total=20)) as response:
            response.raise_for_status()
            length = response.content_length
            if length is not None and length > MAX_GUIDE_BYTES:
                raise ValueError("Guide exceeds the XMLTV download size limit")
            raw = await response.content.read(MAX_GUIDE_BYTES + 1)
            if len(raw) > MAX_GUIDE_BYTES:
                raise ValueError("Guide exceeds the XMLTV download size limit")
        parsed = await self._hass.async_add_executor_job(_parse_guide_bytes, raw)
        if not parsed["channels"] or not parsed["programme_count"]:
            raise ValueError("Guide contains no usable channels or programmes")
        return parsed

    async def _refresh(self) -> None:
        """Use the first current guide; keep cached data and report failed sources."""
        errors = []
        for index, url in enumerate(GUIDE_SOURCES):
            try:
                parsed = await self._download(url)
                if not parsed.get("window_programme_count"):
                    raise ValueError("No programmes in the current eight-hour window")
                self._guide = {
                    **parsed, "error": None, "source": url,
                    "source_name": SOURCE_NAMES[index], "fallback": index > 0,
                    "source_errors": errors, "using_cached_guide": False,
                }
                self._next_refresh = time.monotonic() + _CACHE_SECONDS
                if index:
                    _LOGGER.info("Totalplay EPG using alternative source %s", index + 1)
                return
            except Exception as exc:  # Optional guide never blocks decoder control.
                reason = _error_description(exc)
                _LOGGER.warning("Totalplay XMLTV provider %s unavailable: %s", index + 1, reason)
                errors.append(f"provider {index + 1} ({SOURCE_NAMES[index]}): {reason}")
        self._guide = {
            **self._guide,
            "error": "EPG download failed (" + "; ".join(errors) + ")",
            "source_errors": errors,
            "using_cached_guide": bool(self._guide.get("channels")),
        }
        self._next_refresh = time.monotonic() + _RETRY_SECONDS
