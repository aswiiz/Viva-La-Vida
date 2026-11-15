import logging
import os
import threading
import time
import urllib.error
import urllib.request
from django.apps import AppConfig

logger = logging.getLogger(__name__)


def _keep_alive_loop():
    """Background loop to periodically ping the web service and prevent it from sleeping on Render."""
    time.sleep(30)  # Initial wait for server initialization
    while True:
        try:
            url = os.environ.get("KEEP_ALIVE_URL") or os.environ.get("PING_URL")
            if not url and os.environ.get("RENDER_EXTERNAL_HOSTNAME"):
                url = f"https://{os.environ.get('RENDER_EXTERNAL_HOSTNAME')}/ping/"
            
            if url:
                req = urllib.request.Request(url, headers={"User-Agent": "VivaLaVida-KeepAlive/1.0"})
                with urllib.request.urlopen(req, timeout=15) as resp:
                    logger.info("Keep-alive ping sent to %s (status %s)", url, resp.status)
        except Exception as exc:
            logger.debug("Keep-alive ping error: %s", exc)
        # Sleep for 10 minutes (600s), well under Render's 15-minute idle sleep timer
        time.sleep(600)


class TranslatorConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "translator"

    def ready(self):
        is_server = (
            os.environ.get("RUN_MAIN") == "true" or
            "gunicorn" in os.environ.get("SERVER_SOFTWARE", "") or
            "RENDER" in os.environ
        )
        if is_server and not getattr(self, "_keep_alive_started", False):
            self._keep_alive_started = True
            t = threading.Thread(target=_keep_alive_loop, daemon=True, name="keep_alive_ping_worker")
            t.start()
