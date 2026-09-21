"""Pure XMLTV parsing for the optional Totalplay programme guide.

The upstream XMLTV channel IDs are *not* Totalplay channel numbers.
"""

from datetime import datetime, timezone, timedelta
import xml.etree.ElementTree as ET

MAX_GUIDE_BYTES = 25_000_000
MAX_CHANNELS = 1000
MAX_PROGRAMMES = 150_000


def _when(value: str) -> datetime | None:
    """Parse the standard XMLTV timestamp and its explicit timezone."""
    value = value.strip()
    for fmt in ("%Y%m%d%H%M%S %z", "%Y%m%d%H%M%S%z"):
        try:
            return datetime.strptime(value, fmt).astimezone(timezone.utc)
        except ValueError:
            continue
    return None  # Do not guess the timezone of unlabelled programmes.


def parse_xmltv(data: bytes, now: datetime | None = None) -> dict:
    """Return a compact guide for channels with programmes around 'now'."""
    if len(data) > MAX_GUIDE_BYTES:
        raise ValueError("XMLTV guide exceeds size limit")
    # Never allow a remote XML document to introduce entity or DTD definitions.
    if b"<!doctype" in data.lower() or b"<!entity" in data.lower():
        raise ValueError("XMLTV document contains a forbidden DTD")
    now = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)
    end = now + timedelta(hours=8)
    root = ET.fromstring(data)
    if root.tag != "tv":
        raise ValueError("Expected an XMLTV <tv> document")
    channels: dict[str, dict] = {}
    for node in root.findall("channel"):
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
    count = 0
    for node in root.findall("programme"):
        count += 1
        if count > MAX_PROGRAMMES:
            raise ValueError("XMLTV programme count exceeds limit")
        channel = channels.get(node.get("channel", ""))
        if channel is None:
            continue
        start, stop = _when(node.get("start", "")), _when(node.get("stop", ""))
        if not start or not stop or not start < stop or stop <= now or start >= end:
            continue
        title = (node.findtext("title") or "").strip()
        if title:
            channel["schedule"].append({
                "title": title[:200], "start": start.isoformat(), "stop": stop.isoformat()
            })
    for channel in channels.values():
        channel["schedule"].sort(key=lambda item: item["start"])
        channel["schedule"] = channel["schedule"][:40]
    return {"updated": now.isoformat(), "channels": list(channels.values()), "programme_count": count}
