PYTHON ?= python3

.PHONY: check-backend
check-backend:
	$(PYTHON) -m ruff check backend
	$(PYTHON) -m unittest discover -s backend/tests -v
