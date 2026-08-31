from uuid import UUID

from pyrate_limiter import (
    BucketAsyncWrapper,
    Duration,
    InMemoryBucket,
    Limiter,
    Rate,
)

from app.application.ports.services import AnalysisQuotaEnforcer

from .config import PyRateLimiterConfig


class PyRateLimiterAnalysisQuotaEnforcer(AnalysisQuotaEnforcer):
    def __init__(self, config: PyRateLimiterConfig) -> None:
        rates = [
            Rate(config.minute_limit, Duration.MINUTE),
            Rate(config.day_limit, Duration.DAY),
        ]
        self.limiter = Limiter(BucketAsyncWrapper(InMemoryBucket(rates)))

    async def try_consume(self, user_id: UUID) -> bool:
        return await self.limiter.try_acquire_async(
            f"speech-upload:{user_id}", blocking=False
        )
