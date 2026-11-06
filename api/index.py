"""Expose the Flask application to the Vercel Python runtime."""

from backend.app import app as flask_app


app = flask_app
