# -*- coding: utf-8 -*-
"""静态服务器：支持 HTTP Range 请求（音频/视频跳转进度必需）
另提供 /wallpaper 同源壁纸代理(带缓存)，页面据此实现"下载当前壁纸"原图"""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import os
import re
import sys
import urllib.parse
import urllib.request

PORT = 8000

# /wallpaper 壁纸代理缓存：key=查询串(含页面 token)，value=(bytes, content_type)
BG_PROXY_CACHE = {}
BG_PROXY_MAX = 30
_BAD_HOSTS = ("localhost", "127.0.0.1", "::1")


class RangeHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/wallpaper":
            self.handle_wallpaper(parsed)
            return
        super().do_GET()

    @staticmethod
    def _is_safe_url(url):
        try:
            p = urllib.parse.urlparse(url)
            if p.scheme not in ("http", "https"):
                return False
            host = (p.hostname or "").lower()
            if host in _BAD_HOSTS or host.startswith(("10.", "192.168.", "172.")):
                return False
            return True
        except Exception:
            return False

    def handle_wallpaper(self, parsed):
        src = (urllib.parse.parse_qs(parsed.query).get("src") or [""])[0]
        if not self._is_safe_url(src):
            self.send_error(400, "bad src")
            return
        key = parsed.query  # 含页面 token：刷新后 key 变化，会重新取一张新随机图
        if key in BG_PROXY_CACHE:
            body, ctype = BG_PROXY_CACHE[key]
        else:
            try:
                req = urllib.request.Request(
                    src, headers={"User-Agent": "Mozilla/5.0 (LJYHomePage wallpaper proxy)"}
                )
                with urllib.request.urlopen(req, timeout=25) as resp:
                    body = resp.read()
                    ctype = resp.headers.get("Content-Type") or "image/jpeg"
                    if len(body) > 20 * 1024 * 1024:
                        raise ValueError("image too large")
            except Exception:
                self.send_error(502, "upstream error")
                return
            if len(BG_PROXY_CACHE) >= BG_PROXY_MAX:
                BG_PROXY_CACHE.pop(next(iter(BG_PROXY_CACHE)))
            BG_PROXY_CACHE[key] = (body, ctype)
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "public, max-age=3600")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        try:
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def send_head(self):
        path = self.translate_path(self.path)
        if os.path.isdir(path):
            return super().send_head()
        if not os.path.isfile(path):
            return super().send_head()
        ctype = self.guess_type(path)
        try:
            f = open(path, "rb")
        except OSError:
            self.send_error(404, "File not found")
            return None
        file_len = os.fstat(f.fileno()).st_size
        rng = self.headers.get("Range")
        if rng:
            m = re.match(r"bytes=(\d*)-(\d*)", rng)
            if m and (m.group(1) or m.group(2)):
                if m.group(1):
                    start = int(m.group(1))
                    end = int(m.group(2)) if m.group(2) else file_len - 1
                else:  # 后缀范围
                    n = int(m.group(2))
                    start = max(0, file_len - n)
                    end = file_len - 1
                end = min(end, file_len - 1)
                if start > end or start >= file_len:
                    f.close()
                    self.send_response(416)
                    self.send_header("Content-Range", "bytes */%d" % file_len)
                    self.end_headers()
                    return None
                length = end - start + 1
                f.seek(start)
                self.send_response(206)
                self.send_header("Content-Type", ctype)
                self.send_header("Content-Range", "bytes %d-%d/%d" % (start, end, file_len))
                self.send_header("Content-Length", str(length))
                self.send_header("Accept-Ranges", "bytes")
                self.end_headers()
                return f
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(file_len))
        self.send_header("Accept-Ranges", "bytes")
        self.end_headers()
        return f


if __name__ == "__main__":
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    server = ThreadingHTTPServer(("127.0.0.1", PORT), RangeHandler)
    print("Serving on http://127.0.0.1:%d (Range enabled)" % PORT)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()
