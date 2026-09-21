"""Register the bundled Totalplay card without overwriting other Lovelace resources.

The resource version is read from the installed integration manifest so a HACS
upgrade refreshes the browser's JavaScript URL after Home Assistant restarts.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

_LOGGER = logging.getLogger(__name__)
CARD_PATH = "/totalplay_stb/totalplay-stb-card.js"


def _versioned_url() -> str:
    """Build a cache-busting URL from the *installed* integration version."""
    manifest = Path(__file__).with_name("manifest.json")
    version = json.loads(manifest.read_text(encoding="utf-8"))["version"]
    return f"{CARD_PATH}?v={version}"


async def async_register_card_resource(hass: Any) -> bool:
    """Ensure one Lovelace storage resource points at the installed card version.

    Never edit YAML resources, unrelated URLs, or delete an existing item. Always
    load the resource collection before listing/writing: earlier HA versions had
    a lazy-load issue that could otherwise overwrite existing stored resources.
    """
    lovelace = hass.data.get("lovelace")
    if lovelace is None:
        _LOGGER.warning("Lovelace is not available; add the Totalplay card resource manually")
        return False
    if getattr(lovelace, "resource_mode", None) != "storage":
        _LOGGER.info("Lovelace resources use YAML mode; add %s as a module in YAML", CARD_PATH)
        return False

    resources = lovelace.resources
    # Crucial: loads the existing collection even on older HA versions where
    # async_items() and async_create_item() had no lazy-load guard.
    await resources.async_get_info()
    matching = [
        item
        for item in resources.async_items()
        if urlsplit(item.get("url", "")).path == CARD_PATH
    ]
    if len(matching) > 1:
        _LOGGER.warning(
            "Multiple Totalplay card resources already exist; keep only one in "
            "Settings > Dashboards > Resources before enabling automatic updates"
        )
        return False

    target = _versioned_url()
    if matching:
        item = matching[0]
        if item["url"] != target or item.get("type") != "module":
            await resources.async_update_item(
                item["id"], {"url": target, "res_type": "module"}
            )
            _LOGGER.info("Updated Totalplay dashboard resource to %s", target)
    else:
        await resources.async_create_item({"url": target, "res_type": "module"})
        _LOGGER.info("Automatically registered Totalplay dashboard resource %s", target)
    return True
