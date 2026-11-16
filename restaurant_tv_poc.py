#!/usr/bin/env python3
"""Restaurant sidewalk display proof of concept.

The application intentionally keeps the interaction model small:
standby -> looking countdown -> live camera/robot -> offer -> standby.
"""

from __future__ import annotations

import argparse
import logging
import socket
import threading
import time
from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from typing import Optional

try:
    import cv2
    import numpy as np
    import qrcode
    from flask import Flask, Response
except ImportError:  # State-machine tests can run without Pi/UI dependencies.
    cv2 = None
    np = None
    qrcode = None
    Flask = None
    Response = None

try:
    from picamera2 import Picamera2
except ImportError:  # Allows UI/state tests on non-Pi machines.
    Picamera2 = None


LOG = logging.getLogger("restaurant-tv")
WINDOW_TV = "Restaurant TV Preview"
WINDOW_CAMERA = "Camera + Telemetry"


class DisplayState(str, Enum):
    STANDBY = "standby"
    LOOKING = "looking"
    LIVE_ROBOT = "live_robot"
    OFFER = "offer"
    RETURNING = "returning"


@dataclass
class Settings:
    look_seconds: float = 2.0
    robot_seconds: float = 3.0
    return_seconds: float = 2.0
    offer_timeout_seconds: float = 60.0
    transition_seconds: float = 0.35
    camera_width: int = 640
    camera_height: int = 480
    display_width: int = 1280
    display_height: int = 720
    http_port: int = 5000


@dataclass
class PersonObservation:
    face: tuple[int, int, int, int]
    frontal: bool
    eyes: int
    looking: bool


class InteractionController:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.state = DisplayState.STANDBY
        self.state_started = time.monotonic()
        self.look_started: Optional[float] = None
        self.active_face: Optional[tuple[int, int, int, int]] = None
        self.offer_left = True
        self.redeemed = threading.Event()

    def _set_state(self, state: DisplayState, now: float) -> None:
        if state == self.state:
            return
        LOG.info("state %s -> %s", self.state.value, state.value)
        self.state = state
        self.state_started = now

    def update(self, observation: Optional[PersonObservation], now: Optional[float] = None) -> None:
        now = time.monotonic() if now is None else now
        looking = bool(observation and observation.looking)

        if self.state == DisplayState.STANDBY:
            if looking:
                self.look_started = now
                self.active_face = observation.face if observation else None
                if observation:
                    self.offer_left = observation.face[0] < self.settings.camera_width / 2
                self._set_state(DisplayState.LOOKING, now)
            return

        if self.state == DisplayState.LOOKING:
            if looking:
                if observation:
                    self.active_face = observation.face
                    self.offer_left = observation.face[0] < self.settings.camera_width / 2
                if self.look_started is None:
                    self.look_started = now
                if now - self.look_started >= self.settings.look_seconds:
                    self._set_state(DisplayState.LIVE_ROBOT, now)
            else:
                self.look_started = None
                self.active_face = None
                self._set_state(DisplayState.STANDBY, now)
            return

        if self.state == DisplayState.LIVE_ROBOT:
            if observation:
                self.active_face = observation.face
                self.offer_left = observation.face[0] < self.settings.camera_width / 2
            if now - self.state_started >= self.settings.robot_seconds:
                self.redeemed.clear()
                self._set_state(DisplayState.OFFER, now)
            return

        if self.state == DisplayState.OFFER:
            if observation:
                self.active_face = observation.face
            if self.redeemed.is_set() or now - self.state_started >= self.settings.offer_timeout_seconds:
                self._set_state(DisplayState.RETURNING, now)
            return

        if self.state == DisplayState.RETURNING and now - self.state_started >= self.settings.return_seconds:
            self.look_started = None
            self.active_face = None
            self._set_state(DisplayState.STANDBY, now)

    def countdown(self, now: Optional[float] = None) -> Optional[float]:
        now = time.monotonic() if now is None else now
        if self.state == DisplayState.LOOKING and self.look_started is not None:
            return max(0.0, self.settings.look_seconds - (now - self.look_started))
        if self.state == DisplayState.LIVE_ROBOT:
            return max(0.0, self.settings.robot_seconds - (now - self.state_started))
        if self.state == DisplayState.RETURNING:
            return max(0.0, self.settings.return_seconds - (now - self.state_started))
        if self.state == DisplayState.OFFER:
            return max(0.0, self.settings.offer_timeout_seconds - (now - self.state_started))
        return None


def local_ip() -> str:
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.connect(("8.8.8.8", 80))
        return sock.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        sock.close()


