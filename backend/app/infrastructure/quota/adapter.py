from uuid import UUID

from pyrate_limiter import (
    BucketAsyncWrapper,
    BucketFactory,
    Duration,
    InMemoryBucket,
    Limiter,
    Rate,
    RateItem,
)

from app.application.ports.services import AnalysisQuotaEnforcer

from .config import PyRateLimiterConfig


class PerUserBucketFactory(BucketFactory):
    def __init__(self, rates: list[Rate]) -> None:
        self.rates = rates
        self.buckets: dict[str, BucketAsyncWrapper] = {}

    def wrap_item(self, name: str, weight: int = 1) -> RateItem:
        bucket = self._get_or_create(name)
        return RateItem(name, bucket.now(), weight=weight)

    def get(self, item: RateItem) -> BucketAsyncWrapper:
        return self._get_or_create(item.name)

    def _get_or_create(self, name: str) -> BucketAsyncWrapper:
        bucket = self.buckets.get(name)
        if bucket is None:
            bucket = BucketAsyncWrapper(InMemoryBucket(self.rates))
            self.buckets[name] = bucket
            self.schedule_leak(bucket)
        return bucket


class PyRateLimiterAnalysisQuotaEnforcer(AnalysisQuotaEnforcer):
    def __init__(self, config: PyRateLimiterConfig) -> None:
        rates = [
            Rate(config.minute_limit, Duration.MINUTE),
            Rate(config.day_limit, Duration.DAY),
        ]
        self.limiter = Limiter(PerUserBucketFactory(rates))

    async def try_consume(self, user_id: UUID) -> bool:
        return await self.limiter.try_acquire_async(
            f"speech-upload:{user_id}", blocking=False
        )
