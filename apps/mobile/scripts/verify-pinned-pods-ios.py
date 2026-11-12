#!/usr/bin/env python3
"""Fail `pod install` when a pinned pod's installed files differ from the manifest.

Some pods download prebuilt binaries in their podspec `prepare_command`. The
Podfile.lock SPEC CHECKSUM only covers the podspec text, so
pinned-pods-ios.json pins the SHA-256 of every file the pod installs.

To upgrade a pinned pod, compare the new release asset with the digest GitHub
lists for it, run `pod install`, print the new hashes with `--print <pod>`, and
update the manifest in the same change.
"""
import argparse
import hashlib
import json
from pathlib import Path
import sys

MANIFEST = Path(__file__).with_name('pinned-pods-ios.json')


def sha256(path):
    digest = hashlib.sha256()
    with path.open('rb') as file:
        for chunk in iter(lambda: file.read(1 << 20), b''):
            digest.update(chunk)
    return digest.hexdigest()


def installed_files(pod_dir):
    files = {}
    for path in sorted(pod_dir.rglob('*')):
        relative = path.relative_to(pod_dir).as_posix()
        if path.is_symlink() or not (path.is_file() or path.is_dir()):
            files[relative] = 'not a regular file'
        elif path.is_file():
            files[relative] = sha256(path)
    return files


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('pods_root', type=Path, help='the Pods directory')
    parser.add_argument('--print', dest='print_pod', metavar='POD',
                        help='print the installed hashes of POD as manifest JSON')
    args = parser.parse_args()

    if args.print_pod:
        print(json.dumps(installed_files(args.pods_root / args.print_pod), indent=2))
        return 0

    failed = False
    for name, pin in json.loads(MANIFEST.read_text())['pods'].items():
        pod_dir = args.pods_root / name
        if not pod_dir.is_dir():
            print(f'[pinned pods] {name} is not installed; remove it from {MANIFEST.name} if it is no longer used',
                  file=sys.stderr)
            failed = True
            continue
        expected = pin['files']
        actual = installed_files(pod_dir)
        mismatches = [relative for relative in sorted(expected.keys() | actual.keys())
                      if expected.get(relative) != actual.get(relative)]
        for relative in mismatches:
            print(f'[pinned pods] {name}/{relative}: expected {expected.get(relative, "no file")}, '
                  f'found {actual.get(relative, "no file")}', file=sys.stderr)
        if mismatches:
            failed = True
        else:
            print(f'[pinned pods] {name} {pin["version"]} verified ({len(expected)} files)')
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
