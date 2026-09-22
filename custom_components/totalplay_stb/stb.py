"""Model choices and consistent device metadata for Totalplay decoders."""

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import CONF_HOST, CONF_PORT

from .const import DOMAIN

CONF_STB_MODEL = "stb_model"
DEFAULT_NEW_MODEL = "M362"
LEGACY_MODEL = "DIW362 UHD"
STB_MODELS = {
    "M362": "M362",
    "DIW362 UHD": "DIW362 UHD",
    "Other / Unknown": "Other / Unknown",
}


def configured_model(entry: ConfigEntry) -> str:
    """Options override setup data; existing installations retain their model."""
    return entry.options.get(
        CONF_STB_MODEL, entry.data.get(CONF_STB_MODEL, LEGACY_MODEL)
    )


def device_details(entry: ConfigEntry) -> dict:
    """Share one identity across remote and media player to avoid duplicate devices."""
    host = entry.data[CONF_HOST]
    port = entry.data[CONF_PORT]
    model = configured_model(entry)
    label = "STB" if model == "Other / Unknown" else model
    return {
        "identifiers": {(DOMAIN, f"{host}:{port}")},
        "name": f"Totalplay {label}",
        "manufacturer": "Totalplay",
        "model": model,
        "configuration_url": f"http://{host}:{port}",
    }
