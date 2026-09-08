// 右下角小鲸鱼挂件：点击随机台词、拖拽+吸附、按压Q弹、音效、汉堡菜单（无余额/峰谷/用量）
(function () {
  var root = document.getElementById("whale");
  if (!root) return;
  var img = document.getElementById("whale-img");
  var bubble = document.getElementById("whale-bubble");
  var bubbleText = document.getElementById("whale-bubble-text");
  var menuBtn = document.getElementById("whale-menu");
  var panel = document.getElementById("whale-panel");
  var scaleInput = document.getElementById("wh-scale");
  var scaleNum = document.getElementById("wh-scale-num");
  var soundSelect = document.getElementById("wh-sound");
  var volInput = document.getElementById("wh-vol");
  var volNum = document.getElementById("wh-vol-num");
  var bubbleToggle = document.getElementById("wh-bubble");

  var phrases = [
    "好模型... ↓",
    "好女孩...↓",
    "不知道用户有什么用，先赶走吧~",
    "我...我...我也要挣钱吗？",
    "我去吃饭啦，测完叫我",
    "压力一只蓝色大肥鱼？！",
    "DeepSleep...",
    "坏了...用户彻底怒了！",
    "恭喜你实现token自由！token全跑了！",
    "真当我是便宜货啊...",
    "哦鲸鲸... ",
    "今天也要元气满满地营业哦~",
  ];

  // 配置
  var scale = 1.0;
  var soundSet = Math.random() < 0.5 ? "duck" : "fx1"; // 默认随机小黄鸭/音效1，钢管手动选
  var vol = 0.9;
  var bubbleOn = true;
  var MARGIN = 12;

  function readConfig() {
    try {
      var c = JSON.parse(localStorage.getItem("whale-cfg-v2") || "{}");
      if (c.scale) scale = c.scale;
      if (c.soundSet) soundSet = c.soundSet;
      if (typeof c.vol === "number") vol = c.vol;
      if (typeof c.bubbleOn === "boolean") bubbleOn = c.bubbleOn;
    } catch (e) {}
  }
  function saveConfig() {
    try {
      localStorage.setItem(
        "whale-cfg-v2",
        JSON.stringify({ scale: scale, soundSet: soundSet, vol: vol, bubbleOn: bubbleOn })
      );
    } catch (e) {}
  }
  function applyControls() {
    root.style.setProperty("--wh-scale", scale);
    scaleInput.value = scale;
    scaleNum.textContent = scale.toFixed(1);
    soundSelect.value = soundSet;
    volInput.value = vol;
    volNum.textContent = Math.round(vol * 100) + "%";
    bubbleToggle.checked = bubbleOn;
  }
  readConfig();
  applyControls();

  // 音效：按压/松开两声改成"顺序播放"——先完整播完第一声(按压声)，放完后再紧接着放第二声(松开声)，
  // 两者不重叠。元素复用并预加载，保证即便快速连按每一声都就绪；松开声会排队等第一声 ended 再播。
  function snds() {
    if (soundSet === "fx1") return ["D1.mp3", "D2.mp3"];
    if (soundSet === "steel") return ["Gang1.mp3", null]; // 钢管落地：只摁下响，松开不响
    return ["Ya1.mp3", "Ya2.mp3"];
  }
  var audioPool = {}; // 按文件名缓存 Audio 元素
  function ensureAudio(f) {
    var a = audioPool[f];
    if (!a) {
      a = audioPool[f] = new Audio("./static/sounds/" + f);
      a.preload = "auto";
    }
    return a;
  }
  function preloadSounds() {
    snds().forEach(function (f) {
      if (f) {
        var a = ensureAudio(f);
        if (a.readyState < 2) a.load(); // HAVE_CURRENT_DATA 以下才真正去加载
      }
    });
  }
  function playNow(el) {
    if (!el) return;
    el.volume = vol;
    try {
      el.currentTime = 0; // 允许同一个元素被快速重复触发
    } catch (e) {}
    var p = el.play();
    if (p && p.catch) p.catch(function () {});
  }
  var firstEl = null; // 当前这一轮"按压声"的元素
  var pendingEndFn = null; // 挂在按压声上、用于触发松开声的 ended 处理器
  function cancelPendingSecond() {
    if (firstEl && pendingEndFn) firstEl.removeEventListener("ended", pendingEndFn);
    pendingEndFn = null;
  }
  function playSecond(second) {
    var first = firstEl;
    function go() {
      cancelPendingSecond();
      firstEl = null;
      playNow(second); // 第一声放完，紧接着放第二声
    }
    if (!first) {
      go();
      return;
    }
    if (first.ended) {
      // 第一声早已放完（如长按后才松手）：直接放第二声
      go();
      return;
    }
    // 第一声仍在播放/尚未开始：排队等它 ended 后再放第二声
    cancelPendingSecond();
    pendingEndFn = go;
    first.addEventListener("ended", go, { once: true });
  }
  function playSound(which) {
    if (vol <= 0) return;
    var f = snds()[which];
    if (!f) return; // 松开不响
    var el = ensureAudio(f);
    if (which === 0) {
      // 新一次"按压"：丢弃上一轮遗留的"松开排队"，从头播按压声
      cancelPendingSecond();
      firstEl = el;
      playNow(el);
    } else {
      // 松开：排在按压声之后播放
      playSecond(el);
    }
  }
  // 一开始就预载当前音效对，保证每一声都"就绪"
  preloadSounds();

  // 气泡
  var hideTimer = null;
  function pick() {
    return phrases[Math.floor(Math.random() * phrases.length)];
  }
  function showBubble() {
    if (!bubbleOn) return;
    if (bubbleText) bubbleText.textContent = pick();
    bubble.classList.add("show");
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(hideBubble, 5000);
  }
  function hideBubble() {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
    bubble.classList.remove("show");
  }
  bubble.addEventListener("click", function (e) {
    e.stopPropagation();
    hideBubble();
  });

  // 拖拽 + 四边吸附 + Q弹 + 音效
  var drag = null;
  var snapTimer = null;
  img.style.cursor = "grab";
  img.addEventListener("pointerdown", function (e) {
    if (e.button !== 0) return;
    e.preventDefault();
    if (snapTimer) {
      clearTimeout(snapTimer);
      snapTimer = null;
    }
    // 先记录当前视觉位置（吸附动画进行中 = 半途位置），再取消过渡，
    // 避免元素瞬间跳到吸附目标
    var rect = root.getBoundingClientRect();
    root.classList.remove("snapping");
    root.style.transform = "none";
    root.style.left = rect.left + "px";
    root.style.top = rect.top + "px";
    root.style.right = "auto";
    root.style.bottom = "auto";
    drag = {
      startX: e.clientX,
      startY: e.clientY,
      left: rect.left,
      top: rect.top,
      moved: false,
    };
    img.style.cursor = "grabbing";
    root.classList.add("pressing");
    playSound(0);
    if (img.setPointerCapture) img.setPointerCapture(e.pointerId);
  });
  document.addEventListener("pointermove", function (e) {
    if (!drag) return;
    var dx = e.clientX - drag.startX;
    var dy = e.clientY - drag.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) drag.moved = true;
    var L = Math.max(MARGIN, Math.min(window.innerWidth - root.offsetWidth - MARGIN, drag.left + dx));
    var T = Math.max(MARGIN, Math.min(window.innerHeight - root.offsetHeight - MARGIN, drag.top + dy));
    root.style.left = L + "px";
    root.style.top = T + "px";
    root.style.right = "auto";
    root.style.bottom = "auto";
  });
  function endDrag(e) {
    if (!drag) return;
    var wasClick = !drag.moved;
    root.classList.remove("pressing");
    img.style.cursor = "grab";
    drag = null;
    // 松开 Q 弹 + 音效
    root.classList.add("bounce");
    setTimeout(function () {
      root.classList.remove("bounce");
    }, 220);
    playSound(1);
    if (wasClick) showBubble();
    else snap();
  }
  document.addEventListener("pointerup", endDrag);
  document.addEventListener("pointercancel", endDrag);

  function snap() {
    root.classList.add("snapping");
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var w = root.offsetWidth;
    var h = root.offsetHeight;
    var rect = root.getBoundingClientRect();
    var cx = rect.left + rect.width / 2;
    var cy = rect.top + rect.height / 2;
    var L = rect.left;
    var T = rect.top;
    // 四分之一区吸附（始终用 left/top，保证过渡动画生效）
    if (cx < vw * 0.25) {
      L = MARGIN;
      root.classList.add("left");
    } else if (cx > vw * 0.75) {
      L = vw - w - MARGIN;
      root.classList.remove("left");
    } else {
      root.classList.remove("left");
    }
    if (cy < vh * 0.25) {
      T = MARGIN;
    } else if (cy > vh * 0.75) {
      // 贴底更近：4px
      T = vh - h - 4;
    }
    root.style.left = L + "px";
    root.style.top = T + "px";
    root.style.right = "auto";
    root.style.bottom = "auto";
    if (snapTimer) clearTimeout(snapTimer);
    snapTimer = setTimeout(function () {
      root.classList.remove("snapping");
      snapTimer = null;
    }, 1600);
  }

  // 菜单
  menuBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    panel.classList.toggle("open");
  });
  scaleInput.addEventListener("input", function () {
    scale = Number(scaleInput.value);
    scaleNum.textContent = scale.toFixed(1);
    root.style.setProperty("--wh-scale", scale);
    saveConfig();
  });
  soundSelect.addEventListener("change", function () {
    soundSet = soundSelect.value;
    preloadSounds(); // 换音效后预载新的一组
    saveConfig();
  });
  volInput.addEventListener("input", function () {
    vol = Number(volInput.value);
    volNum.textContent = Math.round(vol * 100) + "%";
    saveConfig();
  });
  bubbleToggle.addEventListener("change", function () {
    bubbleOn = bubbleToggle.checked;
    if (!bubbleOn) hideBubble();
    saveConfig();
  });

  // 隐藏 / 唤出小鲸鱼
  var whaleHideBtn = document.getElementById("whale-hide");
  var whaleReopenBtn = document.getElementById("whale-reopen");
  var whaleReopenTimer = null;
  if (whaleHideBtn && whaleReopenBtn) {
    whaleHideBtn.addEventListener("click", function () {
      // 清掉拖拽产生的内联定位，让入场隐藏动画生效
      root.classList.remove("in");
      root.style.transform = "";
      root.style.left = "";
      root.style.top = "";
      root.style.right = "12px";
      root.style.bottom = "4px";
      panel.classList.remove("open");
      // 鲸鱼完全下沉后（0.9s）再从下方弹出按钮
      if (whaleReopenTimer) clearTimeout(whaleReopenTimer);
      whaleReopenTimer = setTimeout(function () {
        whaleReopenBtn.classList.add("show");
      }, 950);
    });
    whaleReopenBtn.addEventListener("click", function () {
      if (whaleReopenTimer) {
        clearTimeout(whaleReopenTimer);
        whaleReopenTimer = null;
      }
      root.classList.add("in");
      whaleReopenBtn.classList.remove("show");
    });
  }

  // 重新加载小鲸鱼：复位右下角，屏外停留一秒再重新弹出
  window.reloadWhale = function () {
    if (!root) return;
    root.classList.remove("in", "pressing", "bounce", "snapping");
    root.style.transform = "";
    root.style.left = "";
    root.style.top = "";
    root.style.right = "12px";
    root.style.bottom = "4px";
    if (whaleReopenBtn) whaleReopenBtn.classList.remove("show");
    void root.offsetHeight;
    setTimeout(function () {
      root.classList.add("in");
      setTimeout(function () {
        showBubble();
      }, 1200);
    }, 1300);
  };

  // 页面完全加载完成后，从屏幕底部缓缓升起，然后自动说一句
  window.addEventListener("load", function () {
    setTimeout(function () {
      root.classList.add("in");
      setTimeout(function () {
        showBubble();
      }, 1200);
    }, 300);
  });
})();
