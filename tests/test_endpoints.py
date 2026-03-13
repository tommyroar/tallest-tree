"""Integration tests for Flask endpoints."""

import json
import pytest


# ---------------------------------------------------------------------------
# Fast tests (no S3)
# ---------------------------------------------------------------------------

class TestFastEndpoints:
    def test_index_returns_html(self, client):
        resp = client.get("/")
        assert resp.status_code == 200
        assert b"PNW Canopy Height Explorer" in resp.data

    def test_analyze_missing_params(self, client):
        resp = client.get("/api/analyze")
        assert resp.status_code == 400
        data = json.loads(resp.data)
        assert "error" in data

    def test_analyze_missing_lon(self, client):
        resp = client.get("/api/analyze?lat=46.0")
        assert resp.status_code == 400

    def test_analyze_outside_bounds(self, client):
        resp = client.get("/api/analyze?lat=30&lon=-100")
        assert resp.status_code == 400
        data = json.loads(resp.data)
        assert "outside" in data["error"].lower() or "bounds" in data["error"].lower()

    def test_analyze_north_of_bounds(self, client):
        resp = client.get("/api/analyze?lat=55&lon=-120")
        assert resp.status_code == 400

    def test_overlay_missing_key(self, client):
        resp = client.get("/api/overlay?key=nonexistent")
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Slow tests (real S3)
# ---------------------------------------------------------------------------

@pytest.mark.slow
class TestSlowEndpoints:
    def test_health(self, client):
        resp = client.get("/api/health")
        assert resp.status_code == 200
        data = json.loads(resp.data)
        assert data["status"] == "ok"
        assert "crs" in data
        assert "shape" in data
        assert "res" in data

    def test_analyze_real_location(self, client):
        resp = client.get("/api/analyze?lat=47.8&lon=-123.9&window=1000")
        assert resp.status_code == 200
        data = json.loads(resp.data)
        assert len(data["trees"]) > 0
        assert data["stats"]["max_height"] > 0
        assert data["stats"]["n_trees"] > 0
        assert data["overlay_key"]

    def test_analyze_then_overlay(self, client):
        resp = client.get("/api/analyze?lat=47.8&lon=-123.9&window=1000")
        assert resp.status_code == 200
        data = json.loads(resp.data)
        key = data["overlay_key"]
        assert key

        resp2 = client.get(f"/api/overlay?key={key}")
        assert resp2.status_code == 200
        assert resp2.content_type == "image/png"
        assert len(resp2.data) > 100

    def test_analyze_tree_structure(self, client):
        resp = client.get("/api/analyze?lat=47.8&lon=-123.9&window=1000")
        data = json.loads(resp.data)
        tree = data["trees"][0]
        assert "rank" in tree
        assert "height_m" in tree
        assert "error_m" in tree
        assert "lat" in tree
        assert "lon" in tree
        assert "tier" in tree
        assert "colour" in tree
        assert tree["rank"] == 1
        assert tree["error_m"] == 2.8
