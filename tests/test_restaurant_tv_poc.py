import unittest
from pathlib import Path
from unittest.mock import patch

import restaurant_tv_poc
from restaurant_tv_poc import DisplayState, InteractionController, PersonObservation, Settings


class InteractionControllerTests(unittest.TestCase):
    def setUp(self):
        self.controller = InteractionController(Settings(look_seconds=2, robot_seconds=5, return_seconds=2))
        self.person = PersonObservation((10, 10, 100, 100), True, 2, True)

    def test_looking_requires_full_duration(self):
        self.controller.update(self.person, now=0)
        self.assertEqual(self.controller.state, DisplayState.LOOKING)
        self.controller.update(self.person, now=1.9)
        self.assertEqual(self.controller.state, DisplayState.LOOKING)
        self.controller.update(self.person, now=2.0)
        self.assertEqual(self.controller.state, DisplayState.LIVE_ROBOT)

    def test_looking_resets_when_person_stops_looking(self):
        self.controller.update(self.person, now=0)
        self.controller.update(None, now=1)
        self.assertEqual(self.controller.state, DisplayState.STANDBY)

    def test_offer_returns_after_redemption(self):
        self.controller.update(self.person, now=0)
        self.controller.update(self.person, now=2)
        self.controller.update(self.person, now=7)
        self.assertEqual(self.controller.state, DisplayState.OFFER)
        self.controller.redeemed.set()
        self.controller.update(None, now=7.1)
        self.assertEqual(self.controller.state, DisplayState.RETURNING)
        self.controller.update(None, now=9.1)
        self.assertEqual(self.controller.state, DisplayState.STANDBY)


class DetectorPathTests(unittest.TestCase):
    def test_load_detectors_supports_opencv_without_data_attribute(self):
        fake_cv2 = unittest.mock.Mock()
        fake_cv2.data = None
        fake_cv2.CascadeClassifier.side_effect = lambda path: unittest.mock.Mock(
            empty=lambda: False
        )
        with patch.object(restaurant_tv_poc, "cv2", fake_cv2), patch.object(
            Path, "is_dir", return_value=True
        ), patch.object(Path, "is_file", return_value=True):
            face, eyes = restaurant_tv_poc.load_detectors()
        self.assertIsNotNone(face)
        self.assertIsNotNone(eyes)
        self.assertEqual(fake_cv2.CascadeClassifier.call_count, 2)


if __name__ == "__main__":
    unittest.main()
