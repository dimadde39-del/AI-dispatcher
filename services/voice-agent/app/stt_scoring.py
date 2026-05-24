from dataclasses import dataclass
import re

from .stt_scenarios import SttScenario


KAZAKH_CHAR_PATTERN = re.compile(r"[әғқңөұүһіӘҒҚҢӨҰҮҺІ]")
RUSSIAN_CHAR_PATTERN = re.compile(r"[а-яёА-ЯЁ]")
SPANISH_OR_ENGLISH_JUNK = (
    "hola",
    "buenos",
    "gracias",
    "senor",
    "señor",
    "hello",
    "thank you",
    "thanks",
    "water leak",
    "plumber",
    "address",
    "my name is",
    "bathroom",
)


@dataclass(frozen=True)
class SttScore:
    keyword_hits: list[str]
    missed_keywords: list[str]
    has_russian: bool
    has_kazakh_chars: bool
    likely_wrong_language: bool
    score: int
    warnings: list[str]

    def to_public_dict(self) -> dict[str, object]:
        return {
            "keyword_hits": self.keyword_hits,
            "missed_keywords": self.missed_keywords,
            "has_russian": self.has_russian,
            "has_kazakh_chars": self.has_kazakh_chars,
            "likely_wrong_language": self.likely_wrong_language,
            "score": self.score,
            "warnings": self.warnings,
        }


def score_transcript(transcript: str, scenario: SttScenario) -> SttScore:
    normalized_transcript = _normalize(transcript)
    keyword_hits: list[str] = []
    missed_keywords: list[str] = []

    for keyword in scenario.expected_keywords:
        if _normalize(keyword) in normalized_transcript:
            keyword_hits.append(keyword)
        else:
            missed_keywords.append(keyword)

    has_russian = bool(RUSSIAN_CHAR_PATTERN.search(transcript))
    has_kazakh_chars = bool(KAZAKH_CHAR_PATTERN.search(transcript))
    likely_wrong_language = _looks_like_wrong_language(normalized_transcript, scenario.expected_language)
    keyword_score = _keyword_score(keyword_hits, scenario.expected_keywords)
    language_score = _language_score(scenario.expected_language, has_russian, has_kazakh_chars)
    score = max(0, min(100, keyword_score + language_score))

    warnings: list[str] = []
    if missed_keywords:
        warnings.append("missed_keywords")
    if likely_wrong_language:
        warnings.append("likely_wrong_language")
        score = max(0, score - 40)
    if not has_russian and not has_kazakh_chars:
        warnings.append("no_cyrillic_detected")
    if scenario.expected_language == "kk" and not has_kazakh_chars:
        warnings.append("kazakh_chars_missing")
    if scenario.expected_language == "mixed" and (not has_russian or not has_kazakh_chars):
        warnings.append("mixed_language_signal_missing")

    return SttScore(
        keyword_hits=keyword_hits,
        missed_keywords=missed_keywords,
        has_russian=has_russian,
        has_kazakh_chars=has_kazakh_chars,
        likely_wrong_language=likely_wrong_language,
        score=score,
        warnings=warnings,
    )


def _keyword_score(keyword_hits: list[str], expected_keywords: tuple[str, ...]) -> int:
    if not expected_keywords:
        return 80

    return round((len(keyword_hits) / len(expected_keywords)) * 80)


def _language_score(expected_language: str, has_russian: bool, has_kazakh_chars: bool) -> int:
    if expected_language == "kk":
        return 20 if has_kazakh_chars else 0

    if expected_language == "mixed":
        return (10 if has_russian else 0) + (10 if has_kazakh_chars else 0)

    return 20 if has_russian else 0


def _looks_like_wrong_language(normalized_transcript: str, expected_language: str) -> bool:
    if expected_language not in {"ru", "kk", "mixed"}:
        return False

    return any(marker in normalized_transcript for marker in SPANISH_OR_ENGLISH_JUNK)


def _normalize(value: str) -> str:
    return " ".join(value.casefold().replace("ё", "е").split())
