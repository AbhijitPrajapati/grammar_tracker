from app.application.use_cases.account.change_password import ChangePassword
from app.application.use_cases.account.delete_user import DeleteUser
from app.application.use_cases.analytics.retrieve_distribution import (
    RetrieveDistribution,
)
from app.application.use_cases.analytics.retrieve_time_series import RetrieveTimeSeries
from app.application.use_cases.auth.get_user_id_from_token import GetUserIdFromToken
from app.application.use_cases.auth.login import Login
from app.application.use_cases.auth.register_user import RegisterUser
from app.application.use_cases.speeches.delete_speech import DeleteSpeech
from app.application.use_cases.speeches.list_speeches import ListSpeeches
from app.application.use_cases.speeches.process_speech import ProcessSpeech
from app.infrastructure.composition import InfrastructureComposition
from app.settings import InfrastructureSettings


class ApplicationContainer:
    def __init__(self, settings: InfrastructureSettings) -> None:
        self.infrastructure = InfrastructureComposition(settings)
        self.change_password = ChangePassword(
            self.infrastructure.uow_factory,
            self.infrastructure.password_hasher,
        )
        self.delete_user = DeleteUser(self.infrastructure.uow_factory)
        self.retrieve_distribution = RetrieveDistribution(
            self.infrastructure.uow_factory
        )
        self.retrieve_time_series = RetrieveTimeSeries(self.infrastructure.uow_factory)
        self.get_user_id_from_token = GetUserIdFromToken(
            self.infrastructure.token_service, self.infrastructure.uow_factory
        )
        self.login = Login(
            self.infrastructure.uow_factory,
            self.infrastructure.password_hasher,
            self.infrastructure.token_service,
        )
        self.register_user = RegisterUser(
            self.infrastructure.uow_factory, self.infrastructure.password_hasher
        )
        self.delete_speech = DeleteSpeech(self.infrastructure.uow_factory)
        self.list_speeches = ListSpeeches(self.infrastructure.uow_factory)
        self.process_speech = ProcessSpeech(
            self.infrastructure.uow_factory,
            self.infrastructure.grammar_analyzer,
            self.infrastructure.analysis_quota_enforcer,
        )

    async def close(self) -> None:
        await self.infrastructure.close()
