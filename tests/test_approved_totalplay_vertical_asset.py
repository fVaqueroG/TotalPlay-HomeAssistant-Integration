"""Regression test for the approved Totalplay vertical logo artwork."""
import base64
import hashlib
from pathlib import Path
import struct
import unittest

BUNDLE = (Path(__file__).resolve().parents[1] / "custom_components" / "totalplay_stb"
          / "www" / "brand" / "totalplay-vertical-approved.png.b64")
EXPECTED_SHA256 = "75f0eaae881a5f40f14a5e3b22fff1d4d3d1c03384637b14a3e8c347c8aa8d66"


class ApprovedVerticalLogoTests(unittest.TestCase):
    def test_approved_white_lettered_logo_is_intact(self):
        encoded = "".join(BUNDLE.read_text(encoding="ascii").split())
        data = base64.b64decode(encoded, validate=True)
        self.assertEqual(hashlib.sha256(data).hexdigest(), EXPECTED_SHA256)
        self.assertGreater(len(data), 2500)  # Reject the earlier 1325-byte placeholder.
        self.assertEqual(data[:8], b"\x89PNG\r\n\x1a\n")
        self.assertEqual(data[12:16], b"IHDR")
        self.assertEqual(struct.unpack(">II", data[16:24]), (158, 200))
        self.assertEqual(data[-12:], b"\x00\x00\x00\x00IEND\xaeB`\x82")


if __name__ == "__main__":
    unittest.main()
