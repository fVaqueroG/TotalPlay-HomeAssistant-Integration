"""Discover Totalplay STBs using the read-only endpoints found in Control 1.2.28.

The official application's default discovery scans the local subnet and reads
/Application/TPNG/RemoteControl/getSTBInfo (name, mac_address), falling back to
/RemoteControl/StbInfo/getMac?if=eth0. Only HTTP identification is needed here:
probing SSH/NetBIOS/SMB ports, which the Android app also checks, would not
identify a decoder and would unnecessarily contact unrelated LAN devices.

No remote keys are sent during discovery or manual-IP verification.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
import ipaddress
import json
import re

from homeassistant.components.network import async_get_adapters
from homeassistant.core import HomeAssistant

_INFO_PATH = "/Application/TPNG/RemoteControl/getSTBInfo"
_MAC_PATH = "/RemoteControl/StbInfo/getMac?if=eth0"
_MAC = re.compile(r"(?i)\b(?:[0-9a-f]{2}:){5}[0-9a-f]{2}\b")
_STATUS = re.compile(rb"^HTTP/1\.[01] ([1-5][0-9]{2})(?:\s|$)")
_MAX_RESPONSE = 65536


@dataclass(frozen=True)
class DiscoveredSTB:
    """A decoder identified by a Totalplay-specific information endpoint."""

    host: str
    port: int
    name: str
    mac: str | None = None
    reported_model: str | None = None


async def _read_endpoint(host: str, port: int, path: str) -> str | None:
    """Read a small HTTP response without rejecting malformed STB headers.

    The decoder firmware may return e.g. 'Cache-Control : ...', which strict
    clients reject. Read-only probes can read the raw response body instead.
    """
    writer = None
    try:
        reader, writer = await asyncio.wait_for(
            asyncio.open_connection(host, port), timeout=0.9
        )
        writer.write(
            (f"GET {path} HTTP/1.0\r\nHost: {host}:{port}\r\n"
             "Connection: close\r\nAccept: application/json, */*\r\n\r\n").encode("ascii")
        )
        await asyncio.wait_for(writer.drain(), timeout=1.2)
        response = bytearray()
        while len(response) < _MAX_RESPONSE:
            part = await asyncio.wait_for(
                reader.read(min(8192, _MAX_RESPONSE - len(response))), timeout=1.2
            )
            if not part:
                break
            response.extend(part)
        header, separator, body = bytes(response).partition(b"\r\n\r\n")
        if not separator:
            header, separator, body = bytes(response).partition(b"\n\n")
        if not separator or not _STATUS.match(header.splitlines()[0]):
            return None
        status = int(_STATUS.match(header.splitlines()[0]).group(1))
        if status < 200 or status >= 300:
            return None
        return body.decode("utf-8", errors="replace").strip()
    except (OSError, asyncio.TimeoutError, UnicodeError, ValueError):
        return None
    finally:
        if writer is not None:
            writer.close()
            try:
                await asyncio.wait_for(writer.wait_closed(), timeout=0.3)
            except (OSError, asyncio.TimeoutError):
                pass


def _as_info(payload: str) -> tuple[str, str | None, str | None] | None:
    try:
        info = json.loads(payload)
    except (TypeError, ValueError):
        return None
    if not isinstance(info, dict):
        return None
    if isinstance(info.get("DeviceVO"), dict):
        info = info["DeviceVO"]
    name = info.get("name") or info.get("alias") or info.get("StbName")
    mac = info.get("mac_address") or info.get("mac")
    model = info.get("model") or info.get("stb_model")
    if not isinstance(name, str) or not name.strip():
        name = "Totalplay STB"
    if not isinstance(mac, str) or not _MAC.fullmatch(mac.strip()):
        mac = None
    if not isinstance(model, str) or not model.strip():
        model = None
    # A successful reply must contain a plausible decoder identity, not just
    # HTTP 200 or an unrelated JSON object.
    if name == "Totalplay STB" and mac is None and model is None:
        return None
    return name.strip()[:80], mac, model.strip()[:80] if model else None


async def async_probe_stb(host: str, port: int = 80) -> DiscoveredSTB | None:
    """Verify a candidate IP with exactly the same logic as manual setup."""
    address = ipaddress.ip_address(host)
    if address.version != 4 or not address.is_private or address.is_loopback:
        return None
    payload = await _read_endpoint(host, port, _INFO_PATH)
    if payload and (parsed := _as_info(payload)):
        name, mac, model = parsed
        return DiscoveredSTB(host, port, name, mac, model)
    # The official app falls back to this second vendor-specific endpoint.
    payload = await _read_endpoint(host, port, _MAC_PATH)
    match = _MAC.search(payload or "")
    if match:
        return DiscoveredSTB(host, port, "Totalplay STB", match.group(0), None)
    return None


async def async_discover_stbs(
    hass: HomeAssistant, port: int = 80, network_cidr: str = ""
) -> list[DiscoveredSTB]:
    """Probe local IPv4 subnets, or an explicitly supplied private /24 or smaller.

    A manually specified decoder IP is probed directly by async_probe_stb and
    does not need to belong to a local interface's discovered subnet.
    """
    networks: list[ipaddress.IPv4Network] = []
    if network_cidr.strip():
        network = ipaddress.ip_network(network_cidr.strip(), strict=False)
        if (network.version != 4 or not network.is_private
                or network.prefixlen < 24 or network.is_loopback):
            raise ValueError("Specify a private IPv4 subnet of /24 or smaller")
        networks.append(network)
    else:
        for adapter in await async_get_adapters(hass):
            if not adapter["enabled"]:
                continue
            for iface in adapter["ipv4"]:
                ip = ipaddress.ip_address(iface["address"])
                if not ip.is_private or ip.is_loopback:
                    continue
                prefix = max(24, int(iface["network_prefix"]))
                networks.append(ipaddress.ip_network(f"{ip}/{prefix}", strict=False))
    candidates = list(dict.fromkeys(
        str(ip) for network in networks[:4] for ip in network.hosts()
    ))
    semaphore = asyncio.Semaphore(32)

    async def probe(ip: str) -> DiscoveredSTB | None:
        async with semaphore:
            return await async_probe_stb(ip, port)

    found = await asyncio.gather(*(probe(ip) for ip in candidates))
    return sorted((device for device in found if device), key=lambda d: ipaddress.ip_address(d.host))
