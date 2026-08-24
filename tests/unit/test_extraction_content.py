from app.extraction.content import extract_text


def test_html_text_strips_boilerplate_and_keeps_menu_lines():
    html = b"""
    <html>
      <head><script>trackPageview();</script></head>
      <body>
        <nav>Home | Menu | Contact</nav>
        <main>
          <h2>Antipasti</h2>
          <p>Burrata - $16</p>
          <p>Arancini - $14</p>
        </main>
        <footer>123 Hanover St</footer>
      </body>
    </html>
    """
    text = extract_text(html, "html")
    assert "Burrata - $16" in text
    assert "Arancini - $14" in text
    assert "trackPageview" not in text
    assert "Home | Menu | Contact" not in text
    assert "123 Hanover St" not in text


def test_pdf_text_delegates_to_pypdf_and_joins_pages(monkeypatch):
    class FakePage:
        def __init__(self, text):
            self._text = text

        def extract_text(self):
            return self._text

    class FakeReader:
        def __init__(self, _stream):
            self.pages = [FakePage("Cannoli $8"), FakePage("Tiramisu $9")]

    monkeypatch.setattr("app.extraction.content.PdfReader", FakeReader)

    text = extract_text(b"%PDF-fake-bytes", "pdf")
    assert text == "Cannoli $8\nTiramisu $9"


def test_extract_text_truncates_to_max_chars(monkeypatch):
    monkeypatch.setattr("app.extraction.content.MAX_CHARS", 10)
    text = extract_text(b"<p>" + b"a" * 100 + b"</p>", "html")
    assert len(text) == 10
