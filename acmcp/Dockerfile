# --- Stage 1: Builder ---
FROM ghcr.io/astral-sh/uv:python3.14-bookworm-slim AS builder

WORKDIR /app

# All environment variables in one layer
ENV UV_SYSTEM_PYTHON=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_NO_PROGRESS=1 \
    PYTHONUNBUFFERED=1 \
    DOCKER_CONTAINER=1

COPY pyproject.toml pyproject.toml
# Install from requirements file
RUN uv pip install -r pyproject.toml

# Expose the streamable-http port
EXPOSE 8000

# Copy actual application code
COPY . .

# Because we updated the PATH, "python" now automatically means the one in your .venv
ENTRYPOINT ["python", "main.py"]