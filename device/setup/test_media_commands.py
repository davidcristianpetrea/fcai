import unittest
from pathlib import Path

from media_commands import ffmpeg_command, ffprobe_command


class MediaCommandTests(unittest.TestCase):
    def test_ffmpeg_is_an_argument_list(self) -> None:
        command = ffmpeg_command(Path("input file.mp4"), Path("output file.mp4"))
        self.assertEqual(command[0], "ffmpeg")
        self.assertIn("input file.mp4", command)
        self.assertNotIn("&&", command)

    def test_ffprobe_is_an_argument_list(self) -> None:
        command = ffprobe_command(Path("input.mp4"))
        self.assertEqual(command[0], "ffprobe")
        self.assertEqual(command[-1], "input.mp4")


if __name__ == "__main__":
    unittest.main()
