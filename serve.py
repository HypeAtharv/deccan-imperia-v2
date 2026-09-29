#!/usr/bin/env python3
"""Static server WITH HTTP Range support.

Python's stock http.server ignores Range requests, which makes every <video> report
seekable = [0,0] and silently breaks scrubbing. Any host serving these clips in
production must support Range too - this is a hard requirement of the scroll design,
not a local-dev detail.
"""
import http.server, os, re, socketserver, sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8777


class RangeHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def send_head(self):
        rng = self.headers.get("Range")
        if not rng:
            return super().send_head()
        path = self.translate_path(self.path)
        if not os.path.isfile(path):
            return super().send_head()
        m = re.match(r"bytes=(\d*)-(\d*)", rng.strip())
        if not m:
            return super().send_head()
        size = os.path.getsize(path)
        s, e = m.group(1), m.group(2)
        if s == "":                      # suffix range: last N bytes
            length = int(e); start = max(0, size - length); end = size - 1
        else:
            start = int(s); end = int(e) if e else size - 1
        end = min(end, size - 1)
        if start > end:
            self.send_error(416); return None
        f = open(path, "rb"); f.seek(start)
        self.send_response(206)
        self.send_header("Content-Type", self.guess_type(path))
        self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.send_header("Content-Length", str(end - start + 1))
        self.end_headers()
        self._range = (start, end)
        return f

    def handle_one_request(self):
        # the browser aborts image/range requests constantly while scrubbing; without this
        # the threading server prints tracebacks and can drop the listener
        try:
            super().handle_one_request()
        except (BrokenPipeError, ConnectionResetError):
            self.close_connection = True

    def copyfile(self, src, dst):
        if not hasattr(self, "_range"):
            return super().copyfile(src, dst)
        start, end = self._range
        remaining = end - start + 1
        try:
            while remaining > 0:
                chunk = src.read(min(64 * 1024, remaining))
                if not chunk:
                    break
                dst.write(chunk); remaining -= len(chunk)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def log_message(self, *a):
        pass


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


if __name__ == "__main__":
    with Server(("127.0.0.1", PORT), RangeHandler) as httpd:
        print(f"serving with Range support on http://127.0.0.1:{PORT}")
        httpd.serve_forever()
