"""Ensure the user-provided Totalplay popup icon is bundled intact."""
import base64
import hashlib
from pathlib import Path
import unittest

ASSET = (Path(__file__).resolve().parents[1] / "custom_components" /
         "totalplay_stb" / "www" / "brand" / "totalplay-icon.png.b64")
EXPECTED_SHA256 = "9d02cc2363a9f4b8a2a0c04733604fef379aa6bc0d678e7cdb688c36f8f3f149"


class PackagedTotalplayIconTests(unittest.TestCase):
    def test_uploaded_icon_is_a_valid_transparent_png(self):
        png = base64.b64decode("".join(ASSET.read_text(encoding="ascii").split()), validate=True)
        self.assertEqual(hashlib.sha256(png).hexdigest(), EXPECTED_SHA256)
        self.assertEqual(png[:8], b"\x89PNG\r\n\x1a\n")
        self.assertEqual(png[12:16], b"IHDR")
        self.assertEqual(tuple(int.from_bytes(png[i:i+4], "big") for i in (16, 20)), (257, 282))
        self.assertEqual(png[25], 3)  # Palette with per-color alpha (tRNS chunk).
        self.assertIn(b"tRNS", png)


if __name__ == "__main__":
    unittest.main()
