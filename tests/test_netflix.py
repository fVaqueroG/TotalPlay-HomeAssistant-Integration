"""Verify TV source selection, padded channel digits and app launch without HA."""

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


class TotalplayPlayerTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.tv_entity = "media_player.living_room_tv"
        self.entry = types.SimpleNamespace(
            data={"host": "127.0.0.1", "port": 80},
            options={"tv_entity": self.tv_entity, "tv_source": "HDMI 2"},
        )
        self.tv_state = types.SimpleNamespace(
            state="on", attributes={"source": "HDMI 2", "source_list": ["HDMI 1", "HDMI 2"]}
        )
        self.hass = types.SimpleNamespace(
            states=types.SimpleNamespace(get=lambda eid: self.tv_state if eid == self.tv_entity else None),
            services=types.SimpleNamespace(async_call=AsyncMock()),
        )
        self.player = player_module.TotalplayMediaPlayer(self.hass, self.entry)

    async def _record(self, media_type, media_id):
        events = []

        async def send(host, port, key):
            events.append(("key", key))

        async def sleep(seconds):
            events.append(("sleep", seconds))

        with patch.object(player_module, "async_send_key", side_effect=send), patch.object(
            player_module.asyncio, "sleep", side_effect=sleep
        ):
            await self.player.async_play_media(media_type, media_id)
        return events

    async def test_netflix_sends_333_then_waits_then_ok(self):
        events = await self._record("app", "Netflix")
        self.assertEqual(events, [
            ("key", "3"), ("sleep", 0.1), ("key", "3"),
            ("sleep", 0.1), ("key", "3"),
            ("sleep", player_module._APP_LAUNCH_WAIT_SECS), ("key", "ok"),
        ])
        self.hass.services.async_call.assert_not_awaited()
        self.assertEqual(self.player.extra_state_attributes["last_requested_channel"], "333")

    async def test_short_channel_is_zero_padded_without_ok(self):
        events = await self._record("channel", "7")
        self.assertEqual(events, [
            ("key", "0"), ("sleep", 0.1), ("key", "0"),
            ("sleep", 0.1), ("key", "7"),
        ])
        self.assertEqual(self.player.extra_state_attributes["last_requested_channel"], "007")

    async def test_two_digit_app_channel_padded_before_ok(self):
        events = await self._record("app", "12")
        self.assertEqual(events, [
            ("key", "0"), ("sleep", 0.1), ("key", "1"),
            ("sleep", 0.1), ("key", "2"),
            ("sleep", player_module._APP_LAUNCH_WAIT_SECS), ("key", "ok"),
        ])

    async def test_three_and_four_digit_channels_unchanged(self):
        self.assertEqual(player_module._validated_channel("101"), "101")
        self.assertEqual(player_module._validated_channel("1001"), "1001")

    async def test_different_source_selected_only_once(self):
        self.tv_state.attributes["source"] = "HDMI 1"
        events = await self._record("channel", "101")
        self.hass.services.async_call.assert_awaited_once_with(
            "media_player", "select_source",
            {"entity_id": self.tv_entity, "source": "HDMI 2"}, blocking=True,
        )
        self.assertEqual([e[1] for e in events if e[0] == "key"], ["1", "0", "1"])

    async def test_unknown_source_never_switches_blindly(self):
        self.tv_state.attributes.pop("source")
        await self._record("channel", "101")
        self.hass.services.async_call.assert_not_awaited()

    async def test_bad_app_channel_is_rejected(self):
        with patch.object(player_module, "async_send_key", new_callable=AsyncMock) as sender:
            with self.assertRaisesRegex(errors.HomeAssistantError, "Channel must be"):
                await self.player.async_play_media("app", "other-app")
            sender.assert_not_awaited()


if __name__ == "__main__":
    unittest.main()
