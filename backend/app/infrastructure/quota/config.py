from pydantic import BaseModel


class PyRateLimiterConfig(BaseModel):
    minute_limit: int = 3
    day_limit: int = 20
