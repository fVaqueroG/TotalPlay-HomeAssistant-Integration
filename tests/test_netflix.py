"""Verify TV source selection, menu escape, padded channel digits and app launch without HA."""

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
    SELECT_SOURCE = 32


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

_MENU_ESCAPE = [
    ("key", "channel_up"), ("sleep", player_module._MENU_EXIT_DELAY_SECS)
]


class TotalplayPlayerTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.tv_entity = "media_player.living_room_tv"
        self.entry = types.SimpleNamespace(
            data={"host": "127.0.0.1", "port": 80},
            options={"tv_entity": self.tv_entity, "tv_source": "HDMI 2"},
        )
        self.tv_state = types.SimpleNamespace(
            state="on", attributes={
                "source": "HDMI 2", "source_list": ["HDMI 1", "HDMI 2"],
                "supported_features": Features.SELECT_SOURCE,
            }
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

    async def test_netflix_exits_menu_sends_333_then_waits_then_ok(self):
        events = await self._record("app", "Netflix")
        self.assertEqual(events, _MENU_ESCAPE + [
            ("key", "3"), ("sleep", 0.05), ("key", "3"),
            ("sleep", 0.05), ("key", "3"),
            ("sleep", player_module._APP_LAUNCH_WAIT_SECS), ("key", "ok"),
        ])
        self.hass.services.async_call.assert_not_awaited()
        self.assertEqual(self.player.extra_state_attributes["last_requested_channel"], "333")
        self.assertEqual(self.player.extra_state_attributes["tv_input_check"], "verified")

    async def test_short_channel_exits_menu_and_zero_pads_without_ok(self):
        events = await self._record("channel", "7")
        self.assertEqual(events, _MENU_ESCAPE + [
            ("key", "0"), ("sleep", 0.05), ("key", "0"),
            ("sleep", 0.05), ("key", "7"),
        ])
        self.assertEqual(self.player.extra_state_attributes["last_requested_channel"], "007")

    async def test_two_digit_app_channel_padded_before_ok(self):
        events = await self._record("app", "12")
        self.assertEqual(events, _MENU_ESCAPE + [
            ("key", "0"), ("sleep", 0.05), ("key", "1"),
            ("sleep", 0.05), ("key", "2"),
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
        self.assertEqual([e[1] for e in events if e[0] == "key"], ["channel_up", "1", "0", "1"])
        self.assertEqual(self.player.extra_state_attributes["tv_input_check"], "switch_unconfirmed")

    async def test_source_switch_is_verified_after_tv_reports_input(self):
        self.tv_state.attributes["source"] = "HDMI 1"

        async def select(*args, **kwargs):
            self.tv_state.attributes["source"] = "HDMI 2"

        self.hass.services.async_call.side_effect = select
        events = await self._record("channel", "101")
        self.assertEqual(events[:2], _MENU_ESCAPE)
        self.assertEqual(self.player.extra_state_attributes["tv_input_check"], "verified")

    async def test_unsupported_source_selection_does_not_block_channel(self):
        self.tv_state.attributes["source"] = "HDMI 1"
        self.tv_state.attributes["supported_features"] = 0
        events = await self._record("channel", "101")
        self.hass.services.async_call.assert_not_awaited()
        self.assertEqual([e[1] for e in events if e[0] == "key"], ["channel_up", "1", "0", "1"])
        self.assertEqual(self.player.extra_state_attributes["tv_input_check"], "switch_unsupported")

    async def test_source_selection_service_rejection_does_not_block_app(self):
        self.tv_state.attributes["source"] = "HDMI 1"
        self.hass.services.async_call.side_effect = errors.HomeAssistantError("select_source unsupported")
        events = await self._record("app", "netflix")
        self.hass.services.async_call.assert_awaited_once()
        self.assertEqual([e[1] for e in events if e[0] == "key"], ["channel_up", "3", "3", "3", "ok"])
        self.assertEqual(self.player.extra_state_attributes["tv_input_check"], "switch_failed")

    async def test_unknown_source_requests_configured_hdmi_when_supported(self):
        self.tv_state.attributes.pop("source")
        events = await self._record("channel", "101")
        self.hass.services.async_call.assert_awaited_once_with(
            "media_player", "select_source",
            {"entity_id": self.tv_entity, "source": "HDMI 2"}, blocking=True,
        )
        self.assertEqual([e[1] for e in events if e[0] == "key"], ["channel_up", "1", "0", "1"])
        self.assertEqual(self.player.extra_state_attributes["tv_input_check"], "switch_unconfirmed")

    async def test_unlisted_source_is_not_sent_to_tv(self):
        self.tv_state.attributes["source"] = "HDMI 1"
        self.entry.options["tv_source"] = "HDMI 4"
        await self._record("channel", "101")
        self.hass.services.async_call.assert_not_awaited()
        self.assertEqual(self.player.extra_state_attributes["tv_input_check"], "source_not_listed")

    async def test_optional_power_switch_is_exposed_without_toggling_it(self):
        self.entry.options["power_switch_entity"] = "switch.totalplay_smart_plug"
        await self._record("channel", "101")
        self.assertEqual(self.player.extra_state_attributes["connected_power_switch_entity"],
                         "switch.totalplay_smart_plug")
        self.assertEqual([call.args[:2] for call in self.hass.services.async_call.await_args_list], [],
                         "Channel tune must not cut power or assume the decoder has booted")

    async def test_remote_step_does_not_send_extra_menu_escape(self):
        with patch.object(player_module, "async_send_key", new_callable=AsyncMock) as sender:
            await self.player.async_media_next_track()
            sender.assert_awaited_once_with("127.0.0.1", 80, "channel_up")

    async def test_volume_command_does_not_send_menu_escape(self):
        with patch.object(player_module, "async_send_key", new_callable=AsyncMock) as sender:
            await self.player.async_volume_up()
            sender.assert_awaited_once_with("127.0.0.1", 80, "volume_up")

    async def test_bad_app_channel_is_rejected_without_changing_channels(self):
        with patch.object(player_module, "async_send_key", new_callable=AsyncMock) as sender:
            with self.assertRaisesRegex(errors.HomeAssistantError, "Channel must be"):
                await self.player.async_play_media("app", "other-app")
            sender.assert_not_awaited()


if __name__ == "__main__":
    unittest.main()
