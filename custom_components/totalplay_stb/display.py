"""Best-effort input synchronization for a TV connected to the Totalplay STB.

Only switch to a *configured* source when supported. An unavailable or
uncontrollable TV does not prevent the user from sending decoder commands.
The result explicitly reports whether the HDMI input was verified.
"""

import asyncio
import logging

from homeassistant.components.media_player import MediaPlayerEntityFeature
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

_LOGGER = logging.getLogger(__name__)
CONF_TV_ENTITY = "tv_entity"
CONF_TV_SOURCE = "tv_source"
CONF_POWER_SWITCH = "power_switch_entity"
_UNKNOWN = {"unknown", "unavailable", ""}


def configured_display(entry: ConfigEntry) -> tuple[str, str]:
    """Return optional linked display and HDMI input."""
    return (entry.options.get(CONF_TV_ENTITY, ""), entry.options.get(CONF_TV_SOURCE, ""))


def configured_power_switch(entry: ConfigEntry) -> str:
    """Return an optional HA switch powering the decoder, if configured."""
    return entry.options.get(CONF_POWER_SWITCH, "") or ""


def _same_source(actual: str, desired: str) -> bool:
    return actual.strip().casefold() == desired.strip().casefold()


async def async_ensure_display_source(hass: HomeAssistant, entry: ConfigEntry) -> str:
    """Check the TV input before tuning, select it if supported, then verify.

    Return a status string suitable for display on the decoder media_player.
    Never claim switching succeeded simply because a service call returned.
    """
    entity_id, desired = configured_display(entry)
    if not entity_id or not desired:
        return "not_configured"

    state = hass.states.get(entity_id)
    if state is None or state.state in _UNKNOWN:
        _LOGGER.warning("Cannot verify Totalplay TV input: %s has no known state", entity_id)
        return "tv_unavailable"
    if state.state == "off":
        _LOGGER.warning("Connected Totalplay TV %s is off; HDMI source cannot be verified", entity_id)
        return "tv_off"

    current = state.attributes.get("source")
    if isinstance(current, str) and current.strip().casefold() not in _UNKNOWN:
        if _same_source(current, desired):
            return "verified"
    else:
        current = None

    features = state.attributes.get("supported_features", 0)
    if not isinstance(features, int) or not features & MediaPlayerEntityFeature.SELECT_SOURCE:
        _LOGGER.warning("Totalplay TV %s: HDMI %r cannot be verified/switched (current: %r; select_source unsupported)",
                        entity_id, desired, current)
        return "switch_unsupported" if current else "source_unknown"

    sources = state.attributes.get("source_list")
    if isinstance(sources, (list, tuple)) and sources:
        exact = next((source for source in sources if isinstance(source, str) and _same_source(source, desired)), None)
        if exact is None:
            _LOGGER.warning("Totalplay TV %s: requested HDMI %r absent from available sources %r",
                            entity_id, desired, sources)
            return "source_not_listed"
        desired = exact

    try:
        await hass.services.async_call(
            "media_player", "select_source",
            {"entity_id": entity_id, "source": desired}, blocking=True,
        )
    except Exception as exc:
        _LOGGER.warning("Could not switch Totalplay TV %s to %r: %s. Decoder command will still be sent",
                        entity_id, desired, exc)
        return "switch_failed"

    # Home Assistant state changes can arrive slightly after a blocking service
    # call completes. Re-read once; never trust the stale pre-call state.
    latest = hass.states.get(entity_id)
    actual = latest.attributes.get("source") if latest else None
    if not isinstance(actual, str) or not _same_source(actual, desired):
        await asyncio.sleep(0.4)
        latest = hass.states.get(entity_id)
        actual = latest.attributes.get("source") if latest else None
    if isinstance(actual, str) and _same_source(actual, desired):
        return "verified"
    _LOGGER.warning("Totalplay TV %s accepted input-selection request, but source %r could not be verified (reported %r)",
                    entity_id, desired, actual)
    return "switch_unconfirmed"
