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
        # Preserve the public URL and custom card type so existing dashboards
        # and visual-editor configuration survive upgrades.
        www = Path(__file__).parent / "www"
        await hass.http.async_register_static_paths(
            [
                StaticPathConfig(_CARD_URL, str(www / "totalplay-stb-v0317.js"), False),
                StaticPathConfig("/totalplay_stb/totalplay-stb-v0316.js", str(www / "totalplay-stb-v0316.js"), False),
                StaticPathConfig("/totalplay_stb/totalplay-stb-v0315.js", str(www / "totalplay-stb-v0315.js"), False),
                StaticPathConfig("/totalplay_stb/totalplay-stb-v0313.js", str(www / "totalplay-stb-v0313.js"), False),
                StaticPathConfig("/totalplay_stb/totalplay-stb-v0311.js", str(www / "totalplay-stb-v0311.js"), False),
                StaticPathConfig("/totalplay_stb/totalplay-stb-v0310.js", str(www / "totalplay-stb-v0310.js"), False),
                StaticPathConfig("/totalplay_stb/totalplay-stb-v038.js", str(www / "totalplay-stb-v038.js"), False),
                StaticPathConfig("/totalplay_stb/totalplay-app-logos.js", str(www / "totalplay-app-logos.js"), False),
                StaticPathConfig("/totalplay_stb/totalplay-guide-layout-v036.js", str(www / "totalplay-guide-layout-v036.js"), False),
                StaticPathConfig("/totalplay_stb/totalplay-pages-remote.js", str(www / "totalplay-pages-remote.js"), False),
                StaticPathConfig("/totalplay_stb/totalplay-epg-responsive.js", str(www / "totalplay-epg-responsive.js"), False),
                StaticPathConfig("/totalplay_stb/totalplay-guide-v3.js", str(www / "totalplay-guide-v3.js"), False),
                StaticPathConfig("/totalplay_stb/lineup.txt", str(www / "lineup.txt"), False),
            ]
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
