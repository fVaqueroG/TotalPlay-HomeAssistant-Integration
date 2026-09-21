"""Synchronize the TV input before selecting STB channels or launching apps.

A Totalplay STB is an HDMI source, not the display. We never select the source
again when the connected TV reports that the desired source is already active.
"""

import logging

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError

_LOGGER = logging.getLogger(__name__)
CONF_TV_ENTITY = "tv_entity"
CONF_TV_SOURCE = "tv_source"
_UNKNOWN = {"unknown", "unavailable", ""}


def configured_display(entry: ConfigEntry) -> tuple[str, str]:
    """Return the optional display link from user-editable entry options."""
    return (
        entry.options.get(CONF_TV_ENTITY, ""),
        entry.options.get(CONF_TV_SOURCE, ""),
    )


async def async_ensure_display_source(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Switch inputs only when the TV positively reports a different source.

    When the TV's source is unknown, do not blindly issue select_source. A
    decoder key can still be sent, though users may need to select HDMI manually.
    """
    entity_id, desired = configured_display(entry)
    if not entity_id or not desired:
        return

    state = hass.states.get(entity_id)
    if state is None or state.state in _UNKNOWN:
        _LOGGER.warning("Cannot verify Totalplay TV input: %s has no known state", entity_id)
        return
    if state.state == "off":
        _LOGGER.debug("Connected Totalplay TV %s is off; not switching its input", entity_id)
        return

    current = state.attributes.get("source")
    if not isinstance(current, str) or current.strip().casefold() in _UNKNOWN:
        _LOGGER.warning("TV %s does not report a current source; skipping input switch", entity_id)
        return
    if current.strip().casefold() == desired.strip().casefold():
        return

    sources = state.attributes.get("source_list")
    if isinstance(sources, (list, tuple)) and sources and desired not in sources:
        raise HomeAssistantError(
            f"The configured Totalplay TV source {desired!r} is not in {entity_id}'s source_list"
        )
    await hass.services.async_call(
        "media_player",
        "select_source",
        {"entity_id": entity_id, "source": desired},
        blocking=True,
    )
