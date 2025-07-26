from __future__ import annotations
from pydantic import BaseModel, Field
from typing import List

class FileIn(BaseModel):
    path: str = Field(min_length=1)
    contentBase64: str = Field(min_length=1)

class CompileOptions(BaseModel):
    synctex: bool = False
    maxSeconds: int = 5
    maxMemoryMb: int = 512

class CompileRequest(BaseModel):
    projectId: str
    entryFile: str
    engine: str = 'tectonic'
    files: List[FileIn]
    options: CompileOptions = CompileOptions()

class CompileResponse(BaseModel):
    jobId: str
