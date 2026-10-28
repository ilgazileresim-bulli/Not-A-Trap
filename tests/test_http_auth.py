import http.cookiejar
import json
import threading
import unittest
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer
from pathlib import Path
from unittest.mock import patch

import server


class HttpAuthTests(unittest.TestCase):
    def test_register_profile_and_builder_validation_flow(self):
        account_path = Path(__file__).parent / ".http-account-test.json"
        account_path.unlink(missing_ok=True)
        account_path.with_suffix(".tmp").unlink(missing_ok=True)
        httpd = ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
        thread = threading.Thread(target=httpd.serve_forever, daemon=True)
        jar = http.cookiejar.CookieJar()
        client = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
        base = f"http://127.0.0.1:{httpd.server_address[1]}"

        def request(path, payload=None):
            body = None if payload is None else json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(
                base + path,
                data=body,
                headers={"Content-Type": "application/json"} if body is not None else {},
                method="POST" if body is not None else "GET",
            )
            with client.open(req, timeout=4) as response:
                return response.status, json.loads(response.read().decode("utf-8"))

        try:
            with patch.object(server, "ACCOUNT_PATH", account_path):
                thread.start()
                status, created = request("/api/auth/register", {"username": "WebQA_01", "password": "safe-pass-77"})
                self.assertEqual(status, 201)
                self.assertEqual(created["player"]["username"], "WebQA_01")
                status, auth = request("/api/auth/status")
                self.assertTrue(auth["authenticated"])
                manifest = {
                    "schema_version": 1,
                    "id": "webqa.physics",
                    "name": "Web QA Physics",
                    "version": "1.0.0",
                    "author": "WebQA_01",
                    "description": "Browser builder validation test.",
                    "target_levels": "all",
                    "experimental": False,
                    "rules": {"player_speed": 1.25, "gravity": 0.8, "show_route": True},
                }
                status, checked = request("/api/mod-builder/validate", {"manifest": manifest})
                self.assertEqual(status, 200)
                self.assertTrue(checked["ok"])
                self.assertEqual(checked["manifest"]["rules"]["gravity"], 0.8)
        finally:
            httpd.shutdown()
            httpd.server_close()
            thread.join(timeout=3)
            account_path.unlink(missing_ok=True)
            account_path.with_suffix(".tmp").unlink(missing_ok=True)


if __name__ == "__main__":
    unittest.main()
