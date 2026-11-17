import unittest
import numpy as np

from adsense_vision.attention import (
    AttentionConfig,
    AttentionMachine,
    AttentionState,
    compute_head_pose,
    YAW_MAX,
    PITCH_MIN,
    PITCH_MAX,
)
from adsense_vision.crop import extract_face_crop
from adsense_vision.detector import Detection
from adsense_vision.models import Track, VisionConfig
from adsense_vision.service import VisionService
from adsense_vision.tracking import IoUTracker, iou


class HeadPoseLookingTests(unittest.TestCase):
    def test_facing_forward_is_looking(self):
        # 0: right eye (0.4, 0.3), 1: left eye (0.6, 0.3)
        # eye_mid = (0.5, 0.3), eye_dist = 0.2
        # 2: nose (0.5, 0.425) -> yaw_ratio = 0.0
        # 3: mouth (0.5, 0.55) -> mouth_dist = 0.25 -> pitch_ratio = 0.125 / 0.25 = 0.50
        keypoints = [
            (0.4, 0.3),
            (0.6, 0.3),
            (0.5, 0.425),
            (0.5, 0.55),
        ]
        yaw_ratio, pitch_ratio, yaw_deg, pitch_deg, looking = compute_head_pose(keypoints)
        self.assertAlmostEqual(yaw_ratio, 0.0, places=3)
        self.assertAlmostEqual(pitch_ratio, 0.50, places=3)
        self.assertTrue(looking)
        self.assertAlmostEqual(yaw_deg, 0.0, places=1)
        self.assertAlmostEqual(pitch_deg, -5.0, places=1)

    def test_turned_head_exceeds_yaw_threshold(self):
        # nose turned to the right side (0.55): yaw_ratio = (0.55 - 0.5) / 0.2 = 0.25 > YAW_MAX (0.18)
        keypoints = [
            (0.4, 0.3),
            (0.6, 0.3),
            (0.55, 0.425),
            (0.5, 0.55),
        ]
        yaw_ratio, pitch_ratio, _, _, looking = compute_head_pose(keypoints)
        self.assertAlmostEqual(yaw_ratio, 0.25, places=3)
        self.assertFalse(looking)

    def test_looking_down_exceeds_pitch_max(self):
        # nose shifted down towards mouth (0.51): pitch_ratio = (0.51 - 0.3) / 0.25 = 0.84 > PITCH_MAX (0.75)
        keypoints = [
            (0.4, 0.3),
            (0.6, 0.3),
            (0.5, 0.51),
            (0.5, 0.55),
        ]
        _, pitch_ratio, _, _, looking = compute_head_pose(keypoints)
        self.assertGreater(pitch_ratio, PITCH_MAX)
        self.assertFalse(looking)

    def test_looking_up_below_pitch_min(self):
        # nose shifted up towards eyes (0.36): pitch_ratio = (0.36 - 0.3) / 0.25 = 0.24 < PITCH_MIN (0.35)
        keypoints = [
            (0.4, 0.3),
            (0.6, 0.3),
            (0.5, 0.36),
            (0.5, 0.55),
        ]
        _, pitch_ratio, _, _, looking = compute_head_pose(keypoints)
        self.assertLess(pitch_ratio, PITCH_MIN)
        self.assertFalse(looking)


class CropTests(unittest.TestCase):
    def test_extract_face_crop_returns_data_uri(self):
        frame = np.full((360, 640, 3), 128, dtype=np.uint8)
        # Face box at center
        crop_data = extract_face_crop(frame, (0.4, 0.3, 0.2, 0.3))
        self.assertIsNotNone(crop_data)
        self.assertTrue(crop_data.startswith("data:image/jpeg;base64,"))

    def test_extract_face_crop_boundary_handling(self):
        frame = np.full((360, 640, 3), 128, dtype=np.uint8)
        # Face box near top-left corner
        crop_data = extract_face_crop(frame, (0.01, 0.01, 0.15, 0.15))
        self.assertIsNotNone(crop_data)
        self.assertTrue(crop_data.startswith("data:image/jpeg;base64,"))