def create_offer_server(controller: InteractionController, settings: Settings) -> Flask:
    if Flask is None:
        raise RuntimeError("Install the packages in requirements.txt before running the prototype")
    app = Flask(__name__)

    @app.get("/offer")
    def offer() -> Response:
        controller.redeemed.set()
        LOG.info("offer page visited; redemption signal received")
        return Response(
            "<!doctype html><html><head><meta name='viewport' "
            "content='width=device-width,initial-scale=1'></head>"
            "<body style='font-family:sans-serif;text-align:center;padding:3rem'>"
            "<h1>galati teknologiy</h1><p>Your 20% offer is ready.</p></body></html>",
            mimetype="text/html",
        )

    @app.get("/health")
    def health() -> Response:
        return Response("ok", mimetype="text/plain")

    def serve() -> None:
        logging.getLogger("werkzeug").setLevel(logging.ERROR)
        app.run(host="0.0.0.0", port=settings.http_port, threaded=True, use_reloader=False)

    threading.Thread(target=serve, name="offer-http", daemon=True).start()
    return app


def load_detectors() -> tuple[cv2.CascadeClassifier, cv2.CascadeClassifier]:
    if cv2 is None:
        raise RuntimeError("OpenCV is not installed. Install the packages in requirements.txt")

    cascade_dirs = []
    cv2_data = getattr(cv2, "data", None)
    if cv2_data is not None:
        haarcascades = getattr(cv2_data, "haarcascades", None)
        if haarcascades:
            cascade_dirs.append(Path(haarcascades))
    cascade_dirs.extend((
        Path("/usr/share/opencv4/haarcascades"),
        Path("/usr/share/opencv/haarcascades"),
        Path("/usr/local/share/opencv4/haarcascades"),
    ))
    base = next((directory for directory in cascade_dirs if directory.is_dir()), None)
    if base is None:
        searched = ", ".join(str(directory) for directory in cascade_dirs)
        raise RuntimeError(
            "OpenCV Haar cascade directory was not found. "
            f"Searched: {searched}. Install it with: sudo apt install -y opencv-data"
        )

    face_path = base / "haarcascade_frontalface_default.xml"
    eye_path = base / "haarcascade_eye_tree_eyeglasses.xml"
    if not eye_path.is_file():
        eye_path = base / "haarcascade_eye.xml"
    face = cv2.CascadeClassifier(str(face_path))
    eyes = cv2.CascadeClassifier(str(eye_path))
    if face.empty() or eyes.empty():
        raise RuntimeError(f"OpenCV Haar cascade files could not be loaded from {base}")
    return face, eyes


def detect_person(frame: np.ndarray, face_detector: cv2.CascadeClassifier,
                  eye_detector: cv2.CascadeClassifier) -> Optional[PersonObservation]:
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    faces = face_detector.detectMultiScale(gray, scaleFactor=1.15, minNeighbors=5, minSize=(55, 55))
    if len(faces) == 0:
        return None
    face = max(faces, key=lambda item: item[2] * item[3])
    x, y, width, height = [int(value) for value in face]
    face_gray = gray[y:y + height, x:x + width]
    detected_eyes = eye_detector.detectMultiScale(
        face_gray, scaleFactor=1.1, minNeighbors=4, minSize=(12, 12)
    )
    eye_count = len(detected_eyes)
    # This is deliberately a tunable POC heuristic, not identity or gaze recognition.
    frontal = width / max(height, 1) >= 0.72
    return PersonObservation((x, y, width, height), frontal, eye_count, frontal and eye_count >= 1)


def make_qr(url: str, size: int = 240) -> np.ndarray:
    if qrcode is None or cv2 is None:
        raise RuntimeError("QR/OpenCV dependencies are not installed")
    code = qrcode.QRCode(version=2, box_size=8, border=2)
    code.add_data(url)
    code.make(fit=True)
    image = code.make_image(fill_color="black", back_color="white").convert("RGB")
    image = np.asarray(image)[:, :, ::-1]
    return cv2.resize(image, (size, size), interpolation=cv2.INTER_NEAREST)


def text(frame: np.ndarray, value: str, origin: tuple[int, int], scale: float = 0.7,
         color: tuple[int, int, int] = (255, 255, 255), thickness: int = 2) -> None:
    cv2.putText(frame, value, origin, cv2.FONT_HERSHEY_SIMPLEX, scale, color, thickness, cv2.LINE_AA)


