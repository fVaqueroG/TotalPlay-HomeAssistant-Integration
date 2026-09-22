"""Serve verified, local Totalplay branding without external image requests.

The approved white-lettered vertical logo is stored as UTF-8 base64 PNG to
allow bundling the original user's artwork through text-only repository writes.
Other artwork retains its existing Home Assistant cache and fallback behavior.
"""

import asyncio
import base64
import hashlib
import logging
from pathlib import Path

from .artwork import TotalplayArtworkView

_LOGGER = logging.getLogger(__name__)
_BRAND_DIR = Path(__file__).parent / "www" / "brand"
_ICON_ASSET = _BRAND_DIR / "totalplay-icon.png"
_ICON_SHA256 = "fdef2be7c3db99b499bddd428dbebd6b8e39c0cfbd5288fd0ce9b8c5bd287f3c"
_VERTICAL_ASSET = _BRAND_DIR / "totalplay-vertical-approved.png.b64"
_VERTICAL_SHA256 = "75f0eaae881a5f40f14a5e3b22fff1d4d3d1c03384637b14a3e8c347c8aa8d66"
_PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"


def _validate_png(raw: bytes, expected_sha256: str) -> bytes:
    """Ensure only the verified bundled logo bytes reach Home Assistant clients."""
    if not (
        1_500 < len(raw) <= 1_000_000
        and raw.startswith(_PNG_SIGNATURE)
        and raw[12:16] == b"IHDR"
    ):
        raise ValueError("Invalid packaged Totalplay PNG")
    if hashlib.sha256(raw).hexdigest() != expected_sha256:
        raise ValueError("Packaged Totalplay PNG checksum mismatch")
    return raw


def read_packaged_icon() -> bytes:
    """Read the user's approved icon-only Totalplay PNG."""
    return _validate_png(_ICON_ASSET.read_bytes(), _ICON_SHA256)


def read_packaged_vertical() -> bytes:
    """Read the user's original white-lettered vertical logo, losslessly resized."""
    return _validate_png(
        base64.b64decode(_VERTICAL_ASSET.read_text(encoding="ascii"), validate=True),
        _VERTICAL_SHA256,
    )


class TotalplayPackagedArtworkView(TotalplayArtworkView):
    """Use approved local brand assets while preserving the other caches."""

    def __init__(self, hass):
        super().__init__(hass)
        self._bundled_images: dict[str, bytes] = {}
        self._bundled_locks = {"icon": asyncio.Lock(), "vertical": asyncio.Lock()}

    async def _image(self, kind: str, image_id: str) -> bytes | None:
        if kind != "brand" or image_id not in self._bundled_locks:
            return await super()._image(kind, image_id)
        if image_id not in self._bundled_images:
            async with self._bundled_locks[image_id]:
                if image_id not in self._bundled_images:
                    try:
                        reader = read_packaged_icon if image_id == "icon" else read_packaged_vertical
                        self._bundled_images[image_id] = (
                            await self._hass.async_add_executor_job(reader)
                        )
                    except (OSError, ValueError, base64.binascii.Error):
                        _LOGGER.exception("Could not read packaged Totalplay %s logo", image_id)
                        return None
        return self._bundled_images[image_id]

    async def get(self, request, kind: str, image_id: str):
        """Serve the approved vertical logo as PNG instead of upstream SVG."""
        response = await super().get(request, kind, image_id)
        if kind == "brand" and image_id == "vertical":
            response.content_type = "image/png"
            response.headers["Cache-Control"] = "public, max-age=86400"
        return response
