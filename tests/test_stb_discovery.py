"""Discovery regression tests: do not mistake cameras or generic HTTP for STBs."""

import asyncio
import importlib.util
import json
from pathlib import Path
import sys
import types
import unittest
from unittest.mock import AsyncMock, patch

_COMPONENT = Path(__file__).resolve().parents[1] / "custom_components" / "totalplay_stb"
_pkg = sys.modules.setdefault("totalplay_stb", types.ModuleType("totalplay_stb"))
_pkg.__path__ = [str(_COMPONENT)]
_ha = sys.modules.setdefault("homeassistant", types.ModuleType("homeassistant"))
_components = sys.modules.setdefault("homeassistant.components", types.ModuleType("homeassistant.components"))
_network = sys.modules.setdefault("homeassistant.components.network", types.ModuleType("homeassistant.components.network"))
_core = sys.modules.setdefault("homeassistant.core", types.ModuleType("homeassistant.core"))
_core.HomeAssistant = type("HomeAssistant", (), {})
_components.network = _network
_ha.components = _components
_ha.core = _core

_spec = importlib.util.spec_from_file_location("totalplay_stb.discovery", _COMPONENT / "discovery.py")
assert _spec and _spec.loader
_discovery = importlib.util.module_from_spec(_spec)
sys.modules["totalplay_stb.discovery"] = _discovery
_spec.loader.exec_module(_discovery)


class STBDiscoveryTests(unittest.IsolatedAsyncioTestCase):
    """The presence of an IP camera must never count as an STB discovery."""

    async def test_camera_generic_http_success_is_not_an_stb(self):
        with patch.object(_discovery, "_async_http_get", new=AsyncMock(return_value=(200, "<html>IP Camera</html>"))) as request:
            self.assertIsNone(await _discovery.async_probe_stb("192.168.100.45"))
            self.assertEqual(request.await_count, 1)

    async def test_camera_json_name_and_mac_are_not_an_stb(self):
        body = json.dumps({"name": "Living Room IP Camera", "mac_address": "20:9a:7d:d5:8e:53"})
        with patch.object(_discovery, "_async_http_get", new=AsyncMock(return_value=(200, body))) as request:
            self.assertIsNone(await _discovery.async_probe_stb("192.168.100.45"))
            self.assertEqual(request.await_count, 1)

    async def test_camera_generic_mac_endpoint_is_not_positive_identity(self):
        with patch.object(_discovery, "_async_http_get", new=AsyncMock(side_effect=[(200, "IP Camera"), (200, "20:9a:7d:d5:8e:53")])) as request:
            self.assertIsNone(await _discovery.async_probe_stb("192.168.100.45"))
            self.assertEqual(request.await_count, 1)

    async def test_totalplay_name_and_mac_are_positive_identity(self):
        body = json.dumps({"name": "Totalplay_Sala De Estar", "mac_address": "20:9a:7d:d5:8e:53", "model": "M362"})
        with patch.object(_discovery, "_async_http_get", new=AsyncMock(return_value=(200, body))) as request:
            result = await _discovery.async_probe_stb("192.168.100.17")
            self.assertEqual(result.model, "M362")
            self.assertEqual(result.host, "192.168.100.17")
            self.assertEqual(request.await_count, 1)

    async def test_totalplay_name_without_mac_requires_vendor_endpoint(self):
        body = json.dumps({"name": "Totalplay_Sala De Estar"})
        with patch.object(_discovery, "_async_http_get", new=AsyncMock(side_effect=[(200, body), (200, "20:9a:7d:d5:8e:53")])) as request:
            self.assertIsNotNone(await _discovery.async_probe_stb("192.168.100.17"))
            self.assertEqual(request.await_count, 2)

    async def test_non_vendor_name_cannot_use_mac_fallback(self):
        body = json.dumps({"name": "IP Camera", "mac_address": "20:9a:7d:d5:8e:53"})
        with patch.object(_discovery, "_async_http_get", new=AsyncMock(side_effect=[(200, body), (200, "20:9a:7d:d5:8e:53")])) as request:
            self.assertIsNone(await _discovery.async_probe_stb("192.168.100.45"))
            self.assertEqual(request.await_count, 1)

    async def test_non_200_is_not_identified(self):
        body = json.dumps({"name": "Totalplay_Sala De Estar", "mac_address": "20:9a:7d:d5:8e:53"})
        with patch.object(_discovery, "_async_http_get", new=AsyncMock(return_value=(403, body))):
            self.assertIsNone(await _discovery.async_probe_stb("192.168.100.17"))


if __name__ == "__main__":
    unittest.main()
