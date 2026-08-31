from app.settings import InfrastructureSettings

from .database import (
    SqlAlchemyUnitOfWorkFactory,
    create_engine,
    create_session_factory,
)
from .grammar_analysis import (
    DeterministicGrammarAnalysisAdapter,
    OpenAIGrammarAnalysisAdapter,
)
from .logging import logging_setup
from .password_hasher import PwdLibPasswordHasher
from .quota import PyRateLimiterAnalysisQuotaEnforcer
from .token_service import JwtTokenService


class InfrastructureComposition:
    def __init__(self, settings: InfrastructureSettings) -> None:
        logging_setup()
        self.engine = create_engine(settings.postgres)
        session_factory = create_session_factory(self.engine)
        self.uow_factory = SqlAlchemyUnitOfWorkFactory(session_factory)
        self.grammar_analyzer = (
            DeterministicGrammarAnalysisAdapter()
            if settings.e2e_testing
            else OpenAIGrammarAnalysisAdapter(settings.openai)
        )
        self.password_hasher = PwdLibPasswordHasher()
        self.token_service = JwtTokenService(settings.jwt)
        self.analysis_quota_enforcer = PyRateLimiterAnalysisQuotaEnforcer(
            settings.analysis_quota
        )

    async def close(self) -> None:
        await self.engine.dispose()
