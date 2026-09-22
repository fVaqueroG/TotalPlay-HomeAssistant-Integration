"""Discovery regression tests: do not mistake cameras or generic HTTP for STBs."""

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
_TEST_MAC = "02:00:00:00:00:01"  # Fictitious locally administered address; not a user's device.
_TEST_STB = "192.168.100.55"
_TEST_CAMERA = "192.168.100.45"

_spec = importlib.util.spec_from_file_location("totalplay_stb.discovery", _COMPONENT / "discovery.py")
assert _spec and _spec.loader
_discovery = importlib.util.module_from_spec(_spec)
sys.modules["totalplay_stb.discovery"] = _discovery
_spec.loader.exec_module(_discovery)


class STBDiscoveryTests(unittest.IsolatedAsyncioTestCase):
    """An IP camera must never count as automatically verified STB discovery."""

    async def test_camera_generic_http_success_is_not_an_stb(self):
        with patch.object(_discovery, "_async_http_get", new=AsyncMock(return_value=(200, "<html>IP Camera</html>"))) as request:
            self.assertIsNone(await _discovery.async_probe_stb(_TEST_CAMERA))
            self.assertEqual(request.await_count, 1)

    async def test_camera_json_name_and_mac_are_not_an_stb(self):
        body = json.dumps({"name": "Living Room IP Camera", "mac_address": _TEST_MAC})
        with patch.object(_discovery, "_async_http_get", new=AsyncMock(return_value=(200, body))) as request:
            self.assertIsNone(await _discovery.async_probe_stb(_TEST_CAMERA))
            self.assertEqual(request.await_count, 1)

    async def test_camera_generic_mac_endpoint_is_not_positive_identity(self):
        with patch.object(_discovery, "_async_http_get", new=AsyncMock(side_effect=[(200, "IP Camera"), (200, _TEST_MAC)])) as request:
            self.assertIsNone(await _discovery.async_probe_stb(_TEST_CAMERA))
            self.assertEqual(request.await_count, 1)

    async def test_totalplay_name_and_mac_are_positive_identity(self):
        body = json.dumps({"name": "Totalplay_Test", "mac_address": _TEST_MAC, "model": "M362"})
        with patch.object(_discovery, "_async_http_get", new=AsyncMock(return_value=(200, body))) as request:
            result = await _discovery.async_probe_stb(_TEST_STB)
            self.assertEqual(result.model, "M362")
            self.assertEqual(result.host, _TEST_STB)
            self.assertEqual(request.await_count, 1)

    async def test_totalplay_name_without_mac_requires_vendor_endpoint(self):
        body = json.dumps({"name": "Totalplay_Test"})
        with patch.object(_discovery, "_async_http_get", new=AsyncMock(side_effect=[(200, body), (200, _TEST_MAC)])) as request:
            self.assertIsNotNone(await _discovery.async_probe_stb(_TEST_STB))
            self.assertEqual(request.await_count, 2)

    async def test_non_vendor_name_cannot_use_mac_fallback(self):
        body = json.dumps({"name": "IP Camera", "mac_address": _TEST_MAC})
        with patch.object(_discovery, "_async_http_get", new=AsyncMock(side_effect=[(200, body), (200, _TEST_MAC)])) as request:
            self.assertIsNone(await _discovery.async_probe_stb(_TEST_CAMERA))
            self.assertEqual(request.await_count, 1)

    async def test_non_200_is_not_identified(self):
        body = json.dumps({"name": "Totalplay_Test", "mac_address": _TEST_MAC})
        with patch.object(_discovery, "_async_http_get", new=AsyncMock(return_value=(403, body))):
            self.assertIsNone(await _discovery.async_probe_stb(_TEST_STB))


if __name__ == "__main__":
    unittest.main()
