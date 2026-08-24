"""Gemini client for menu extraction.

Inert without GEMINI_API_KEY: extract_menu_items returns None immediately
so callers (app/extraction/pipeline.py) can fail loudly with a clear
ExtractionError rather than silently writing nothing.
"""

from __future__ import annotations

from google import genai
from google.genai import types

from app.config import settings
from app.extraction.schema import ExtractionResult


def is_configured() -> bool:
    return bool(settings.gemini_api_key)


def extract_menu_items(prompt: str) -> ExtractionResult | None:
    if not is_configured():
        return None

    client = genai.Client(api_key=settings.gemini_api_key)
    response = client.models.generate_content(
        model=settings.gemini_model,
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=ExtractionResult,
        ),
    )

    parsed = response.parsed
    if isinstance(parsed, ExtractionResult):
        return parsed
    return None
