from typing import Protocol
from uuid import UUID

from app.application.contracts.audio import AudioSample
from app.domain.analysis import Analysis


class AnalysisQuotaExhausted(Exception):
    """Raised by the grammar analyzer when quota is reached, and by the quote enforcer"""


class PasswordHasher(Protocol):
    def hash(self, password: str) -> str: ...
    def verify(self, password: str, password_hash: str) -> bool: ...


class TokenService(Protocol):
    def issue(self, user_id: UUID) -> str: ...
    def verify(self, token: str) -> UUID | None: ...


class GrammarAnalyzer(Protocol):
    async def analyze(self, audio: AudioSample) -> tuple[str, Analysis]: ...


class AnalysisQuotaEnforcer(Protocol):
    async def try_consume(self, user_id: UUID) -> bool: ...
