# backend/compile-service/src/compile_service/app/models.py

from __future__ import annotations
import base64
from pathlib import Path
from typing import List, Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from .config import max_upload_bytes


MAX_BYTES = max_upload_bytes()


class FileItem(BaseModel):
    path: str = Field(min_length=1)
    contentBase64: str = Field(min_length=1)

    @field_validator('path')
    @classmethod
    def validate_path(cls, v: str) -> str:
        p = Path(v)
        if v.startswith('/') or '..' in p.parts:
            raise ValueError('invalid path')
        return v


class CompileOptions(BaseModel):
    synctex: bool = False
    maxSeconds: int = 5
    maxMemoryMb: int = 512


class CompileRequest(BaseModel):
    projectId: str
    entryFile: str
    engine: Literal['tectonic'] = 'tectonic'
    files: List[FileItem]
    options: CompileOptions = Field(default_factory=CompileOptions)

    @model_validator(mode='after')
    def check_all(self) -> 'CompileRequest':
        if not any(f.path == self.entryFile for f in self.files):
            raise ValueError('entryFile not in files')
        total = 0
        for f in self.files:
            try:
                total += len(base64.b64decode(f.contentBase64, validate=True))
            except Exception as exc:
                raise ValueError(f'invalid base64 for {f.path}') from exc
        if total > MAX_BYTES:
            raise ValueError('payload too large')
        return self


class CompileResponse(BaseModel):
    jobId: str
