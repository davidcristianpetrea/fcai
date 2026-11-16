"""Local AdSense device agent."""

from .config import AgentConfig, load_config
from .runtime import AgentRuntime

__all__ = ["AgentConfig", "AgentRuntime", "load_config"]


def main() -> None:
    """Run the local agent until interrupted."""
    AgentRuntime(load_config()).run()
