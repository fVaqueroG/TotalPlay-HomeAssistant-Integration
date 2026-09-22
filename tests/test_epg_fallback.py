"""Test independent EPG aggregation, fallback and bounded XMLTV parsing."""
import gzip
import importlib.util
from datetime import datetime, timedelta, timezone
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

CURRENT = {'channels':[{'id':'one','name':'Channel One','names':['Channel One'],'schedule':[
    {'start':'2026-09-22T10:00:00+00:00','stop':'2026-09-22T11:00:00+00:00','title':'Live'}]}],
    'programme_count':3,'window_programme_count':1,'scheduled_channel_count':1,
    'updated':'2026-09-22T10:00:00+00:00'}

class EpgFallbackTests(unittest.IsolatedAsyncioTestCase):
    async def test_all_sources_contribute_and_first_programme_wins(self):
        view = epg.TotalplayGuideView(SimpleNamespace())
        attempted = []
        async def download(url):
            attempted.append(url)
            if url == epg.BACKUP_GUIDE_URL:
                return {**CURRENT, 'channels':[
                    {**CURRENT['channels'][0], 'schedule':[{**CURRENT['channels'][0]['schedule'][0], 'title':'Backup'}]},
                    {**CURRENT['channels'][0], 'id':'extra', 'name':'Channel Two', 'names':['Channel Two']}
                ]}
            return CURRENT
        view._download = download
        await view._refresh()
        self.assertEqual(attempted, list(epg.GUIDE_SOURCES))
        self.assertEqual(len(view._guide['sources']), len(epg.GUIDE_SOURCES))
        self.assertEqual(len(view._guide['channels']), 2)
        self.assertEqual(view._guide['channels'][0]['schedule'][0]['title'], 'Live')
        self.assertIsNone(view._guide['error'])

    async def test_primary_http_error_keeps_other_sources(self):
        view = epg.TotalplayGuideView(SimpleNamespace())
        async def download(url):
            if url == epg.GUIDE_URL:
                raise ClientResponseError(403)
            if url == epg.THIRD_GUIDE_URL:
                raise TimeoutError('testing')
            return CURRENT
        view._download = download
        await view._refresh()
        self.assertEqual(len(view._guide['sources']), len(epg.GUIDE_SOURCES) - 2)
        self.assertTrue(view._guide['fallback'])
        self.assertEqual(view._guide['source'], epg.BACKUP_GUIDE_URL)
        self.assertEqual(len(view._guide['source_errors']), 2)
        self.assertIsNone(view._guide['error'])

    async def test_empty_primary_window_does_not_block_other_guides(self):
        view = epg.TotalplayGuideView(SimpleNamespace())
        async def download(url):
            if url == epg.GUIDE_URL:
                return {**CURRENT, 'window_programme_count':0}
            return CURRENT
        view._download = download
        await view._refresh()
        self.assertEqual(len(view._guide['sources']), len(epg.GUIDE_SOURCES) - 1)
        self.assertEqual(view._guide['source'], epg.BACKUP_GUIDE_URL)
        self.assertEqual(len(view._guide['source_errors']), 1)

    async def test_all_sources_fail_preserves_cache(self):
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
        self.assertEqual(len(view._guide['source_errors']), len(epg.GUIDE_SOURCES))
        self.assertIn('HTTP 403', view._guide['error'])
        self.assertIn('timed out', view._guide['error'])
        self.assertNotIn('private backend detail', view._guide['error'])
        self.assertGreater(view._next_refresh, time.monotonic())

    def test_same_id_from_different_network_is_not_mislabelled(self):
        other = {**CURRENT, 'channels':[{**CURRENT['channels'][0], 'name':'Different channel',
            'names':['Different channel']} ]}
        merged = epg._merge_guide_sources([(0,CURRENT),(1,other)])
        self.assertEqual([s['id'] for s in merged['channels']], ['one','one~tp2'])

    def _sample_xml(self):
        now = datetime.now(timezone.utc)
        start = (now - timedelta(minutes=20)).strftime('%Y%m%d%H%M%S +0000')
        end = (now + timedelta(minutes=40)).strftime('%Y%m%d%H%M%S +0000')
        return (f'<tv><channel id="ESPN.mx"><display-name>ESPN</display-name></channel>'
                f'<programme channel="ESPN.mx" start="{start}" stop="{end}">'
                f'<title>Live sports</title></programme></tv>').encode()

    def test_gzip_and_plain_xmltv_both_decode(self):
        xml = self._sample_xml()
        for payload in (xml, gzip.compress(xml)):
            parsed = epg._parse_guide_bytes(payload)
            self.assertEqual(parsed['window_programme_count'], 1)
            self.assertEqual(parsed['channels'][0]['schedule'][0]['title'], 'Live sports')

    def test_streamed_gzip_exceeds_original_plain_xml_limit(self):
        xml = self._sample_xml().replace(b'</tv>', b'<padding>' + b'X' * 24000 + b'</padding></tv>')
        with patch.object(epg, 'MAX_GUIDE_BYTES', 1024):
            parsed = epg._parse_guide_bytes(gzip.compress(xml))
        self.assertEqual(parsed['window_programme_count'], 1)

    def test_streamed_xmltv_cannot_exceed_expanded_limit(self):
        with patch.object(epg, 'MAX_EXPANDED_GUIDE_BYTES', 256):
            with self.assertRaisesRegex(ValueError, 'Uncompressed guide exceeds'):
                epg._parse_guide_bytes(gzip.compress(b'A' * 1024))
            with self.assertRaisesRegex(ValueError, 'Invalid compressed'):
                epg._parse_guide_bytes(b'\x1f\x8bnot a valid gzip file')

    def test_streamed_xmltv_rejects_doctype(self):
        xml = b'<?xml version="1.0"?><!DOCTYPE tv [<!ENTITY x "bad">]><tv></tv>'
        with self.assertRaisesRegex(ValueError, 'forbidden DTD'):
            epg._parse_guide_bytes(gzip.compress(xml))

if __name__ == '__main__':
    unittest.main()
