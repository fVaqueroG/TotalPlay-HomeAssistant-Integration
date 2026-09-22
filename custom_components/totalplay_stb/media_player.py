"""Command-only media player for Totalplay STBs.

The decoder remote has no verified playback, channel, power, or volume feedback.
The linked TV's reported HDMI source is observed independently of STB commands.
"""

import asyncio
import re
import time
from typing import Any

from homeassistant.components.media_player import (
    MediaPlayerEntity,
    MediaPlayerEntityFeature,
    MediaType,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import CONF_HOST, CONF_PORT
from homeassistant.core import HomeAssistant, callback
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.event import async_track_state_change_event

from .const import CONF_MODEL, DOMAIN, UNKNOWN_MODEL
from .display import (
    async_ensure_display_source,
    configured_display,
    configured_power_switch,
    observed_display_status,
)
from .http import async_send_key

_NETFLIX_CHANNEL = "333"
_CHANNEL_DIGIT_DELAY_SECS = 0.05
_MENU_EXIT_DELAY_SECS = 0.10
_APP_LAUNCH_WAIT_SECS = 5.0
_NETFLIX_LAUNCH_WAIT_SECS = _APP_LAUNCH_WAIT_SECS
_CHANNEL_PATTERN = re.compile(r"[0-9]{1,4}\Z")
_SOURCE_RETRY_INTERVAL_SECS = 15.0


def _validated_channel(value: str) -> str:
    number = str(value).strip()
    if not _CHANNEL_PATTERN.fullmatch(number) or int(number) == 0:
        raise HomeAssistantError("Channel must be a number between 1 and 9999")
    return number.zfill(3)


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback
) -> None:
    async_add_entities([TotalplayMediaPlayer(hass, entry)])


