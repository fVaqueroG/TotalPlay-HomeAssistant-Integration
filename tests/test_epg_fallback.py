"""Test EPG fallback and diagnostics without a live Home Assistant instance."""
import importlib.util
from pathlib import Path
from types import ModuleType, SimpleNamespace
import sys
import time
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1] / 'custom_components' / 'totalplay_stb'

class ClientError(Exception):
    pass

class ClientResponseError(ClientError):
    def __init__(self, status):
        self.status = status
        super().__init__(str(status))

class FakeView:
    def json(self, result):
        return result

pkg = ModuleType('totalplay_epg_test_pkg')
pkg.__path__ = [str(ROOT)]
sys.modules[pkg.__name__] = pkg
web = ModuleType('aiohttp.web')
web.Request = object
web.Response = object
client = ModuleType('aiohttp')
client.ClientError = ClientError
client.ClientResponseError = ClientResponseError
client.ClientTimeout = lambda **kw: kw
client.web = web
ha = ModuleType('homeassistant')
ha.__path__ = []
components = ModuleType('homeassistant.components')
components.__path__ = []
ha_http = ModuleType('homeassistant.components.http')
ha_http.HomeAssistantView = FakeView
helpers = ModuleType('homeassistant.helpers')
helpers.__path__ = []
ha_client = ModuleType('homeassistant.helpers.aiohttp_client')
ha_client.async_get_clientsession = lambda hass: None
stubbed = {'aiohttp': client, 'aiohttp.web': web, 'homeassistant': ha,
           'homeassistant.components': components, 'homeassistant.components.http': ha_http,
           'homeassistant.helpers': helpers, 'homeassistant.helpers.aiohttp_client': ha_client}
with patch.dict(sys.modules, stubbed):
    spec = importlib.util.spec_from_file_location(pkg.__name__ + '.epg', ROOT / 'epg.py')
    epg = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(epg)

CURRENT = {'channels':[{'id':'one','name':'Channel','schedule':[]}],
           'programme_count':3,'window_programme_count':1,'updated':'2026-09-21T18:00:00+00:00'}

class EpgFallbackTests(unittest.IsolatedAsyncioTestCase):
    async def test_primary_http_error_uses_backup(self):
        view = epg.TotalplayGuideView(SimpleNamespace())
        attempted = []
        async def download(url):
            attempted.append(url)
            if url == epg.GUIDE_URL:
                raise ClientResponseError(403)
            return CURRENT
        view._download = download
        await view._refresh()
        self.assertEqual(attempted, list(epg.GUIDE_SOURCES))
        self.assertIsNone(view._guide['error'])
        self.assertTrue(view._guide['fallback'])
        self.assertEqual(view._guide['source'], epg.BACKUP_GUIDE_URL)

    async def test_stale_primary_tries_backup(self):
        view = epg.TotalplayGuideView(SimpleNamespace())
        attempted = []
        async def download(url):
            attempted.append(url)
            return dict(CURRENT, window_programme_count=0) if url == epg.GUIDE_URL else CURRENT
        view._download = download
        await view._refresh()
        self.assertEqual(attempted, list(epg.GUIDE_SOURCES))
        self.assertIsNone(view._guide['error'])

    async def test_all_sources_fail_preserves_cache_and_explains_why(self):
        view = epg.TotalplayGuideView(SimpleNamespace())
        view._guide = dict(CURRENT, error=None)
        async def download(url):
            if url == epg.GUIDE_URL:
                raise ClientResponseError(403)
            raise TimeoutError('private backend detail must not appear')
        view._download = download
        await view._refresh()
        self.assertEqual(view._guide['channels'], CURRENT['channels'])
        self.assertTrue(view._guide['using_cached_guide'])
        self.assertIn('HTTP 403', view._guide['error'])
        self.assertIn('timed out', view._guide['error'])
        self.assertNotIn('private backend detail', view._guide['error'])
        self.assertGreater(view._next_refresh, time.monotonic())

if __name__ == '__main__':
    unittest.main()
