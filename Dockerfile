# Flask backend for PNW Canopy Height Explorer.
# Built into a Cloudflare Worker container.
FROM python:3.11-slim

WORKDIR /app

# rasterio's PyPI wheels bundle GDAL; only libexpat is needed at runtime
# for the bundled libxml2 inside GDAL. Keep the image lean.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libexpat1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt gunicorn

COPY server.py .

ENV PORT=8080 \
    PYTHONUNBUFFERED=1 \
    AWS_NO_SIGN_REQUEST=YES \
    GDAL_DISABLE_READDIR_ON_OPEN=TRUE \
    VSI_CACHE=TRUE \
    VSI_CACHE_SIZE=104857600

EXPOSE 8080

# 1 worker keeps the rasterio LRU cache + overlay cache effective across requests.
# Bump --workers and instance_type together if you need concurrency.
CMD ["sh", "-c", "exec gunicorn --bind 0.0.0.0:${PORT} --workers 1 --threads 4 --timeout 90 server:app"]
