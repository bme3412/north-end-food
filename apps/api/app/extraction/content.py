"""Raw snapshot bytes -> clean text suitable for an LLM prompt.

Dispatches on menu_sources.source_format ("html" or "pdf"). Doesn't attempt
to be a general-purpose readability engine — just strips the boilerplate
that would otherwise pad out every prompt (nav, scripts, footers).
"""

from __future__ import annotations

import io

from bs4 import BeautifulSoup
from pypdf import PdfReader

MAX_CHARS = 20_000
STRIP_TAGS = ("script", "style", "nav", "footer", "header", "noscript", "svg", "form")


def extract_text(raw_bytes: bytes, source_format: str) -> str:
    if source_format == "pdf":
        text = _pdf_text(raw_bytes)
    else:
        text = _html_text(raw_bytes)
    return text[:MAX_CHARS]


def _html_text(raw_bytes: bytes) -> str:
    soup = BeautifulSoup(raw_bytes, "html.parser")
    for tag in soup(STRIP_TAGS):
        tag.decompose()
    lines = [line.strip() for line in soup.get_text("\n").splitlines()]
    return "\n".join(line for line in lines if line)


def _pdf_text(raw_bytes: bytes) -> str:
    reader = PdfReader(io.BytesIO(raw_bytes))
    pages = [page.extract_text() or "" for page in reader.pages]
    return "\n".join(pages).strip()
