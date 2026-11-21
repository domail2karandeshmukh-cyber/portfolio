"""A small test server for the tshark guide: an example parts shop's API on 127.0.0.1:8000.
/api/report waits about 1.2 s and /api/search about 0.4 s, so the capture has slow responses to find.
Each request is logged with its duration, to compare with what tshark measures."""
import json, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse
DELAY = {"/api/report": 1.2, "/api/search": 0.4}
class H(BaseHTTPRequestHandler):
    def do_GET(self):
        t0 = time.perf_counter(); path = urlparse(self.path).path
        time.sleep(DELAY.get(path, 0.01))
        if path in ("/health", "/api/parts", "/api/report", "/api/search"):
            body, code = json.dumps({"path": path, "ok": True}).encode(), 200
        else:
            body, code = b'{"error": "not found"}', 404
        self.send_response(code); self.send_header("Content-Type", "application/json"); self.send_header("Content-Length", str(len(body))); self.end_headers(); self.wfile.write(body)
        print(f"{self.command} {self.path} {code} {time.perf_counter() - t0:.3f} s", flush=True)
    def log_message(self, *a): pass
ThreadingHTTPServer(("127.0.0.1", 8000), H).serve_forever()
