"""Regression checks for read-only external EPG decoding."""

import importlib.util
from datetime import datetime, timezone
from pathlib import Path
import unittest

FILE = Path(__file__).resolve().parents[1] / 'custom_components' / 'totalplay_stb' / 'epg_data.py'
spec = importlib.util.spec_from_file_location('epg_data', FILE)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class XmltvTests(unittest.TestCase):
    def test_current_and_upcoming_programme_and_time_zone(self):
        xml = b'''<tv><channel id="A&amp;E.mx"><display-name>A&amp;E</display-name></channel>
        <programme channel="A&amp;E.mx" start="20260921080000 -0600" stop="20260921090000 -0600"><title>Now &amp; Then</title></programme>
        <programme channel="A&amp;E.mx" start="20260921090000 -0600" stop="20260921100000 -0600"><title>Next</title></programme>
        <programme channel="A&amp;E.mx" start="20260921170000 -0600" stop="20260921180000 -0600"><title>Outside window</title></programme>
        </tv>'''
        result = module.parse_xmltv(xml, datetime(2026, 9, 21, 14, 30, tzinfo=timezone.utc))
        self.assertEqual(result['programme_count'], 3)
        self.assertEqual(result['valid_timestamp_count'], 3)
        self.assertEqual(result['window_programme_count'], 2)
        self.assertEqual(result['scheduled_channel_count'], 1)
        self.assertEqual(result['channels'][0]['id'], 'A&E.mx')
        self.assertEqual([p['title'] for p in result['channels'][0]['schedule']], ['Now & Then', 'Next'])
        self.assertEqual(result['channels'][0]['schedule'][0]['start'], '2026-09-21T14:00:00+00:00')

    def test_explicit_timezone_without_seconds_is_supported(self):
        xml = b'''<tv><channel id="id"><display-name>Channel</display-name></channel>
        <programme channel="id" start="202609210830 -0600" stop="202609210930 -0600"><title>Now</title></programme></tv>'''
        result = module.parse_xmltv(xml, datetime(2026, 9, 21, 15, 0, tzinfo=timezone.utc))
        self.assertEqual(result['channels'][0]['schedule'][0]['title'], 'Now')
        self.assertEqual(result['window_programme_count'], 1)

    def test_stale_guide_is_not_misreported_as_current_programming(self):
        xml = b'''<tv><channel id="id"><display-name>Channel</display-name></channel>
        <programme channel="id" start="20260801083000 -0600" stop="20260801093000 -0600"><title>Old</title></programme></tv>'''
        result = module.parse_xmltv(xml, datetime(2026, 9, 21, 15, 0, tzinfo=timezone.utc))
        self.assertEqual(result['programme_count'], 1)
        self.assertEqual(result['valid_timestamp_count'], 1)
        self.assertEqual(result['window_programme_count'], 0)
        self.assertEqual(result['scheduled_channel_count'], 0)

    def test_missing_timezone_is_not_guessed(self):
        xml = b'''<tv><channel id="id"><display-name>Channel</display-name></channel>
        <programme channel="id" start="20260921140000" stop="20260921150000"><title>Unknown zone</title></programme></tv>'''
        result = module.parse_xmltv(xml, datetime(2026, 9, 21, 14, 30, tzinfo=timezone.utc))
        self.assertEqual(result['channels'][0]['schedule'], [])
        self.assertEqual(result['valid_timestamp_count'], 0)

    def test_rejects_dtd_and_invalid_document(self):
        with self.assertRaisesRegex(ValueError, 'DTD'):
            module.parse_xmltv(b'<!DOCTYPE tv [<!ENTITY x "y">]><tv/>')
        with self.assertRaisesRegex(ValueError, 'XMLTV'):
            module.parse_xmltv(b'<html/>')


if __name__ == '__main__':
    unittest.main()
