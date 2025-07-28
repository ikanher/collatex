FROM python:3.12-slim
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*
RUN curl -L https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%400.15.0/tectonic-0.15.0-x86_64-unknown-linux-musl.tar.gz | tar -xz && mv tectonic /usr/local/bin/tectonic && chmod +x /usr/local/bin/tectonic
WORKDIR /app
COPY backend/compile-service backend/compile-service
RUN pip install uv
RUN uv pip install --system ./backend/compile-service[dev]
WORKDIR /app/backend/compile-service
CMD ["uvicorn", "compile_service.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
