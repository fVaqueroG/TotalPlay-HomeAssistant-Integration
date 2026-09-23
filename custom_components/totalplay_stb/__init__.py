"""Local HTTP remote, media player, optional EPG and Lovelace card for Totalplay."""

import logging
from pathlib import Path

from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from .packaged_artwork import TotalplayPackagedArtworkView
from .card_resource import async_register_card_resource
from .const import DOMAIN
from .epg_manager import TotalplayCachedGuideView

_LOGGER = logging.getLogger(__name__)
PLATFORMS = ["remote", "media_player"]
_CARD_URL = "/totalplay_stb/totalplay-stb-card.js"


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up decoder entities, shared EPG and persistent artwork cache."""
    domain_data = hass.data.setdefault(DOMAIN, {})

    if not domain_data.get("card_registered"):
        # Keep the public URL and card type stable for existing dashboards.
        # Register EVERY bundled JS module so a new version cannot omit imports.
        www = Path(__file__).parent / "www"
        await hass.http.async_register_static_paths(
            [
                StaticPathConfig(
                    _CARD_URL, str(www / "totalplay-stb-v0363.js"), False
                ),
                *(
                    StaticPathConfig(
                        f"/totalplay_stb/{module.name}", str(module), False
                    )
                    for module in sorted(www.glob("*.js"))
                ),
                StaticPathConfig(
                    "/totalplay_stb/premium-catalog.zlib.txt",
                    str(www / "premium-catalog.zlib.txt"),
                    False,
                ),
                StaticPathConfig(
                    "/totalplay_stb/lineup.txt", str(www / "lineup.txt"), False
                ),
            ]
        )
        guide = TotalplayCachedGuideView(hass)
        artwork = TotalplayPackagedArtworkView(hass)
        hass.http.register_view(guide)
        hass.http.register_view(artwork)
        domain_data["guide_view"] = guide
        domain_data["artwork_view"] = artwork
        domain_data["card_registered"] = True

    if not domain_data.get("resource_registered"):
        try:
            domain_data["resource_registered"] = await async_register_card_resource(hass)
        except Exception:  # A frontend failure must not disable the decoder remote.
            _LOGGER.exception("Could not register the Totalplay Lovelace card resource")

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    domain_data.setdefault("active_entries", set()).add(entry.entry_id)
    domain_data["guide_view"].async_start()
    domain_data["artwork_view"].async_start()
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Stop shared EPG/artwork tasks when no decoder entries remain."""
    unloaded = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unloaded:
        domain_data = hass.data.get(DOMAIN, {})
        entries = domain_data.get("active_entries", set())
        entries.discard(entry.entry_id)
        if not entries:
            if domain_data.get("guide_view"):
                domain_data["guide_view"].async_stop()
            if domain_data.get("artwork_view"):
                domain_data["artwork_view"].async_stop()
    return unloaded
