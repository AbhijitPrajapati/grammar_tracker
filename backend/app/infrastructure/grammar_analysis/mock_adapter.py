from app.application.contracts.audio import AudioSample
from app.application.ports.services import GrammarAnalyzer
from app.domain.analysis import (
    Analysis,
    CategoryFrequency,
    Mistake,
    MistakeCategory,
)


class DeterministicGrammarAnalysisAdapter(GrammarAnalyzer):
    async def analyze(self, audio: AudioSample) -> tuple[str, Analysis]:
        return (
            "She go to the store yesterday and buy two apple.",
            Analysis(
                mistakes=(
                    Mistake(
                        category=MistakeCategory.SUBJECT_VERB_AGREEMENT,
                        original_text="She go",
                        correction="She goes",
                        explanation="A third-person singular subject needs 'goes'.",
                    ),
                    Mistake(
                        category=MistakeCategory.VERB_TENSE,
                        original_text="buy",
                        correction="bought",
                        explanation="The completed action requires past tense.",
                    ),
                    Mistake(
                        category=MistakeCategory.PLURALITY,
                        original_text="two apple",
                        correction="two apples",
                        explanation="A quantity greater than one needs a plural noun.",
                    ),
                ),
                frequencies=(
                    CategoryFrequency(MistakeCategory.SUBJECT_VERB_AGREEMENT, 1, 1),
                    CategoryFrequency(MistakeCategory.VERB_TENSE, 1, 2),
                    CategoryFrequency(MistakeCategory.ARTICLE_USAGE, 0, 2),
                    CategoryFrequency(MistakeCategory.PREPOSITION_USAGE, 0, 1),
                    CategoryFrequency(MistakeCategory.WORD_ORDER, 0, 1),
                    CategoryFrequency(MistakeCategory.PLURALITY, 1, 1),
                ),
                feedback="Good effort. Focus on agreement, tense, and plural nouns.",
            ),
        )
