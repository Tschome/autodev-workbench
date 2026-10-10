#!/usr/bin/env python3
"""Restore or verify the exact release assets recorded by this static website."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess
import tempfile

SITE = Path(__file__).resolve().parents[1]


def manifest():
    data = json.loads((SITE / 'release.json').read_text(encoding='utf-8'))
    match = re.fullmatch(r'https://github\.com/([\w.-]+/[\w.-]+)/releases/tag/(v[\w.-]+)', data['releaseUrl'])
    if not match or match[2] != 'v' + data['version']:
        raise ValueError('releaseUrl must identify the manifest version on GitHub')
    names, ids = set(), set()
    for item in data['packages']:
        name = item['filename']
        if not re.fullmatch(r'[A-Za-z0-9_.-]+', name) or name.startswith('.'):
            raise ValueError(f'Invalid asset filename: {name}')
        if item['url'] != 'dl/' + name or name in names or item['id'] in ids:
            raise ValueError(f'Duplicate asset or inconsistent URL: {name}')
        if type(item['size']) is not int or item['size'] <= 0 or not re.fullmatch(r'[a-f0-9]{64}', item['sha256']):
            raise ValueError(f'Invalid size or SHA-256: {name}')
        names.add(name)
        ids.add(item['id'])
    if not names:
        raise ValueError('No release packages')
    return data, match[1], match[2]


def verify_file(path, item):
    if not path.is_file():
        raise ValueError(f'Missing package: {path.name}; run download first')
    if path.stat().st_size != item['size']:
        raise ValueError(f'Size mismatch: {path.name}; existing files are never overwritten')
    digest = hashlib.sha256()
    with path.open('rb') as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b''):
            digest.update(chunk)
    if digest.hexdigest() != item['sha256']:
        raise ValueError(f'SHA-256 mismatch: {path.name}; existing files are never overwritten')


def run(mode):
    data, repo, tag = manifest()
    if mode == 'download':
        missing = []
        for item in data['packages']:
            target = SITE / item['url']
            if target.is_symlink():
                raise ValueError(f'Refusing symlink: {target.name}')
            if target.exists():
                verify_file(target, item)
            else:
                missing.append(item)
        if missing:
            if not shutil.which('gh'):
                raise ValueError('Install GitHub CLI and authenticate an account with repository access')
            release = json.loads(subprocess.check_output(
                ['gh', 'api', f'repos/{repo}/releases/tags/{tag}'], text=True, timeout=60))
            if release['tag_name'] != tag or release['draft']:
                raise ValueError('Expected a published release matching the manifest')
            assets = {asset['name']: asset for asset in release['assets']}
            for item in missing:
                asset = assets.get(item['filename'], {})
                if asset.get('size') != item['size'] or asset.get('digest') != 'sha256:' + item['sha256']:
                    raise ValueError(f'GitHub asset metadata differs from manifest: {item["filename"]}')
            (SITE / 'dl').mkdir(exist_ok=True)
            with tempfile.TemporaryDirectory(prefix='.download-', dir=SITE / 'dl') as temp:
                for item in missing:
                    subprocess.run(['gh', 'release', 'download', tag, '--repo', repo,
                                    '--pattern', item['filename'], '--dir', temp], check=True, timeout=240)
                    downloaded = Path(temp) / item['filename']
                    verify_file(downloaded, item)
                    target = SITE / item['url']
                    # Exclusive creation preserves any file another process wrote meanwhile.
                    with downloaded.open('rb') as source, target.open('xb') as destination:
                        try:
                            shutil.copyfileobj(source, destination)
                        except BaseException:
                            target.unlink(missing_ok=True)
                            raise
                    print(f'Restored {item["filename"]}', flush=True)
    for item in data['packages']:
        verify_file(SITE / item['url'], item)
        print(f'OK {item["filename"]} ({item["size"]:,} bytes)', flush=True)
    print(f'Verified v{data["version"]}: {len(data["packages"])} packages')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('mode', choices=['verify', 'download'], help='download restores missing files; verify is offline and read-only')
    args = parser.parse_args()
    try:
        run(args.mode)
    except (OSError, ValueError, KeyError, subprocess.SubprocessError) as error:
        parser.exit(1, f'ERROR: {error}\n')
