"""WSGI entry point used by Render and local `python app.py` runs."""

import os

from chatbot_api import app


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5001)))
