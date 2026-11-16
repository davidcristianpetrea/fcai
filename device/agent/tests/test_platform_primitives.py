import unittest
from pathlib import Path

from adsense_agent.indicators import HudIndicator, NullIndicator


class PlatformPrimitiveTests(unittest.TestCase):
    def test_null_indicator_is_safe(self) -> None:
        indicator = NullIndicator()
        indicator.set_status("offline")
        indicator.clear()

    def test_hud_indicator_forwards_status_without_gpio(self) -> None:
        updates: list[dict[str, str]] = []
        indicator = HudIndicator(updates.append)
        indicator.set_status("online")
        indicator.clear()
        self.assertEqual(updates, [{"status": "online"}, {}])


if __name__ == "__main__":
    unittest.main()
