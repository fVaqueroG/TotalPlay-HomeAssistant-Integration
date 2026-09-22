"""Best-effort input synchronization for a TV connected to the Totalplay STB.

Only switch to a configured source when supported. The decoder can still be
controlled if the linked TV is unavailable. A successful select_source service
call is never, by itself, evidence that the TV changed input.
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
_SOURCE_VERIFY_SECONDS = 5.0
_SOURCE_RECHECK_SECONDS = 0.5


def configured_display(entry: ConfigEntry) -> tuple[str, str]:
    """Return the configured physical display entity and desired HDMI source."""
    return (entry.options.get(CONF_TV_ENTITY, ""), entry.options.get(CONF_TV_SOURCE, ""))


def configured_power_switch(entry: ConfigEntry) -> str:
    """Return the optional switch powering the decoder."""
    return entry.options.get(CONF_POWER_SWITCH, "") or ""


def _same_source(actual: str, desired: str) -> bool:
    """Compare reported input labels, allowing harmless HDMI whitespace differences."""
    a, b = actual.strip().casefold(), desired.strip().casefold()
    if a == b:
        return True
    if a.startswith("hdmi") and b.startswith("hdmi"):
        return "".join(a.split()) == "".join(b.split())
    return False


def observed_display_status(state, desired: str) -> str:
    """Classify a *reported* TV state without inferring it from a command."""
    if state is None or state.state in _UNKNOWN:
        return "tv_unavailable"
    if state.state == "off":
        return "tv_off"
    source = state.attributes.get("source")
    if not isinstance(source, str) or source.strip().casefold() in _UNKNOWN:
        return "source_unknown"
    return "verified" if _same_source(source, desired) else "source_mismatch"


async def async_ensure_display_source(hass: HomeAssistant, entry: ConfigEntry) -> str:
    """Select the linked TV input, then read its actual state for up to 5s.

    Some TV integrations publish the updated source well after the blocking
    service call returns. Observe fresh HA state, and request one optional
    entity refresh to help integrations that only expose source on polling.
    """
    entity_id, desired = configured_display(entry)
    if not entity_id or not desired:
        return "not_configured"

    state = hass.states.get(entity_id)
    before = observed_display_status(state, desired)
    if before == "verified":
        return "verified"
    if before in ("tv_unavailable", "tv_off"):
        _LOGGER.warning("Cannot verify Totalplay TV input: %s (%s)", entity_id, before)
        return before

    features = state.attributes.get("supported_features", 0)
    if not isinstance(features, int) or not features & MediaPlayerEntityFeature.SELECT_SOURCE:
        _LOGGER.warning("Totalplay TV %s cannot select %r; reported source: %r",
                        entity_id, desired, state.attributes.get("source"))
        return "switch_unsupported" if before == "source_mismatch" else "source_unknown"

    sources = state.attributes.get("source_list")
    if isinstance(sources, (list, tuple)) and sources:
        exact = next((source for source in sources if isinstance(source, str)
                      and _same_source(source, desired)), None)
        if exact is None:
            _LOGGER.warning("Totalplay TV %s: input %r not in source list %r",
                            entity_id, desired, sources)
            return "source_not_listed"
        desired = exact

    try:
        await hass.services.async_call(
            "media_player", "select_source",
            {"entity_id": entity_id, "source": desired}, blocking=True,
        )
    except Exception as exc:
        _LOGGER.warning("Could not switch Totalplay TV %s to %r: %s; decoder commands will continue",
                        entity_id, desired, exc)
        return "switch_failed"

    loop = asyncio.get_running_loop()
    deadline = loop.time() + _SOURCE_VERIFY_SECONDS
    refresh_requested = False
    while True:
        state = hass.states.get(entity_id)  # Never reuse the pre-call snapshot.
        result = observed_display_status(state, desired)
        if result in ("verified", "tv_unavailable", "tv_off"):
            return result
        remaining = deadline - loop.time()
        if remaining <= 0:
            break
        if not refresh_requested and remaining <= _SOURCE_VERIFY_SECONDS - 1.0:
            refresh_requested = True
            try:
                await hass.services.async_call(
                    "homeassistant", "update_entity", {"entity_id": entity_id},
                    blocking=False,
                )
            except Exception as exc:
                _LOGGER.debug("TV %s does not support a forced state refresh: %s", entity_id, exc)
        await asyncio.sleep(min(_SOURCE_RECHECK_SECONDS, remaining))

    actual = hass.states.get(entity_id)
    result = observed_display_status(actual, desired)
    if result in ("verified", "tv_unavailable", "tv_off"):
        return result
    _LOGGER.warning("Totalplay TV %s: requested %r but could not confirm it; reported source %r",
                    entity_id, desired, actual.attributes.get("source") if actual else None)
    return "switch_unconfirmed"
