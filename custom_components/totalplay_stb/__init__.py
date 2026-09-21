"""Local HTTP remote and command-only media player for Totalplay STBs."""

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

PLATFORMS = ["remote", "media_player"]


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up the decoder's remote and media player from the same config entry."""
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload both decoder entities."""
    return await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
