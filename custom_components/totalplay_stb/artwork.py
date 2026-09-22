"""Persistent, allowlisted local artwork for the Totalplay catalog and card.

Downloaded logos live outside custom_components so HACS updates do not erase them.
No user-provided URL or filename is accepted by the public image endpoint.
"""

import asyncio
import base64
import json
import logging
import os
from pathlib import Path
import re
import tempfile
import time
import xml.etree.ElementTree as ET
import zlib

from aiohttp import ClientError, ClientTimeout, web
from homeassistant.components.http import HomeAssistantView
from homeassistant.helpers.aiohttp_client import async_get_clientsession

_LOGGER = logging.getLogger(__name__)
_ARTWORK_URL = "/totalplay_stb/artwork/{kind}/{image_id}"
_BRAND_URL = "https://www.totalplay.com.mx/assetsv2/img/header/totalplay-logoWhite.svg"
_VERTICAL_BRAND_URL = "https://upload.wikimedia.org/wikipedia/commons/b/bf/Logo_TotalPlay.svg"
_ICON_BRAND_URL = "https://yt3.googleusercontent.com/ytc/AIdro_n3v9pBXNjsF96o5V5Gv3HTk1a3NgyNoWwLVYlJ_rdZy6k=s160-c-k-c0x00ffffff-no-rj"
_CHANNEL_ROOT = "https://imgn.cdn.iutpcdn.com/IMGS/CHANNEL/"
_TIMEOUT = ClientTimeout(total=30, connect=8, sock_read=15)
_MAX_IMAGE_BYTES = 1_000_000
_FAIL_RETRY_SECONDS = 20 * 60
_PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
_JPEG_SIGNATURE = b"\xff\xd8\xff"
_SVG_ELEMENTS = {"svg", "g", "path", "rect", "circle", "ellipse", "polygon", "polyline",
                 "line", "defs", "linearGradient", "radialGradient", "stop", "clipPath",
                 "mask", "title", "desc"}
_SVG_ATTRS = {"id", "version", "xmlns", "viewBox", "preserveAspectRatio", "width", "height",
              "x", "y", "x1", "x2", "y1", "y2", "cx", "cy", "r", "rx", "ry", "d", "points",
              "transform", "fill", "fill-rule", "stroke", "stroke-width", "stroke-linecap",
              "stroke-linejoin", "stroke-miterlimit", "stroke-dasharray", "opacity", "fill-opacity",
              "stroke-opacity", "clip-path", "offset", "stop-color", "stop-opacity", "mask",
              "gradientUnits", "gradientTransform"}


def _catalog_ids(bundle: Path) -> dict[str, set[str]]:
    """Read numeric image IDs from the packaged official catalog, not requests."""
    encoded = bundle.read_bytes()
    if len(encoded) > 2_000_000:
        raise ValueError("Totalplay artwork catalog too large")
    compressed = base64.b64decode(encoded, validate=False)
    decompressor = zlib.decompressobj()
    decoded = decompressor.decompress(compressed, 2_000_001)
    if len(decoded) > 2_000_000 or not decompressor.eof:
        raise ValueError("Invalid Totalplay artwork catalog")
    categories, rows = json.loads(decoded)
    if not isinstance(categories, list) or not isinstance(rows, list) or len(rows) != 313:
        raise ValueError("Invalid official Totalplay channel list")
    image_ids = {"light": set(), "super": set(), "brand": {"totalplay", "vertical", "icon"}}
    for row in rows:
        if not isinstance(row, list) or len(row) < 6 or row[3] not in {"C", "M", "I"}:
            raise ValueError("Invalid Totalplay artwork entry")
        for kind, value in (("light", row[4]), ("super", row[5])):
            if type(value) is int and 0 < value < 100_000_000:
                image_ids[kind].add(str(value))
    return image_ids


def _read_cached(path: Path) -> bytes | None:
    try:
        if path.stat().st_size <= _MAX_IMAGE_BYTES:
            return path.read_bytes()
    except OSError:
        pass
    return None


