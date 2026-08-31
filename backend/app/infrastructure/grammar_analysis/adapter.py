from openai import AsyncOpenAI, RateLimitError
from pydantic import BaseModel

from app.application.contracts.audio import AudioSample
from app.application.ports.services import AnalysisQuotaExhausted, GrammarAnalyzer
from app.domain.analysis import (
    Analysis,
    CategoryFrequency,
    Mistake,
    MistakeCategory,
)

from .config import OpenAIConfig


class MistakePayload(BaseModel):
    category: MistakeCategory
    original_text: str
    correction: str
    explanation: str


class FrequencyPayload(BaseModel):
    category: MistakeCategory
    occurrences: int
    opportunities: int


class AnalysisPayload(BaseModel):
    mistakes: list[MistakePayload]
    frequencies: list[FrequencyPayload]
    feedback: str


class OpenAIGrammarAnalysisAdapter(GrammarAnalyzer):
    def __init__(self, config: OpenAIConfig) -> None:
        self.text_model = config.text_model
        self.transcription_model = config.transcription_model
        api_key = config.api_key.get_secret_value()
        self.client = AsyncOpenAI(api_key=api_key)

    async def analyze(self, audio: AudioSample) -> tuple[str, Analysis]:
        try:
            transcription = await self.client.audio.transcriptions.create(
                model=self.transcription_model, file=(audio.filename, audio.content)
            )
            response = await self.client.responses.parse(
                model=self.text_model,
                input=[
                    {
                        "role": "system",
                        "content": (
                            "Analyze the learner's English grammar. Use only the "
                            "categories in the supplied JSON schema. Count an "
                            "opportunity whenever the category could be evaluated; "
                            "occurrences must not exceed opportunities. Return JSON only."
                        ),
                    },
                    {"role": "user", "content": transcription.text},
                ],
                text_format=AnalysisPayload,
            )
        except RateLimitError as e:
            raise AnalysisQuotaExhausted() from e
        payload = response.output_parsed
        if payload is None:
            raise ValueError("LLM output does not adhere to analysis schema.")
        analysis = Analysis(
            mistakes=tuple(
                Mistake(
                    category=item.category,
                    original_text=item.original_text,
                    correction=item.correction,
                    explanation=item.explanation,
                )
                for item in payload.mistakes
            ),
            frequencies=tuple(
                CategoryFrequency(
                    category=item.category,
                    occurrences=item.occurrences,
                    opportunities=item.opportunities,
                )
                for item in payload.frequencies
            ),
            feedback=payload.feedback,
        )
        return transcription.text, analysis
