FROM python:3.12-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

COPY requirements.txt .
# build-essential: chroma-hnswlib 0.7.3 (chromadb 0.5.0's hard pin) has no cp312 wheel; compiles from source
RUN apt-get update && apt-get install -y --no-install-recommends build-essential && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir -r requirements.txt
# ponytail: 0.7.3 source build emits AVX-512 code -> SIGILL on Render free CPU (Zen 2, no AVX-512).
# Swap in the 0.7.6 manylinux wheel (portable, runtime dispatch) after the resolver's ==0.7.3 pin is satisfied.
# Upgrade path: chromadb 0.6+ drops the hard pin; remove this line then.
RUN pip install --no-cache-dir --force-reinstall --no-deps chroma-hnswlib==0.7.6

COPY . .

# HF Spaces sets PORT to 7860; other hosts (Render/Fly) inject their own PORT.
EXPOSE 7860
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-7860}"]
