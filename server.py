"""PNW Canopy Height Explorer — Flask backend.

Reads Meta/WRI 1 m canopy‑height GeoTIFFs from S3 via /vsicurl/,
detects tree tops with scipy local‑maxima, and returns ranked JSON + grayscale PNG overlay.
"""

import hashlib
import io
import math
import os
import uuid
from functools import lru_cache

import numpy as np
import rasterio
import rasterio.transform
import rasterio.windows
from flask import Flask, Response, jsonify, request, send_file
from flask_cors import CORS
from PIL import Image
from scipy.ndimage import gaussian_filter, maximum_filter

# ---------------------------------------------------------------------------
# GDAL / rasterio environment — must be set before any dataset is opened
# ---------------------------------------------------------------------------
os.environ.update({
    "AWS_NO_SIGN_REQUEST": "YES",
    "GDAL_DISABLE_READDIR_ON_OPEN": "TRUE",
    "VSI_CACHE": "TRUE",
    "VSI_CACHE_SIZE": "104857600",
    "GDAL_HTTP_MERGE_CONSECUTIVE_RANGES": "YES",
})

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
S3_URL_TEMPLATE = (
    "https://dataforgood-fb-data.s3.amazonaws.com"
    "/forests/v1/alsgedi_global_v6_float/chm/{quadkey}.tif"
)
TILE_PX = 65536  # pixels per side of a zoom‑9 QuadKey tile
QUADKEY_ZOOM = 9
HEALTH_CHECK_TILE = "021033130"

# PNW bounding box (lat / lon)
PNW_LAT_MIN, PNW_LAT_MAX = 41.0, 50.0
PNW_LON_MIN, PNW_LON_MAX = -126.0, -115.0

# Tree classification tiers
TIERS = [
    ("Global",   90.0, float("inf"), "#ff4444"),
    ("National", 80.0, 90.0,         "#ff8800"),
    ("Regional", 70.0, 80.0,         "#ffcc00"),
    ("Tall",     50.0, 70.0,         "#44bb44"),
    ("Common",   0.0,  50.0,         "#6688aa"),
]

MAE = 2.8  # ±metres mean absolute error

# In‑memory overlay cache  {key: PNG bytes}
_overlay_cache: dict[str, bytes] = {}

app = Flask(__name__, static_folder=".", static_url_path="")
CORS(app)


@app.route("/")
def index():
    return app.send_static_file("index.html")

# ---------------------------------------------------------------------------
# Geo helpers
# ---------------------------------------------------------------------------

def _latlon_to_web_mercator(lat: float, lon: float) -> tuple[float, float]:
    """WGS‑84 → EPSG:3857 (metres)."""
    x = lon * 20037508.342789244 / 180.0
    y = math.log(math.tan((90.0 + lat) * math.pi / 360.0)) / math.pi * 20037508.342789244
    return x, y


def _latlon_to_quadkey(lat: float, lon: float, zoom: int = QUADKEY_ZOOM) -> str:
    """Return the QuadKey tile string for *lat*, *lon* at *zoom*."""
    sin_lat = math.sin(lat * math.pi / 180.0)
    sin_lat = max(-0.9999, min(0.9999, sin_lat))
    n = 1 << zoom
    tile_x = int((lon + 180.0) / 360.0 * n)
    tile_y = int((0.5 - math.log((1 + sin_lat) / (1 - sin_lat)) / (4 * math.pi)) * n)
    tile_x = max(0, min(n - 1, tile_x))
    tile_y = max(0, min(n - 1, tile_y))
    qk = []
    for i in range(zoom, 0, -1):
        digit = 0
        mask = 1 << (i - 1)
        if tile_x & mask:
            digit += 1
        if tile_y & mask:
            digit += 2
        qk.append(str(digit))
    return "".join(qk)


