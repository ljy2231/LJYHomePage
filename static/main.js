layer.config({
  extend: "ljy/style.css", //加载扩展样式
  skin: "layer-ext-ljy",
});

// Nav buttons
$(".nav-btn").on("click", function () {
  let btn = $(this);
  let type = btn.data("window"); // pop current newtab
  let content = btn.data("href");
  switch (type) {
    case "pop":
      let title = btn.data("title");
      let shadeClose = btn.data("shade") === "true" ? false : true;
      let anim = btn.data("anim") ? btn.data("anim") * 1 : 4;
      let area_w = btn.data("area-w") ? btn.data("area-w") : "80%";
      let area_h = btn.data("area-h") ? btn.data("area-h") : "90%";
      layer.open({
        type: 2,
        title: title,
        shadeClose: shadeClose,
        anim: anim,
        closeBtn: 2,
        isOutAnim: false,
        area: [area_w, area_h],
        content: content,
      });
      break;
    case "current":
      window.location = content;
      break;
    case "newtab":
      window.open(content, "_blank");
      break;
  }
});

console.log(
  "\n" +
    " %c LJY2231 v1.2.0 " +
    " %c https://blog.223100.xyz " +
    "\n" +
    "\n",
  "color: #fff; background: #fd79a8; padding:5px 0;",
  "background: #FFF; padding:5px 0;"
);

// 带超时的 fetch：接口挂住时不阻塞页面加载
function fetchTimeout(url, ms) {
  var ctrl = new AbortController();
  var timer = setTimeout(function () {
    ctrl.abort();
  }, ms);
  return fetch(url, { signal: ctrl.signal }).finally(function () {
    clearTimeout(timer);
  });
}

// 手机端检测（与 CSS 767px 断点一致）
function isMobile() {
  return window.innerWidth <= 767;
}

// 一言（8 秒超时）
fetchTimeout(hitokoto_api, 8000)
  .then((response) => response.json())
  .then((data) => {
    const hitokoto = document.getElementById("hitokoto_text");
    hitokoto.href = "https://hitokoto.cn/?uuid=" + data.uuid;
    hitokoto.innerText = data.hitokoto;
  })
  .catch(console.error);

