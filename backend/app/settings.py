from pydantic_settings import BaseSettings, SettingsConfigDict

from app.infrastructure.database.config import PostgresConfig
from app.infrastructure.grammar_analysis.config import OpenAIConfig
from app.infrastructure.quota.config import PyRateLimiterConfig
from app.infrastructure.token_service.config import JwtConfig


class DatabaseSettings(BaseSettings):
    postgres: PostgresConfig
    model_config = SettingsConfigDict(env_nested_delimiter="__", extra="ignore")


class InfrastructureSettings(DatabaseSettings):
    openai: OpenAIConfig
    jwt: JwtConfig
    analysis_quota: PyRateLimiterConfig
    e2e_testing: bool = False
