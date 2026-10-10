# AutoDev Workbench 发布站

本仓库是 AutoDev Workbench 的**对外发布仓库**：存放发布网页的静态源码，、各平台安装包和 Workbench 烧录启动资源包。仓库根目录就是站点根目录，不依赖桌面应用的 Vite/Tauri 构建。

设计采用暖白、墨色、低饱和工程插画；首页以使用场景组织内容，教程页采用侧栏、全文筛选和章节目录。

> 本仓库是 `website/` 内容从源码仓库 `github.com/Tschome/workbench` 的导出。设计规范
> （`docs/workbench-website-design.md`）和维护技能（`.agents/skills/autodev-website/`）
> 留在源码仓库，不随本发布仓库分发。

## 本地预览

```sh
python3 -m http.server 8899 --bind 127.0.0.1
```

访问 `http://127.0.0.1:8899/`。若已有预览进程，不要重复启动。

## 部署

对外访问走**自有对象存储 + CDN**，步骤见 [DEPLOY.md](DEPLOY.md)。一句话版本：

```sh
cp deploy.config.example.env deploy.env   # 填桶和域名
./scripts/deploy.sh --dry-run
./scripts/deploy.sh
```

## 内容入口

- `index.html`：首页、产品演示、案例筛选、教程入口、课程、下载与 FAQ。
- `docs.html` / `docs.js`：教程路由 `?guide=...`、搜索、章节目录与前后篇。
- `docs-content.js`：8 篇可编辑中文教程，每篇拥有稳定 ID 与章节锚点。
- `site.css`：两页共用视觉、移动布局及减少动画支持；颜色使用 `--c-*` 语义变量。
- `site.js`：首页交互、演示状态和下载清单加载。
- `assets/scene-*.svg`：原创工程插画；没有使用第三方网站的图片或品牌标识。
- `release.json`：版本、文件 URL、大小和 SHA-256；安装包放在 `dl/`。
- `scripts/check.mjs`：静态页面、教程 ID/章节和链接检查。
- `scripts/release.py`：安装包的存在性、大小和 SHA-256 校验（及恢复）。
- `scripts/deploy.sh`：上传到对象存储并做公网冒烟测试。\n- `firmware/manifest.json`：固件资源清单；当前仅包含 Cloner runtime 启动资源包。

## 校验

在本仓库根目录执行：

```sh
node scripts/check.mjs
python3 scripts/release.py verify
```

`check.mjs` 做静态检查，不要求安装包存在；`release.py verify` 严格要求 `dl/` 中的包存在并核对大小与 SHA-256。

`release.py download` 用于**从 GitHub 发行版恢复**缺失的已发布包（需要 GitHub CLI；仓库公开，见 `github.com/Tschome/autodev-workbench`）。它只恢复清单对应的包，不覆盖已有不匹配的文件、不更改版本，也不会安装或运行下载的应用。这是开发期恢复用途，与对外下载无关。

## 更新安装包

当前为 2026-09-24 的 `v0.1.0`，共五个原始发布包，合计 85,828,172 bytes。每个本地包的大小与 SHA-256 已与 GitHub Release API 的资产信息比对一致。

安装包在两个公开仓库各发布一份，`release.json` 用 `sources.cn` / `sources.global` 表示两个下载源：国内访客走 Gitee，海外访客走 GitHub。首页只从本地清单读取版本和文件名，下载直连对应平台的发行版，不经过本站中转。

更新时先取得新版本的真实发布包，核对大小与 SHA-256，再更新 `release.json` 和首页版本文案。**不要仅修改下载 URL 或版本标签。** 部署网页时不需要传输 `dl/`，安装包由两个平台的发行版直接分发。

> 安装包走**发行版附件**而不是 git：Gitee 社区版 git 仓库上限 500MB，而 `dl/` 每版本约 82MB；
> 发行版附件单文件 ≤ 100MB、单仓库合计 ≤ 1GB，够用得多。

## 视频与演示

视频尚未录制，首页三张课程卡仅展示大纲，没有假播放器。课程大纲在 `site.js` 的 `courses` 中。录制完成后可在原有课程位置加入带 `controls`、`poster` 和字幕的 `video` 元素。

产品区是 HTML/CSS/JS 绘制的交互示意，使用示例日志和状态，不发起串口、电源、烧录或 MCP 请求。它不能代替实机验证。正式实机视频应单独标识。

## 验收记录

初版浏览器验收（2026-10-01）：

- 三个 JS 语法检查通过。
- 54 个本地资源/链接检查通过，8 篇教程 ID 和章节引用有效。
- 5 个安装包 HTTP HEAD 均为 200，Content-Length 与清单一致；文件 SHA-256 与 GitHub 资产 digest 一致。
- 浏览器验证：场景切换、烧录示意从 0% 到 100%、案例筛选、课程弹窗、文档搜索与无结果提示、手机菜单。
- 桌面 1440px 与手机 390px 检查；三个插画加载成功，无横向页面溢出；浏览器未记录 JS warning/error。

另于 2026-10-10 在本仓库（站点根目录布局）复核：`check.mjs` 通过、`release.py verify` 5 个包全部匹配、本地 HTTP 服务下首页/资源/`release.json` 均 200、5 个下载 HEAD 的 `Content-Length` 与清单一致、`deploy.sh` 全流程（校验→上传→冒烟测试）通过。

**当前状态：本地可预览、文件已校验；尚未部署到任何公网。** 也没有配置过云厂商凭据，桌面应用的自动更新配置未改动。
\n## 固件资源\n\nfirmware/ 只包含 config.cfg、spl.bin、uboot.bin 的版本化启动资源包，并提供 SHA-256。当前不包含 rootfs、系统分区镜像、完整 OTA 镜像或生产签名文件。\n