// 音乐播放器（自绘样式，数据来自 meting API：api.injahow.cn）
(function () {
  // 本地歌曲列表：音频自备，歌词由 LRCLIB 按歌名+歌手自动搜索
  // 想加歌：往 static/music/ 放 mp3，然后在这里加一行 { name, artist, url }
  // DJ/翻唱版可加 lrcName/lrcArtist 按原曲搜索歌词
  var LOCAL_SONGS = [
    { name: "酔いどれ知らず", artist: "kanaria/GUMI", pic: "./static/covers/酔いどれ知らず.jpg", url: "./static/music/酔いどれ知らず.mp3" },
    { name: "假面舞会", artist: "很美味", pic: "./static/covers/假面舞会.jpg", url: "./static/music/假面舞会.mp3" },
    { name: "樱花樱花想见你", artist: "李蚊香/满汉全席", pic: "./static/covers/樱花樱花想见你.jpg", lrcUrl: "https://api.injahow.cn/meting/?server=netease&type=lrc&id=440241194", url: "./static/music/樱花樱花想见你.mp3" },
    { name: "烟火里的尘埃", artist: "华晨宇", pic: "./static/covers/烟火里的尘埃.jpg", url: "./static/music/烟火里的尘埃.mp3" },
    { name: "高飞", artist: "张杰", pic: "./static/covers/高飞.jpg", lrcUrl: "https://api.injahow.cn/meting/?server=netease&type=lrc&id=191024", url: "./static/music/高飞.mp3" },
    { name: "红色高跟鞋 (DJ混搭)", artist: "DJ阿可", pic: "./static/covers/DJ阿可-红色高跟鞋-DJ混搭.jpg", url: "./static/music/DJ阿可-红色高跟鞋-DJ混搭.mp3" },
    { name: "失控 (DJ版)", artist: "井迪", pic: "./static/covers/井迪-失控-DJ版.jpg", url: "./static/music/井迪-失控-DJ版.mp3" },
    { name: "苦茶子", artist: "路易斯", pic: "./static/covers/路易斯-苦茶子.jpg", lrcUrl: "./static/lyrics/苦茶子.lrc", url: "./static/music/路易斯-苦茶子.mp3" },
    { name: "雨爱 (DJ版)", artist: "阿黛", pic: "./static/covers/阿黛-雨爱-DJ版.jpg", url: "./static/music/阿黛-雨爱-DJ版.mp3" },
    { name: "忘川彼岸 (DJ名龙版)", artist: "零一九零贰", pic: "./static/covers/零一九零贰-忘川彼岸-DJ名龙版.jpg", url: "./static/music/零一九零贰-忘川彼岸-DJ名龙版.mp3" },
    { name: "只对你有感觉", artist: "飞轮海、田馥甄", pic: "./static/covers/飞轮海田馥甄-只对你有感觉.jpg", lrcName: "只对你有感觉", lrcArtist: "飞轮海", url: "./static/music/飞轮海田馥甄-只对你有感觉.mp3" },
  ];
  var DEFAULT_COVER = "./static/images/default-cover.svg";
  var audio = new Audio();
  var songs = [];
  var cur = -1;
  var history = [];
  var listEl = document.getElementById("player-list");
  var coverEl = document.getElementById("player-cover");
  var artistEl = document.getElementById("player-artist");
  var titleEl = document.getElementById("player-title");
  var curEl = document.getElementById("player-cur");
  var durEl = document.getElementById("player-dur");
  var fillEl = document.getElementById("player-fill");
  var trackEl = document.getElementById("player-track");
  var playBtn = document.getElementById("btn-play");
  var prevBtn = document.getElementById("btn-prev");
  var nextBtn = document.getElementById("btn-next");
  var playerEl = document.getElementById("player");
  // 左上角歌词面板
  var lyricsBox = document.getElementById("lyrics-box");
  var lyricsSong = document.getElementById("lyrics-song");
  var lyricsP2 = document.getElementById("lyrics-p2");
  var lyricsP1 = document.getElementById("lyrics-p1");
  var lyricsCur = document.getElementById("lyrics-cur");
  var lyricsN1 = document.getElementById("lyrics-n1");
  var lyricsN2 = document.getElementById("lyrics-n2");
  var lrcList = [];
  if (!listEl) return;

  function fmt(t) {
    if (isNaN(t)) return "0:00";
    var m = Math.floor(t / 60);
    var s = Math.floor(t % 60);
    return m + ":" + (s < 10 ? "0" : "") + s;
  }
  // 拆分双语歌词："英文 (中文)" → [英文, 中文]
  function splitBilingual(txt) {
    var m = txt.match(/^([\s\S]+?)\s*[（(]([\u4e00-\u9fa5][\s\S]*?)[)）]\s*$/);
    if (m && m[1].trim() && !/[\u4e00-\u9fa5]/.test(m[1].trim())) {
      return [m[1].trim(), m[2].trim()];
    }
    return [txt];
  }
  // 解析 LRC 歌词（过滤元数据行，双语拆两行）
  function parseLrc(lrc) {
    var out = [];
    if (!lrc) return out;
    var meta = /^(作词|作曲|编曲|制作人|混音|母带|录音|和声|吉他|贝斯|键盘|鼓|小提琴|大提琴|监制|出品)/;
    lrc.split("\n").forEach(function (line) {
      var m = line.match(/\[(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?\](.*)/);
      if (m) {
        var txt = m[4].trim();
        if (!txt || meta.test(txt)) return; // 跳过空行和元数据行
        var t = parseInt(m[1], 10) * 60 + parseFloat(m[2] + "." + (m[3] || "0"));
        var parts = splitBilingual(txt);
        out.push({ time: t, text: parts[0] });
        if (parts[1]) out.push({ time: t, text: parts[1] });
      }
    });
    out.sort(function (a, b) {
      return a.time - b.time;
    });
    return out;
  }
  // 同步显示歌词：5 行居中，唱完一行整列上滑一行（离散动画，不持续滚动）
  var lyricSlots = [lyricsP2, lyricsP1, lyricsCur, lyricsN1, lyricsN2];
  var rollEl = document.querySelector("#lyrics-box .lyrics-roll");
  var lastIdx = -1;
  function renderLyrics() {
    if (!lyricsBox) return;
    // 手机端不自动展开歌词，改用 ♪词 按钮手动打开
    if (isMobile()) {
      if (lyricsReopenBtn && !lyricsBox.classList.contains("show")) {
        lyricsReopenBtn.classList.add("show");
      }
    } else {
      lyricsBox.classList.add("show");
    }
    if (!lrcList.length) {
      for (var s = 0; s < 5; s++)
        if (lyricSlots[s]) lyricSlots[s].textContent = "";
      lastIdx = -1;
      return;
    }
    var t = audio.currentTime;
    var idx = -1;
    for (var i = 0; i < lrcList.length; i++) {
      if (t >= lrcList[i].time) {
        // 同时间戳的双语双行取第一行（原文）作为当前
        if (idx < 0 || lrcList[i].time > lrcList[idx].time) idx = i;
      } else break;
    }
    if (idx < 0) idx = 0;
    // 行没变：静止等待，不做任何更新
    if (idx === lastIdx) return;
    var firstShow = lastIdx === -1;
    lastIdx = idx;
    // 更新 5 行内容
    for (var k = 0; k < 5; k++) {
      var el = lyricSlots[k];
      if (!el) continue;
      var m = idx + (k - 2);
      el.textContent = m >= 0 && m < lrcList.length ? lrcList[m].text : "";
    }
    // 每次切行整列上滑一行；开唱首次显示从更下方滑入，不直接出现
    if (rollEl) {
      rollEl.style.transition = "none";
      rollEl.style.transform = "translateY(" + (firstShow ? 48 : 24) + "px)";
      void rollEl.offsetHeight; // 强制回流
      rollEl.style.transition = "transform 0.45s cubic-bezier(0.25, 0.6, 0.35, 1)";
      rollEl.style.transform = "translateY(0)";
    }
  }
  function randomIdx() {
    if (songs.length < 2) return 0;
    var i = Math.floor(Math.random() * songs.length);
    while (i === cur) i = Math.floor(Math.random() * songs.length);
    return i;
  }
  function updateBtn() {
    var playing = !audio.paused;
    var pi = document.getElementById("play-ico");
    var pai = document.getElementById("pause-ico");
    if (pi) pi.style.display = playing ? "none" : "block";
    if (pai) pai.style.display = playing ? "block" : "none";
    if (playerEl) playerEl.classList.toggle("playing", playing);
  }
  // 歌词获取：优先指定 lrcUrl，否则 LRCLIB 搜索；lrcUrl 失败回退 LRCLIB
  function lrclibSearch(i) {
    var s = songs[i];
    if (!s) return;
    var qName = s.lrcName || s.name;
    var qArtist = s.lrcArtist || s.artist;
    var url =
      "https://lrclib.net/api/search?track_name=" +
      encodeURIComponent(qName) +
      "&artist_name=" +
      encodeURIComponent(qArtist);
    fetchTimeout(url, 8000)
      .then(function (r) {
        return r.json();
      })
      .then(function (list) {
        // 竞态保护：只在仍是当前这首歌时更新歌词
        if (cur !== i) return;
        var lrc = list && list[0] ? list[0].syncedLyrics : "";
        lrcList = lrc ? parseLrc(lrc) : [];
        renderLyrics();
      })
      .catch(function () {});
  }
  function fetchLyrics(i) {
    var s = songs[i];
    if (!s) return;
    if (s.lrcUrl) {
      // 指定歌词 URL（如网易云歌词代理）
      fetchTimeout(s.lrcUrl, 8000)
        .then(function (r) {
          return r.text();
        })
        .then(function (txt) {
          if (cur !== i) return;
          if (txt && txt.indexOf("[") >= 0) {
            lrcList = parseLrc(txt);
            renderLyrics();
          } else {
            lrclibSearch(i); // 不是 LRC 文本，回退搜索
          }
        })
        .catch(function () {
          lrclibSearch(i); // 接口挂了回退 LRCLIB
        });
      return;
    }
    lrclibSearch(i);
  }
  function setSong(i) {
    if (cur >= 0 && cur !== i) history.push(cur);
    cur = i;
    var s = songs[i];
    audio.src = s.url;
    if (coverEl) coverEl.src = s.pic || DEFAULT_COVER;
    // 上行显示歌名，下行显示作者
    if (artistEl) artistEl.textContent = s.name;
    if (titleEl) titleEl.textContent = s.artist;
    if (lyricsSong) lyricsSong.textContent = s.name + " - " + s.artist;
    // 歌词：去 LRCLIB 搜索
    lrcList = [];
    renderLyrics();
    fetchLyrics(i);
    var items = listEl.children;
    for (var k = 0; k < items.length; k++)
      items[k].classList.toggle("active", k === i);
  }
  function play(i) {
    if (i < 0 || i >= songs.length) return;
    if (i === cur) {
      if (audio.paused) audio.play().catch(function () {});
      else audio.pause();
      return;
    }
    setSong(i);
    audio.play().catch(function () {});
  }
  if (playBtn)
    playBtn.addEventListener("click", function () {
      if (cur < 0) {
        if (songs.length) {
          setSong(randomIdx());
          audio.play().catch(function () {});
        }
        return;
      }
      if (audio.paused) audio.play().catch(function () {});
      else audio.pause();
    });
  if (prevBtn)
    prevBtn.addEventListener("click", function () {
      if (!songs.length) return;
      if (history.length) play(history.pop());
      else play(randomIdx());
    });
  if (nextBtn)
    nextBtn.addEventListener("click", function () {
      if (songs.length) play(randomIdx());
    });
  audio.addEventListener("timeupdate", function () {
    if (curEl) curEl.textContent = fmt(audio.currentTime);
    if (fillEl && audio.duration)
      fillEl.style.width = (audio.currentTime / audio.duration) * 100 + "%";
  });
  audio.addEventListener("loadedmetadata", function () {
    if (durEl) durEl.textContent = fmt(audio.duration);
  });
  audio.addEventListener("ended", function () {
    if (songs.length) play(randomIdx());
  });
  audio.addEventListener("play", updateBtn);
  audio.addEventListener("pause", updateBtn);
  if (trackEl)
    trackEl.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      var rect = trackEl.getBoundingClientRect();
      if (!isFinite(audio.duration) || audio.duration <= 0) return;
      var ratio = (e.clientX - rect.left) / rect.width;
      ratio = Math.min(1, Math.max(0, ratio));
      audio.currentTime = ratio * audio.duration;
      if (fillEl) fillEl.style.width = ratio * 100 + "%";
    });

  // 载入歌单（可重复调用：重新加载组件并重新弹出，屏外停留 1 秒）
  var lyricTimer = null;
  function initMusic() {
    // 收起并重置（先滑出屏幕外）
    var hideTime = Date.now();
    if (playerEl) {
      playerEl.classList.remove("in");
      playerEl.classList.add("hidden");
    }
    if (lyricsBox) lyricsBox.classList.remove("show");
    songs = [];
    cur = -1;
    history = [];
    lrcList = [];
    lastIdx = -1;
    listEl.innerHTML = "";
    audio.pause();
    if (lyricTimer) {
      clearInterval(lyricTimer);
      lyricTimer = null;
    }
    // 本地歌曲：无需网络接口，直接渲染列表
    songs = LOCAL_SONGS.slice();
    songs.forEach(function (s, i) {
      var li = document.createElement("li");
      li.className = "player__song";
      var img = document.createElement("img");
      img.className = "player__img";
      img.src = s.pic || DEFAULT_COVER;
      img.alt = "cover";
      var p = document.createElement("p");
      p.className = "player__context";
      var b = document.createElement("b");
      b.className = "player__song-name";
      b.textContent = s.name;
      var sp = document.createElement("span");
      sp.className = "flex";
      var t = document.createElement("span");
      t.className = "player__title";
      t.textContent = s.artist;
      var tm = document.createElement("span");
      tm.className = "player__song-time";
      tm.textContent = "";
      sp.appendChild(t);
      sp.appendChild(tm);
      p.appendChild(b);
      p.appendChild(sp);
      li.appendChild(img);
      li.appendChild(p);
      li.addEventListener("click", function () {
        play(i);
      });
      listEl.appendChild(li);
    });
    if (songs.length) {
      // 屏外停留至少 1 秒再重新弹出
      var wait = Math.max(0, 1000 - (Date.now() - hideTime));
      setTimeout(function () {
        setSong(randomIdx());
        if (isMobile()) {
          // 手机端：不自动展开播放器，显示 ♪ 按钮手动打开
          if (reopenBtn) reopenBtn.classList.add("show");
        } else {
          if (playerEl) {
            playerEl.classList.remove("hidden");
            playerEl.classList.add("in");
          }
          if (reopenBtn) reopenBtn.classList.remove("show");
        }
        // 歌词离散刷新（80ms 检测切行）
        lyricTimer = setInterval(renderLyrics, 80);
        // 自动播放：浏览器可能拦截，被拦截则首次点击页面时播放
        audio.play().catch(function () {
          document.addEventListener(
            "click",
            function once() {
              if (audio.paused && cur >= 0)
                audio.play().catch(function () {});
            },
            { once: true }
          );
        });
      }, wait);
    }
  }
  window.reloadMusic = initMusic;

  // 收起 / 展开播放器（与歌词互相独立；播放器按钮会同时展开两者）
  var collapseBtn = document.getElementById("player-collapse");
  var reopenBtn = document.getElementById("player-reopen");
  var lyricsCollapseBtn = document.getElementById("lyrics-collapse");
  var lyricsReopenBtn = document.getElementById("lyrics-reopen");
  var reopenTimer = null;
  var lyricsReopenTimer = null;
  if (collapseBtn && playerEl && reopenBtn) {
    collapseBtn.addEventListener("click", function () {
      playerEl.classList.remove("in");
      playerEl.classList.add("hidden");
      // 卡片完全下沉后（0.6s）再从下方弹出按钮
      if (reopenTimer) clearTimeout(reopenTimer);
      reopenTimer = setTimeout(function () {
        reopenBtn.classList.add("show");
      }, 650);
    });
    reopenBtn.addEventListener("click", function () {
      if (reopenTimer) {
        clearTimeout(reopenTimer);
        reopenTimer = null;
      }
      playerEl.classList.remove("hidden");
      playerEl.classList.add("in");
      reopenBtn.classList.remove("show");
      // 同时展开歌词（只展开，不收起）
      if (lyricsBox) lyricsBox.classList.remove("hide-left");
      if (lyricsReopenBtn) lyricsReopenBtn.classList.remove("show");
    });
  }
  if (lyricsCollapseBtn && lyricsBox && lyricsReopenBtn) {
    lyricsCollapseBtn.addEventListener("click", function () {
      lyricsBox.classList.add("hide-left");
      // 歌词完全滑出后（0.6s）再从左边滑出按钮
      if (lyricsReopenTimer) clearTimeout(lyricsReopenTimer);
      lyricsReopenTimer = setTimeout(function () {
        lyricsReopenBtn.classList.add("show");
      }, 650);
    });
    lyricsReopenBtn.addEventListener("click", function () {
      if (lyricsReopenTimer) {
        clearTimeout(lyricsReopenTimer);
        lyricsReopenTimer = null;
      }
      lyricsBox.classList.remove("hide-left");
      lyricsBox.classList.add("show");
      lyricsReopenBtn.classList.remove("show");
    });
  }

  // 首次加载歌单
  initMusic();
})();

