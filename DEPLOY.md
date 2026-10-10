# 部署与发布

三个位置：

| 位置 | 作用 |
|---|---|
| Gitee `tschome/autodev-workbench` | 国内下载源；网页源码副本 |
| GitHub `Tschome/autodev-workbench` | 海外下载源；网页源码副本（公开） |
| ECS `101.132.58.126` | 托管网页（nginx，站点目录 `/opt/autodev/www`） |

访客打开首页后，`site.js` 先按**国内源渲染**（下载区立刻可用），再用 IP 归属探测：中国大陆 → Gitee，其他地区 → GitHub；探测超时或失败一律回落 Gitee。

## 1. 发布安装包

清单是 `release.json`，安装包本地缓存在 `dl/`（**不入 git**）。两个平台各发一份发行版：

```sh
# 国内：Gitee 发行版附件（token 放 ~/.config/gitee/token 或 $GITEE_TOKEN）
python3 scripts/publish-gitee-release.py --dry-run
python3 scripts/publish-gitee-release.py

# 海外：GitHub Release（gh 已登录 Tschome）
gh release create v0.1.0 --repo Tschome/autodev-workbench \
  --title "AutoDev Workbench v0.1.0" --notes "安装包见附件。" \
  dl/AutoDev.Workbench_0.1.0_x64-setup.exe dl/AutoDev-Workbench-0.1.0-windows-x64-portable.zip \
  dl/AutoDev.Workbench_0.1.0_aarch64.dmg dl/AutoDev.Workbench_0.1.0_x64.dmg \
  dl/AutoDev.Workbench_0.1.0_amd64.deb
```

`release.json` 结构：

```json
"sources":      { "cn": ".../releases/download/v0.1.0", "global": ".../releases/download/v0.1.0" },
"releasePages": { "cn": ".../releases/tag/v0.1.0",      "global": ".../releases/tag/v0.1.0" },
"notes":        { "cn": "当前下载源：Gitee（国内）。", "global": "当前下载源：GitHub（海外）。" },
"packages":     [ { "id", "platform", "arch", "label", "filename", "size", "sha256" } ]
```

发新版时按这个顺序走，**不要只改 URL 或版本号**：

1. 从源码仓库 `github.com/Tschome/workbench` 的 Actions 取得新版本的真实发布包；
2. 计算字节数和 SHA-256，写入 `release.json` 的 `packages`，同时更新 `version` / `date` / `sources` / `releasePages`；
3. 同步首页（`index.html`）的版本文案；
4. 用上面的命令把包发到两个平台；
5. 跑第 4 节的校验，再部署。

## 2. 部署网页到 ECS

```sh
rsync -az --delete \
  --exclude '.git/' --exclude '.gitignore' --exclude 'dl/' --exclude 'scripts/' \
  --exclude 'README.md' --exclude 'DEPLOY.md' \
  --exclude 'deploy.env' --exclude 'deploy.config.example.env' \
  ./ root@101.132.58.126:/opt/autodev/www/

ssh root@101.132.58.126 'chown -R root:root /opt/autodev/www && nginx -t && systemctl reload nginx'
```

只上传网页和清单：`dl/`（安装包）和 `scripts/` 不进公网目录。

nginx 虚拟主机在 `/etc/nginx/sites-available/autodev-www`，`server_name 101.132.58.126;`，站点根 `/opt/autodev/www`。

> 服务器上另有 `autodev-ota`（默认站，根 `/opt/autodev/ota`，提供 `/latest.json` 和 `/ota/`）承载桌面应用的 OTA 更新。**改网页不要动它。**

## 3. 域名与 HTTPS（待办）

现在只绑了 IP，所以只能用 `http://101.132.58.126/`。拿到域名后：

1. 域名加进 `autodev-www` 的 `server_name`；
2. `certbot --nginx -d <domain>` 签发并自动续期 HTTPS；
3. 回头把本文件里的地址改成域名。

顺带一提：这台 ECS 的 nginx 已经装了 **GeoIP2 模块**（`50-mod-http-geoip2.conf`），需要的话可以把 IP 归属判断从浏览器挪到服务端，比前端调第三方接口更稳、也不依赖访客网络。

## 4. 上传前校验

```sh
node scripts/check.mjs            # JS 语法 + 本地链接/锚点 + 清单结构（双源、文件名、SHA-256）
python3 scripts/release.py verify # dl/ 中安装包的存在性、字节数与 SHA-256
```

`check.mjs` 是离线检查，允许本地没有安装包缓存；`release.py verify` 严格要求包存在且字节与摘要一致。

## 5. 部署后冒烟测试

`scripts/deploy.sh` 是给**对象存储**用的（rclone）：校验 → 上传站点 → 对首页和两个下载源的每个包发 HEAD 请求核对 `Content-Length`。

```sh
cp deploy.config.example.env deploy.env
./scripts/deploy.sh --dry-run
./scripts/deploy.sh                       # 对象存储；当前网页走 ECS，暂不需要
./scripts/deploy.sh --target /tmp/out     # 本地目录也能跑，用来单测链路
```

当前网页走 ECS，所以主要用它第 4 步（冒烟测试）的思路；将来改成 OSS + CDN 时直接用它。

## 6. 平台限制

- **Gitee 社区版**：git 单文件 ≤ 50MB、单仓库 ≤ 500MB；**发行版附件**单文件 ≤ 100MB、单仓库合计 ≤ 1GB。安装包每版本约 82MB，所以走附件、不进 git 历史。
- **GitHub Release**：公开仓库的附件匿名可下载，单个附件上限 2GB。
- 两个平台的发行版都要发；只发一边会让另一半访客下载失败。

## 7. 已知

- `docs.html` 里的「源文档 · GitHub」仍指向**私有**源码仓库 `github.com/Tschome/workbench`，对公网访客不可用（页面已标注需仓库访问权限）。公开文档站做出来之前先保持现状。
- 网页目前只有 IP 地址，没有域名，也没有 HTTPS。
