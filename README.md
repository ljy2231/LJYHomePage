# LJY2231 个人主页

二次元卡片风格个人网站主页。

## 功能

- **随机二次元背景**：每次刷新换图，右上角设置里可一键更换背景（桌面用横版、手机用竖版图源，渐变过渡）
- **音乐播放器**（左下角）：本地 mp3 播放，不依赖任何音乐接口；上一曲/下一曲/随机播放、进度条点击跳转、旋转封面
- **歌词面板**（左上角）：按"歌名+歌手"从 LRCLIB 搜索歌词（支持指定歌词 URL），5 行居中滚动、切行上滑动画、双语歌词拆行
- **小鲸鱼挂件**（右下角）：点击随机台词、可拖拽、按压 Q 弹、四种音效（小黄鸭/音效1/钢管落地）、可隐藏
- **右上角设置**：更换背景图、重新载入歌曲、重新加载小鲸鱼
- 访问计数（自建 PHP 接口）、本站运行时长计时（滚数动画）
- 文字逐行浮现动画、响应式适配（手机端卡片居中、音乐/歌词不自动展开）

## 部署

静态部分可放任意服务器；访问计数与壁纸代理需要后端支持（本项目线上为 PHP + Nginx）。

### 本地预览

仓库自带 Range 服务器（音频进度跳转必需），并模拟了计数接口：

```bash
python serve.py
# 访问 http://127.0.0.1:8000
```

### 线上（PHP + Nginx）

1. 上传整站，确认 `api/*.php` 由 PHP-FPM 处理
2. 建数据目录并给写权限：

```bash
mkdir -p /站点路径/api/data
chown -R www:www /站点路径/api/data
chmod 755 /站点路径/api/data
```

3. 禁止直接访问计数数据：

```nginx
location ^~ /api/data/ {
    deny all;
    return 404;
}
```

计数接口为 `api/counter.php`：每次请求 PV +1，UV 按一年期 cookie `ljy_uid` 去重。返回 `{"pv":N,"uv":N,"since":"YYYY-MM-DD"}`，数据存在 `api/data/counter.json`。想设置起始值，直接改这个文件即可。

## 配置

### 添加歌曲

1. 把 mp3 放到 `static/music/`
2. 在 `static/main.js` 的 `LOCAL_SONGS` 数组加一行：

```js
{ name: "歌名", artist: "歌手", url: "./static/music/文件名.mp3" }
```

可选字段：

- `pic`：封面图路径（`static/covers/`）
- `lrcUrl`：指定歌词直链（如网易云歌词代理），优先于自动搜索
- `lrcName` / `lrcArtist`：指定歌词搜索用歌名/歌手（翻唱版按原曲搜索）

### 更换背景图源

编辑 `static/main.js` 的 `BG_LIST`（桌面）和 `BG_LIST_MOBILE`（手机）数组。当前统一使用 `t.alcy.cc`（`/ycy` 横版、`/mp` 竖版）。

### 运行时长起始日期

编辑 `static/main.js` 中 `var start = new Date("2026/08/29")` 为你的实际上线日期。

### 其他

- 一言 API 地址在 `index.html` 的 `hitokoto_api` 变量中修改
- 导航按钮链接、备案号在 `index.html` 中修改

## 目录结构

```
├── index.html          页面主体
├── serve.py            本地静态服务器（支持 Range / 壁纸代理 / 计数）
├── api/
│   ├── counter.php     访问计数接口
│   └── data/           计数数据（运行时生成，不入库）
├── static/
│   ├── main.js         逻辑（播放器/歌词/设置/动画）
│   ├── whale.js        小鲸鱼挂件
│   ├── style.css       样式
│   ├── canvas-nest.min.js   粒子背景
│   ├── layer-v3.5.1/   layer 弹窗库
│   ├── music/          本地 mp3
│   ├── lyrics/         本地歌词文件
│   ├── covers/         歌曲封面
│   ├── sounds/         小鲸鱼音效
│   └── fonts/          气泡字体子集（MiSans Bold）
```

## 说明

- 歌词来自 [LRCLIB](https://lrclib.net)（免费歌词库），部分歌曲歌词来自网易云歌词代理接口。
- 仓库内音乐文件版权归原作者所有，仅用于个人学习与展示，请勿用于商业用途。
- 背景图来自公共随机图床，版权归原画师/图床所有。
- 气泡字体为 MiSans Bold 的 unicode-range 子集（来源 npm `misans`，OFL 协议），仅包含现有台词用到的字符；新增台词若出现缺字，会回退到系统黑体。
- 部分代码由 AI 编写。

## License

[MIT](LICENSE)