def draw_robot(frame: np.ndarray, center_x: int, floor_y: int, face_image: Optional[np.ndarray] = None) -> None:
    body_color = (70, 150, 210)
    head_center = (center_x, floor_y - 220)
    cv2.circle(frame, head_center, 65, (205, 205, 205), -1)
    cv2.circle(frame, head_center, 55, (30, 35, 40), -1)
    if face_image is not None and face_image.size:
        crop = cv2.resize(face_image, (88, 88))
        mask = np.zeros((88, 88), dtype=np.uint8)
        cv2.circle(mask, (44, 44), 40, 255, -1)
        roi = frame[head_center[1] - 44:head_center[1] + 44, center_x - 44:center_x + 44]
        np.copyto(roi, crop, where=mask[:, :, None].astype(bool))
    else:
        cv2.circle(frame, (center_x - 22, head_center[1] - 8), 7, (80, 220, 255), -1)
        cv2.circle(frame, (center_x + 22, head_center[1] - 8), 7, (80, 220, 255), -1)
        cv2.line(frame, (center_x - 20, head_center[1] + 25), (center_x + 20, head_center[1] + 25), (80, 220, 255), 3)
    cv2.rectangle(frame, (center_x - 55, floor_y - 150), (center_x + 55, floor_y - 35), body_color, -1)
    cv2.line(frame, (center_x - 45, floor_y - 35), (center_x - 75, floor_y), body_color, 18)
    cv2.line(frame, (center_x + 45, floor_y - 35), (center_x + 75, floor_y), body_color, 18)
    cv2.line(frame, (center_x - 55, floor_y - 125), (center_x - 120, floor_y - 80), body_color, 16)
    cv2.line(frame, (center_x + 55, floor_y - 125), (center_x + 125, floor_y - 175), body_color, 16)
    cv2.ellipse(frame, (center_x + 150, floor_y - 175), (55, 20), -15, 0, 360, (230, 230, 230), -1)


