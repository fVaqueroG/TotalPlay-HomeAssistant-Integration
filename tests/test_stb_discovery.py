"""Tests for discovery recovered from the original Totalplay Control APK."""

import asyncio
import importlib.util
from pathlib import Path
import sys
import types
import unittest
from unittest.mock import AsyncMock, patch


ROOT = Path(__file__).resolve().parents[1] / "custom_components" / "totalplay_stb"


def _load_discovery():
    """Load the discovery module without installing Home Assistant in CI."""
    fake_ha = types.ModuleType("homeassistant")
    fake_components = types.ModuleType("homeassistant.components")
    fake_network = types.ModuleType("homeassistant.components.network")
    fake_network.async_get_adapters = AsyncMock(return_value=[])
    fake_core = types.ModuleType("homeassistant.core")
    fake_core.HomeAssistant = type("HomeAssistant", (), {})
    name = "totalplay_discovery_under_test"
    spec = importlib.util.spec_from_file_location(name, ROOT / "discovery.py")
    module = importlib.util.module_from_spec(spec)
    with patch.dict(sys.modules, {
        "homeassistant": fake_ha,
        "homeassistant.components": fake_components,
        "homeassistant.components.network": fake_network,
        "homeassistant.core": fake_core,
        name: module,
    }):
        spec.loader.exec_module(module)
    return module


class DiscoveryTests(unittest.IsolatedAsyncioTestCase):
    @classmethod
    def setUpClass(cls):
        cls.discovery = _load_discovery()

    async def test_manual_ip_uses_info_endpoint_even_on_other_subnet(self):
        d = self.discovery
        async def fake_response(host, port, path):
            self.assertEqual((host, port), ("192.168.100.17", 80))
            self.assertEqual(path, d._INFO_PATH)
            return '{"name":"Sala de Estar","mac_address":"20:9a:7d:d5:8e:53"}'
        with patch.object(d, "_read_endpoint", side_effect=fake_response):
            result = await d.async_probe_stb("192.168.100.17", 80)
        self.assertEqual(result.name, "Sala de Estar")
        self.assertEqual(result.mac, "20:9a:7d:d5:8e:53")

    async def test_same_mac_fallback_for_discovery_and_manual_ip(self):
        d = self.discovery
        async def fake_response(host, port, path):
            return None if path == d._INFO_PATH else "20:9a:7d:d5:8e:53"
        with patch.object(d, "_read_endpoint", side_effect=fake_response):
            result = await d.async_probe_stb("192.168.100.17")
        self.assertEqual(result.mac, "20:9a:7d:d5:8e:53")
        self.assertEqual(result.name, "Totalplay STB")

    async def test_unrelated_http_200_is_not_a_decoder(self):
        d = self.discovery
        with patch.object(d, "_read_endpoint", AsyncMock(return_value='{"hello":"world"}')):
            self.assertIsNone(await d.async_probe_stb("192.168.100.17"))

    async def test_auto_scan_uses_actual_interface_subnet(self):
        d = self.discovery
        mock_adapters = AsyncMock(return_value=[{
            "enabled": True,
            "ipv4": [{"address": "192.168.100.20", "network_prefix": 28}],
        }])
        async def fake_probe(host, port):
            return d.DiscoveredSTB(host, port, "Sala") if host == "192.168.100.17" else None
        with patch.object(d, "async_get_adapters", mock_adapters), patch.object(
            d, "async_probe_stb", side_effect=fake_probe
        ) as probe:
            devices = await d.async_discover_stbs(object())
        self.assertEqual([device.host for device in devices], ["192.168.100.17"])
        self.assertEqual(probe.call_count, 14)

    async def test_explicit_subnet_can_be_different_from_home_assistant(self):
        d = self.discovery
        async def fake_probe(host, port):
            return d.DiscoveredSTB(host, port, "Sala") if host == "192.168.100.17" else None
        with patch.object(d, "async_get_adapters", AsyncMock(side_effect=AssertionError(
            "Explicit subnet must not depend on HA adapters"
        ))), patch.object(d, "async_probe_stb", side_effect=fake_probe):
            devices = await d.async_discover_stbs(object(), 80, "192.168.100.16/28")
        self.assertEqual(devices[0].host, "192.168.100.17")

    async def test_reject_broad_or_public_subnet(self):
        d = self.discovery
        with self.assertRaises(ValueError):
            await d.async_discover_stbs(object(), 80, "192.168.0.0/16")
        with self.assertRaises(ValueError):
            await d.async_discover_stbs(object(), 80, "8.8.8.0/24")

    async def test_malformed_header_is_accepted_for_info_read(self):
        d = self.discovery
        async def server(reader, writer):
            await reader.readuntil(b"\r\n\r\n")
            writer.write(b"HTTP/1.1 200 OK\r\nCache-Control : no-cache\r\nConnection: close\r\n\r\n"
                         b'{"name":"Sala","mac_address":"20:9a:7d:d5:8e:53"}')
            await writer.drain()
            writer.close()
        listener = await asyncio.start_server(server, "127.0.0.1", 0)
        try:
            port = listener.sockets[0].getsockname()[1]
            result = await d._read_endpoint("127.0.0.1", port, d._INFO_PATH)
            self.assertIn('"name":"Sala"', result)
        finally:
            listener.close()
            await listener.wait_closed()


if __name__ == "__main__":
    unittest.main()
