import unittest

from adsense_agent.bluetooth import NotSupported, create_bluetooth_transport
from adsense_agent.bluetooth_protocol import ChunkReassembler, Frame, ReplayError, ReplayCounter, chunk_frame, decode_frame, encode_frame
from adsense_agent.crypto import decrypt, derive_session_keys, encrypt, hmac_sha256, verify_hmac
from adsense_agent.redaction import mask_wifi_password


class BluetoothTests(unittest.TestCase):
    def test_frame_round_trip_and_chunk_reassembly(self) -> None:
        encoded = encode_frame(Frame(2, 7, b"credentials", encrypted=True))
        chunks = chunk_frame(encoded, max_chunk_payload=3, frame_id=42)
        reassembler = ChunkReassembler()
        rebuilt = next(result for chunk in reversed(chunks) for result in [reassembler.add(chunk)] if result is not None)
        self.assertEqual(decode_frame(rebuilt), Frame(2, 7, b"credentials", encrypted=True))

    def test_replay_counter_is_monotonic(self) -> None:
        counter = ReplayCounter()
        counter.accept(1)
        with self.assertRaises(ReplayError):
            counter.accept(1)

    def test_crypto_vector_is_stable(self) -> None:
        keys = derive_session_keys("correct horse battery staple", b"0123456789abcdef", iterations=1000)
        nonce, ciphertext = encrypt(keys, b"hello", aad=b"header")
        self.assertEqual(decrypt(keys, nonce, ciphertext, aad=b"header"), b"hello")
        tag = hmac_sha256(keys.authentication, b"header")
        verify_hmac(keys.authentication, b"header", tag)

    def test_windows_transport_is_not_supported(self) -> None:
        with self.assertRaises(NotSupported):
            create_bluetooth_transport("windows")

    def test_wifi_password_is_redacted(self) -> None:
        self.assertEqual(mask_wifi_password("secret"), "***")
        self.assertEqual(mask_wifi_password(""), "")


if __name__ == "__main__":
    unittest.main()
