"""Authenticated Home Assistant proxy for public XMLTV programme listings.

Additional Mexico-specific guide feeds may improve coverage; absent stations
remain unmatched rather than receiving invented or unrelated programmes.

Independent sources are combined to improve coverage without using an XMLTV
channel ID as a Totalplay tuning number or replacing official channel branding.
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
GUIDE_URL = "https://raw.githubusercontent.com/acidjesuz/EPGTalk/master/Latino_guide.xml.gz"
BACKUP_GUIDE_URL = "https://epgshare01.online/epgshare01/epg_ripper_MX1.xml.gz"
THIRD_GUIDE_URL = "https://iptv-epg.org/files/epg-mx.xml"
# Independently published Mexico-focused XMLTV feeds; these are optional.
# They supplement programme data only, never the official Totalplay lineup.
FOURTH_GUIDE_URL = "https://iptv-org.github.io/epg/guides/mx/gatotv.com.epg.xml"
FIFTH_GUIDE_URL = "https://iptv-org.github.io/epg/guides/mx/mi.tv.epg.xml"
GUIDE_SOURCES = (GUIDE_URL, BACKUP_GUIDE_URL, THIRD_GUIDE_URL,
                 FOURTH_GUIDE_URL, FIFTH_GUIDE_URL)
SOURCE_NAMES = ("EPGTalk Latino / Mexico", "EPGshare Mexico MX1", "IPTV-EPG Mexico",
                "GatoTV Mexico (iptv-org)", "mi.tv Mexico (iptv-org)")
MAX_EXPANDED_GUIDE_BYTES = MAX_STREAMED_XMLTV_BYTES
_CACHE_SECONDS = 15 * 60
_RETRY_SECONDS = 5 * 60
_DOWNLOAD_CHUNK_BYTES = 128 * 1024
_MAX_MERGED_STATIONS = 3000


def _error_description(exc: Exception) -> str:
    """Expose useful categories without leaking provider URLs or private data."""
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


def _merge_guide_sources(successes: list[tuple[int, dict]]) -> dict:
    """Preserve first-provider schedules per ID; supplement missing stations.

    ID collisions with different station names are separately namespaced so a
    foreign feed can never silently replace an existing manual EPG mapping.
    Same-ID alternate names are retained, with later programmes used only when
    the primary source supplies no current/upcoming programme for that station.
    """
    merged = {}
    reports = []
    for rank, parsed in successes:
        reports.append({
            "name": SOURCE_NAMES[rank],
            "stations": len(parsed["channels"]),
            "scheduled": parsed.get("scheduled_channel_count", 0),
        })
        for station in parsed["channels"]:
            original_id = str(station.get("id", "")).strip()
            if not original_id:
                continue
            names = list(dict.fromkeys(str(n).strip() for n in
                [station.get("name"), *(station.get("names") or [])] if n))[:10]
            if not names:
                continue
            identity = original_id
            existing = merged.get(identity)
            if existing and not ({n.casefold() for n in existing["names"]} &
                                 {n.casefold() for n in names}):
                identity = f"{original_id}~tp{rank + 1}"
                existing = merged.get(identity)
            if existing:
                existing["names"] = list(dict.fromkeys(existing["names"] + names))[:10]
                if not existing["schedule"] and station.get("schedule"):
                    existing["schedule"] = list(station["schedule"])
                    existing["programme_source"] = SOURCE_NAMES[rank]
                continue
            if len(merged) >= _MAX_MERGED_STATIONS:
                raise ValueError("Combined XMLTV guide exceeds the station limit")
            merged[identity] = {
                "id": identity, "name": names[0], "names": names,
                "logo": station.get("logo"),
                "schedule": list(station.get("schedule") or []),
                "source_rank": rank, "source_name": SOURCE_NAMES[rank],
                "programme_source": SOURCE_NAMES[rank],
            }
    channels = list(merged.values())
    first = successes[0][1]
    return {
        "updated": first.get("updated"), "channels": channels,
        "programme_count": sum(p.get("programme_count", 0) for _, p in successes),
        "valid_timestamp_count": sum(p.get("valid_timestamp_count", 0) for _, p in successes),
        "window_programme_count": sum(len(s["schedule"]) for s in channels),
        "scheduled_channel_count": sum(bool(s["schedule"]) for s in channels),
        "sources": reports, "source_name": " + ".join(s["name"] for s in reports),
        "source": GUIDE_SOURCES[successes[0][0]],
        "fallback": successes[0][0] != 0,
    }


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
        if time.monotonic() >= self._next_refresh:
            async with self._lock:
                if time.monotonic() >= self._next_refresh:
                    await self._refresh()
        response = self.json(self._guide)
        enable_compression = getattr(response, "enable_compression", None)
        if callable(enable_compression):
            enable_compression()
        return response

    async def _download(self, url: str) -> dict:
        """Read until EOF, enforce transfer limits, parse off the event loop."""
        session = async_get_clientsession(self._hass)
        async with session.get(url, timeout=ClientTimeout(total=20)) as response:
            response.raise_for_status()
            length = response.content_length
            if length is not None and length > MAX_GUIDE_BYTES:
                raise ValueError("Guide exceeds the XMLTV download size limit")
            chunks = []
            downloaded = 0
            while True:
                remaining = MAX_GUIDE_BYTES + 1 - downloaded
                chunk = await response.content.read(min(_DOWNLOAD_CHUNK_BYTES, remaining))
                if not chunk:
                    break
                downloaded += len(chunk)
                if downloaded > MAX_GUIDE_BYTES:
                    raise ValueError("Guide exceeds the XMLTV download size limit")
                chunks.append(chunk)
            raw = b"".join(chunks)
        parsed = await self._hass.async_add_executor_job(_parse_guide_bytes, raw)
        if not parsed["channels"] or not parsed["programme_count"]:
            raise ValueError("Guide contains no usable channels or programmes")
        return parsed

    async def _refresh(self) -> None:
        """Load all independent sources, preserving cached data on total failure.

        Download concurrently to avoid stacking successive 20-second
        provider timeouts during initial dashboard startup.
        """
        results = await asyncio.gather(
            *(self._download(url) for url in GUIDE_SOURCES),
            return_exceptions=True,
        )
        successes = []
        errors = []
        for rank, result in enumerate(results):
            if isinstance(result, BaseException):
                reason = _error_description(result)
                _LOGGER.warning("Totalplay XMLTV provider %s unavailable: %s", rank + 1, reason)
                errors.append(f"provider {rank + 1} ({SOURCE_NAMES[rank]}): {reason}")
                continue
            if not result.get("window_programme_count"):
                errors.append(f"provider {rank + 1} ({SOURCE_NAMES[rank]}): no programmes in the current window")
                continue
            successes.append((rank, result))
        if successes:
            try:
                combined = _merge_guide_sources(successes)
                self._guide = {
                    **combined, "error": None, "source_errors": errors,
                    "using_cached_guide": False,
                }
                self._next_refresh = time.monotonic() + _CACHE_SECONDS
                _LOGGER.info("Totalplay EPG combined %s source(s), %s stations with programmes",
                             len(successes), combined["scheduled_channel_count"])
                return
            except ValueError as exc:
                errors.append(_error_description(exc))
        self._guide = {
            **self._guide,
            "error": "EPG download failed (" + "; ".join(errors) + ")",
            "source_errors": errors,
            "using_cached_guide": bool(self._guide.get("channels")),
        }
        self._next_refresh = time.monotonic() + _RETRY_SECONDS
