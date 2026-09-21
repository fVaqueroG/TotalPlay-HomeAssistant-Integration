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
from .http import async_send_key

# Confirmed on the owner's DIW362 UHD: channel 333 shows a Netflix launch
# screen, then the center D-pad / `ok` key opens Netflix. The wait allows the
# channel to tune and the app-launch screen to become ready before pressing OK.
_NETFLIX_CHANNEL = "333"
_NETFLIX_LAUNCH_WAIT_SECS = 5.0


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback
) -> None:
    """Create a media player alongside the remote entity."""
    async_add_entities([TotalplayMediaPlayer(entry)])


class TotalplayMediaPlayer(MediaPlayerEntity):
    """Expose channel, volume and confirmed Netflix launch commands."""

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

    def __init__(self, entry: ConfigEntry) -> None:
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
        """Show the last requested channel, not an unverified current channel."""
        return {"last_requested_channel": self._last_requested_channel}

    async def _send_keys(self, keys: list[str]) -> None:
        """Send keys sequentially, tolerating the STB's invalid HTTP headers."""
        for index, key in enumerate(keys):
            await async_send_key(self._host, self._port, key)
            if index < len(keys) - 1:
                await asyncio.sleep(0.35)

    async def async_volume_up(self) -> None:
        async with self._command_lock:
            await self._send_keys(["volume_up"])

    async def async_volume_down(self) -> None:
        async with self._command_lock:
            await self._send_keys(["volume_down"])

    async def async_media_next_track(self) -> None:
        async with self._command_lock:
            await self._send_keys(["channel_up"])

    async def async_media_previous_track(self) -> None:
        async with self._command_lock:
            await self._send_keys(["channel_down"])

    async def async_media_stop(self) -> None:
        async with self._command_lock:
            await self._send_keys(["stop"])

    async def async_play_media(
        self, media_type: MediaType | str, media_id: str, **kwargs: Any
    ) -> None:
        """Select a numbered TV channel, or launch Netflix via channel 333.

        The Netflix command launches its app, not an individual movie or show.
        """
        if media_type in ("app", "application"):
            if str(media_id).strip().casefold() != "netflix":
                raise HomeAssistantError("Only the Netflix app has a confirmed launch sequence")
            async with self._command_lock:
                await self._send_keys(list(_NETFLIX_CHANNEL))
                # An immediate OK can be ignored while the launch channel loads.
                await asyncio.sleep(_NETFLIX_LAUNCH_WAIT_SECS)
                await self._send_keys(["ok"])
                self._last_requested_channel = _NETFLIX_CHANNEL
                self.async_write_ha_state()
            return

        if media_type != MediaType.CHANNEL:
            raise HomeAssistantError(
                "Totalplay supports media_content_type: channel, or app with media_content_id: netflix"
            )
        channel = str(media_id).strip()
        if re.fullmatch(r"[0-9]{1,4}", channel) is None or int(channel) == 0:
            raise HomeAssistantError("Channel must be a number between 1 and 9999")
        async with self._command_lock:
            await self._send_keys(list(channel))
            self._last_requested_channel = channel
            self.async_write_ha_state()