def render_tv(frame: np.ndarray, controller: InteractionController, settings: Settings,
              qr: np.ndarray, face_image: Optional[np.ndarray], now: float) -> np.ndarray:
    output = np.zeros((settings.display_height, settings.display_width, 3), dtype=np.uint8)
    output[:] = (22, 31, 48)
    state = controller.state
    if state in (DisplayState.STANDBY, DisplayState.LOOKING):
        cv2.rectangle(output, (0, 0), (settings.display_width, settings.display_height), (22, 31, 48), -1)
        label_size = cv2.getTextSize("STANDBY", cv2.FONT_HERSHEY_SIMPLEX, 2.0, 4)[0]
        text(output, "STANDBY", ((settings.display_width - label_size[0]) // 2, settings.display_height // 2), 2.0, (100, 220, 255), 4)
    elif state == DisplayState.LIVE_ROBOT:
        if frame.size:
            scaled = cv2.resize(frame, (settings.display_width, settings.display_height))
            output = cv2.addWeighted(scaled, 0.72, output, 0.28, 0)
        progress = min(1.0, (now - controller.state_started) / settings.robot_seconds)
        draw_robot(output, int(-120 + progress * (settings.display_width * 0.54)), settings.display_height - 55, None)
    elif state == DisplayState.OFFER:
        output[:] = (245, 241, 230)
        left_width = settings.display_width // 2
        offer_x = 0 if controller.offer_left else left_width
        robot_x = left_width + 300 if controller.offer_left else 300
        split_progress = min(1.0, (now - controller.state_started) / settings.transition_seconds)
        animated_width = int(left_width * split_progress)
        if controller.offer_left:
            output[:, :animated_width] = (245, 241, 230)
            output[:, left_width:left_width + animated_width] = (42, 52, 65)
        else:
            output[:, settings.display_width - animated_width:] = (245, 241, 230)
            output[:, left_width - animated_width:left_width] = (42, 52, 65)
        qr_x = (left_width - qr.shape[1]) // 2
        qr_y = (settings.display_height - qr.shape[0]) // 2
        output[qr_y:qr_y + qr.shape[0], offer_x + qr_x:offer_x + qr_x + qr.shape[1]] = qr
        text_color = (25, 35, 45)
        text(output, "SCAN FOR 20% OFF", (offer_x + 100, 115), 1.05, text_color, 3)
        text(output, "Redeem on your phone", (offer_x + 145, 620), 0.75, text_color, 2)
        draw_robot(output, robot_x, settings.display_height - 55, face_image)
        text(output, "aici poza cu mancare", (robot_x - 185, 115), 1.05, (230, 240, 250), 2)
    else:
        output[:] = (35, 45, 58)
        text(output, "Thanks!", (settings.display_width // 2 - 75, settings.display_height // 2), 1.4, (130, 230, 255), 3)

    remaining = controller.countdown(now)
    if remaining is not None:
        label = f"{state.value.replace('_', ' ').upper()}  {remaining:04.1f}s"
        text(output, label, (settings.display_width - 330, 42), 0.6, (255, 240, 130), 2)
    fade = min(1.0, max(0.0, (now - controller.state_started) / settings.transition_seconds))
    if fade < 1.0 and state not in (DisplayState.LOOKING, DisplayState.OFFER):
        output = cv2.addWeighted(output, fade, np.zeros_like(output), 1.0 - fade, 0)
    return output


def draw_camera_telemetry(frame: np.ndarray, observation: Optional[PersonObservation],
                          controller: InteractionController, fps: float) -> np.ndarray:
    view = frame.copy()
    if observation:
        x, y, width, height = observation.face
        color = (0, 220, 0) if observation.looking else (0, 165, 255)
        cv2.rectangle(view, (x, y), (x + width, y + height), color, 2)
        text(view, f"eyes={observation.eyes} frontal={observation.frontal}", (x, max(22, y - 8)), 0.5, color, 1)
    text(view, f"state: {controller.state.value}", (15, 28), 0.65, (255, 255, 255), 2)
    text(view, f"fps: {fps:04.1f}", (15, 55), 0.55, (180, 220, 255), 1)
    if controller.look_started is not None and controller.state == DisplayState.LOOKING:
        elapsed = time.monotonic() - controller.look_started
        text(view, f"looking: {elapsed:0.1f}/{controller.settings.look_seconds:0.1f}s", (15, 82), 0.55, (255, 240, 130), 1)
    return view


def open_camera(settings: Settings):
    if Picamera2 is None:
        raise RuntimeError("Picamera2 is not installed. Run: sudo apt install -y python3-picamera2")
    camera = Picamera2()
    camera.configure(camera.create_preview_configuration(
        main={"size": (settings.camera_width, settings.camera_height), "format": "RGB888"}
    ))
    camera.start()
    time.sleep(1.0)
    return camera


def run(settings: Settings) -> None:
    face_detector, eye_detector = load_detectors()
    controller = InteractionController(settings)
    offer_url = f"http://{local_ip()}:{settings.http_port}/offer"
    qr = make_qr(offer_url)
    create_offer_server(controller, settings)
    camera = open_camera(settings)
    last_frame = time.monotonic()
    fps = 0.0
    LOG.info("offer URL: %s", offer_url)
    LOG.info("press q in either window to quit")
    tracked_face_image = None
    try:
        while True:
            # Picamera2's RGB888 buffer is already laid out for OpenCV on Raspberry Pi.
            # Converting it again swaps red/blue and produces the blue-tinted preview.
            frame = np.ascontiguousarray(camera.capture_array())
            now = time.monotonic()
            delta = max(now - last_frame, 1e-6)
            last_frame = now
            fps = 0.9 * fps + 0.1 / delta
            observation = detect_person(frame, face_detector, eye_detector)
            controller.update(observation, now)
            face_image = None
            if observation and controller.state in (
                DisplayState.LOOKING, DisplayState.LIVE_ROBOT, DisplayState.OFFER
            ):
                x, y, width, height = observation.face
                tracked_face_image = frame[max(0, y):min(frame.shape[0], y + height),
                                           max(0, x):min(frame.shape[1], x + width)].copy()
            if controller.state in (DisplayState.LIVE_ROBOT, DisplayState.OFFER):
                face_image = tracked_face_image
            else:
                face_image = None
            tv = render_tv(frame, controller, settings, qr, face_image, now)
            telemetry = draw_camera_telemetry(frame, observation, controller, fps)
            cv2.imshow(WINDOW_TV, tv)
            cv2.imshow(WINDOW_CAMERA, telemetry)
            key = cv2.waitKey(1) & 0xFF
            if key == ord("q") or key == 27:
                break
    finally:
        camera.stop()
        cv2.destroyAllWindows()


def parse_args() -> Settings:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--look-seconds", type=float, default=2.0)
    parser.add_argument("--robot-seconds", type=float, default=3.0)
    parser.add_argument("--return-seconds", type=float, default=2.0)
    parser.add_argument("--offer-timeout", type=float, default=60.0)
    parser.add_argument("--port", type=int, default=5000)
    args = parser.parse_args()
    return Settings(
        look_seconds=args.look_seconds,
        robot_seconds=args.robot_seconds,
        return_seconds=args.return_seconds,
        offer_timeout_seconds=args.offer_timeout,
        http_port=args.port,
    )


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s", datefmt="%H:%M:%S")
    run(parse_args())
