#!/usr/bin/env python3
"""重新生成小鲸鱼气泡字体子集（MiSans Demibold）。

用法:
    pip install fonttools brotli
    python tools/build-bubble-font.py

流程:
    1. 从 static/whale.js 的 phrases 数组提取所有字符
    2. 按 MiSans 的 unicode-range 找出覆盖这些字符的分片，缺的自动下载
    3. 合并分片并子集化，输出 static/fonts/MiSansBubble.woff2

分片缓存在 .cache/misans/，重复运行不会重复下载。
需要走代理时设置环境变量 HTTPS_PROXY。
"""
import glob
import os
import re
import sys
import tempfile
import urllib.request

from fontTools.merge import Merger
from fontTools import subset

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, ".cache", "misans")
WEIGHT = "Demibold"
CDN = "https://cdn.jsdelivr.net/npm/misans@4.1.0/lib/Normal/"
EXTRA = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ .,!?~-:;'\"()[]%¥"


def load_phrases():
    src = open(os.path.join(ROOT, "static", "whale.js"), encoding="utf-8").read()
    m = re.search(r"var phrases = \[(.*?)\];", src, re.S)
    if not m:
        sys.exit("找不到 phrases 数组")
    return re.findall(r'"([^"]*)"', m.group(1))


def fetch(url, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=60) as r, open(path, "wb") as f:
        f.write(r.read())


def parse_range(s):
    out = set()
    for part in s.split(","):
        p = part.strip().upper().replace("U+", "")
        if "-" in p:
            a, b = p.split("-")
            out.update(range(int(a, 16), int(b, 16) + 1))
        elif p:
            out.add(int(p, 16))
    return out


def main():
    phrases = load_phrases()
    text = "".join(phrases) + EXTRA
    cps = {ord(c) for c in set(text)}
    print(f"台词 {len(phrases)} 句，字符 {len(cps)} 个")

    css_path = os.path.join(CACHE, f"MiSans-{WEIGHT}.min.css")
    if not os.path.exists(css_path):
        print("下载 CSS ...")
        fetch(f"{CDN}MiSans-{WEIGHT}.min.css", css_path)

    css = open(css_path, encoding="utf-8").read()
    blocks = re.findall(r"@font-face\{([^}]+)\}", css)

    need = {}
    for b in blocks:
        mu = re.search(r"url\('([^']+)'\)", b)
        mr = re.search(r"unicode-range:([^;]+);", b)
        if not mu or not mr:
            continue
        hit = cps & parse_range(mr.group(1))
        if hit:
            need[mu.group(1)] = need.get(mu.group(1), set()) | hit

    missing = [f for f in need if not os.path.exists(os.path.join(CACHE, f))]
    for f in missing:
        print(f"下载分片 {f} ...")
        fetch(CDN + f, os.path.join(CACHE, f))

    files = sorted(os.path.join(CACHE, f) for f in need)
    merged = Merger().merge(files)

    tmp = os.path.join(tempfile.gettempdir(), "MiSansBubble-full.ttf")
    merged.save(tmp)

    out = os.path.join(ROOT, "static", "fonts", "MiSansBubble.woff2")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    opts = subset.Options()
    opts.flavor = "woff2"
    opts.desubroutinize = True
    opts.layout_features = ["*"]
    opts.name_IDs = ["*"]
    opts.notdef_outline = True
    font = subset.load_font(tmp, opts)
    sub = subset.Subsetter(options=opts)
    sub.populate(text=text)
    sub.subset(font)
    subset.save_font(font, out, opts)
    print(f"完成: {out} ({os.path.getsize(out)} bytes, {len(files)} 个分片)")


if __name__ == "__main__":
    main()