// 右上角设置（齿轮按钮 + 面板：换背景 / 重载歌曲 / 重载小鲸鱼）
(function () {
  var box = document.getElementById("settings");
  var btn = document.getElementById("settings-btn");
  var panel = document.getElementById("settings-panel");
  if (!box || !btn || !panel) return;

  // 加载完成后从顶部滑下来
  window.addEventListener("load", function () {
    setTimeout(function () {
      box.classList.add("in");
    }, 400);
  });

  btn.addEventListener("click", function (e) {
    e.stopPropagation();
    panel.classList.toggle("open");
  });
  document.addEventListener("click", function (e) {
    if (panel.classList.contains("open") && e.target !== btn && !panel.contains(e.target)) {
      panel.classList.remove("open");
    }
  });

  // 更换背景图：双背景层交替交叉淡化（手机端用竖版图源）
  var BG_LIST = [
    "https://t.alcy.cc/pc",
    "https://api.anosu.top/img",
    "https://www.dmoe.cc/random.php",
    "https://api.paugram.com/wallpaper/?source=acg",
  ];
  var BG_LIST_MOBILE = [
    "https://t.alcy.cc/mp",
    "https://api.anosu.top/img",
    "https://www.dmoe.cc/random.php",
  ];
  function bgListNow() {
    return isMobile() ? BG_LIST_MOBILE : BG_LIST;
  }
  var bgIdx = 0;
  var bgFailCount = 0;
  function mkBgLayer() {
    var el = document.createElement("div");
    el.style.cssText =
      "position:fixed;inset:0;z-index:-1;background:top/cover no-repeat;opacity:0;pointer-events:none;transition:opacity .8s ease;";
    document.body.appendChild(el);
    return el;
  }
  var bgLayerA = mkBgLayer();
  var bgLayerB = mkBgLayer();
  var front = null; // 当前不透明层；初始显示 html 底图
  function switchBg() {
    var list = bgListNow();
    bgIdx = (bgIdx + 1) % list.length;
    var url = list[bgIdx];
    var img = new Image();
    img.onload = function () {
      // 新图已就绪：另一层载入新图并淡入，旧层淡出
      bgFailCount = 0;
      var target = front === bgLayerA ? bgLayerB : bgLayerA;
      target.style.backgroundImage = "url('" + url + "')";
      void target.offsetHeight;
      target.style.opacity = "1";
      if (front) front.style.opacity = "0";
      front = target;
    };
    img.onerror = function () {
      // 这张加载失败：尝试下一个，最多轮完一圈
      bgFailCount++;
      if (bgFailCount < bgListNow().length) switchBg();
    };
    img.src = url;
  }

  document.getElementById("btn-bg").addEventListener("click", function () {
    switchBg();
    panel.classList.remove("open");
  });
  document.getElementById("btn-reload-music").addEventListener("click", function () {
    if (window.reloadMusic) window.reloadMusic();
    panel.classList.remove("open");
  });
  document.getElementById("btn-reload-whale").addEventListener("click", function () {
    if (window.reloadWhale) window.reloadWhale();
    panel.classList.remove("open");
  });
})();

