"""Remote platform for the DIW362's HTTP KeyHandling endpoint."""

import asyncio
from collections.abc import Iterable
import logging
from typing import Any

import aiohttp

from homeassistant.components.remote import (
    ATTR_DELAY_SECS,
    ATTR_HOLD_SECS,
    ATTR_NUM_REPEATS,
    RemoteEntity,
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
    """Add the command-only remote."""
    async_add_entities([TotalplayRemote(entry, async_get_clientsession(hass))])


class TotalplayRemote(RemoteEntity):
    """Virtual remote: its on/off state does NOT represent STB power."""

    _attr_has_entity_name = True
    _attr_name = "Remote"
    _attr_icon = "mdi:remote-tv"
    _attr_is_on = None  # The STB power state cannot be read from the decoded API.
    _attr_should_poll = False

    def __init__(self, entry: ConfigEntry, session: aiohttp.ClientSession) -> None:
        self._host = entry.data[CONF_HOST]
        self._port = entry.data[CONF_PORT]
        self._session = session
        self._attr_unique_id = f"{DOMAIN}_{self._host}_{self._port}_remote"
        self._attr_device_info = {
            "identifiers": {(DOMAIN, f"{self._host}:{self._port}")},
            "name": "Totalplay DIW362 UHD",
            "manufacturer": "Sagemcom / Totalplay",
            "model": "DIW362 UHD",
            "configuration_url": f"http://{self._host}:{self._port}",
        }

    async def async_turn_on(self, **kwargs: Any) -> None:
        """Do not treat a power toggle as a discrete ON command."""
        raise HomeAssistantError(
            "Totalplay only provides a power toggle; use remote.send_command with on_off"
        )

    async def async_turn_off(self, **kwargs: Any) -> None:
        """Do not treat a power toggle as a discrete OFF command."""
        raise HomeAssistantError(
            "Totalplay only provides a power toggle; use remote.send_command with on_off"
        )

    async def async_send_command(
        self, command: Iterable[str], **kwargs: Any
    ) -> None:
        """Send the decoded official-app keys via local HTTP GET."""
        commands = [command] if isinstance(command, str) else list(command)
        if not commands:
            return
        try:
            keys = [normalize_key(key) for key in commands]
        except ValueError as exc:
            raise HomeAssistantError(str(exc)) from exc

        repeat = int(kwargs.get(ATTR_NUM_REPEATS, 1))
        delay = float(kwargs.get(ATTR_DELAY_SECS, 0.4))
        hold = float(kwargs.get(ATTR_HOLD_SECS, 0))
        if repeat < 1 or repeat > 50 or delay < 0 or hold:
            raise HomeAssistantError(
                "Invalid repeats/delay, or hold_secs is unsupported by this API"
            )

        url = f"http://{self._host}:{self._port}/RemoteControl/KeyHandling/sendKey"
        timeout = aiohttp.ClientTimeout(total=5)
        sequence = keys * repeat
        for index, key in enumerate(sequence):
            try:
                async with self._session.get(
                    url, params={"key": key}, timeout=timeout
                ) as response:
                    response.raise_for_status()
                    body = (await response.content.read(512)).decode(
                        "utf-8", errors="replace"
                    )
                    if "error" in body.lower():
                        _LOGGER.warning(
                            "Totalplay returned a possible API error for key %s: %s",
                            key,
                            body[:256],
                        )
            except (aiohttp.ClientError, asyncio.TimeoutError) as exc:
                raise HomeAssistantError(
                    f"Totalplay remote request failed for {key}: {exc}"
                ) from exc
            if index < len(sequence) - 1 and delay:
                await asyncio.sleep(delay)
