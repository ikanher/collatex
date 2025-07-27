import base64
import shutil
import pytest

from compile_service.executor import run_compile
from compile_service.app.jobs import Job, JobStatus
from compile_service.app.models import CompileRequest, FileItem, CompileOptions


@pytest.mark.parametrize('tectonic', [True, False])
def test_run_compile_stub(monkeypatch, tectonic) -> None:
    tex = base64.b64encode(b'\\documentclass{article}\\begin{document}hi\\end{document}').decode()
    req = CompileRequest(
        projectId='p',
        entryFile='main.tex',
        files=[FileItem(path='main.tex', contentBase64=tex)],
        options=CompileOptions(maxSeconds=5, maxMemoryMb=64),
    )
    job = Job(req=req)
    if not tectonic:
        monkeypatch.setattr(shutil, 'which', lambda *_: None)
        monkeypatch.setattr('compile_service.executor._TECTONIC', None)
    run_compile(job)
    assert job.status == JobStatus.DONE
    assert job.pdf_bytes and job.pdf_bytes.startswith(b'%PDF')
