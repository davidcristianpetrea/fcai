from __future__ import annotations


def mask_wifi_password(password: str) -> str:
    return "" if not password else "***"
