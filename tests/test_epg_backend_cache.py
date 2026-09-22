"""Test the backend-managed Totalplay guide without a real HA instance or internet."""
import asyncio
from datetime import datetime, timedelta, timezone
import importlib.util
from pathlib import Path
import sys
from types import ModuleType, SimpleNamespace
import unittest
from unittest.mock import patch

from test_epg_fallback import epg, pkg, ha, helpers

EVENTS = []
event = ModuleType('homeassistant.helpers.event')

def schedule(_hass, callback, *, minute, second):
    record = {'callback': callback, 'minute': minute, 'second': second, 'cancelled': False}
    EVENTS.append(record)
    def cancel():
        record['cancelled'] = True
    return cancel

event.async_track_time_change = schedule
ROOT = Path(__file__).resolve().parents[1] / 'custom_components' / 'totalplay_stb'
with patch.dict(sys.modules, {
    'homeassistant': ha, 'homeassistant.helpers': helpers,
    'homeassistant.helpers.event': event,
    pkg.__name__ + '.epg': epg,
}):
    spec = importlib.util.spec_from_file_location(
        pkg.__name__ + '.epg_manager', ROOT / 'epg_manager.py')
    manager = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(manager)

class BackendCacheTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        EVENTS.clear()
        self.now = datetime.now(timezone.utc)
        self.live = {'title': 'Current show',
                     'start': (self.now-timedelta(minutes=15)).isoformat(),
                     'stop': (self.now+timedelta(minutes=40)).isoformat()}
        self.ended = {'title': 'Expired show',
                      'start': (self.now-timedelta(hours=2)).isoformat(),
                      'stop': (self.now-timedelta(minutes=1)).isoformat()}
        self.future = {'title': 'Upcoming show',
                       'start': (self.now+timedelta(hours=1)).isoformat(),
                       'stop': (self.now+timedelta(hours=2)).isoformat()}
        self.fetches = 0
        # The current EPG combines all configured XMLTV sources per refresh;
        # the old single-provider count no longer represents one refresh.
        self.requests_per_refresh = len(epg.GUIDE_SOURCES)
        hass = SimpleNamespace(async_create_task=lambda coro: asyncio.create_task(coro))
        self.view = manager.TotalplayCachedGuideView(hass)
        async def download(_url):
            self.fetches += 1
            return {
                'channels': [{'id': 'Azteca.mx', 'name': 'Azteca Uno',
                              'schedule': [dict(self.ended), dict(self.live), dict(self.future)]}],
                'programme_count': 3, 'window_programme_count': 3,
                'updated': self.now.isoformat(),
            }
        self.view._download = download

    async def asyncTearDown(self):
        self.view.async_stop()

    async def test_preload_and_clock_aligned_refresh_are_independent_of_dashboard(self):
        self.view.async_start()
        self.view.async_start()
        self.assertEqual(len(EVENTS), 1, 'Only one half-hour clock listener is registered')
        self.assertEqual(EVENTS[0]['minute'], [0, 30], 'Use :00 and :30, not rolling interval')
        self.assertEqual(EVENTS[0]['second'], 0, 'Start at the beginning of the minute')
        await self.view._startup_task
        self.assertEqual(self.fetches, self.requests_per_refresh,
                         'Home Assistant preloads every configured provider once')
        response = await self.view.get(SimpleNamespace(query={}))
        self.assertEqual(self.fetches, self.requests_per_refresh,
                         'An ordinary card receives the prepared cache without downloads')
        guide = response['channels'][0]['schedule']
        self.assertEqual([p['title'] for p in guide], ['Current show', 'Upcoming show'])
        self.assertEqual(response['window_programme_count'], 2)
        self.view._next_refresh = 0
        await self.view.get(SimpleNamespace(query={}))
        self.assertEqual(self.fetches, self.requests_per_refresh,
                         'Opening a card does not trigger XMLTV fetches')
        await EVENTS[0]['callback'](None)
        self.assertEqual(self.fetches, 2 * self.requests_per_refresh,
                         'Clock-aligned callback refreshes every source once')
        await self.view.get(SimpleNamespace(query={'refresh':'1'}))
        self.assertEqual(self.fetches, 3 * self.requests_per_refresh,
                         'Explicit Refresh guide bypasses timer and refreshes each source once')
        self.view.async_stop()
        self.assertTrue(EVENTS[0]['cancelled'], 'Unloading last entry cancels scheduled fetches')

    async def test_failed_refresh_keeps_current_programmes(self):
        self.view.async_start()
        await self.view._startup_task
        async def unavailable(_url):
            raise TimeoutError('provider is not responding')
        self.view._download = unavailable
        await EVENTS[0]['callback'](None)
        guide = await self.view.get(SimpleNamespace(query={}))
        self.assertTrue(guide['using_cached_guide'])
        self.assertIn('Current show', [p['title'] for p in guide['channels'][0]['schedule']])
        self.assertNotIn('Expired show', [p['title'] for p in guide['channels'][0]['schedule']])
        self.assertIn('EPG download failed', guide['error'])

if __name__ == '__main__':
    unittest.main()
