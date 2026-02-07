# Unit Tests

## Structure

```
tests/
├── backend/
│   └── test_api.py       # API endpoint tests
└── frontend/             # Frontend tests (future)
```

## Running Tests

### All tests
```bash
uv run pytest
```

### Specific test file
```bash
uv run pytest tests/backend/test_api.py
```

### Specific test function
```bash
uv run pytest tests/backend/test_api.py::test_health_check
```

### Verbose output
```bash
uv run pytest -v
```

### With coverage (install pytest-cov first)
```bash
uv add pytest-cov --dev
uv run pytest --cov=src --cov-report=html
```

## Current Tests (6 passing)

### Backend API Tests

**test_api.py** - Tests FastAPI endpoints:
- ✅ Health check endpoint
- ✅ Get categories
- ✅ Get transaction types
- ✅ Create and delete budget
- ✅ Bulk delete budgets
- ✅ Auto-populate monthly from yearly budget

## Adding New Tests

1. Create test file: `test_<module>.py`
2. Import modules to test
3. Write test functions starting with `test_`
4. Use fixtures for shared setup
5. Run tests to verify

Example:
```python
def test_my_function():
    result = my_function(input)
    assert result == expected
```
