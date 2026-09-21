"""Verify the confirmed Netflix launch sequence without a running Home Assistant."""

import asyncio
from enum import Enum
import importlib.util
from pathlib import Path
import sys
import types
import unittest
from unittest.mock import AsyncMock, patch

_COMPONENT = Path(__file__).resolve().parents[1] / "custom_components" / "totalplay_stb"


def _module(name):
    module = sys.modules.get(name)
    if module is None:
        module = types.ModuleType(name)
        if name == "totalplay_stb":
            module.__path__ = [str(_COMPONENT)]
        sys.modules[name] = module
    return module


_module("totalplay_stb")
_module("homeassistant")
_module("homeassistant.components")
player_api = _module("homeassistant.components.media_player")
_module("homeassistant.config_entries").ConfigEntry = type("ConfigEntry", (), {})
constants = _module("homeassistant.const")
constants.CONF_HOST = "host"
constants.CONF_PORT = "port"
_module("homeassistant.core").HomeAssistant = type("HomeAssistant", (), {})
errors = _module("homeassistant.exceptions")
if not hasattr(errors, "HomeAssistantError"):
    errors.HomeAssistantError = type("HomeAssistantError", (Exception,), {})
_module("homeassistant.helpers")
_module("homeassistant.helpers.entity_platform").AddEntitiesCallback = object


class MediaType(str, Enum):
    CHANNEL = "channel"


class Features:
    PLAY_MEDIA = 1
    VOLUME_STEP = 2
    NEXT_TRACK = 4
    PREVIOUS_TRACK = 8
    STOP = 16


class Entity:
    def async_write_ha_state(self):
        pass


player_api.MediaType = MediaType
player_api.MediaPlayerEntityFeature = Features
player_api.MediaPlayerEntity = Entity
spec = importlib.util.spec_from_file_location(
    "totalplay_stb.media_player", _COMPONENT / "media_player.py"
)
assert spec is not None and spec.loader is not None
player_module = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = player_module
spec.loader.exec_module(player_module)


class NetflixLaunchTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        entry = types.SimpleNamespace(data={"host": "127.0.0.1", "port": 80})
        self.player = player_module.TotalplayMediaPlayer(entry)

    async def test_netflix_sends_333_then_waits_then_ok(self):
        events = []

        async def send(host, port, key):
            events.append(("key", key))

        async def sleep(seconds):
            events.append(("sleep", seconds))

        with patch.object(player_module, "async_send_key", side_effect=send), patch.object(
            player_module.asyncio, "sleep", side_effect=sleep
        ):
            await self.player.async_play_media("app", "Netflix")

        self.assertEqual(
            events,
            [
                ("key", "3"),
                ("sleep", 0.35),
                ("key", "3"),
                ("sleep", 0.35),
                ("key", "3"),
                ("sleep", player_module._NETFLIX_LAUNCH_WAIT_SECS),
                ("key", "ok"),
            ],
        )
        self.assertEqual(self.player.extra_state_attributes["last_requested_channel"], "333")

    async def test_regular_channel_still_sends_digits_without_ok(self):
        sender = AsyncMock()
        with patch.object(player_module, "async_send_key", sender), patch.object(
            player_module.asyncio, "sleep", new_callable=AsyncMock
        ):
            await self.player.async_play_media("channel", "101")
        self.assertEqual([args.args[2] for args in sender.await_args_list], ["1", "0", "1"])

    async def test_unsupported_app_cannot_trigger_arbitrary_commands(self):
        with patch.object(player_module, "async_send_key", new_callable=AsyncMock) as sender:
            with self.assertRaisesRegex(errors.HomeAssistantError, "Only the Netflix app"):
                await self.player.async_play_media("app", "other-app")
            sender.assert_not_awaited()


if __name__ == "__main__":
    unittest.main()
