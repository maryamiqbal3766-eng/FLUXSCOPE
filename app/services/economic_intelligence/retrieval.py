from __future__ import annotations

import re
from dataclasses import dataclass

from .chunker import EconomicChunker, TextChunk
from .schemas import SourceDocument


@dataclass(frozen=True)
class RetrievedChunk:
    chunk: TextChunk
    score: float
    source: SourceDocument


def _terms(text: str) -> set[str]:
    return {
        token.lower()
        for token in re.findall(r"[A-Za-z0-9_/%.-]{2,}", text)
        if token.lower() not in {"the", "and", "for", "from", "with", "that", "this"}
    }


class LocalEconomicRetriever:
    """Dependency-light retrieval implementation.

    It provides the same conceptual RAG boundary without requiring an
    embedding service or vector database. It can later be replaced by
    pgvector/LlamaIndex without changing the detector contract.
    """

    def __init__(self, chunker: EconomicChunker | None = None):
        self.chunker = chunker or EconomicChunker()
        self._sources: dict[str, SourceDocument] = {}
        self._chunks: list[TextChunk] = []

    def add_source(self, source: SourceDocument) -> None:
        self._sources[str(source.source_id)] = source
        self._chunks.extend(self.chunker.chunk(str(source.source_id), source.content))

    def retrieve(
        self,
        query: str,
        *,
        top_k: int = 5,
        source_id: str | None = None,
    ) -> list[RetrievedChunk]:
        """Return the best-matching chunks, optionally limited to one source.

        Limiting retrieval to one source keeps evidence attributable: a chunk
        is only ever reported under the document it actually came from.
        """
        q = _terms(query)
        if not q:
            return []

        results: list[RetrievedChunk] = []
        for chunk in self._chunks:
            if source_id is not None and chunk.source_id != source_id:
                continue
            c = _terms(chunk.text)
            overlap = len(q & c)
            if overlap == 0:
                continue
            score = overlap / max(1, len(q))
            source = self._sources[chunk.source_id]
            results.append(RetrievedChunk(chunk=chunk, score=score, source=source))

        results.sort(key=lambda item: (-item.score, item.chunk.chunk_id))
        return results[:top_k]
