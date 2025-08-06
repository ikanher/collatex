from pathlib import Path

from pypdf import PdfReader


def test_placeholder_has_page() -> None:
    pdf_path = Path(__file__).resolve().parents[1] / 'static' / 'placeholder.pdf'
    reader = PdfReader(str(pdf_path))
    assert len(reader.pages) >= 1
