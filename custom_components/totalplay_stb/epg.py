"""Authenticated Home Assistant proxy for independent, optional public Mexican XMLTV guides.

Only programme metadata is downloaded. STB tuning remains local to Totalplay.
"""

import asyncio
import gzip
import io
import logging
import time

from aiohttp import ClientError, ClientResponseError, ClientTimeout, web
from homeassistant.components.http import HomeAssistantView
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .epg_data import MAX_GUIDE_BYTES, parse_xmltv

_LOGGER = logging.getLogger(__name__)
# EPGshare MX1 is a Mexico-specific XMLTV feed; unlike an M3U playlist,
# it provides programme times and titles. These are independent public guides,
# not Totalplay's proprietary EPG or proof of channel/package availability.
GUIDE_URL = "https://epgshare01.online/epgshare01/epg_ripper_MX1.xml.gz"
BACKUP_GUIDE_URL = "https://iptv-epg.org/files/epg-mx.xml"
THIRD_GUIDE_URL = "https://iptv-org.github.io/epg/guides/mx/gatotv.com.epg.xml"
GUIDE_SOURCES = (GUIDE_URL, BACKUP_GUIDE_URL, THIRD_GUIDE_URL)
_CACHE_SECONDS = 15 * 60
_RETRY_SECONDS = 5 * 60


def _error_description(exc: Exception) -> str:
    """Provide an actionable category without revealing private connection details."""
    if isinstance(exc, ClientResponseError):
        return f"HTTP {exc.status} from the XMLTV provider"
    if isinstance(exc, (asyncio.TimeoutError, TimeoutError)):
        return "XMLTV download timed out"
    if isinstance(exc, ClientError):
        return f"XMLTV network error ({type(exc).__name__})"
    if isinstance(exc, ValueError):
        return f"XMLTV content error: {exc}"
    return f"XMLTV processing error ({type(exc).__name__})"


def _parse_guide_bytes(raw: bytes) -> dict:
    """Handle .xml and .xml.gz safely; cap both transfer and decompressed XML.

    aiohttp might already have decoded HTTP Content-Encoding: gzip; sniffing the
    gzip file header also supports files served as application/gzip or octet-stream.
    """
    if len(raw) > MAX_GUIDE_BYTES:
        raise ValueError("Guide exceeds the XMLTV download size limit")
    if raw.startswith(b"\x1f\x8b"):
        try:
            with gzip.GzipFile(fileobj=io.BytesIO(raw)) as stream:
                raw = stream.read(MAX_GUIDE_BYTES + 1)
        except (OSError, EOFError) as exc:
            raise ValueError("Invalid compressed XMLTV guide") from exc
        if len(raw) > MAX_GUIDE_BYTES:
            raise ValueError("Uncompressed guide exceeds the XMLTV size limit")
    return parse_xmltv(raw)


class TotalplayGuideView(HomeAssistantView):
    """Expose current programmes via an authenticated HA endpoint."""

    url = "/api/totalplay_stb/epg"
    name = "api:totalplay_stb:epg"
    requires_auth = True

    def __init__(self, hass):
        self._hass = hass
        self._lock = asyncio.Lock()
        self._guide = {"channels": [], "updated": None, "error": "Guide not loaded"}
        self._next_refresh = 0.0

    async def get(self, request: web.Request) -> web.Response:
        """Keep network operations server-side and share the cached result."""
        if time.monotonic() >= self._next_refresh:
            async with self._lock:
                if time.monotonic() >= self._next_refresh:
                    await self._refresh()
        return self.json(self._guide)

    async def _download(self, url: str) -> dict:
        """Bound transfer, decompression, parse work and per-source wait."""
        session = async_get_clientsession(self._hass)
        async with session.get(url, timeout=ClientTimeout(total=14)) as response:
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
        """Try independent feeds, retain prior results when every source fails."""
        errors = []
        for index, url in enumerate(GUIDE_SOURCES):
            try:
                parsed = await self._download(url)
                if not parsed.get("window_programme_count"):
                    raise ValueError("No programmes in the current eight-hour window")
                self._guide = {
                    **parsed, "error": None, "source": url,
                    "source_name": ("EPGshare Mexico MX1" if index == 0 else
                                    "IPTV-EPG Mexico" if index == 1 else "IPTV-org Mexico"),
                    "fallback": index > 0, "source_errors": errors,
                    "using_cached_guide": False,
                }
                self._next_refresh = time.monotonic() + _CACHE_SECONDS
                if index:
                    _LOGGER.info("Totalplay EPG using alternative source %s", index + 1)
                return
            except Exception as exc:  # Optional guide must never block STB commands.
                reason = _error_description(exc)
                _LOGGER.warning("Totalplay XMLTV provider %s unavailable: %s", index + 1, reason)
                errors.append(f"provider {index + 1}: {reason}")

        self._guide = {
            **self._guide,
            "error": "EPG download failed (" + "; ".join(errors) + ")",
            "source_errors": errors,
            "using_cached_guide": bool(self._guide.get("channels")),
        }
        self._next_refresh = time.monotonic() + _RETRY_SECONDS
