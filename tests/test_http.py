"""Local protocol regression tests; no Home Assistant installation or STB required."""

import asyncio
import importlib.util
from pathlib import Path
import sys
import types
import unittest


# Load the transport under a lightweight stand-in for the HA error type.
_COMPONENT = Path(__file__).resolve().parents[1] / "custom_components" / "totalplay_stb"
_package = types.ModuleType("totalplay_stb")
_package.__path__ = [str(_COMPONENT)]
sys.modules.setdefault("totalplay_stb", _package)
_ha = types.ModuleType("homeassistant")
_ha_errors = types.ModuleType("homeassistant.exceptions")


class HomeAssistantError(Exception):
    """Error stand-in used to exercise the HTTP transport without HA."""


_ha_errors.HomeAssistantError = HomeAssistantError
_ha.exceptions = _ha_errors
sys.modules.setdefault("homeassistant", _ha)
sys.modules.setdefault("homeassistant.exceptions", _ha_errors)

_spec = importlib.util.spec_from_file_location("totalplay_stb.http", _COMPONENT / "http.py")
assert _spec is not None and _spec.loader is not None
_http = importlib.util.module_from_spec(_spec)
sys.modules["totalplay_stb.http"] = _http
_spec.loader.exec_module(_http)


class TotalplayHTTPTests(unittest.IsolatedAsyncioTestCase):
    """Check both tolerant header handling and real HTTP status errors."""

    async def asyncSetUp(self):
        self.keys = []
        self.status = b"HTTP/1.1 200 OK"
        self.server = await asyncio.start_server(self._respond, "127.0.0.1", 0)
        self.port = self.server.sockets[0].getsockname()[1]

    async def asyncTearDown(self):
        self.server.close()
        await self.server.wait_closed()

    async def _respond(self, reader, writer):
        try:
            line = await reader.readline()
            request_target = line.decode("ascii").split(" ")[1]
            self.keys.append(request_target.rsplit("key=", 1)[1])
            # Read the request headers, but deliberately reply with an INVALID one.
            while await reader.readline() not in (b"\r\n", b"\n", b""):
                pass
            writer.write(
                self.status
                + b"\r\nCache-Control : no-cache, private\r\n"
                + b"Content-Length: 0\r\nConnection: close\r\n\r\n"
            )
            await writer.drain()
        finally:
            writer.close()
            await writer.wait_closed()

    async def test_three_channel_digits_survive_invalid_header(self):
        for digit in "101":
            await _http.async_send_key("127.0.0.1", self.port, digit)
        self.assertEqual(self.keys, ["1", "0", "1"])

    async def test_reject_actual_http_failure_without_resending(self):
        self.status = b"HTTP/1.1 403 Forbidden"
        with self.assertRaisesRegex(HomeAssistantError, "HTTP 403"):
            await _http.async_send_key("127.0.0.1", self.port, "channel_up")
        self.assertEqual(self.keys, ["channel_up"])

    async def test_invalid_status_is_not_reported_as_success(self):
        self.status = b"NOT_HTTP"
        with self.assertRaisesRegex(HomeAssistantError, "no valid HTTP status"):
            await _http.async_send_key("127.0.0.1", self.port, "volume_up")


if __name__ == "__main__":
    unittest.main()
