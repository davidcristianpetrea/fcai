from __future__ import annotations

import struct
from dataclasses import dataclass

from .generated_protocol import BLE_MAX_CHUNK_PAYLOAD, BLE_PROTOCOL_VERSION


class ProtocolError(ValueError):
    pass


class ReplayError(ProtocolError):
    pass


FRAME_MAGIC = b"AS"
FRAME_HEADER = struct.Struct("!2sBBBBQI")
CHUNK_MAGIC = b"AC"
CHUNK_HEADER = struct.Struct("!2sBHHHI")
FLAG_ENCRYPTED = 1


@dataclass(frozen=True)
class Frame:
    message_type: int
    counter: int
    payload: bytes
    encrypted: bool = False


def encode_frame(frame: Frame) -> bytes:
    if not 0 <= frame.message_type <= 255 or not 0 <= frame.counter <= 2**64 - 1:
        raise ProtocolError("frame fields out of range")
    flags = FLAG_ENCRYPTED if frame.encrypted else 0
    header = FRAME_HEADER.pack(FRAME_MAGIC, BLE_PROTOCOL_VERSION, flags, frame.message_type, 0, frame.counter, len(frame.payload))
    return header + frame.payload


def decode_frame(data: bytes) -> Frame:
    if len(data) < FRAME_HEADER.size:
        raise ProtocolError("frame is truncated")
    magic, version, flags, message_type, reserved, counter, payload_length = FRAME_HEADER.unpack_from(data)
    if magic != FRAME_MAGIC or version != BLE_PROTOCOL_VERSION or reserved != 0:
        raise ProtocolError("invalid frame header")
    payload = data[FRAME_HEADER.size:]
    if len(payload) != payload_length:
        raise ProtocolError("frame payload length mismatch")
    if flags & ~FLAG_ENCRYPTED:
        raise ProtocolError("unknown frame flags")
    return Frame(message_type, counter, payload, bool(flags & FLAG_ENCRYPTED))


def chunk_frame(frame: bytes, max_chunk_payload: int = BLE_MAX_CHUNK_PAYLOAD, frame_id: int = 0) -> list[bytes]:
    if max_chunk_payload <= 0 or not 0 <= frame_id <= 2**32 - 1:
        raise ValueError("invalid chunk parameters")
    count = max(1, (len(frame) + max_chunk_payload - 1) // max_chunk_payload)
    if count > 65535:
        raise ProtocolError("frame requires too many chunks")
    return [
        CHUNK_HEADER.pack(CHUNK_MAGIC, BLE_PROTOCOL_VERSION, index, count, len(part), frame_id) + part
        for index in range(count)
        for part in [frame[index * max_chunk_payload : (index + 1) * max_chunk_payload]]
    ]


@dataclass
class ChunkReassembler:
    frame_id: int | None = None
    count: int | None = None
    chunks: dict[int, bytes] | None = None

    def __post_init__(self) -> None:
        self.chunks = {} if self.chunks is None else self.chunks

    def add(self, chunk: bytes) -> bytes | None:
        if len(chunk) < CHUNK_HEADER.size:
            raise ProtocolError("chunk is truncated")
        magic, version, index, count, payload_length, frame_id = CHUNK_HEADER.unpack_from(chunk)
        payload = chunk[CHUNK_HEADER.size:]
        if magic != CHUNK_MAGIC or version != BLE_PROTOCOL_VERSION or count == 0 or index >= count:
            raise ProtocolError("invalid chunk header")
        if len(payload) != payload_length:
            raise ProtocolError("chunk payload length mismatch")
        if self.frame_id is None:
            self.frame_id, self.count = frame_id, count
        if frame_id != self.frame_id or count != self.count:
            raise ProtocolError("chunk stream changed")
        self.chunks[index] = payload
        if len(self.chunks) != count:
            return None
        result = b"".join(self.chunks[i] for i in range(count))
        self.frame_id, self.count, self.chunks = None, None, {}
        return result


@dataclass
class ReplayCounter:
    highest: int = -1

    def accept(self, counter: int) -> None:
        if counter <= self.highest:
            raise ReplayError("replayed or stale counter")
        self.highest = counter
