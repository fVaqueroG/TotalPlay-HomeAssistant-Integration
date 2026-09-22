"""Discovery and identification helpers for Totalplay STBs.

The Totalplay Control 1.2.28 APK references Android NsdManager plus DHCP and
network-interface enumeration, then uses the local getSTBInfo HTTP endpoint.
Home Assistant cannot use Android's NsdManager, so we reproduce the verifiable
network logic: enumerate reachable private IPv4 LANs and identify candidates
with the same getSTBInfo probe used for manually entered addresses.
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
_STATUS_LINE = re.compile(rb"^HTTP/1\.[01] ([1-5][0-9]{2})(?:[ \t\r\n]|$)")
_MODEL_PATTERNS = (
    re.compile(r'(?i)"(?:model|modelo|stbmodel|stb_model|modelname)"\s*:\s*"([^"]+)"'),
    re.compile(r"(?i)(?:model|modelo|stbmodel|stb_model|modelname)\s*[=:]\s*([A-Za-z0-9._ -]{2,40})"),
)
_COMMON_TOTALPLAY_NETWORK = ipaddress.ip_network("192.168.100.0/24")
_MAX_CONCURRENCY = 48


@dataclass(frozen=True, slots=True)
class TotalplaySTB:
    """A decoder positively identified through the Totalplay info endpoint."""

    host: str
    port: int
    model: str = ""


def _extract_model(body: str) -> str:
    """Best-effort model extraction without depending on one firmware format."""
    text = body.strip()
    if not text:
        return ""
    try:
        payload = json.loads(text)
    except (ValueError, TypeError):
        payload = None
    if isinstance(payload, dict):
        for key, value in payload.items():
            normalized = str(key).replace("_", "").casefold()
            if normalized in {"model", "modelo", "stbmodel", "modelname"} and value:
                return str(value).strip()[:80]
    for pattern in _MODEL_PATTERNS:
        if match := pattern.search(text):
            return match.group(1).strip().strip(",;}")[:80]
    # Known Totalplay model strings are often embedded in a larger response.
    if match := re.search(r"\b(?:DIW)?M?362(?:\s+UHD)?\b", text, re.I):
        return match.group(0).upper().replace("M362", "M362")
    return ""


async def async_probe_stb(host: str, port: int = DEFAULT_PORT, timeout: float = 1.5) -> TotalplaySTB | None:
    """Identify one address using Totalplay's getSTBInfo request."""
    writer: asyncio.StreamWriter | None = None
    try:
        reader, writer = await asyncio.wait_for(asyncio.open_connection(host, port), timeout=timeout)
        request = (
            f"GET {_INFO_PATH} HTTP/1.1\r\n"
            f"Host: {host}:{port}\r\n"
            "Connection: close\r\n"
            "Accept: */*\r\n\r\n"
        ).encode("ascii")
        writer.write(request)
        await asyncio.wait_for(writer.drain(), timeout=timeout)
        first = await asyncio.wait_for(reader.readline(), timeout=timeout)
        match = _STATUS_LINE.match(first)
        if not match or not 200 <= int(match.group(1)) < 300:
            return None
        payload = first + await asyncio.wait_for(reader.read(65536), timeout=timeout)
    except (OSError, asyncio.TimeoutError, ValueError):
        return None
    finally:
        if writer is not None:
            writer.close()
            try:
                await asyncio.wait_for(writer.wait_closed(), timeout=0.5)
            except (OSError, asyncio.TimeoutError):
                pass

    body = payload.split(b"\r\n\r\n", 1)[-1].decode("utf-8", "replace")
    return TotalplaySTB(host=host, port=port, model=_extract_model(body))


async def _candidate_hosts(hass: HomeAssistant) -> set[str]:
    """Build a bounded host list from HA LAN adapters plus Totalplay's common STB LAN."""
    candidates: set[str] = set()
    networks: set[ipaddress.IPv4Network] = {_COMMON_TOTALPLAY_NETWORK}
    for adapter in await network.async_get_adapters(hass):
        for configured in adapter.get("ipv4", []):
            try:
                address = ipaddress.ip_address(configured["address"])
                prefix = int(configured["network_prefix"])
            except (KeyError, TypeError, ValueError):
                continue
            if not isinstance(address, ipaddress.IPv4Address) or not address.is_private or address.is_loopback:
                continue
            # Never fan out across a huge corporate/VPN network. Android's app uses
            # the active LAN; /24 gives the same practical local-neighbour scope.
            scan_prefix = max(prefix, 24)
            networks.add(ipaddress.ip_network(f"{address}/{scan_prefix}", strict=False))

    for subnet in networks:
        candidates.update(str(host) for host in subnet.hosts())
    return candidates


async def async_discover_stbs(hass: HomeAssistant, port: int = DEFAULT_PORT) -> list[TotalplaySTB]:
    """Find Totalplay decoders by probing candidate LAN addresses concurrently."""
    semaphore = asyncio.Semaphore(_MAX_CONCURRENCY)

    async def _probe(host: str) -> TotalplaySTB | None:
        async with semaphore:
            return await async_probe_stb(host, port, timeout=0.7)

    results = await asyncio.gather(*(_probe(host) for host in await _candidate_hosts(hass)))
    return sorted((item for item in results if item is not None), key=lambda item: ipaddress.ip_address(item.host))