def _write_cached(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    # Readers see the complete image or no image, never a partial download.
    with tempfile.NamedTemporaryFile(dir=path.parent, prefix=".art-", delete=False) as stream:
        temporary = Path(stream.name)
        try:
            stream.write(data)
        except BaseException:
            temporary.unlink(missing_ok=True)
            raise
    os.replace(temporary, path)


def _clean_svg(raw: bytes) -> bytes:
    """Never expose upstream active SVG content on Home Assistant's origin."""
    if b"<!doctype" in raw.lower() or b"<!entity" in raw.lower():
        raise ValueError("Unsafe SVG declaration")
    root = ET.fromstring(raw)
    if root.tag.rsplit("}", 1)[-1] != "svg":
        raise ValueError("Expected an SVG logo")
    for element in root.iter():
        if element.tag.rsplit("}", 1)[-1] not in _SVG_ELEMENTS:
            raise ValueError("SVG has an unsupported element")
        for key, value in element.attrib.items():
            local = key.rsplit("}", 1)[-1]
            if local not in _SVG_ATTRS or local.lower().startswith("on"):
                raise ValueError("SVG has an unsafe attribute")
            if "url(" in value.lower() and not re.fullmatch(r"url\(#[a-zA-Z0-9_-]+\)", value.strip()):
                raise ValueError("SVG has an external reference")
            if re.search(r"(?:javascript:|data:|https?://|@import)", value, re.IGNORECASE):
                raise ValueError("SVG has an external or active reference")
    return ET.tostring(root, encoding="utf-8", xml_declaration=True)


class TotalplayArtworkView(HomeAssistantView):
    """Serve known official artwork from persistent storage, fetching on miss."""

    url = _ARTWORK_URL
    name = "api:totalplay_stb:artwork"
    requires_auth = False  # <img> requests cannot send Home Assistant bearer headers.

    def __init__(self, hass):
        self._hass = hass
        self._cache = Path(hass.config.path("totalplay_stb_artwork"))
        self._catalog_path = Path(__file__).parent / "www" / "premium-catalog.zlib.txt"
        self._allowed = None
        self._catalog_lock = asyncio.Lock()
        self._locks = {}
        self._download_limit = asyncio.Semaphore(5)
        self._failed_until = {}
        self._warm_task = None

    async def _prepare(self):
        if self._allowed is None:
            async with self._catalog_lock:
                if self._allowed is None:
                    self._allowed = await self._hass.async_add_executor_job(
                        _catalog_ids, self._catalog_path
                    )

    async def _image(self, kind: str, image_id: str) -> bytes | None:
        await self._prepare()
        if image_id not in self._allowed.get(kind, set()):
            return None
        suffix = ".img" if kind == "brand" and image_id == "icon" else (".svg" if kind == "brand" else ".png")
        filename = f"{kind}-{image_id}{suffix}"
        path = self._cache / filename
        cached = await self._hass.async_add_executor_job(_read_cached, path)
        if cached is not None:
            return cached
        lock = self._locks.setdefault(filename, asyncio.Lock())
        async with lock:
            cached = await self._hass.async_add_executor_job(_read_cached, path)
            if cached is not None:
                return cached
            if self._failed_until.get(filename, 0) > time.monotonic():
                return None
            source = ((_ICON_BRAND_URL if image_id == "icon" else
                       _VERTICAL_BRAND_URL if image_id == "vertical" else _BRAND_URL)
                      if kind == "brand" else
                      f"{_CHANNEL_ROOT}{'SUPER_LIGHT' if kind == 'light' else 'SUPER'}/{image_id}-8c.png")
            try:
                async with self._download_limit:
                    session = async_get_clientsession(self._hass)
                    async with session.get(source, timeout=_TIMEOUT, allow_redirects=False) as response:
                        response.raise_for_status()
                        if response.content_length and response.content_length > _MAX_IMAGE_BYTES:
                            raise ValueError("Image exceeds download limit")
                        raw = await response.content.read(_MAX_IMAGE_BYTES + 1)
                if not raw or len(raw) > _MAX_IMAGE_BYTES:
                    raise ValueError("Invalid image size")
                if kind == "brand" and image_id != "icon":
                    raw = await self._hass.async_add_executor_job(_clean_svg, raw)
                elif kind == "brand" and image_id == "icon":
                    is_png = raw.startswith(_PNG_SIGNATURE) and raw[12:16] == b"IHDR"
                    is_jpeg = raw.startswith(_JPEG_SIGNATURE)
                    is_webp = raw.startswith(b"RIFF") and raw[8:12] == b"WEBP"
                    if not (is_png or is_jpeg or is_webp):
                        raise ValueError("Expected a raster Totalplay icon")
                elif not raw.startswith(_PNG_SIGNATURE) or raw[12:16] != b"IHDR":
                    raise ValueError("Expected an official PNG image")
                await self._hass.async_add_executor_job(_write_cached, path, raw)
                self._failed_until.pop(filename, None)
                return raw
            except (ClientError, asyncio.TimeoutError, OSError, ValueError, ET.ParseError) as exc:
                self._failed_until[filename] = time.monotonic() + _FAIL_RETRY_SECONDS
                _LOGGER.debug("Totalplay image %s unavailable: %s", filename, exc)
                return None

    async def get(self, request: web.Request, kind: str, image_id: str) -> web.Response:
        if kind not in {"light", "super", "brand"} or not re.fullmatch(
            r"[0-9]{1,8}" if kind != "brand" else r"(?:totalplay|vertical|icon)", image_id
        ):
            raise web.HTTPNotFound()
        raw = await self._image(kind, image_id)
        if raw is None:
            raise web.HTTPNotFound()
        if kind == "brand" and image_id == "icon":
            content_type = ("image/png" if raw.startswith(_PNG_SIGNATURE) else
                            "image/webp" if raw.startswith(b"RIFF") and raw[8:12] == b"WEBP" else
                            "image/jpeg")
        else:
            content_type = "image/svg+xml" if kind == "brand" else "image/png"
        return web.Response(
            body=raw,
            content_type=content_type,
            headers={"Cache-Control": "public, max-age=86400", "X-Content-Type-Options": "nosniff"},
        )

    def async_start(self):
        if self._warm_task is None or self._warm_task.done():
            self._warm_task = self._hass.async_create_task(self._prewarm())

    def async_stop(self):
        if self._warm_task is not None and not self._warm_task.done():
            self._warm_task.cancel()
        self._warm_task = None

    async def _prewarm(self):
        try:
            await self._prepare()
            # Preload all official channel and app primary artwork once. The
            # SUPER fallback is fetched only when a displayed image needs it.
            targets = [("brand", "totalplay"), ("brand", "vertical"), ("brand", "icon"),
                       *[("light", value) for value in
                       sorted(self._allowed["light"], key=int)]]
            completed = await asyncio.gather(
                *(self._image(kind, image_id) for kind, image_id in targets),
                return_exceptions=True,
            )
            good = sum(isinstance(image, bytes) for image in completed)
            _LOGGER.info("Totalplay artwork cache: %s of %s branding/channel/app images ready",
                         good, len(targets))
        except asyncio.CancelledError:
            raise
        except (OSError, ValueError) as exc:
            _LOGGER.warning("Could not prepare Totalplay artwork cache: %s", exc)