class TotalplayMediaPlayer(MediaPlayerEntity):
    _attr_has_entity_name = True
    _attr_name = "Media Player"
    _attr_icon = "mdi:set-top-box"
    _attr_should_poll = False
    _attr_assumed_state = True
    _attr_state = None
    _attr_supported_features = (
        MediaPlayerEntityFeature.PLAY_MEDIA
        | MediaPlayerEntityFeature.VOLUME_STEP
        | MediaPlayerEntityFeature.NEXT_TRACK
        | MediaPlayerEntityFeature.PREVIOUS_TRACK
        | MediaPlayerEntityFeature.STOP
    )

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        self._hass = hass
        self._entry = entry
        self._host = entry.data[CONF_HOST]
        self._port = entry.data[CONF_PORT]
        self._model = entry.data.get(CONF_MODEL, UNKNOWN_MODEL)
        self._last_requested_channel: str | None = None
        self._last_tv_input_check = "not_checked"
        self._last_tv_input_request_time = 0.0
        self._command_lock = asyncio.Lock()
        self._attr_unique_id = f"{DOMAIN}_{self._host}_{self._port}_media_player"
        self._attr_device_info = {
            "identifiers": {(DOMAIN, f"{self._host}:{self._port}")},
            "name": f"Totalplay {self._model}",
            "manufacturer": "Totalplay",
            "model": self._model,
            "configuration_url": f"http://{self._host}:{self._port}",
        }

    async def async_added_to_hass(self) -> None:
        """Follow delayed HDMI-source reports from the configured *physical* TV."""
        await super().async_added_to_hass()
        tv_entity, _ = configured_display(self._entry)
        if tv_entity:
            self.async_on_remove(async_track_state_change_event(
                self._hass, [tv_entity], self._linked_tv_changed
            ))
            self._update_linked_tv_status(self._hass.states.get(tv_entity))

    @callback
    def _linked_tv_changed(self, event) -> None:
        self._update_linked_tv_status(event.data.get("new_state"))

    @callback
    def _update_linked_tv_status(self, state) -> None:
        """Reconcile a later TV state; never leave stale 'unconfirmed' feedback."""
        tv_entity, target = configured_display(self._entry)
        if not tv_entity or not target:
            return
        result = observed_display_status(state, target)
        if result == "source_unknown":
            # A TV that reports no source cannot confirm a previous command.
            # Preserve the pending warning, but revoke old verified feedback.
            if self._last_tv_input_check != "verified":
                return
        if result == "tv_unavailable" and self._last_tv_input_check == "not_checked":
            return
        if result != self._last_tv_input_check:
            self._last_tv_input_check = result
            self.async_write_ha_state()

    @property
    def extra_state_attributes(self) -> dict[str, str | None]:
        tv_entity, tv_source = configured_display(self._entry)
        return {
            "stb_model": self._model,
            "last_requested_channel": self._last_requested_channel,
            "connected_tv_entity": tv_entity or None,
            "connected_tv_source": tv_source or None,
            "connected_power_switch_entity": configured_power_switch(self._entry) or None,
            "tv_input_check": self._last_tv_input_check,
        }

    async def _send_keys(self, keys: list[str], delay: float = 0.35) -> None:
        for index, key in enumerate(keys):
            await async_send_key(self._host, self._port, key)
            if index < len(keys) - 1:
                await asyncio.sleep(delay)

    async def _ensure_tv_input(self) -> None:
        tv_entity, target = configured_display(self._entry)
        if tv_entity and target:
            observed = observed_display_status(self._hass.states.get(tv_entity), target)
            if observed == "verified":
                self._last_tv_input_check = "verified"
                self.async_write_ha_state()
                return
            # Do not send a new HDMI command for every channel change while a
            # just-requested input is still awaiting feedback from the TV.
            if self._last_tv_input_check == "switch_unconfirmed" and (
                time.monotonic() - self._last_tv_input_request_time
                < _SOURCE_RETRY_INTERVAL_SECS
            ) and observed == "source_unknown":
                return

        self._last_tv_input_request_time = time.monotonic()
        self._last_tv_input_check = "checking"
        self.async_write_ha_state()
        result = await async_ensure_display_source(self._hass, self._entry)
        if tv_entity and target and observed_display_status(
            self._hass.states.get(tv_entity), target
        ) == "verified":
            result = "verified"
        self._last_tv_input_check = result
        self.async_write_ha_state()

    async def _prepare_for_channel_selection(self) -> None:
        await self._ensure_tv_input()
        await self._send_keys(["channel_up"])
        await asyncio.sleep(_MENU_EXIT_DELAY_SECS)

    async def async_volume_up(self) -> None:
        async with self._command_lock:
            await self._send_keys(["volume_up"])

    async def async_volume_down(self) -> None:
        async with self._command_lock:
            await self._send_keys(["volume_down"])

    async def async_media_next_track(self) -> None:
        async with self._command_lock:
            await self._ensure_tv_input()
            await self._send_keys(["channel_up"])

    async def async_media_previous_track(self) -> None:
        async with self._command_lock:
            await self._ensure_tv_input()
            await self._send_keys(["channel_down"])

    async def async_media_stop(self) -> None:
        async with self._command_lock:
            await self._send_keys(["stop"])

    async def async_play_media(
        self, media_type: MediaType | str, media_id: str, **kwargs: Any
    ) -> None:
        if media_type in ("app", "application"):
            app_id = str(media_id).strip()
            channel = _NETFLIX_CHANNEL if app_id.casefold() == "netflix" else _validated_channel(app_id)
            async with self._command_lock:
                await self._prepare_for_channel_selection()
                await self._send_keys(list(channel), delay=_CHANNEL_DIGIT_DELAY_SECS)
                await asyncio.sleep(_APP_LAUNCH_WAIT_SECS)
                await self._send_keys(["ok"])
                self._last_requested_channel = channel
                self.async_write_ha_state()
            return

        if media_type != MediaType.CHANNEL:
            raise HomeAssistantError(
                "Use media_content_type: channel for TV, or app with its numeric launch channel"
            )
        channel = _validated_channel(media_id)
        async with self._command_lock:
            await self._prepare_for_channel_selection()
            await self._send_keys(list(channel), delay=_CHANNEL_DIGIT_DELAY_SECS)
            self._last_requested_channel = channel
            self.async_write_ha_state()
