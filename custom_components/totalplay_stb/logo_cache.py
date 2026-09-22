"""Persistent backend cache for Totalplay brand, channel and app artwork."""

from __future__ import annotations

import asyncio
import base64
from datetime import timedelta
import json
import logging
from pathlib import Path
import time
import zlib

from aiohttp import ClientError, ClientTimeout
from homeassistant.core import HomeAssistant
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.event import async_track_time_interval

from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)

CACHE_URL = "/totalplay_stb_cache"
_BRAND_URL = "https://www.totalplay.com.mx/assetsv2/img/header/totalplay-logoWhite.svg"
_IMAGE_ROOT = "https://imgn.cdn.iutpcdn.com/IMGS/CHANNEL/"
_REFRESH_INTERVAL = timedelta(hours=24)
_REFRESH_AFTER_SECONDS = 7 * 24 * 60 * 60
_MAX_IMAGE_BYTES = 2_000_000
_DOWNLOAD_CHUNK = 64 * 1024
_CONCURRENCY = 6
_TIMEOUT = ClientTimeout(total=35, connect=10, sock_read=20)


class TotalplayLogoCache:
    """Download public Totalplay artwork once and serve it locally from HA."""

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self.root = Path(hass.config.path(".storage", DOMAIN, "logo_cache"))
        self._lock = asyncio.Lock()
        self._task: asyncio.Task | None = None
        self._unsubscribe_interval = None

    async def async_prepare(self) -> None:
        """Create persistent cache directories before static paths are registered."""
        await self.hass.async_add_executor_job(self._prepare_dirs)

    def _prepare_dirs(self) -> None:
        self.root.mkdir(parents=True, exist_ok=True)
        (self.root / "brand").mkdir(exist_ok=True)
        (self.root / "channels").mkdir(exist_ok=True)
        (self.root / "apps").mkdir(exist_ok=True)

    def async_start(self) -> None:
        """Warm the cache and schedule periodic stale-file refreshes."""
        if self._unsubscribe_interval is None:
            self._unsubscribe_interval = async_track_time_interval(
                self.hass, self._scheduled_refresh, _REFRESH_INTERVAL
            )
        if self._task is None or self._task.done():
            self._task = self.hass.async_create_task(self.async_refresh())

    def async_stop(self) -> None:
        """Stop scheduled cache work when the last decoder unloads."""
        if self._unsubscribe_interval is not None:
            self._unsubscribe_interval()
            self._unsubscribe_interval = None
        if self._task is not None and not self._task.done():
            self._task.cancel()
        self._task = None

    async def _scheduled_refresh(self, _now) -> None:
        await self.async_refresh()

    def _catalog_targets(self) -> list[tuple[Path, tuple[str, ...]]]:
        """Read the bundled official catalogue and build safe artwork targets."""
        encoded = (
            Path(__file__).parent.joinpath("www", "premium-catalog.zlib.txt")
            .read_text(encoding="utf-8")
            .strip()
        )
        categories, rows = json.loads(zlib.decompress(base64.b64decode(encoded)))
        if not isinstance(categories, list) or not isinstance(rows, list):
            raise ValueError("Invalid bundled Totalplay catalogue")

        targets: list[tuple[Path, tuple[str, ...]]] = [
            (self.root / "brand" / "totalplay-horizontal.svg", (_BRAND_URL,))
        ]
        seen: set[int] = set()
        for row in rows:
            if not isinstance(row, list) or len(row) < 6:
                raise ValueError("Invalid Totalplay catalogue row")
            number, _name, group, kind, light_id, super_id = row[:6]
            if (
                not isinstance(number, int)
                or number <= 0
                or number in seen
                or not isinstance(group, int)
                or group < 0
                or group >= len(categories)
                or kind not in {"C", "M", "I"}
                or not isinstance(light_id, int)
                or light_id <= 0
            ):
                raise ValueError("Invalid Totalplay catalogue artwork entry")
            seen.add(number)
            folder = "apps" if kind == "I" else "channels"
            urls = [f"{_IMAGE_ROOT}SUPER_LIGHT/{light_id}-8c.png"]
            if isinstance(super_id, int) and super_id > 0:
                urls.append(f"{_IMAGE_ROOT}SUPER/{super_id}-8c.png")
            targets.append((self.root / folder / f"{number}.png", tuple(urls)))
        return targets

    def _stale_targets(
        self, targets: list[tuple[Path, tuple[str, ...]]]
    ) -> list[tuple[Path, tuple[str, ...]]]:
        now = time.time()
        stale = []
        for destination, urls in targets:
            try:
                fresh = now - destination.stat().st_mtime < _REFRESH_AFTER_SECONDS
            except OSError:
                fresh = False
            if not fresh:
                stale.append((destination, urls))
        return stale

    async def _download(
        self,
        semaphore: asyncio.Semaphore,
        destination: Path,
        urls: tuple[str, ...],
    ) -> bool:
        session = async_get_clientsession(self.hass)
        async with semaphore:
            for url in urls:
                try:
                    async with session.get(url, timeout=_TIMEOUT) as response:
                        if response.status != 200:
                            continue
                        if (
                            response.content_length is not None
                            and response.content_length > _MAX_IMAGE_BYTES
                        ):
                            continue
                        content_type = response.headers.get("Content-Type", "").lower()
                        if not content_type.startswith("image/"):
                            continue
                        chunks: list[bytes] = []
                        total = 0
                        while True:
                            chunk = await response.content.read(_DOWNLOAD_CHUNK)
                            if not chunk:
                                break
                            total += len(chunk)
                            if total > _MAX_IMAGE_BYTES:
                                chunks = []
                                break
                            chunks.append(chunk)
                        if not chunks:
                            continue
                        data = b"".join(chunks)
                    await self.hass.async_add_executor_job(
                        self._atomic_write, destination, data
                    )
                    return True
                except (ClientError, asyncio.TimeoutError, TimeoutError):
                    continue
                except Exception:
                    _LOGGER.debug(
                        "Unexpected error caching Totalplay artwork %s",
                        destination.name,
                        exc_info=True,
                    )
                    continue
        return False

    @staticmethod
    def _atomic_write(destination: Path, data: bytes) -> None:
        destination.parent.mkdir(parents=True, exist_ok=True)
        temporary = destination.with_name(destination.name + ".tmp")
        temporary.write_bytes(data)
        temporary.replace(destination)

    async def async_refresh(self) -> None:
        """Refresh only missing/stale assets; retain old files on provider failure."""
        if self._lock.locked():
            return
        async with self._lock:
            try:
                targets = await self.hass.async_add_executor_job(self._catalog_targets)
                stale = await self.hass.async_add_executor_job(
                    self._stale_targets, targets
                )
            except (OSError, ValueError, zlib.error, json.JSONDecodeError) as exc:
                _LOGGER.warning("Could not prepare Totalplay artwork cache: %s", exc)
                return

            if not stale:
                return

            semaphore = asyncio.Semaphore(_CONCURRENCY)
            results = await asyncio.gather(
                *(
                    self._download(semaphore, destination, urls)
                    for destination, urls in stale
                ),
                return_exceptions=False,
            )
            saved = sum(bool(result) for result in results)
            failed = len(results) - saved
            if failed:
                _LOGGER.info(
                    "Totalplay artwork cache refreshed %s file(s); %s source file(s) "
                    "remain unavailable and will be retried later",
                    saved,
                    failed,
                )
            else:
                _LOGGER.info(
                    "Totalplay artwork cache refreshed %s file(s)", saved
                )
