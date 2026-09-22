"""Remote platform for the Totalplay local HTTP KeyHandling endpoint."""

import asyncio
from collections.abc import Iterable
from typing import Any

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
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import DOMAIN, normalize_key
from .display import async_ensure_display_source
from .http import async_send_key
from .stb import device_details


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback
) -> None:
    """Add the command-only remote."""
    async_add_entities([TotalplayRemote(entry, hass)])


class TotalplayRemote(RemoteEntity):
    """Virtual remote: its on/off state does NOT represent STB power."""

    _attr_has_entity_name = True
    _attr_name = "Remote"
    _attr_icon = "mdi:remote-tv"
    _attr_is_on = None
    _attr_should_poll = False

    def __init__(self, entry: ConfigEntry, hass: HomeAssistant | None = None) -> None:
        self._entry = entry
        self._hass = hass
        self._host = entry.data[CONF_HOST]
        self._port = entry.data[CONF_PORT]
        # Preserve entity registry IDs when changing models/reconfiguring.
        self._attr_unique_id = f"{DOMAIN}_{self._host}_{self._port}_remote"
        self._attr_device_info = device_details(entry)

    async def async_turn_on(self, **kwargs: Any) -> None:
        """A power toggle cannot guarantee a discrete ON command."""
        raise HomeAssistantError(
            "Totalplay only provides a power toggle; use remote.send_command with on_off"
        )

    async def async_turn_off(self, **kwargs: Any) -> None:
        """A power toggle cannot guarantee a discrete OFF command."""
        raise HomeAssistantError(
            "Totalplay only provides a power toggle; use remote.send_command with on_off"
        )

    async def async_send_command(
        self, command: Iterable[str], **kwargs: Any
    ) -> None:
        """Check the display once per batch before sending remote keys."""
        commands = [command] if isinstance(command, str) else list(command)
        if not commands:
            return
        try:
            keys = [normalize_key(key) for key in commands]
        except ValueError as exc:
            raise HomeAssistantError(str(exc)) from exc

        try:
            repeat = int(kwargs.get(ATTR_NUM_REPEATS, 1))
            delay = float(kwargs.get(ATTR_DELAY_SECS, 0.4))
            hold = float(kwargs.get(ATTR_HOLD_SECS, 0))
        except (TypeError, ValueError) as exc:
            raise HomeAssistantError("Invalid remote repeats or delay") from exc
        if repeat < 1 or repeat > 50 or delay < 0 or hold:
            raise HomeAssistantError(
                "Invalid repeats/delay, or hold_secs is unsupported by this API"
            )

        if self._hass is not None:
            await async_ensure_display_source(self._hass, self._entry)
        sequence = keys * repeat
        for index, key in enumerate(sequence):
            await async_send_key(self._host, self._port, key)
            if index < len(sequence) - 1 and delay:
                await asyncio.sleep(delay)
