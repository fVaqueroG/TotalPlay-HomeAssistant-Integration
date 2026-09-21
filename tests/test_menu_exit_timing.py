"""Ensure menu-exit timing stays fast without changing other command delays."""

import unittest

from test_netflix import player_module


class MenuExitTimingTests(unittest.TestCase):
    def test_menu_escape_is_100_ms(self):
        self.assertEqual(player_module._MENU_EXIT_DELAY_SECS, 0.10)

    def test_channel_digit_and_app_launch_delays_are_unchanged(self):
        self.assertEqual(player_module._CHANNEL_DIGIT_DELAY_SECS, 0.05)
        self.assertEqual(player_module._APP_LAUNCH_WAIT_SECS, 5.0)


if __name__ == "__main__":
    unittest.main()
