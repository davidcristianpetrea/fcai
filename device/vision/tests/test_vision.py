import unittest
import numpy as np

from adsense_vision.attention import AttentionConfig, AttentionMachine, AttentionState
from adsense_vision.detector import Detection
from adsense_vision.models import Track
from adsense_vision.service import VisionService
from adsense_vision.tracking import IoUTracker, iou


class TrackingTests(unittest.TestCase):
    def test_iou_matches_overlapping_boxes(self):
        self.assertAlmostEqual(iou((0, 0, 10, 10), (5, 0, 10, 10)), 1 / 3)

    def test_track_id_survives_motion(self):
        tracker = IoUTracker()
        first = tracker.update([((0, 0, 20, 20), 0.9, 0, 0)], 0)
        second = tracker.update([((2, 0, 20, 20), 0.8, 0, 0)], 100)
        self.assertEqual(first[0].id, second[0].id)


class AttentionTests(unittest.TestCase):
    def make_track(self, yaw=0.0, pitch=0.0):
        return Track(1, (0.2, 0.2, 0.2, 0.2), 0.9, 0, yaw=yaw, pitch=pitch)

    def test_dwell_triggers_offer(self):
        machine = AttentionMachine(AttentionConfig(dwell_seconds=3))
        track = self.make_track()
        track.last_seen_ms = 0
        machine.update([track], 0)
        track.last_seen_ms = 2999
        machine.update([track], 2999)
        track.last_seen_ms = 3000
        self.assertEqual(machine.state, AttentionState.STANDBY)
        machine.update([track], 3000)
        self.assertEqual(machine.state, AttentionState.OFFER)

    def test_short_non_looking_gap_does_not_reset_dwell(self):
        machine = AttentionMachine(AttentionConfig(dwell_seconds=3))
        track = self.make_track()
        track.last_seen_ms = 0
        machine.update([track], 0)
        track.yaw = 40
        track.last_seen_ms = 100
        machine.update([track], 100)
        track.yaw = 0
        track.last_seen_ms = 450
        machine.update([track], 450)
        track.last_seen_ms = 3000
        machine.update([track], 3000)
        self.assertEqual(machine.state, AttentionState.OFFER)

    def test_offer_waits_for_minimum_time_and_people_to_leave(self):
        machine = AttentionMachine(AttentionConfig(offer_min_seconds=20, exit_after_nobody_seconds=6))
        machine.preview_offer(0)
        track = self.make_track()
        track.last_seen_ms = 1000
        machine.update([track], 1000)
        machine.update([], 19000)
        self.assertEqual(machine.state, AttentionState.OFFER)
        machine.update([], 26000)
        self.assertEqual(machine.state, AttentionState.EXITING)


class VisionServiceTests(unittest.TestCase):
    def test_service_emits_normalized_face_message(self):
        class FakeDetector:
            def detect(self, frame):
                return [Detection((0.1, 0.2, 0.2, 0.3), 0.95)]

        service = VisionService(FakeDetector())
        message = service.process(np.zeros((360, 640, 3), dtype=np.uint8), 1000)
        self.assertEqual(message.as_dict()["t"], "faces")
        self.assertEqual(message.faces[0].id, 1)
        self.assertAlmostEqual(message.faces[0].h, 0.3)

    def test_service_caps_detection_rate(self):
        calls = []

        class FakeDetector:
            def detect(self, frame):
                calls.append(1)
                return []

        service = VisionService(FakeDetector())
        frame = np.zeros((360, 640, 3), dtype=np.uint8)
        service.process(frame, 1000)
        service.process(frame, 1001)
        self.assertEqual(len(calls), 1)


if __name__ == "__main__":
    unittest.main()
