"""Pure, bounded XMLTV parsing for the optional Totalplay programme guide.

Upstream station IDs are NOT Totalplay channel numbers.
"""

from datetime import datetime, timezone, timedelta
import io
import re
import xml.etree.ElementTree as ET
from urllib.parse import urlsplit

MAX_GUIDE_BYTES = 25_000_000
MAX_STREAMED_XMLTV_BYTES = 160_000_000
MAX_CHANNELS = 1000
MAX_PROGRAMMES = 150_000
# The backend refreshes on :00/:30. Keep an extra half hour so the timeline
# still contains eight hours of data at the next scheduled refresh boundary.
GUIDE_WINDOW = timedelta(hours=8, minutes=30)

_SAFE_XMLTV_DOCTYPE = re.compile(
    rb'<!DOCTYPE\s+tv\s+SYSTEM\s+(["\'])xmltv\.dtd\1\s*>', re.IGNORECASE
)
_ROOT_OPEN = re.compile(rb'<tv(?:\s|>)', re.IGNORECASE)


def _when(value: str) -> datetime | None:
    """Read common timezone-explicit XMLTV dates; never guess a timezone."""
    value = value.strip()
    for fmt in (
        "%Y%m%d%H%M%S %z", "%Y%m%d%H%M%S%z",
        "%Y%m%d%H%M %z", "%Y%m%d%H%M%z",
        "%Y%m%d%H %z", "%Y%m%d%H%z",
    ):
        try:
            return datetime.strptime(value, fmt).astimezone(timezone.utc)
        except ValueError:
            continue
    return None


def _logo_url(value: str | None) -> str | None:
    """Only expose HTTPS image URLs, never an XMLTV-supplied active URI."""
    if not value or len(value) > 512 or any(ord(c) < 32 for c in value):
        return None
    try:
        address = urlsplit(value)
        if address.scheme.lower() == "https" and address.hostname and not address.username and not address.password:
            return value
    except ValueError:
        pass
    return None


def parse_xmltv(data: bytes, now: datetime | None = None) -> dict:
    """Small-file compatibility API; larger compressed files use streaming."""
    if len(data) > MAX_GUIDE_BYTES:
        raise ValueError("XMLTV guide exceeds size limit")
    return parse_xmltv_stream(io.BytesIO(data), now=now, max_bytes=MAX_GUIDE_BYTES)


class _LimitedXmlReader:
    """Cap streamed XML size; accept one inert DTD and reject entity declarations.

    Buffer at most 8 KiB of XML preamble so an allowed declaration can be
    removed even when the underlying source returns very short read chunks.
    After the root begins, never accept additional DTD/ENTITY declarations.
    """

    def __init__(self, source, max_bytes: int):
        self._source = source
        self._max_bytes = max_bytes
        self._count = 0
        self._ready = False
        self._carry = b""
        self._tail = b""

    def _bounded_read(self, size: int) -> bytes:
        remaining = self._max_bytes - self._count
        chunk = self._source.read(min(size, max(0, remaining) + 1))
        self._count += len(chunk)
        if self._count > self._max_bytes:
            raise ValueError("Uncompressed guide exceeds the XMLTV size limit")
        return chunk

    def read(self, size: int = -1) -> bytes:
        if size < 0:
            size = 16384
        if not size:
            return b""
        if self._carry:
            chunk, self._carry = self._carry[:size], self._carry[size:]
            return chunk

        if not self._ready:
            preamble = bytearray()
            while not _ROOT_OPEN.search(preamble):
                chunk = self._bounded_read(4096)
                if not chunk:
                    break
                preamble.extend(chunk)
                if len(preamble) > 8192:
                    raise ValueError("XMLTV preamble is too large")
            data = bytes(preamble)
            lower = data.lower()
            if b"<!entity" in lower:
                raise ValueError("XMLTV document contains a forbidden DTD or entity declaration")
            if b"<!doctype" in lower:
                match = _SAFE_XMLTV_DOCTYPE.search(data)
                if (match is None or match.start() >= (_ROOT_OPEN.search(data) or match).start()
                        or b"<!doctype" in (data[:match.start()] + data[match.end():]).lower()):
                    raise ValueError("XMLTV document contains a forbidden DTD")
                data = data[:match.start()] + data[match.end():]
            self._ready = True
            self._tail = data[-16:].lower()
            self._carry = data[size:]
            return data[:size]

        chunk = self._bounded_read(size)
        scan = (self._tail + chunk).lower()
        if b"<!doctype" in scan or b"<!entity" in scan:
            raise ValueError("XMLTV document contains a forbidden DTD or entity declaration")
        self._tail = scan[-16:]
        return chunk


def parse_xmltv_stream(source, now: datetime | None = None,
                       max_bytes: int = MAX_STREAMED_XMLTV_BYTES) -> dict:
    """Stream XMLTV and clear processed nodes to bound memory usage.

    Multi-day XMLTV files can exceed the original 25 MB limit after gzip
    decompression; retain only programmes overlapping the next eight and a
    half hours, so a timed refresh does not truncate guide navigation.
    """
    now = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)
    end = now + GUIDE_WINDOW
    channels: dict[str, dict] = {}
    count = timestamped = retained = 0
    root = None
    for event, node in ET.iterparse(_LimitedXmlReader(source, max_bytes), events=("start", "end")):
        if root is None:
            if event != "start" or node.tag != "tv":
                raise ValueError("Expected an XMLTV <tv> document")
            root = node
        if event != "end":
            continue
        if node.tag == "channel":
            channel_id = node.get("id", "").strip()
            names = list(dict.fromkeys(
                name.text.strip() for name in node.findall("display-name")
                if name.text and name.text.strip()
            ))
            if channel_id and names and channel_id not in channels:
                icon = node.find("icon")
                logo = _logo_url(icon.get("src")) if icon is not None else None
                channels[channel_id] = {
                    "id": channel_id, "name": names[0], "names": names[:10],
                    "logo": logo, "schedule": []
                }
                if len(channels) > MAX_CHANNELS:
                    raise ValueError("XMLTV channel count exceeds limit")
            root.clear()
        elif node.tag == "programme":
            count += 1
            if count > MAX_PROGRAMMES:
                raise ValueError("XMLTV programme count exceeds limit")
            channel = channels.get(node.get("channel", ""))
            if channel is not None:
                start = _when(node.get("start", ""))
                stop = _when(node.get("stop", ""))
                if start and stop and start < stop:
                    timestamped += 1
                    if stop > now and start < end:
                        title = (node.findtext("title") or "").strip()
                        if title:
                            channel["schedule"].append({
                                "title": title[:200], "start": start.isoformat(),
                                "stop": stop.isoformat(),
                            })
                            retained += 1
            root.clear()
    if root is None:
        raise ValueError("XMLTV document is empty")
    for channel in channels.values():
        channel["schedule"].sort(key=lambda item: item["start"])
        channel["schedule"] = channel["schedule"][:40]
    return {
        "updated": now.isoformat(), "channels": list(channels.values()),
        "programme_count": count, "valid_timestamp_count": timestamped,
        "window_programme_count": retained,
        "scheduled_channel_count": sum(bool(ch["schedule"]) for ch in channels.values()),
    }
