"""Serve approved packaged Totalplay artwork without external logo requests.

The uploaded icon and approved vertical logo take precedence over old persistent
artwork cache files. Other official logos keep their existing backend cache.
"""

import asyncio
import hashlib
import logging
from pathlib import Path

from .artwork import TotalplayArtworkView

_LOGGER = logging.getLogger(__name__)
_BRAND_DIR = Path(__file__).parent / "www" / "brand"
_ICON_ASSET = _BRAND_DIR / "totalplay-icon.png"
_ICON_SHA256 = "fdef2be7c3db99b499bddd428dbebd6b8e39c0cfbd5288fd0ce9b8c5bd287f3c"
_VERTICAL_ASSET = _BRAND_DIR / "totalplay-vertical-white.png"
_VERTICAL_SHA256 = "d364a2c51a2bcec2c9cd0f6354baeaa0b51b09fc52720f608f04ac5a9471122c"
_PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"


def _read_packaged_png(path: Path, expected_sha256: str) -> bytes:
    """Validate the packaged PNG before serving it on Home Assistant's origin."""
    raw = path.read_bytes()
    if not (
        0 < len(raw) <= 1_000_000
        and raw.startswith(_PNG_SIGNATURE)
        and raw[12:16] == b"IHDR"
    ):
        raise ValueError("Invalid packaged Totalplay PNG")
    if hashlib.sha256(raw).hexdigest() != expected_sha256:
        raise ValueError("Packaged Totalplay PNG checksum mismatch")
    return raw


def read_packaged_icon() -> bytes:
    """Read the user's approved icon-only Totalplay PNG."""
    return _read_packaged_png(_ICON_ASSET, _ICON_SHA256)


def read_packaged_vertical() -> bytes:
    """Read the approved vertical logo with white 'Total' text."""
    return _read_packaged_png(_VERTICAL_ASSET, _VERTICAL_SHA256)


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
                        reader = (
                            read_packaged_icon if image_id == "icon"
                            else read_packaged_vertical
                        )
                        self._bundled_images[image_id] = (
                            await self._hass.async_add_executor_job(reader)
                        )
                    except (OSError, ValueError):
                        _LOGGER.exception(
                            "Could not read packaged Totalplay %s logo", image_id
                        )
                        return None
        return self._bundled_images[image_id]

    async def get(self, request, kind: str, image_id: str):
        """Serve the packaged vertical logo as PNG instead of upstream SVG."""
        response = await super().get(request, kind, image_id)
        if kind == "brand" and image_id == "vertical":
            response.content_type = "image/png"
        return response