class TrackingTests(unittest.TestCase):
    def test_iou_matches_overlapping_boxes(self):
        self.assertAlmostEqual(iou((0, 0, 10, 10), (5, 0, 10, 10)), 1 / 3)

    def test_track_id_survives_motion(self):
        tracker = IoUTracker()
        first = tracker.update([((0, 0, 20, 20), 0.9, 0, 0)], 0)
        second = tracker.update([((2, 0, 20, 20), 0.8, 0, 0)], 100)
        self.assertEqual(first[0].id, second[0].id)


class AttentionTests(unittest.TestCase):
    def make_track(self, yaw=0.0, pitch=0.0, yaw_ratio=0.0, pitch_ratio=0.55, raw_looking=True):
        return Track(
            1,
            (0.2, 0.2, 0.2, 0.2),
            0.9,
            0,
            yaw=yaw,
            pitch=pitch,
            yaw_ratio=yaw_ratio,
            pitch_ratio=pitch_ratio,
            raw_looking=raw_looking,
        )

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
        machine = AttentionMachine(AttentionConfig(dwell_seconds=3, looking_reset_seconds=0.4))
        track = self.make_track()
        track.last_seen_ms = 0
        machine.update([track], 0)
        # Person looks away briefly for 350 ms (< 400 ms)
        track.raw_looking = False
        track.yaw_ratio = 0.35
        track.last_seen_ms = 100
        machine.update([track], 100)
        # Still looking away at t=350 (250 ms gap)
        track.last_seen_ms = 350
        machine.update([track], 350)
        # Person looks back at t=450 (gap from t=100 was 350ms <= 400ms)
        track.raw_looking = True
        track.yaw_ratio = 0.0
        track.last_seen_ms = 450
        machine.update([track], 450)
        # Total dwell since t=0 reached at t=3000
        track.last_seen_ms = 3000
        machine.update([track], 3000)
        self.assertEqual(machine.state, AttentionState.OFFER)

    def test_long_non_looking_gap_resets_dwell(self):
        machine = AttentionMachine(AttentionConfig(dwell_seconds=3, looking_reset_seconds=0.4))
        track = self.make_track()
        track.last_seen_ms = 0
        machine.update([track], 0)
        # Person looks away for 500 ms (> 400 ms)
        track.raw_looking = False
        track.yaw_ratio = 0.35
        track.last_seen_ms = 100
        machine.update([track], 100)
        track.last_seen_ms = 601
        machine.update([track], 601)
        self.assertIsNone(track.looking_since_ms)
        # Person looks back at t=700
        track.raw_looking = True
        track.yaw_ratio = 0.0
        track.last_seen_ms = 700
        machine.update([track], 700)
        # At t=3000 (dwell only 2300ms from t=700), offer should NOT trigger yet
        track.last_seen_ms = 3000
        machine.update([track], 3000)
        self.assertEqual(machine.state, AttentionState.STANDBY)
        # Reaches 3000ms from t=700 at t=3700
        track.last_seen_ms = 3700
        machine.update([track], 3700)
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
                return [Detection((0.1, 0.2, 0.2, 0.3), 0.95, looking=True, yaw_ratio=0.02, pitch_ratio=0.52)]

        service = VisionService(FakeDetector())
        message = service.process(np.zeros((360, 640, 3), dtype=np.uint8), 1000)
        self.assertEqual(message.as_dict()["t"], "faces")
        self.assertEqual(message.faces[0].id, 1)
        self.assertAlmostEqual(message.faces[0].h, 0.3)
        self.assertEqual(message.faces[0].looking, True)
        self.assertAlmostEqual(message.faces[0].yaw_ratio, 0.02)

    def test_service_ignores_faces_smaller_than_7_percent(self):
        class FakeDetector:
            def detect(self, frame):
                return [
                    Detection((0.1, 0.2, 0.2, 0.05), 0.95),  # 5% height - should be ignored
                    Detection((0.5, 0.2, 0.2, 0.12), 0.90),  # 12% height - should be kept
                ]

        service = VisionService(FakeDetector(), VisionConfig(detection_range="medium"))
        message = service.process(np.zeros((360, 640, 3), dtype=np.uint8), 1000)
        self.assertEqual(len(message.faces), 1)
        self.assertAlmostEqual(message.faces[0].h, 0.12)

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
