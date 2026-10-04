from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import urlparse


@dataclass(frozen=True)
class ApprovedSource:
    publisher: str
    domains: tuple[str, ...]
    role: str


class ApprovedSourceRegistry:
    """Explicit allowlist for TADBIR DETECT.

    The registry intentionally stores domains rather than inventing individual
    URLs. Exact source URLs belong to the ingestion/source-data layer.
    """

    def __init__(self, sources: tuple[ApprovedSource, ...] | None = None):
        self._sources = sources or (
            ApprovedSource(
                publisher="State Bank of Pakistan",
                domains=("sbp.org.pk",),
                role="approved economic and monetary evidence",
            ),
            ApprovedSource(
                publisher="Pakistan Bureau of Statistics",
                domains=("pbs.gov.pk",),
                role="approved official statistics",
            ),
            ApprovedSource(
                publisher="Government of Pakistan",
                domains=("gov.pk",),
                role="approved government publications",
            ),
        )

    @property
    def sources(self) -> tuple[ApprovedSource, ...]:
        return self._sources

    def is_approved(self, *, publisher: str | None, url: str | None) -> bool:
        if not url:
            return False
        host = (urlparse(url).hostname or "").lower().removeprefix("www.")
        if not host:
            return False

        for source in self._sources:
            publisher_ok = not publisher or publisher.strip().lower() == source.publisher.lower()
            domain_ok = any(host == d or host.endswith("." + d) for d in source.domains)
            if publisher_ok and domain_ok:
                return True
        return False

    def publisher_for_domain(self, url: str | None) -> str | None:
        if not url:
            return None
        host = (urlparse(url).hostname or "").lower().removeprefix("www.")
        for source in self._sources:
            if any(host == d or host.endswith("." + d) for d in source.domains):
                return source.publisher
        return None
