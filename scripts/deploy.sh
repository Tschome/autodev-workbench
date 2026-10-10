#!/usr/bin/env bash
# Deploy the AutoDev Workbench static release site to an S3-compatible object
# store (Aliyun OSS / Tencent COS / Qiniu / MinIO) using rclone, then smoke-test
# the live URLs.
#
#   ./scripts/deploy.sh [--dry-run] [--delete] [--target REMOTE:PATH]
#
# Copy deploy.config.example.env to deploy.env and edit it first.
# Default is a safe `rclone copy` (never deletes anything). --delete switches
# to `rclone sync`, which removes remote files that no longer exist locally.
set -euo pipefail

SITE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$SITE_DIR"

DRY=""
DELETE=0
TARGET_OVERRIDE=""
while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY="--dry-run"; shift ;;
    --delete)  DELETE=1; shift ;;
    --target)  TARGET_OVERRIDE="${2:-}"; shift 2 ;;
    -h|--help) sed -n '2,9p' "$0"; exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

if [ -f deploy.env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./deploy.env
  set +a
fi

SITE_TARGET="${TARGET_OVERRIDE:-${SITE_TARGET:-}}"
DL_TARGET="${DL_TARGET:-}"
SITE_BASE_URL="${SITE_BASE_URL:-}"
RCLONE_REMOTE="${RCLONE_REMOTE:-}"

die() { echo "ERROR: $*" >&2; exit 1; }

[ -n "$SITE_TARGET" ] || die "SITE_TARGET is not set — edit deploy.env or pass --target"
command -v rclone  >/dev/null || die "rclone not found — run: brew install rclone"
command -v node    >/dev/null || die "node not found"
command -v python3 >/dev/null || die "python3 not found"

if [ -n "$RCLONE_REMOTE" ]; then
  rclone listremotes | grep -qx "${RCLONE_REMOTE}:" \
    || die "rclone remote '${RCLONE_REMOTE}:' is not configured — run: rclone config"
fi

MODE=copy
[ "$DELETE" -eq 1 ] && MODE=sync

echo "==> 1/4  validating site"
node scripts/check.mjs
python3 scripts/release.py verify

echo "==> 2/4  uploading site -> $SITE_TARGET  (rclone $MODE)"
# shellcheck disable=SC2086
rclone "$MODE" . "$SITE_TARGET" $DRY \
  --checksum \
  --header-upload "Cache-Control: public, max-age=300" \
  --exclude ".git/**" \
  --exclude ".DS_Store" \
  --exclude "**/.DS_Store" \
  --exclude ".gitignore" \
  --exclude "deploy.env" \
  --exclude "deploy.config.example.env" \
  --exclude "scripts/**" \
  --exclude "README.md" \
  --exclude "DEPLOY.md" \
  --exclude "__pycache__/**" \
  --exclude "*.pyc" \
  --stats-one-line -v

if [ -n "$DL_TARGET" ] && [ "$DL_TARGET" != "$SITE_TARGET" ]; then
  echo "==> 3/4  uploading packages -> $DL_TARGET"
  echo "    NOTE: with a separate package host, release.json 'url' values must be"
  echo "          absolute — see DEPLOY.md, section 「把安装包放到独立域名」."
  # shellcheck disable=SC2086
  rclone "$MODE" dl "$DL_TARGET" $DRY \
    --checksum \
    --header-upload "Cache-Control: public, max-age=31536000, immutable" \
    --stats-one-line -v
else
  echo "==> 3/4  packages ship inside the site target (relative dl/ links)"
fi

if [ -z "$SITE_BASE_URL" ]; then
  echo "==> 4/4  smoke test skipped (SITE_BASE_URL not set)"
  exit 0
fi
if [ -n "$DRY" ]; then
  echo "==> 4/4  smoke test skipped (dry run)"
  exit 0
fi

echo "==> 4/4  smoke test against $SITE_BASE_URL"
base="${SITE_BASE_URL%/}"
code="$(curl -s -o /dev/null -w '%{http_code}' "$base/")"
[ "$code" = "200" ] || die "homepage returned HTTP $code"
echo "    OK    $base/  [200]"

python3 - "$base" <<'PY'
import json, sys, urllib.request
base = sys.argv[1].rstrip('/')
data = json.load(open('release.json', encoding='utf-8'))
bad = 0
for item in data['packages']:
    url = base + '/' + item['url']
    try:
        req = urllib.request.Request(url, method='HEAD')
        with urllib.request.urlopen(req, timeout=30) as r:
            cl = int(r.headers.get('Content-Length') or -1)
            ok = r.status == 200 and cl == item['size']
    except Exception as exc:                      # noqa: BLE001
        print(f"    FAIL  {url}  ({exc})")
        bad += 1
        continue
    print(f"    {'OK  ' if ok else 'FAIL'}  {url}  {cl}/{item['size']}")
    bad += 0 if ok else 1
if bad:
    print(f"{bad} download URL(s) failed", file=sys.stderr)
sys.exit(1 if bad else 0)
PY

echo "==> done — site is live and every download resolves"