// 本站运行时长（实时跳动 + 加载后从 0 滚动到真实值）
(function () {
  var start = new Date("2026/08/29"); // 改成你的网站正式上线日期
  var dayEl = document.getElementById("run-days");
  var hourEl = document.getElementById("run-hours");
  var minEl = document.getElementById("run-minutes");
  var secEl = document.getElementById("run-seconds");
  if (!dayEl || !hourEl || !minEl || !secEl) return;
  var animDone = false;

  function set(d, h, m, s) {
    dayEl.innerText = d;
    hourEl.innerText = h;
    minEl.innerText = m;
    secEl.innerText = s;
  }
  function tick() {
    if (!animDone) return; // 入场动画期间不覆盖
    var s = Math.floor(Math.max(0, Date.now() - start.getTime()) / 1000);
    var d = Math.floor(s / 86400);
    s -= d * 86400;
    var h = Math.floor(s / 3600);
    s -= h * 3600;
    var m = Math.floor(s / 60);
    set(d, h, m, s - m * 60);
  }
  // 入场：约 1.8 秒从 0 滚动到真实运行时间
  function rollUp() {
    var t0 = performance.now();
    var DUR = 1800;
    var totalSec = Math.floor(Math.max(0, Date.now() - start.getTime()) / 1000);
    function step(now) {
      var p = Math.min(1, (now - t0) / DUR);
      var e = 1 - Math.pow(1 - p, 3); // ease-out
      var v = Math.round(totalSec * e);
      var d = Math.floor(v / 86400);
      var r = v % 86400;
      var h = Math.floor(r / 3600);
      var r2 = r % 3600;
      var m = Math.floor(r2 / 60);
      set(d, h, m, r2 % 60);
      if (p < 1) requestAnimationFrame(step);
      else {
        var s2 = totalSec % 86400;
        set(Math.floor(totalSec / 86400), Math.floor(s2 / 3600), Math.floor((s2 % 3600) / 60), s2 % 60);
        animDone = true;
      }
    }
    requestAnimationFrame(step);
  }
  tick();
  setInterval(tick, 1000);
  // 等页脚那一行淡入时开始滚动
  window.addEventListener("load", function () {
    setTimeout(rollUp, 3400);
  });
})();

