"""Accept only EPGTalk's inert XMLTV prologue; never expand arbitrary DTDs."""
import gzip
import importlib.util
import io
from datetime import datetime, timedelta, timezone
from pathlib import Path
import unittest

MODULE = Path(__file__).resolve().parents[1] / 'custom_components' / 'totalplay_stb' / 'epg_data.py'
spec = importlib.util.spec_from_file_location('totalplay_safe_doctype', MODULE)
epg_data = importlib.util.module_from_spec(spec)
spec.loader.exec_module(epg_data)


class BytewiseStream:
    """Simulate a compressed source that returns less than the requested read."""
    def __init__(self, data):
        self.stream = io.BytesIO(data)
    def read(self, size=-1):
        return self.stream.read(min(max(size, 0), 1))


class SafeDoctypeTests(unittest.TestCase):
    def setUp(self):
        now = datetime.now(timezone.utc)
        start = (now - timedelta(minutes=15)).strftime('%Y%m%d%H%M%S +0000')
        stop = (now + timedelta(minutes=45)).strftime('%Y%m%d%H%M%S +0000')
        self.xml = (
            '<?xml version="1.0" encoding="UTF-8"?>\n'
            '<!DOCTYPE tv SYSTEM "xmltv.dtd">\n\n'
            '<tv source-info-name="Schedules Direct" generator-info-name="mc2xml">'
            '<channel id="I1.82970.schedulesdirect.org">'
            '<display-name>HOLA TV</display-name><display-name>1 HOLA TV</display-name>'
            '</channel>'
            f'<programme channel="I1.82970.schedulesdirect.org" start="{start}" stop="{stop}">'
            '<title>Current show &amp; news</title></programme></tv>'
        ).encode()

    def test_realistic_epgtalk_header_plain_gzip_and_short_reads(self):
        for source in (io.BytesIO(self.xml), gzip.GzipFile(fileobj=io.BytesIO(gzip.compress(self.xml))),
                       BytewiseStream(self.xml)):
            with self.subTest(source=type(source).__name__):
                result = epg_data.parse_xmltv_stream(source)
                self.assertEqual(result['window_programme_count'], 1)
                self.assertEqual(result['channels'][0]['name'], 'HOLA TV')
                self.assertEqual(result['channels'][0]['schedule'][0]['title'], 'Current show & news')

    def test_internal_entity_and_other_dtds_remain_forbidden(self):
        attacks = (
            b'<!DOCTYPE tv [<!ENTITY x "EXPAND">]><tv><channel id="x"/></tv>',
            b'<!DOCTYPE tv SYSTEM "file:///etc/passwd"><tv/>',
            b'<!DOCTYPE tv SYSTEM "xmltv.dtd" [<!ELEMENT tv ANY>]><tv/>',
            b'<!DOCTYPE html SYSTEM "xmltv.dtd"><tv/>',
            b'<!DOCTYPE tv SYSTEM "xmltv.dtd"><!DOCTYPE tv SYSTEM "xmltv.dtd"><tv/>',
        )
        for attack in attacks:
            with self.subTest(attack=attack[:65]), self.assertRaisesRegex(ValueError, 'forbidden DTD'):
                epg_data.parse_xmltv(attack)

    def test_oversized_stream_remains_bounded_with_safe_doctype(self):
        with self.assertRaisesRegex(ValueError, 'Uncompressed guide exceeds'):
            epg_data.parse_xmltv_stream(io.BytesIO(self.xml), max_bytes=len(self.xml)-1)


if __name__ == '__main__':
    unittest.main()
