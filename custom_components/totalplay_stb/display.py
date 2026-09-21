"""Best-effort HDMI source synchronization for a separately connected Totalplay STB.

Never select the HDMI source when already selected, the TV is off, or the TV
cannot report its active input. Failure to switch the display must not prevent
a user-requested STB channel or app command.
"""

import logging

from homeassistant.components.media_player import MediaPlayerEntityFeature
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

_LOGGER = logging.getLogger(__name__)
CONF_TV_ENTITY = "tv_entity"
CONF_TV_SOURCE = "tv_source"
_UNKNOWN = {"unknown", "unavailable", ""}


def configured_display(entry: ConfigEntry) -> tuple[str, str]:
    """Return the optional linked display and its HDMI input."""
    return (entry.options.get(CONF_TV_ENTITY, ""), entry.options.get(CONF_TV_SOURCE, ""))


async def async_ensure_display_source(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Try switching input only if the TV explicitly supports that operation."""
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

    # A TV can report its active source without offering source selection.
    # The HA service exists globally but must not be called for such an entity.
    features = state.attributes.get("supported_features", 0)
    if not isinstance(features, int) or not features & MediaPlayerEntityFeature.SELECT_SOURCE:
        _LOGGER.warning(
            "Totalplay TV %s reports source %r instead of %r but does not support "
            "media_player.select_source; choose the input manually or link an entity "
            "that supports source selection", entity_id, current, desired,
        )
        return

    sources = state.attributes.get("source_list")
    if isinstance(sources, (list, tuple)) and sources and desired not in sources:
        _LOGGER.warning(
            "Configured Totalplay TV input %r is absent from %s's source_list; "
            "not attempting an invalid source change", desired, entity_id,
        )
        return
    try:
        await hass.services.async_call(
            "media_player", "select_source",
            {"entity_id": entity_id, "source": desired}, blocking=True,
        )
    except Exception as exc:
        # The display can reject a source change even after advertising support;
        # do not turn a display failure into a failure to control the decoder.
        _LOGGER.warning(
            "Could not switch Totalplay TV %s to %r: %s. Decoder command will "
            "still be sent", entity_id, desired, exc,
        )
