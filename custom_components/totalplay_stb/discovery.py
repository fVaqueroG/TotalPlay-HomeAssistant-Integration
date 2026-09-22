"""Read-only discovery of Totalplay decoders on local IPv4 networks.

The Control APK's subnet scanner queries getSTBInfo for a device name and MAC.
A decoder may also support the remote endpoint when its information endpoint
is not available: never use a negative information probe to reject a manual IP.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
import ipaddress
import json
import re

from homeassistant.components import network
from homeassistant.core import HomeAssistant

from .const import DEFAULT_PORT

_INFO_PATH = "/Application/TPNG/RemoteControl/getSTBInfo"
_MAC_PATH = "/RemoteControl/StbInfo/getMac?if=eth0"
_STATUS_LINE = re.compile(rb"^HTTP/1\.[01] ([1-5][0-9]{2})(?:[ \t\r\n]|$)")
_MAC = re.compile(r"(?i)\b(?:[0-9a-f]{2}:){5}[0-9a-f]{2}\b")
_COMMON_TOTALPLAY_NETWORK = ipaddress.ip_network("192.168.100.0/24")
_MAX_CONCURRENCY = 32


@dataclass(frozen=True, slots=True)
class TotalplaySTB:
    """A decoder candidate identified by its local information endpoint."""

    host: str
    port: int
    model: str = ""


def _extract_info(body: str) -> tuple[bool, str]:
    """Recognize the name/mac_address JSON expected by the Control APK."""
    try:
        payload = json.loads(body.strip())
    except (ValueError, TypeError):
        payload = None
    if isinstance(payload, dict):
        # Some firmware nests information in an envelope.
        for item in (payload, payload.get("data"), payload.get("device")):
            if not isinstance(item, dict):
                continue
            mac = item.get("mac_address") or item.get("macAddress") or item.get("mac")
            name = item.get("name") or item.get("StbName") or item.get("stb_name")
            if isinstance(mac, str) and _MAC.fullmatch(mac.strip()) and isinstance(name, str) and name.strip():
                model = item.get("model") or item.get("stbModel") or item.get("modelo") or ""
                return True, str(model).strip()[:80]
    return False, ""


async def _async_http_get(host: str, port: int, path: str, timeout: float) -> tuple[int, str] | None:
    """Read status and a bounded body; do not wait for a broken STB to close HTTP.

    Some STBs send malformed response headers or keep the connection open after
    sending a complete short response. Strict aiohttp parsing or read-to-EOF
    incorrectly labels these working devices as offline. Headers are discarded;
    the read-only response body is capped and never logged.
    """
    writer: asyncio.StreamWriter | None = None
    try:
        reader, writer = await asyncio.wait_for(asyncio.open_connection(host, port), timeout=timeout)
        writer.write((
            f"GET {path} HTTP/1.1\r\n"
            f"Host: {host}:{port}\r\n"
            "Accept: application/json, */*\r\n"
            "Connection: close\r\n\r\n"
        ).encode("ascii"))
        await asyncio.wait_for(writer.drain(), timeout=timeout)
        status_line = await asyncio.wait_for(reader.readline(), timeout=timeout)
        match = _STATUS_LINE.match(status_line)
        if not match:
            return None
        status = int(match.group(1))
        # Read only until the end of headers, tolerant of invalid header syntax.
        for _ in range(80):
            line = await asyncio.wait_for(reader.readline(), timeout=timeout)
            if line in (b"\r\n", b"\n", b""):
                break
        else:
            return None
        # Body is normally a small JSON object. Read a chunk, not the entire
        # connection: waiting for EOF incorrectly timed out on real decoders.
        try:
            body = await asyncio.wait_for(reader.read(8192), timeout=timeout)
        except asyncio.TimeoutError:
            body = b""
        return status, body.decode("utf-8", "replace")
    except (OSError, asyncio.TimeoutError, ValueError, asyncio.IncompleteReadError):
        return None
    finally:
        if writer is not None:
            writer.close()
            try:
                await asyncio.wait_for(writer.wait_closed(), timeout=0.3)
            except (OSError, asyncio.TimeoutError):
                pass


async def async_probe_stb(host: str, port: int = DEFAULT_PORT, timeout: float = 1.5) -> TotalplaySTB | None:
    """Query read-only endpoints; never send a power, channel or navigation key."""
    result = await _async_http_get(host, port, _INFO_PATH, timeout)
    if result is not None and result[0] == 200:
        identified, model = _extract_info(result[1])
        if identified:
            return TotalplaySTB(host=host, port=port, model=model)
    # Some firmware exposes its MAC but not the expected name+MAC JSON.
    # A valid device MAC on the vendor-specific path is useful confirmation.
    mac_result = await _async_http_get(host, port, _MAC_PATH, timeout)
    if mac_result is not None and mac_result[0] == 200 and _MAC.search(mac_result[1]):
        return TotalplaySTB(host=host, port=port)
    return None


async def _candidate_hosts(hass: HomeAssistant) -> set[str]:
    """Scan bounded LANs rather than an arbitrary private address range."""
    networks: set[ipaddress.IPv4Network] = {_COMMON_TOTALPLAY_NETWORK}
    for adapter in await network.async_get_adapters(hass):
        if not adapter.get("enabled", True):
            continue
        for configured in adapter.get("ipv4", []):
            try:
                address = ipaddress.ip_address(configured["address"])
                prefix = int(configured["network_prefix"])
            except (KeyError, TypeError, ValueError):
                continue
            if not isinstance(address, ipaddress.IPv4Address) or not address.is_private or address.is_loopback:
                continue
            networks.add(ipaddress.ip_network(f"{address}/{max(prefix, 24)}", strict=False))
    return {str(host) for subnet in networks for host in subnet.hosts()}


async def async_discover_stbs(hass: HomeAssistant, port: int = DEFAULT_PORT) -> list[TotalplaySTB]:
    """Apply the very same read-only probe used by manual-IP setup."""
    semaphore = asyncio.Semaphore(_MAX_CONCURRENCY)

    async def _probe(host: str) -> TotalplaySTB | None:
        async with semaphore:
            return await async_probe_stb(host, port, timeout=1.0)

    results = await asyncio.gather(*(_probe(host) for host in await _candidate_hosts(hass)))
    return sorted((item for item in results if item is not None), key=lambda item: ipaddress.ip_address(item.host))
