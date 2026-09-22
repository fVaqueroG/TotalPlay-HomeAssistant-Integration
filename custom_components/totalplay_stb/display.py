"""Request the configured TV input without inspecting its current source.

The Totalplay decoder is command-only. A successful source-selection service
call means the request was accepted, not that the TV confirmed its HDMI input.
"""

import logging

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

_LOGGER = logging.getLogger(__name__)
CONF_TV_ENTITY = "tv_entity"
CONF_TV_SOURCE = "tv_source"
CONF_POWER_SWITCH = "power_switch_entity"


def configured_display(entry: ConfigEntry) -> tuple[str, str]:
    """Return the optional linked TV and desired input."""
    return (entry.options.get(CONF_TV_ENTITY, ""), entry.options.get(CONF_TV_SOURCE, ""))


def configured_power_switch(entry: ConfigEntry) -> str:
    """Return the optional switch powering the decoder."""
    return entry.options.get(CONF_POWER_SWITCH, "") or ""


async def async_ensure_display_source(hass: HomeAssistant, entry: ConfigEntry) -> str:
    """Request the configured input without checking the TV's reported source.

    Do not read the current source, poll the TV, refresh its entity, or wait for
    verification. A failed service request does not block decoder commands.
    """
    entity_id, desired = configured_display(entry)
    if not entity_id or not desired:
        return "not_configured"

    try:
        await hass.services.async_call(
            "media_player", "select_source",
            {"entity_id": entity_id, "source": desired}, blocking=True,
        )
    except Exception as exc:
        _LOGGER.warning(
            "Could not request Totalplay TV input %r on %s: %s; decoder commands continue",
            desired, entity_id, exc,
        )
        return "switch_failed"
    return "requested"
