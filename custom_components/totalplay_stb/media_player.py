"""Command-only media player for Totalplay STBs.

The decoded HTTP protocol does not currently expose trustworthy power, channel,
playback, or volume feedback. Never present an inferred value as real STB state.
"""

import asyncio
import logging
import re
from typing import Any

import aiohttp

from homeassistant.components.media_player import (
    MediaPlayerEntity,
    MediaPlayerEntityFeature,
    MediaType,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import CONF_HOST, CONF_PORT
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import DOMAIN, normalize_key

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback
) -> None:
    """Create a media player alongside the existing remote entity."""
    async_add_entities([TotalplayMediaPlayer(entry, async_get_clientsession(hass))])


class TotalplayMediaPlayer(MediaPlayerEntity):
    """Expose channel and volume commands without pretending to know STB state."""

    _attr_has_entity_name = True
    _attr_name = "Media Player"
    _attr_icon = "mdi:set-top-box"
    _attr_should_poll = False
    _attr_assumed_state = True
    # State is deliberately unknown: HTTP reachability does not prove power is on.
    _attr_state = None
    _attr_supported_features = (
        MediaPlayerEntityFeature.PLAY_MEDIA
        | MediaPlayerEntityFeature.VOLUME_STEP
        | MediaPlayerEntityFeature.NEXT_TRACK
        | MediaPlayerEntityFeature.PREVIOUS_TRACK
        | MediaPlayerEntityFeature.STOP
    )

    def __init__(self, entry: ConfigEntry, session: aiohttp.ClientSession) -> None:
        """Set up the HTTP command target."""
        self._host = entry.data[CONF_HOST]
        self._port = entry.data[CONF_PORT]
        self._session = session
        self._last_requested_channel: str | None = None
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
        """Report requested channel separately from actual channel feedback."""
        return {"last_requested_channel": self._last_requested_channel}

    async def _send_keys(self, keys: list[str]) -> None:
        """Send a verified key name using the endpoint recovered from the app."""
        url = f"http://{self._host}:{self._port}/RemoteControl/KeyHandling/sendKey"
        timeout = aiohttp.ClientTimeout(total=5)
        for index, key in enumerate(keys):
            normalized_key = normalize_key(key)
            try:
                async with self._session.get(
                    url, params={"key": normalized_key}, timeout=timeout
                ) as response:
                    response.raise_for_status()
                    body = (await response.content.read(512)).decode(
                        "utf-8", errors="replace"
                    )
                    if "error" in body.lower():
                        _LOGGER.warning(
                            "Totalplay returned a possible API error for key %s: %s",
                            normalized_key,
                            body[:256],
                        )
            except (aiohttp.ClientError, asyncio.TimeoutError) as exc:
                raise HomeAssistantError(
                    f"Totalplay media-player request failed for {normalized_key}: {exc}"
                ) from exc
            if index < len(keys) - 1:
                await asyncio.sleep(0.35)

    async def async_volume_up(self) -> None:
        """Increase STB volume by one remote-button press."""
        await self._send_keys(["volume_up"])

    async def async_volume_down(self) -> None:
        """Decrease STB volume by one remote-button press."""
        await self._send_keys(["volume_down"])

    async def async_media_next_track(self) -> None:
        """Move to the next TV channel (the decoder has no track concept)."""
        await self._send_keys(["channel_up"])

    async def async_media_previous_track(self) -> None:
        """Move to the previous TV channel."""
        await self._send_keys(["channel_down"])

    async def async_media_stop(self) -> None:
        """Send the decoder's Stop key (where the current screen supports it)."""
        await self._send_keys(["stop"])

    async def async_play_media(
        self, media_type: MediaType | str, media_id: str, **kwargs: Any
    ) -> None:
        """Select a numbered TV channel by sending its digits, without OK.

        This is not URL streaming, nor confirmation of the currently tuned channel.
        """
        if media_type != MediaType.CHANNEL:
            raise HomeAssistantError("Totalplay supports only media_content_type: channel")
        channel = str(media_id).strip()
        if re.fullmatch(r"[0-9]{1,4}", channel) is None or int(channel) == 0:
            raise HomeAssistantError("Channel must be a number between 1 and 9999")
        await self._send_keys(list(channel))
        self._last_requested_channel = channel
        self.async_write_ha_state()
