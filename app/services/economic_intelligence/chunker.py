from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass(frozen=True)
class TextChunk:
    chunk_id: str
    source_id: str
    text: str
    start_char: int
    end_char: int


class EconomicChunker:
    """Simple deterministic chunker for the MVP/local RAG path."""

    def __init__(self, chunk_size: int = 1400, overlap: int = 180):
        if chunk_size <= 0 or overlap < 0 or overlap >= chunk_size:
            raise ValueError("invalid chunk_size/overlap")
        self.chunk_size = chunk_size
        self.overlap = overlap

    def chunk(self, source_id: str, text: str) -> list[TextChunk]:
        normalized = re.sub(r"\s+", " ", text).strip()
        if not normalized:
            return []

        chunks: list[TextChunk] = []
        start = 0
        index = 0
        while start < len(normalized):
            end = min(len(normalized), start + self.chunk_size)
            if end < len(normalized):
                boundary = normalized.rfind(" ", start, end)
                if boundary > start + self.chunk_size // 2:
                    end = boundary

            chunks.append(
                TextChunk(
                    chunk_id=f"{source_id}:{index}",
                    source_id=source_id,
                    text=normalized[start:end],
                    start_char=start,
                    end_char=end,
                )
            )
            if end >= len(normalized):
                break
            start = end - self.overlap
            index += 1

        return chunks
