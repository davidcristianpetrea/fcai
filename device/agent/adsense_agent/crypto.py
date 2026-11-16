from __future__ import annotations

import hashlib
import hmac
import secrets
from dataclasses import dataclass
from enum import StrEnum

from cryptography.hazmat.primitives import hashes
from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC


class CryptoError(ValueError):
    pass


class AuthMode(StrEnum):
    NONE = "none"
    PSK = "psk"
    PAIRING = "pairing"


@dataclass(frozen=True)
class SessionKeys:
    encryption: bytes
    authentication: bytes


def keys_for_auth_mode(mode: AuthMode | str, credential: bytes | str | None, salt: bytes) -> SessionKeys | None:
    selected = AuthMode(mode)
    if selected is AuthMode.NONE:
        return None
    if credential is None:
        raise CryptoError(f"{selected.value} authentication requires a credential")
    return derive_session_keys(credential, salt)


def derive_session_keys(secret: bytes | str, salt: bytes, *, iterations: int = 310_000, info: bytes = b"adsense-ble-v1") -> SessionKeys:
    raw = secret.encode() if isinstance(secret, str) else secret
    if not raw or not salt or iterations < 1:
        raise CryptoError("secret, salt, and iterations are required")
    stretched = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=iterations).derive(raw)
    material = HKDF(algorithm=hashes.SHA256(), length=64, salt=salt, info=info).derive(stretched)
    return SessionKeys(material[:32], material[32:])


def hmac_sha256(key: bytes, message: bytes) -> bytes:
    return hmac.new(key, message, hashlib.sha256).digest()


def verify_hmac(key: bytes, message: bytes, tag: bytes) -> None:
    if not hmac.compare_digest(hmac_sha256(key, message), tag):
        raise CryptoError("invalid authentication tag")


def encrypt(keys: SessionKeys, plaintext: bytes, *, aad: bytes = b"") -> tuple[bytes, bytes]:
    nonce = secrets.token_bytes(12)
    return nonce, AESGCM(keys.encryption).encrypt(nonce, plaintext, aad)


def decrypt(keys: SessionKeys, nonce: bytes, ciphertext: bytes, *, aad: bytes = b"") -> bytes:
    if len(nonce) != 12:
        raise CryptoError("AES-GCM nonce must be 12 bytes")
    try:
        return AESGCM(keys.encryption).decrypt(nonce, ciphertext, aad)
    except InvalidTag as error:
        raise CryptoError("invalid encrypted payload") from error
