"""Command-only media player for Totalplay STBs.

The local key endpoint has no verified power, channel, playback or volume
feedback. Do not report inferred STB state as actual state.
"""

import asyncio
import re
from typing import Any

from homeassistant.components.media_player import (
    MediaPlayerEntity,
    MediaPlayerEntityFeature,
    MediaType,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import CONF_HOST, CONF_PORT
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import DOMAIN
from .display import async_ensure_display_source, configured_display
from .http import async_send_key

# The owner's DIW362 UHD uses the same app launch procedure for app channels:
# tune the numbered channel, wait for its screen, press OK. Netflix channel 333
# has been physically verified; other app numbers are supplied by the user.
_NETFLIX_CHANNEL = "333"
_CHANNEL_DIGIT_DELAY_SECS = 0.05
_MENU_EXIT_DELAY_SECS = 0.10
_APP_LAUNCH_WAIT_SECS = 5.0
_NETFLIX_LAUNCH_WAIT_SECS = _APP_LAUNCH_WAIT_SECS  # Legacy test alias.
_CHANNEL_PATTERN = re.compile(r"[0-9]{1,4}\Z")


def _validated_channel(value: str) -> str:
    """Accept only channels 1-9999 and pad those below 100 to three digits."""
    number = str(value).strip()
    if not _CHANNEL_PATTERN.fullmatch(number) or int(number) == 0:
        raise HomeAssistantError("Channel must be a number between 1 and 9999")
    return number.zfill(3)


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback
) -> None:
    """Create a media player alongside the remote entity."""
    async_add_entities([TotalplayMediaPlayer(hass, entry)])


class TotalplayMediaPlayer(MediaPlayerEntity):
    """Expose channel, volume and numbered app-launch commands."""

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
        self._last_requested_channel: str | None = None
        self._command_lock = asyncio.Lock()
        # Preserve entity registry IDs when updating from v0.2.0.
        self._attr_unique_id = f"{DOMAIN}_{self._host}_{self._port}_media_player"
        self._attr_device_info = {
            "identifiers": {(DOMAIN, f"{self._host}:{self._port}")},
            "name": "Totalplay DIW362 UHD",
            "manufacturer": "Sagemcom / Totalplay",
            "model": "DIW362 UHD",
            "configuration_url": f"http://{self._host}:{self._port}",
        }

    @property
    def extra_state_attributes(self) -> dict[str, str | None]:
        """Show requested channel and configured connection, not inferred TV state."""
        tv_entity, tv_source = configured_display(self._entry)
        return {
            "last_requested_channel": self._last_requested_channel,
            "connected_tv_entity": tv_entity or None,
            "connected_tv_source": tv_source or None,
        }

    async def _send_keys(self, keys: list[str], delay: float = 0.35) -> None:
        """Send keys sequentially, tolerating the STB's invalid HTTP headers."""
        for index, key in enumerate(keys):
            await async_send_key(self._host, self._port, key)
            if index < len(keys) - 1:
                await asyncio.sleep(delay)

    async def _prepare_for_channel_selection(self) -> None:
        """Dismiss STB menus before sending a complete channel or app number.

        A single channel_up key returns the owner's decoder to live TV even if
        the on-screen menu is open. Keep it within the command lock and allow a
        brief pause before the first digit; do not prepend it to remote key taps.
        """
        await async_ensure_display_source(self._hass, self._entry)
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
            await async_ensure_display_source(self._hass, self._entry)
            await self._send_keys(["channel_up"])

    async def async_media_previous_track(self) -> None:
        async with self._command_lock:
            await async_ensure_display_source(self._hass, self._entry)
            await self._send_keys(["channel_down"])

    async def async_media_stop(self) -> None:
        async with self._command_lock:
            await self._send_keys(["stop"])

    async def async_play_media(
        self, media_type: MediaType | str, media_id: str, **kwargs: Any
    ) -> None:
        """Tune a TV channel or open an app via its numbered launch channel.

        ``app`` accepts a channel number or backwards-compatible Netflix alias.
        It opens the app only; it does not select or play a title.
        """
        if media_type in ("app", "application"):
            app_id = str(media_id).strip()
            channel = _NETFLIX_CHANNEL if app_id.casefold() == "netflix" else _validated_channel(app_id)
            async with self._command_lock:
                await self._prepare_for_channel_selection()
                await self._send_keys(list(channel), delay=_CHANNEL_DIGIT_DELAY_SECS)
                # Sending OK while the launch screen is loading can be ignored.
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
