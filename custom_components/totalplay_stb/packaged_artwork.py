"""Serve the bundled user-supplied Totalplay icon without an external request.

The icon is packaged directly in the integration and served before consulting
the persistent artwork cache, so the exact user-provided image is always used.
"""

import asyncio
import hashlib
import logging
from pathlib import Path

from .artwork import TotalplayArtworkView

_LOGGER = logging.getLogger(__name__)
_ICON_ASSET = Path(__file__).parent / "www" / "brand" / "totalplay-icon.png"
_ICON_SHA256 = "fdef2be7c3db99b499bddd428dbebd6b8e39c0cfbd5288fd0ce9b8c5bd287f3c"
_PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"


def read_packaged_icon() -> bytes:
    """Read the bundled transparent PNG and validate the image and checksum."""
    raw = _ICON_ASSET.read_bytes()
    if not (
        0 < len(raw) <= 1_000_000
        and raw.startswith(_PNG_SIGNATURE)
        and raw[12:16] == b"IHDR"
    ):
        raise ValueError("Invalid packaged Totalplay icon PNG")
    if hashlib.sha256(raw).hexdigest() != _ICON_SHA256:
        raise ValueError("Packaged Totalplay icon checksum mismatch")
    return raw


class TotalplayPackagedArtworkView(TotalplayArtworkView):
    """Override only the brand icon, preserving the other persistent caches."""

    def __init__(self, hass):
        super().__init__(hass)
        self._bundled_icon = None
        self._bundled_icon_lock = asyncio.Lock()

    async def _image(self, kind: str, image_id: str) -> bytes | None:
        if kind != "brand" or image_id != "icon":
            return await super()._image(kind, image_id)
        if self._bundled_icon is None:
            async with self._bundled_icon_lock:
                if self._bundled_icon is None:
                    try:
                        self._bundled_icon = await self._hass.async_add_executor_job(
                            read_packaged_icon
                        )
                    except (OSError, ValueError):
                        _LOGGER.exception("Could not read the packaged Totalplay icon")
                        return None
        return self._bundled_icon
