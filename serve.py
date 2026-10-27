# -*- coding: utf-8 -*-
"""静态服务器：支持 HTTP Range 请求（音频/视频跳转进度必需）
另提供 /wallpaper 同源壁纸代理(带缓存)，页面据此实现"下载当前壁纸"原图"""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import os
import re
import sys
import threading
import time
import urllib.parse
import urllib.request
import uuid

PORT = 8000

# /api/counter 访问计数：文件持久化，进程内加锁避免并发写坏
COUNTER_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "api", "data")
COUNTER_FILE = os.path.join(COUNTER_DIR, "counter.json")
_counter_lock = threading.Lock()

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
        if parsed.path in ("/api/counter", "/api/counter.php"):
            self.handle_counter()
            return
        if parsed.path.startswith("/data/") or parsed.path.startswith("/api/data/"):
            self.send_error(404, "Not found")  # 不对外暴露计数文件
            return
        super().do_GET()

    # ---------- 访问计数 ----------
    @staticmethod
    def _load_counter():
        try:
            with open(COUNTER_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
            if not isinstance(data, dict):
                raise ValueError("bad counter file")
        except (OSError, ValueError):
            data = {}
        data["pv"] = int(data.get("pv") or 0)
        data["uv"] = int(data.get("uv") or 0)
        data["since"] = data.get("since") or time.strftime("%Y-%m-%d")
        return data

    @staticmethod
    def _save_counter(data):
        os.makedirs(COUNTER_DIR, exist_ok=True)
        tmp = COUNTER_FILE + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        os.replace(tmp, COUNTER_FILE)  # 原子替换，避免写到一半被读到

    def handle_counter(self):
        cookie = self.headers.get("Cookie") or ""
        first_visit = "ljy_uid=" not in cookie
        with _counter_lock:
            data = self._load_counter()
            data["pv"] += 1
            if first_visit:
                data["uv"] += 1
            self._save_counter(data)
        body = json.dumps(
            {"pv": data["pv"], "uv": data["uv"], "since": data["since"]}, ensure_ascii=False
        ).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        if first_visit:
            self.send_header(
                "Set-Cookie",
                "ljy_uid=%s; Max-Age=31536000; Path=/; SameSite=Lax" % uuid.uuid4().hex,
            )
        self.end_headers()
        self.wfile.write(body)

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
