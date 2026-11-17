from __future__ import annotations

from collections.abc import Callable
from typing import Protocol


class Indicator(Protocol):
    def set_status(self, status: str) -> None: ...

    def clear(self) -> None: ...


class NullIndicator:
    """No-op indicator for headless and test environments."""

    def set_status(self, status: str) -> None:
        del status

    def clear(self) -> None:
        return


class HudIndicator:
    """Adapter for a renderer HUD callback; GPIO is intentionally out of scope."""

    def __init__(self, update: Callable[[dict[str, str]], None]) -> None:
        self._update = update

    def set_status(self, status: str) -> None:
        self._update({"status": status})

    def clear(self) -> None:
        self._update({})
