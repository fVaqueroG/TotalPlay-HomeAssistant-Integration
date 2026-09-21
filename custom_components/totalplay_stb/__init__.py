"""Local HTTP remote, media player, optional EPG and Lovelace card for Totalplay."""

from pathlib import Path

from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from .const import DOMAIN
from .epg import TotalplayGuideView

PLATFORMS = ["remote", "media_player"]
_CARD_URL = "/totalplay_stb/totalplay-stb-card.js"


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up decoder entities and serve the authenticated EPG plus card resource."""
    domain_data = hass.data.setdefault(DOMAIN, {})
    if not domain_data.get("card_registered"):
        card_file = Path(__file__).parent / "www" / "totalplay-stb-card.js"
        lineup_file = Path(__file__).parent / "www" / "lineup.txt"
        await hass.http.async_register_static_paths(
            [StaticPathConfig(_CARD_URL, str(card_file), False),
             StaticPathConfig("/totalplay_stb/lineup.txt", str(lineup_file), False)]
        )
        hass.http.register_view(TotalplayGuideView(hass))
        domain_data["card_registered"] = True
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload entities. Existing HTTP routes remain valid until HA restarts."""
    return await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
