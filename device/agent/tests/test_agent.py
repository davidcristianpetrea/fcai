import json
import tempfile
import unittest
from pathlib import Path

from adsense_agent.config import AgentConfig
from adsense_agent.platform import RaspberryPiAdapter, WindowsAdapter
from adsense_agent.runtime import AgentRuntime


class AgentTests(unittest.IsolatedAsyncioTestCase):
    async def test_sync_stays_local_and_identify_reports_platform(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            runtime = AgentRuntime(
                AgentConfig(data_dir=Path(directory)),
                platform=WindowsAdapter(),
            )
            response = await runtime.handle_message({"type": "sync", "playlist": ["a.jpg"]})
            self.assertEqual(response["type"], "sync_ack")
            self.assertEqual(runtime.store.read()["playlist"], ["a.jpg"])
            self.assertFalse(response["state"]["platform"]["bluetooth"])

    async def test_pi_adapter_is_explicit(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            runtime = AgentRuntime(
                AgentConfig(data_dir=Path(directory)),
                platform=RaspberryPiAdapter(),
            )
            response = await runtime.handle_message({"type": "identify"})
            self.assertTrue(response["platform"]["bluetooth"])

    async def test_unknown_message_is_an_error(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            runtime = AgentRuntime(AgentConfig(data_dir=Path(directory)))
            response = await runtime.handle_message({"type": "frame"})
            self.assertEqual(response, {"type": "error", "error": "unsupported_message"})


if __name__ == "__main__":
    unittest.main()
