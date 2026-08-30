# -*- coding: utf-8 -*-
"""静态服务器：支持 HTTP Range 请求（音频/视频跳转进度必需）"""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import os
import re
import sys

PORT = 8000


class RangeHandler(SimpleHTTPRequestHandler):
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
