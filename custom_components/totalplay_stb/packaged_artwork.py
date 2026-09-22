"""Serve the bundled user-supplied Totalplay icon without an external request.

The previous icon may already exist in the persistent artwork cache. Serving the
packaged icon before consulting that cache prevents the old image resurfacing.
"""

import asyncio
import base64
import binascii
import hashlib
import logging
from pathlib import Path

from .artwork import TotalplayArtworkView

_LOGGER = logging.getLogger(__name__)
_ICON_ASSET = Path(__file__).parent / "www" / "brand" / "totalplay-icon.png.b64"
_ICON_SHA256 = "9d02cc2363a9f4b8a2a0c04733604fef379aa6bc0d678e7cdb688c36f8f3f149"
_PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"


def read_packaged_icon() -> bytes:
    """Decode the bundled transparent PNG and validate the image and checksum."""
    encoded = _ICON_ASSET.read_text(encoding="ascii")
    raw = base64.b64decode("".join(encoded.split()), validate=True)
    if not (0 < len(raw) <= 1_000_000 and raw.startswith(_PNG_SIGNATURE)
            and raw[12:16] == b"IHDR"):
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
                    except (OSError, ValueError, binascii.Error):
                        _LOGGER.exception("Could not read the packaged Totalplay icon")
                        return None
        return self._bundled_icon
