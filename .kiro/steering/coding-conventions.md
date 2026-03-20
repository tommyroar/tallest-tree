# Coding Conventions

## Python
- Target Python 3.11+
- Use ruff for linting and formatting (config in `pyproject.toml`)
- Line length: 100 (ruff handles enforcement)
- Double quotes, space indentation
- Lint rules: E, F, W, I (isort), UP (pyupgrade)
- Private helper functions prefixed with `_` (e.g. `_latlon_to_web_mercator`)
- Type hints on function signatures (e.g. `def _classify(height: float) -> tuple[str, str]`)
- All backend logic lives in `server.py` — single-file architecture

## JavaScript (MCP server — `mcp/**`)
- Biome for linting and formatting (config in `biome.json`, scoped to `mcp/**`)
- 2-space indentation, single quotes, semicolons always
- ES modules (`import`/`export`)
- Node.js built-in test runner for tests

## Frontend (`index.html`)
- Vanilla JS — no framework, no components, no build step
- All HTML, CSS, and JS in a single `index.html` file
- JetBrains Mono for UI text, DM Sans for headings
- Dark theme with specific color palette (#0c0e13 background, #11131a panels)

## Testing
- Python tests in `tests/` directory, use pytest fixtures from `conftest.py`
- Mark slow/network tests with `@pytest.mark.slow`
- JS unit tests: `tests/*.test.js` run by vitest
- E2E tests: Playwright-based, separate from unit tests
- Test files follow naming: `test_*.py` (Python), `*.test.js` (vitest), `test_*.js` (Playwright E2E)

## General
- No unnecessary abstractions — keep it simple and direct
- Prefer single-file modules over deep directory structures
- Commit messages should be concise and descriptive
