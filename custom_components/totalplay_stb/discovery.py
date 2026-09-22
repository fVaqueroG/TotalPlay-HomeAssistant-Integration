"""Read-only discovery of Totalplay STBs on local IPv4 networks.

The Control APK queries getSTBInfo for the decoder's name and MAC address.
A generic HTTP 200, an unrelated device's MAC address, or a working TCP port
is never sufficient for automatic discovery. Manual IP setup can still select
an unverified box if its information endpoint is unavailable.
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
_VENDOR_NAME = re.compile(r"(?i)(?:total[\s_-]*play|\bSTB\b|\bset[ -]?top[ -]?box\b)")
_DECODER_MODEL = re.compile(r"(?i)^(?:DIW[\w.-]*|M362|(?:SAGEMCOM[\s_-]+)?(?:STB|DECODER)[\w .-]*)$")
_COMMON_TOTALPLAY_NETWORK = ipaddress.ip_network("192.168.100.0/24")
_MAX_CONCURRENCY = 32


@dataclass(frozen=True, slots=True)
class TotalplaySTB:
    """A decoder identified through recognizable device metadata."""

    host: str
    port: int
    model: str = ""


def _extract_info(body: str) -> tuple[bool, str, bool]:
    """Require a Totalplay/STB identity, not an IP camera's generic JSON.

    Returns (vendor_identity, model, valid_mac_in_info). A valid MAC on its
    own proves nothing; almost every networked device has one.
    """
    try:
        payload = json.loads(body.strip())
    except (ValueError, TypeError):
        return False, "", False
    if not isinstance(payload, dict):
        return False, "", False
    for item in (payload, payload.get("data"), payload.get("device")):
        if not isinstance(item, dict):
            continue
        name = item.get("name") or item.get("StbName") or item.get("stb_name")
        model = item.get("model") or item.get("stbModel") or item.get("modelo") or ""
        mac = item.get("mac_address") or item.get("macAddress") or item.get("mac")
        model = str(model).strip()[:80] if isinstance(model, str) else ""
        # An ordinary IP camera may return {name, mac_address}; neither field
        # establishes that it understands the Totalplay remote protocol.
        recognized = (isinstance(name, str) and bool(_VENDOR_NAME.search(name))) or bool(_DECODER_MODEL.fullmatch(model))
        if recognized:
            has_mac = isinstance(mac, str) and bool(_MAC.fullmatch(mac.strip()))
            return True, model, has_mac
    return False, "", False


async def _async_http_get(host: str, port: int, path: str, timeout: float) -> tuple[int, str] | None:
    """Read a bounded HTTP body without waiting for the socket to close.

    Totalplay devices may send malformed header lines or leave the connection
    open. This is a read-only request; response bodies are never logged.
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
        for _ in range(80):
            line = await asyncio.wait_for(reader.readline(), timeout=timeout)
            if line in (b"\r\n", b"\n", b""):
                break
        else:
            return None
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
    """Identify a decoder via its metadata; never send a remote-control key."""
    result = await _async_http_get(host, port, _INFO_PATH, timeout)
    if result is None or result[0] != 200:
        return None
    recognized, model, has_mac = _extract_info(result[1])
    if not recognized:
        return None
    if not has_mac:
        # Only a device already reporting recognizable Totalplay/STB metadata
        # may use the MAC endpoint as corroboration. MAC alone is not proof.
        mac_result = await _async_http_get(host, port, _MAC_PATH, timeout)
        if mac_result is None or mac_result[0] != 200 or not _MAC.search(mac_result[1]):
            return None
    return TotalplaySTB(host=host, port=port, model=model)


async def _candidate_hosts(hass: HomeAssistant) -> set[str]:
    """Probe bounded home LANs, never an unbounded private network."""
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
    """Run the same read-only identification used in manual-IP setup."""
    semaphore = asyncio.Semaphore(_MAX_CONCURRENCY)

    async def _probe(host: str) -> TotalplaySTB | None:
        async with semaphore:
            return await async_probe_stb(host, port, timeout=1.0)

    results = await asyncio.gather(*(_probe(host) for host in await _candidate_hosts(hass)))
    return sorted((item for item in results if item is not None), key=lambda item: ipaddress.ip_address(item.host))