// 访问量数字滚动动画（不蒜子写入数字后从 0 滚到真实值）
(function () {
  var pv = document.getElementById("busuanzi_value_site_pv");
  var uv = document.getElementById("busuanzi_value_site_uv");
  if (!pv || !uv) return;
  var done = false;
  function fmt(n) {
    try {
      return n.toLocaleString("en-US");
    } catch (e) {
      return String(n);
    }
  }
  function tryAnimate() {
    if (done) return;
    var pvText = (pv.textContent || "").replace(/[^\d]/g, "");
    var uvText = (uv.textContent || "").replace(/[^\d]/g, "");
    if (!pvText || !uvText) return; // 不蒜子还没写入
    done = true;
    var pvNum = parseInt(pvText, 10) || 0;
    var uvNum = parseInt(uvText, 10) || 0;
    var t0 = performance.now();
    var DUR = 1600;
    function step(now) {
      var p = Math.min(1, (now - t0) / DUR);
      var e = 1 - Math.pow(1 - p, 3); // ease-out
      pv.textContent = fmt(Math.round(pvNum * e));
      uv.textContent = fmt(Math.round(uvNum * e));
      if (p < 1) requestAnimationFrame(step);
      else {
        pv.textContent = fmt(pvNum);
        uv.textContent = fmt(uvNum);
      }
    }
    requestAnimationFrame(step);
  }
  // 轮询等待不蒜子写入（最多 20 秒）
  var tries = 0;
  var timer = setInterval(function () {
    tryAnimate();
    if (done || ++tries > 40) clearInterval(timer);
  }, 500);
})();

// 图床加载失败提示：用 JS 检测背景图 URL 是否能加载
(function () {
  var tip = document.getElementById("bg-fail-tip");
  if (!tip) return;
  var bg = getComputedStyle(document.documentElement).backgroundImage || "";
  var m = bg.match(/url\(\s*["']?([^"')]+)["']?\s*\)/);
  if (!m) return;
  var img = new Image();
  img.onload = function () {
    tip.style.display = "none"; // 图床正常
  };
  img.onerror = function () {
    tip.style.display = "block"; // 图床挂了，显示提示
  };
  img.src = m[1];
})();
