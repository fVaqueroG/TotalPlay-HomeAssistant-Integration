"""A short StreamReader.read() is not necessarily EOF: test complete XMLTV fetch."""
import gzip
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from test_epg_fallback import epg, EpgFallbackTests


class ChunkedContent:
    def __init__(self, payload, chunk_bytes=11):
        self.payload = payload
        self.chunk_bytes = chunk_bytes
        self.offset = 0
        self.calls = 0

    async def read(self, maximum):
        self.calls += 1
        if self.offset >= len(self.payload):
            return b''
        stop = min(len(self.payload), self.offset + self.chunk_bytes,
                   self.offset + maximum)
        result = self.payload[self.offset:stop]
        self.offset = stop
        return result


class FakeResponse:
    def __init__(self, payload, content_length=None):
        self.content = ChunkedContent(payload)
        self.content_length = content_length

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return False

    def raise_for_status(self):
        pass


class ChunkedEpgDownloadTests(unittest.IsolatedAsyncioTestCase):
    async def test_reads_all_chunks_until_eof_before_decoding_gzip(self):
        xml = EpgFallbackTests()._sample_xml()
        payload = gzip.compress(xml)
        response = FakeResponse(payload, content_length=len(payload))
        session = SimpleNamespace(get=lambda url, timeout: response)

        async def executor(function, data):
            return function(data)

        hass = SimpleNamespace(async_add_executor_job=executor)
        with patch.object(epg, 'async_get_clientsession', return_value=session):
            guide = await epg.TotalplayGuideView(hass)._download('https://example.test/guide.xml.gz')
        self.assertEqual(guide['window_programme_count'], 1)
        self.assertEqual(guide['channels'][0]['schedule'][0]['title'], 'Live sports')
        self.assertGreater(response.content.calls, 2,
                           'A valid partial HTTP read must not be mistaken for EOF')
        self.assertEqual(response.content.offset, len(payload))

    async def test_omitted_content_length_cannot_bypass_transfer_limit(self):
        response = FakeResponse(b'x' * 100)
        session = SimpleNamespace(get=lambda url, timeout: response)
        hass = SimpleNamespace(async_add_executor_job=None)
        with patch.object(epg, 'MAX_GUIDE_BYTES', 64), patch.object(
                epg, 'async_get_clientsession', return_value=session):
            with self.assertRaisesRegex(ValueError, 'download size limit'):
                await epg.TotalplayGuideView(hass)._download('https://example.test/huge.xml')
        self.assertLessEqual(response.content.offset, 65,
                             'Never buffer unbounded transfer data')


if __name__ == '__main__':
    unittest.main()
