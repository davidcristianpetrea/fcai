from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class AgentConfig:
    host: str = "127.0.0.1"
    http_port: int = 8765
    websocket_port: int = 8766
    device_id: str = "dev-display"
    cloud_base_url: str = ""
    link_code: str = ""
    data_dir: Path = Path("data")
    platform: str = "auto"

    @classmethod
    def from_env(cls) -> "AgentConfig":
        return cls(
            host=os.getenv("ADSENSE_AGENT_HOST", cls.host),
            http_port=int(os.getenv("ADSENSE_AGENT_HTTP_PORT", cls.http_port)),
            websocket_port=int(os.getenv("ADSENSE_AGENT_WS_PORT", cls.websocket_port)),
            device_id=os.getenv("ADSENSE_DEVICE_ID", cls.device_id),
            cloud_base_url=os.getenv("ADSENSE_CLOUD_BASE_URL", cls.cloud_base_url),
            link_code=os.getenv("ADSENSE_LINK_CODE", cls.link_code),
            data_dir=Path(os.getenv("ADSENSE_DATA_DIR", str(cls.data_dir))),
            platform=os.getenv("ADSENSE_PLATFORM", cls.platform),
        )


def load_config() -> AgentConfig:
    return AgentConfig.from_env()
