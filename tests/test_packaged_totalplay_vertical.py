"""Protect the approved white-letter Totalplay vertical popup artwork."""
import base64
import hashlib
from pathlib import Path
import unittest

ASSET = (
    Path(__file__).resolve().parents[1]
    / "custom_components"
    / "totalplay_stb"
    / "www"
    / "brand"
    / "totalplay-vertical-approved.png.b64"
)
EXPECTED_SHA256 = "75f0eaae881a5f40f14a5e3b22fff1d4d3d1c03384637b14a3e8c347c8aa8d66"


class PackagedTotalplayVerticalTests(unittest.TestCase):
    def test_approved_vertical_logo_is_valid_png(self):
        encoded = "".join(ASSET.read_text(encoding="ascii").split())
        png = base64.b64decode(encoded, validate=True)
        self.assertEqual(hashlib.sha256(png).hexdigest(), EXPECTED_SHA256)
        self.assertEqual(png[:8], b"\x89PNG\r\n\x1a\n")
        self.assertEqual(png[12:16], b"IHDR")
        self.assertGreater(len(png), 1500)


if __name__ == "__main__":
    unittest.main()