def _tile_origin_meters(quadkey: str) -> tuple[float, float]:
    """Return top‑left corner (x, y) in EPSG:3857 metres for *quadkey*."""
    tile_x = tile_y = 0
    zoom = len(quadkey)
    for i, ch in enumerate(quadkey):
        d = int(ch)
        mask = 1 << (zoom - 1 - i)
        if d & 1:
            tile_x |= mask
        if d & 2:
            tile_y |= mask
    n = 1 << zoom
    # Full Web‑Mercator extent
    origin = -20037508.342789244
    tile_size_m = 2 * 20037508.342789244 / n
    x0 = origin + tile_x * tile_size_m
    y0 = 20037508.342789244 - tile_y * tile_size_m  # top‑left y (north)
    return x0, y0


def _classify(height: float) -> tuple[str, str]:
    for name, lo, hi, colour in TIERS:
        if lo <= height < hi or (name == "Global" and height >= lo):
            return name, colour
    return "Common", "#6688aa"


# ---------------------------------------------------------------------------
# Core analysis
# ---------------------------------------------------------------------------

def _analyze(lat: float, lon: float, window_m: int = 1000) -> dict:
    """Read CHM data around (lat, lon), detect tree tops, return results dict."""
    cx, cy = _latlon_to_web_mercator(lat, lon)
    half = window_m / 2.0

    quadkey = _latlon_to_quadkey(lat, lon)
    url = S3_URL_TEMPLATE.format(quadkey=quadkey)

    with rasterio.open(url) as src:
        res = src.res  # (pixel_width, pixel_height) in metres
        px_w, px_h = abs(res[0]), abs(res[1])

        # Tile origin in EPSG:3857
        t = src.transform
        tile_x0 = t.c
        tile_y0 = t.f  # top‑left y

        # Pixel offsets for the requested window
        col_off = int((cx - half - tile_x0) / px_w)
        row_off = int((tile_y0 - (cy + half)) / px_h)
        n_cols = int(window_m / px_w)
        n_rows = int(window_m / px_h)

        # Clamp to tile bounds
        col_off = max(0, min(TILE_PX - 1, col_off))
        row_off = max(0, min(TILE_PX - 1, row_off))
        n_cols = min(n_cols, TILE_PX - col_off)
        n_rows = min(n_rows, TILE_PX - row_off)

        win = rasterio.windows.Window(col_off, row_off, n_cols, n_rows)
        chm = src.read(1, window=win).astype(np.float32)

        # Transform for the window (pixel → EPSG:3857 metres)
        win_transform = rasterio.windows.transform(win, src.transform)

    # Replace nodata / negatives
    chm[chm < 0] = 0.0
    chm = np.nan_to_num(chm, nan=0.0)

    if chm.size == 0 or chm.max() == 0:
        return {"trees": [], "stats": {"max_height": 0, "mean_height": 0, "area_m2": 0, "n_trees": 0}, "overlay_key": None}

    # Smooth + local‑max detection
    smoothed = gaussian_filter(chm, sigma=1.0)
    local_max = maximum_filter(smoothed, size=9)
    peaks = (smoothed == local_max) & (smoothed > 2.0)  # min 2 m

    # Non‑max suppression: keep only the tallest within 5 m radius
    peak_rows, peak_cols = np.nonzero(peaks)
    heights = smoothed[peak_rows, peak_cols]
    order = np.argsort(-heights)
    kept_mask = np.ones(len(order), dtype=bool)
    suppression_px = int(5.0 / px_w)  # ~5 metres
    for idx in range(len(order)):
        if not kept_mask[order[idx]]:
            continue
        r0, c0 = peak_rows[order[idx]], peak_cols[order[idx]]
        for jdx in range(idx + 1, len(order)):
            if not kept_mask[order[jdx]]:
                continue
            ri, ci = peak_rows[order[jdx]], peak_cols[order[jdx]]
            if abs(r0 - ri) <= suppression_px and abs(c0 - ci) <= suppression_px:
                kept_mask[order[jdx]] = False

    sel = kept_mask
    peak_rows, peak_cols, heights = peak_rows[sel], peak_cols[sel], heights[sel]

    # Convert pixel coords → lat/lon
    trees = []
    for r, c, h in sorted(zip(peak_rows, peak_cols, heights), key=lambda t: -t[2]):
        mx, my = rasterio.transform.xy(win_transform, int(r), int(c))
        # EPSG:3857 → WGS‑84
        tree_lon = mx / 20037508.342789244 * 180.0
        tree_lat = (
            math.atan(math.exp(my / 20037508.342789244 * math.pi)) * 360.0 / math.pi - 90.0
        )
        tier, colour = _classify(float(h))
        trees.append({
            "rank": len(trees) + 1,
            "height_m": round(float(h), 1),
            "error_m": MAE,
            "lat": round(tree_lat, 6),
            "lon": round(tree_lon, 6),
            "tier": tier,
            "colour": colour,
        })

    # Grayscale RGBA overlay
    norm = np.clip(chm / max(chm.max(), 1.0), 0, 1)
    gray = (norm * 255).astype(np.uint8)
    rgba = np.zeros((*gray.shape, 4), dtype=np.uint8)
    rgba[..., 0] = gray
    rgba[..., 1] = gray
    rgba[..., 2] = gray
    rgba[..., 3] = (norm * 200).astype(np.uint8)  # semi‑transparent
    img = Image.fromarray(rgba, "RGBA")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    overlay_bytes = buf.getvalue()
    overlay_key = hashlib.md5(overlay_bytes[:256]).hexdigest()[:12] + uuid.uuid4().hex[:4]
    _overlay_cache[overlay_key] = overlay_bytes

    # Overlay geographic bounds (for Leaflet ImageOverlay)
    # top‑left pixel → EPSG:3857 → WGS‑84
    ox0, oy0 = rasterio.transform.xy(win_transform, 0, 0)
    ox1, oy1 = rasterio.transform.xy(win_transform, n_rows - 1, n_cols - 1)
    def _m_to_ll(mx, my):
        lon_ = mx / 20037508.342789244 * 180.0
        lat_ = math.atan(math.exp(my / 20037508.342789244 * math.pi)) * 360.0 / math.pi - 90.0
        return round(lat_, 6), round(lon_, 6)
    sw = _m_to_ll(ox0, oy1)
    ne = _m_to_ll(ox1, oy0)

    valid = chm[chm > 0]
    stats = {
        "max_height": round(float(chm.max()), 1),
        "mean_height": round(float(valid.mean()), 1) if valid.size else 0,
        "area_m2": int(n_rows * n_cols * px_w * px_h),
        "n_trees": len(trees),
    }

    return {
        "trees": trees,
        "stats": stats,
        "overlay_key": overlay_key,
        "overlay_bounds": {"sw": sw, "ne": ne},
    }


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.route("/api/analyze")
def analyze():
    try:
        lat = float(request.args["lat"])
        lon = float(request.args["lon"])
    except (KeyError, ValueError):
        return jsonify({"error": "lat and lon query params required"}), 400

    if not (PNW_LAT_MIN <= lat <= PNW_LAT_MAX and PNW_LON_MIN <= lon <= PNW_LON_MAX):
        return jsonify({"error": f"Coordinates outside PNW bounds ({PNW_LAT_MIN}–{PNW_LAT_MAX}°N, {PNW_LON_MIN}–{PNW_LON_MAX}°W)"}), 400

    window_m = int(request.args.get("window", 1000))
    window_m = max(100, min(2000, window_m))

    try:
        result = _analyze(lat, lon, window_m)
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500

    return jsonify(result)


@app.route("/api/overlay")
def overlay():
    key = request.args.get("key", "")
    data = _overlay_cache.get(key)
    if not data:
        return jsonify({"error": "overlay not found"}), 404
    return send_file(io.BytesIO(data), mimetype="image/png")


@app.route("/api/health")
def health():
    url = S3_URL_TEMPLATE.format(quadkey=HEALTH_CHECK_TILE)
    try:
        with rasterio.open(url) as src:
            info = {
                "status": "ok",
                "tile": HEALTH_CHECK_TILE,
                "crs": str(src.crs),
                "shape": list(src.shape),
                "res": list(src.res),
            }
        return jsonify(info)
    except Exception as exc:
        return jsonify({"status": "error", "detail": str(exc)}), 503


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5111, debug=True)
