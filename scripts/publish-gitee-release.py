#!/usr/bin/env python3
"""Publish the installers listed in release.json to Gitee as issue/release attachments.

The installers are NOT kept in git (Gitee's git repo caps at 500 MB); they live as
release attachments, which get their own 1 GB budget.

    scripts/publish-gitee-release.py --dry-run
    scripts/publish-gitee-release.py

Reads the token from $GITEE_TOKEN, else ~/.config/gitee/token. The token is never
written to the repo, a remote URL, or .git/config.
"""
import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path

SITE = Path(__file__).resolve().parents[1]
API = "https://gitee.com/api/v5"
REPO = "tschome/autodev-workbench"


def get_token():
    token = os.environ.get("GITEE_TOKEN", "").strip()
    if token:
        return token
    path = Path.home() / ".config" / "gitee" / "token"
    if path.is_file():
        return path.read_text(encoding="utf-8").strip()
    sys.exit("ERROR: no token — set GITEE_TOKEN or write ~/.config/gitee/token")


def request(url, data=None, headers=None, allow404=False):
    req = urllib.request.Request(url, data=data, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=600) as resp:
            raw = resp.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        if allow404 and exc.code == 404:
            return None
        raise SystemExit(
            f"ERROR {exc.code} {url}\n{exc.read().decode('utf-8', 'replace')}"
        ) from exc
    return json.loads(raw) if raw.strip() else {}


def upload(release_id, path, token):
    """multipart/form-data POST — urllib has no built-in encoder."""
    boundary = "----AutoDevWorkbench" + uuid.uuid4().hex
    head = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="access_token"\r\n\r\n{token}\r\n'
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="file"; filename="{path.name}"\r\n'
        f"Content-Type: application/octet-stream\r\n\r\n"
    ).encode("utf-8")
    body = head + path.read_bytes() + f"\r\n--{boundary}--\r\n".encode("utf-8")
    return request(
        f"{API}/repos/{REPO}/releases/{release_id}/attach_files",
        data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
    )


def main():
    manifest_path = SITE / "release.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--version", default=manifest["version"])
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--notes", default=None)
    args = parser.parse_args()

    tag = f"v{args.version}"
    files = []
    for item in manifest["packages"]:
        path = SITE / item["url"]
        if not path.is_file():
            sys.exit(f"ERROR: missing package {path} — run scripts/release.py download")
        if path.stat().st_size != item["size"]:
            sys.exit(f"ERROR: size drift on {path.name}; regenerate the manifest")
        files.append((path, item))

    if args.dry_run:
        print(f"tag {tag}: would upload {len(files)} attachments")
        for path, _ in files:
            print(f"  {path.name}  {path.stat().st_size:,} bytes")
        return

    token = get_token()
    q = urllib.parse.quote(token, safe="")
    release = request(f"{API}/repos/{REPO}/releases/tags/{tag}?access_token={q}", allow404=True)
    if release is None:
        form = urllib.parse.urlencode({
            "access_token": token,
            "tag_name": tag,
            "name": f"AutoDev Workbench {tag}",
            "body": args.notes or f"AutoDev Workbench {tag} 安装包。",
            "target_commitish": "master",
            "prerelease": "false",
            "draft": "false",
        }).encode()
        release = request(
            f"{API}/repos/{REPO}/releases",
            data=form,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        print(f"created release {tag} (id={release['id']})")
    else:
        print(f"release {tag} already exists (id={release['id']})")

    if release is None:
        sys.exit("ERROR: release lookup/creation returned nothing")

    release_id = release["id"]
    have = {a.get("name") for a in release.get("assets", [])}
    for path, item in files:
        if path.name in have:
            print(f"  skip (already attached) {path.name}")
            continue
        result = upload(release_id, path, token)
        print(f"  uploaded {path.name} -> {result.get('browser_download_url')}")

    release = request(f"{API}/repos/{REPO}/releases/tags/{tag}?access_token={q}")
    if release is None:
        sys.exit("ERROR: release disappeared after upload")
    print(f"\nrelease: {release.get('html_url')}")
    for asset in release.get("assets", []):
        print(f"  {asset['name']}  {asset.get('browser_download_url')}")


if __name__ == "__main__":
    main()
