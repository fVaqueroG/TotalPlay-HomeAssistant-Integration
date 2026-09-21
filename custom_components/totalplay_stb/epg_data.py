"""Pure XMLTV parsing for the optional Totalplay programme guide.

Upstream XMLTV station IDs are NOT Totalplay channel numbers.
"""

from datetime import datetime, timezone, timedelta
import io
import xml.etree.ElementTree as ET

MAX_GUIDE_BYTES = 25_000_000
MAX_STREAMED_XMLTV_BYTES = 160_000_000
MAX_CHANNELS = 1000
MAX_PROGRAMMES = 150_000


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


def parse_xmltv(data: bytes, now: datetime | None = None) -> dict:
    """Small-file compatibility API; larger compressed files use streaming."""
    if len(data) > MAX_GUIDE_BYTES:
        raise ValueError("XMLTV guide exceeds size limit")
    return parse_xmltv_stream(io.BytesIO(data), now=now, max_bytes=MAX_GUIDE_BYTES)


class _LimitedXmlReader:
    """Reject oversize/DTD XML while reading small chunks, without full inflation."""

    def __init__(self, source, max_bytes: int):
        self._source = source
        self._max_bytes = max_bytes
        self._count = 0
        self._tail = b""

    def read(self, size: int = -1) -> bytes:
        if size < 0:
            size = 16384
        # An extra byte detects over-limit data rather than silently truncating.
        remaining = self._max_bytes - self._count
        chunk = self._source.read(min(size, max(0, remaining) + 1))
        self._count += len(chunk)
        if self._count > self._max_bytes:
            raise ValueError("Uncompressed guide exceeds the XMLTV size limit")
        scan = (self._tail + chunk).lower()
        if b"<!doctype" in scan or b"<!entity" in scan:
            raise ValueError("XMLTV document contains a forbidden DTD")
        self._tail = scan[-16:]
        return chunk


def parse_xmltv_stream(source, now: datetime | None = None,
                       max_bytes: int = MAX_STREAMED_XMLTV_BYTES) -> dict:
    """Stream an XMLTV file, clearing processed nodes to bound memory usage.

    Large multi-day XMLTV sources can exceed the original 25 MB limit after
    gzip decompression; only programmes overlapping the next eight hours are
    retained. Unknown station IDs are never mistaken for Totalplay numbers.
    """
    now = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)
    end = now + timedelta(hours=8)
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
                channels[channel_id] = {
                    "id": channel_id, "name": names[0], "names": names[:10], "schedule": []
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
