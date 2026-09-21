"""Local HTTP remote, media player, optional EPG and Lovelace card for Totalplay."""

import logging
from pathlib import Path

from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from .card_resource import async_register_card_resource
from .const import DOMAIN
from .epg import TotalplayGuideView

_LOGGER = logging.getLogger(__name__)
PLATFORMS = ["remote", "media_player"]
_CARD_URL = "/totalplay_stb/totalplay-stb-card.js"


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up decoder entities and serve the authenticated EPG plus card resource."""
    domain_data = hass.data.setdefault(DOMAIN, {})
    if not domain_data.get("card_registered"):
        # Keep the existing resource URL and card type so dashboards retain their
        # configuration; the JavaScript implementation can change independently.
        card_file = Path(__file__).parent / "www" / "totalplay-guide-v3.js"
        lineup_file = Path(__file__).parent / "www" / "lineup.txt"
        await hass.http.async_register_static_paths(
            [StaticPathConfig(_CARD_URL, str(card_file), False),
             StaticPathConfig("/totalplay_stb/lineup.txt", str(lineup_file), False)]
        )
        hass.http.register_view(TotalplayGuideView(hass))
        domain_data["card_registered"] = True

    if not domain_data.get("resource_registered"):
        try:
            domain_data["resource_registered"] = await async_register_card_resource(hass)
        except Exception:  # A frontend failure must not disable the decoder remote.
            _LOGGER.exception("Could not register the Totalplay Lovelace card resource")

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload entities. Existing HTTP routes remain valid until HA restarts."""
    return await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
