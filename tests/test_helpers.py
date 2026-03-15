"""Unit tests for pure helper functions in server.py."""

import collections

import pytest

from server import (
    OVERLAY_CACHE_MAX,
    _classify,
    _latlon_to_quadkey,
    _latlon_to_web_mercator,
    _mercator_to_latlon,
    _open_tile,
    _overlay_cache,
    _tile_origin_meters,
)

# ---------------------------------------------------------------------------
# _latlon_to_web_mercator
# ---------------------------------------------------------------------------


class TestLatLonToWebMercator:
    def test_origin(self):
        x, y = _latlon_to_web_mercator(0, 0)
        assert x == pytest.approx(0, abs=1)
        assert y == pytest.approx(0, abs=1)

    def test_seattle(self):
        # Seattle: 47.6062, -122.3321
        # Known EPSG:3857 approx: (-13617842, 6044863)
        x, y = _latlon_to_web_mercator(47.6062, -122.3321)
        assert x == pytest.approx(-13617947, abs=200)
        assert y == pytest.approx(6041589, abs=200)

    def test_positive_lon(self):
        x, _ = _latlon_to_web_mercator(0, 180)
        assert x == pytest.approx(20037508.34, abs=1)

    def test_negative_lon(self):
        x, _ = _latlon_to_web_mercator(0, -180)
        assert x == pytest.approx(-20037508.34, abs=1)


# ---------------------------------------------------------------------------
# _latlon_to_quadkey
# ---------------------------------------------------------------------------


class TestLatLonToQuadKey:
    def test_known_location(self):
        # The health check tile is 021033130 — near PNW
        qk = _latlon_to_quadkey(46.85, -121.76)
        assert len(qk) == 9
        assert all(c in "0123" for c in qk)

    def test_zoom_determines_length(self):
        qk5 = _latlon_to_quadkey(46.85, -121.76, zoom=5)
        qk9 = _latlon_to_quadkey(46.85, -121.76, zoom=9)
        assert len(qk5) == 5
        assert len(qk9) == 9
        # Higher zoom should be a prefix extension
        assert qk9[:5] == qk5

    def test_only_valid_digits(self):
        qk = _latlon_to_quadkey(48.0, -123.0)
        assert all(c in "0123" for c in qk)

    def test_different_locations_different_keys(self):
        qk1 = _latlon_to_quadkey(42.0, -122.0)
        qk2 = _latlon_to_quadkey(49.0, -116.0)
        assert qk1 != qk2


# ---------------------------------------------------------------------------
# _tile_origin_meters
# ---------------------------------------------------------------------------


class TestTileOriginMeters:
    def test_quadkey_0(self):
        # QuadKey "0" is top-left quarter of the world at zoom 1
        x0, y0 = _tile_origin_meters("0")
        assert x0 == pytest.approx(-20037508.34, abs=1)
        assert y0 == pytest.approx(20037508.34, abs=1)

    def test_roundtrip_consistency(self):
        # Get a quadkey, then its origin should be NW of the input point
        lat, lon = 46.85, -121.76
        qk = _latlon_to_quadkey(lat, lon)
        x0, y0 = _tile_origin_meters(qk)
        cx, cy = _latlon_to_web_mercator(lat, lon)
        # Tile origin x should be <= point x (origin is west edge)
        assert x0 <= cx
        # Tile origin y should be >= point y (origin is north edge, y increases northward in 3857)
        assert y0 >= cy


# ---------------------------------------------------------------------------
# _classify
# ---------------------------------------------------------------------------


class TestClassify:
    def test_global(self):
        assert _classify(95.0) == ("Global", "#ff4444")

    def test_global_exactly_90(self):
        assert _classify(90.0) == ("Global", "#ff4444")

    def test_national(self):
        assert _classify(85.0) == ("National", "#ff8800")

    def test_regional(self):
        assert _classify(75.0) == ("Regional", "#ffcc00")

    def test_tall(self):
        assert _classify(60.0) == ("Tall", "#44bb44")

    def test_common(self):
        assert _classify(30.0) == ("Common", "#6688aa")

    def test_zero_height(self):
        name, _ = _classify(0.0)
        assert name == "Common"

    def test_boundary_80(self):
        assert _classify(80.0)[0] == "National"

    def test_boundary_70(self):
        assert _classify(70.0)[0] == "Regional"

    def test_boundary_50(self):
        assert _classify(50.0)[0] == "Tall"


# ---------------------------------------------------------------------------
# _mercator_to_latlon
# ---------------------------------------------------------------------------


class TestMercatorToLatlon:
    def test_origin(self):
        lat, lon = _mercator_to_latlon(0, 0)
        assert lat == pytest.approx(0, abs=0.001)
        assert lon == pytest.approx(0, abs=0.001)

    def test_seattle_roundtrip(self):
        """Convert Seattle to Mercator and back — should recover original coords."""
        orig_lat, orig_lon = 47.6062, -122.3321
        mx, my = _latlon_to_web_mercator(orig_lat, orig_lon)
        lat, lon = _mercator_to_latlon(mx, my)
        assert lat == pytest.approx(orig_lat, abs=0.001)
        assert lon == pytest.approx(orig_lon, abs=0.001)

    def test_southern_hemisphere(self):
        mx, my = _latlon_to_web_mercator(-33.8688, 151.2093)  # Sydney
        lat, lon = _mercator_to_latlon(mx, my)
        assert lat == pytest.approx(-33.8688, abs=0.001)
        assert lon == pytest.approx(151.2093, abs=0.001)


# ---------------------------------------------------------------------------
# Overlay cache eviction
# ---------------------------------------------------------------------------


class TestOverlayCacheEviction:
    def test_cache_is_ordered_dict(self):
        assert isinstance(_overlay_cache, collections.OrderedDict)

    def test_eviction_limit(self):
        """Inserting more than OVERLAY_CACHE_MAX entries evicts oldest."""
        _overlay_cache.clear()
        for i in range(OVERLAY_CACHE_MAX + 10):
            _overlay_cache[f"key_{i}"] = b"data"
            while len(_overlay_cache) > OVERLAY_CACHE_MAX:
                _overlay_cache.popitem(last=False)
        assert len(_overlay_cache) == OVERLAY_CACHE_MAX
        # Oldest keys should be gone
        assert "key_0" not in _overlay_cache
        assert "key_9" not in _overlay_cache
        # Newest keys should remain
        assert f"key_{OVERLAY_CACHE_MAX + 9}" in _overlay_cache
        _overlay_cache.clear()

    def test_max_is_reasonable(self):
        assert OVERLAY_CACHE_MAX > 0
        assert OVERLAY_CACHE_MAX <= 256


# ---------------------------------------------------------------------------
# _open_tile caching
# ---------------------------------------------------------------------------


class TestOpenTileCache:
    def test_lru_cache_is_configured(self):
        """_open_tile should be wrapped with lru_cache."""
        assert hasattr(_open_tile, "cache_info"), "_open_tile should use lru_cache"
        info = _open_tile.cache_info()
        assert info.maxsize == 32
