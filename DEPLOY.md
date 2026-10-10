# 部署：本机 → 对象存储 → CDN

本仓库是对外发布仓库：静态网页 + 各平台安装包。网页的对外访问走**自有对象存储 + CDN**，不在 Gitee 上托管（Gitee Pages 已下线，见文末）。

```
本机(本仓库)  --rclone-->  对象存储桶  --CDN-->  用户
                             │
                             └─ www.<domain>      网页（index.html / docs.html / assets）
                             └─ updates.<domain>  安装包（dl/），可选拆分
```

## 1. 前置

| 依赖 | 用途 | 本机状态 |
|---|---|---|
| `rclone` | 上传到 OSS/COS/Qiniu | ✅ 1.75.1（`brew install rclone`） |
| `node` | 静态检查 `scripts/check.mjs` | ✅ v26.7.0 |
| `python3` | 安装包校验 `scripts/release.py verify` | ✅ 系统 3.9.6 |

## 2. 一次配置 rclone

`rclone` 的 `s3` 后端已支持 Alibaba / TencentCOS / Qiniu（可用 `rclone config providers` 核对）：

```sh
rclone config        # n → 起个名字 → 选 s3 → provider 选对应厂商 → 填 AK/SK 和 endpoint
```

阿里云 OSS 的例子（填进 `rclone config` 对应的字段即可）：

```
[alioss]
type     = s3
provider = Alibaba
access_key_id     = <AccessKeyId>
secret_access_key = <AccessKeySecret>
endpoint = oss-cn-hangzhou.aliyuncs.com
```

腾讯云 COS：`provider = TencentCOS`，`endpoint = cos.ap-guangzhou.myqcloud.com`。
其他厂商照 `rclone config` 的提示走。配置完 `rclone listremotes` 应能看到 `alioss:`。

## 3. deploy.env

```sh
cp deploy.config.example.env deploy.env
$EDITOR deploy.env
```

`deploy.env` 被 gitignore，不会入库。字段：

| 变量 | 说明 |
|---|---|
| `RCLONE_REMOTE` | rclone remote 名，需与 `rclone listremotes` 一致 |
| `SITE_TARGET` | 网页目标：`<remote>:<bucket>[/<prefix>]` |
| `DL_TARGET` | 可选，安装包单独放另一个桶/域名时用（见第 6 节） |
| `SITE_BASE_URL` | 部署后冒烟测试用的公网地址 |

## 4. 部署

```sh
./scripts/deploy.sh --dry-run        # 先看会传哪些文件
./scripts/deploy.sh                  # 安全上传（rclone copy，永不删除远端文件）
./scripts/deploy.sh --delete         # 真正同步（rclone sync，会删除远端多余文件）
```

脚本固定做四步：

1. 跑 `node scripts/check.mjs` + `python3 scripts/release.py verify`，校验不过就**不上传**；
2. `rclone copy/sync` 仓库根目录到 `SITE_TARGET`，上传时带 `Cache-Control: public, max-age=300`；
3. 安装包默认跟着网页一起传（`release.json` 里是相对 `dl/` 链接，URL 直接可用）；
4. 若设了 `SITE_BASE_URL`，对首页和 `release.json` 里的每个安装包发 HEAD 请求，核对 200 与 `Content-Length`。

自动排除：`.git/`、`.gitignore`、`scripts/`、`README.md`、`DEPLOY.md`、`deploy.env`、`deploy.config.example.env`、`__pycache__/`、`.DS_Store`。也就是只有网页和安装包会上传。

本地不接云端也能验证链路（把目标换成目录即可，脚本支持本地路径）：

```sh
./scripts/deploy.sh --target /tmp/site-out
```

## 5. 域名、CDN 和备案

- `www.<domain>` 指向网页桶；开启 CDN 加速。
- 缓存策略：`index.html` / `docs.html` / `release.json` 用短缓存（脚本已设 300s）；`dl/` 里的安装包用长缓存（`max-age=31536000, immutable`），因为文件名带版本号，内容不会变。
- **发新版后必须刷新 CDN 缓存**：至少刷 `index.html`、`docs.html`、`release.json` 三个 URL。
- 中国大陆节点加速通常要求域名 **ICP 备案**；未备案就先只开境外/香港节点。
- 全站走 HTTPS；`dl/` 大文件建议关掉回源压缩。

## 6. 把安装包放到独立域名（可选，需要改代码）

如果按 `www` / `updates` 拆分，把 `release.json` 里每个 `url` 改成绝对地址（如 `https://updates.example.com/dl/xxx`），同时必须改两处，否则校验会失败：

- `scripts/check.mjs`：写死了 `item.url !== 'dl/' + item.filename`，会报 `Invalid manifest entry`。
- `scripts/release.py`：`manifest()` 同样按 `dl/<filename>` 校验。

不改的话保持单桶（默认路径）最省事，`site.js` 直接用相对 `dl/` 链接，零改动。

## 7. 推送到 Gitee

```sh
git remote add origin https://gitee.com/tschome/autodev-workbench.git   # 若尚未添加
git add -A
git commit -m "chore: 发布站源码与 v0.1.0 安装包"
git push -u origin master        # Gitee 新建仓库默认分支是 master
```

> **配额提醒**：Gitee 社区版 **单文件 ≤ 50MB、单仓库 ≤ 500MB**。`dl/` 每版本约 82MB，
> 大约 5 个版本就会顶到仓库上限。到那时把安装包改放 Gitee「发行版附件」
> （单文件 ≤ 100MB、单仓库合计 ≤ 1GB），仓库里只留网页源码。

## 8. 已知限制

- **Gitee Pages 已下线**：Gitee 帮助中心已无 Pages 文档，旧文档地址 `/help/articles/4328` 现在重定向到首页；Gitee Feedback 多个 issue 中客服明确回复「由于不可抗原因，Pages 服务已经下线，暂无具体计划再次上线」。所以**网页不能托管在 Gitee 上**，只能存源码。
- `release.json` 的 `releaseUrl` / `accessNote` 目前仍指向 GitHub 私有仓库（源仓库 `github.com/Tschome/workbench`）。安装包实际由该仓库的 GitHub Actions 产出，`scripts/release.py download` 也从那里恢复文件；这是**开发期恢复**用途，与对外下载无关。
- 当前**尚未部署过公网**，也没有配置过任何云厂商凭据。
