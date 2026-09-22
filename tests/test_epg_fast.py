"""Check large XMLTV JSON responses enable compression without altering schedules."""
import time
import unittest
from types import SimpleNamespace

from test_epg_fallback import CURRENT, epg


class FakeResponse:
    def __init__(self, payload):
        self.payload = payload
        self.compression_enabled = False

    def enable_compression(self):
        self.compression_enabled = True


class FastGuideResponseTests(unittest.IsolatedAsyncioTestCase):
    async def test_cached_schedule_response_negotiates_compression(self):
        view = epg.TotalplayGuideView(SimpleNamespace())
        view._guide = dict(CURRENT)
        view._next_refresh = time.monotonic() + 3600
        view.json = FakeResponse
        result = await view.get(None)
        self.assertTrue(result.compression_enabled)
        self.assertIs(result.payload, view._guide)
        self.assertEqual(result.payload['channels'], CURRENT['channels'])

    async def test_expired_cache_refreshes_before_returning_guide(self):
        view = epg.TotalplayGuideView(SimpleNamespace())
        view._guide = {'channels': []}
        view._next_refresh = 0
        view.json = FakeResponse
        refreshes = []

        async def refresh():
            refreshes.append(True)
            view._guide = dict(CURRENT)
            view._next_refresh = time.monotonic() + 3600

        view._refresh = refresh
        response = await view.get(None)
        self.assertEqual(len(refreshes), 1)
        self.assertEqual(response.payload['channels'], CURRENT['channels'])
        self.assertTrue(response.compression_enabled)


if __name__ == '__main__':
    unittest.main()
