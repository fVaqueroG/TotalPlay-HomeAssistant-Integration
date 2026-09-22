"""Local HTTP remote, media player, optional EPG and Lovelace card for Totalplay."""

import logging
from pathlib import Path

from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from .card_resource import async_register_card_resource
from .const import DOMAIN
from .epg_manager import TotalplayCachedGuideView

_LOGGER = logging.getLogger(__name__)
PLATFORMS = ["remote", "media_player"]
_CARD_URL = "/totalplay_stb/totalplay-stb-card.js"


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up decoder entities and pre-warm a single authenticated EPG cache."""
    domain_data = hass.data.setdefault(DOMAIN, {})
    if not domain_data.get("card_registered"):
        # Keep the public URL and card type stable for existing dashboards.
        # Register EVERY bundled JS module, not a hand-maintained subset: an
        # omitted import prevents the browser from registering the custom card.
        www = Path(__file__).parent / "www"
        await hass.http.async_register_static_paths(
            [
                StaticPathConfig(
                    _CARD_URL, str(www / "totalplay-stb-v0333.js"), False
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
        view = TotalplayCachedGuideView(hass)
        hass.http.register_view(view)
        domain_data["guide_view"] = view
        domain_data["card_registered"] = True

    if not domain_data.get("resource_registered"):
        try:
            domain_data["resource_registered"] = await async_register_card_resource(hass)
        except Exception:  # A frontend failure must not disable the decoder remote.
            _LOGGER.exception("Could not register the Totalplay Lovelace card resource")

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    domain_data.setdefault("active_entries", set()).add(entry.entry_id)
    # Only the first decoder starts the clock-aligned refresh listener.
    domain_data["guide_view"].async_start()
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload decoder entities and stop EPG updates when none remain."""
    unloaded = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unloaded:
        domain_data = hass.data.get(DOMAIN, {})
        entries = domain_data.get("active_entries", set())
        entries.discard(entry.entry_id)
        if not entries and domain_data.get("guide_view"):
            domain_data["guide_view"].async_stop()
    return unloaded
