#!/usr/bin/env python3
"""Restore an explicitly pinned, complete WASM artifact before Yarn resolves portals."""

import argparse
import hashlib
import json
from pathlib import Path
import shutil
import tempfile


APP = Path(__file__).resolve().parents[2]
REQUIRED = {
    "pkg": "onekey_zcash_runtime",
    "pkg-keys": "onekey_zcash_keys",
    "pkg/storage-benchmark": "onekey_zcash_storage_benchmark",
}


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def inventory(root):
    files = {}
    for directory in ("pkg", "pkg-keys"):
        base = root / directory
        if base.is_symlink():
            raise ValueError(f"Artifact package is a symlink: {directory}")
        for path in sorted(base.rglob("*")):
            if path.is_symlink():
                raise ValueError("Artifact contains a symlink")
            if path.is_file() and path.name != ".gitignore":
                relative = path.relative_to(root).as_posix()
                if path.suffix not in (".js", ".ts", ".wasm", ".md") and path.name not in ("package.json", "LICENSE"):
                    raise ValueError(f"Unexpected artifact file: {relative}")
                files[relative] = sha256(path)
    return files


def restore(source, target, expected_manifest, revision):
    manifest_path = source / "zcash-wasm-manifest.json"
    if manifest_path.is_symlink() or sha256(manifest_path) != expected_manifest:
        raise ValueError("Pinned artifact manifest checksum mismatch")
    manifest = json.loads(manifest_path.read_text())
    if (
        manifest.get("formatVersion") != 1
        or manifest.get("sourceRepository") != "OneKeyHQ/app-modules"
        or manifest.get("sourceRevision") != revision
        or manifest.get("sourceDirty") is not False
    ):
        raise ValueError("Artifact must match the pinned, clean source revision")
    files = inventory(source)
    if files != manifest.get("files"):
        raise ValueError("Artifact file inventory or checksum mismatch")
    for directory, module in REQUIRED.items():
        for name in ("package.json", f"{module}.js", f"{module}.d.ts", f"{module}_bg.wasm"):
            if f"{directory}/{name}" not in files:
                raise ValueError(f"Incomplete artifact: {directory}/{name}")
    entries = ("pkg", "pkg-keys", manifest_path.name)
    for directory in entries:
        if (target / directory).exists() or (target / directory).is_symlink():
            raise ValueError("Refusing to replace an existing local runtime; restore into an empty CI directory")
    target.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="zcash-restore-", dir=target) as temporary:
        staged = Path(temporary)
        for directory in ("pkg", "pkg-keys"):
            shutil.copytree(source / directory, staged / directory)
        if inventory(staged) != files:
            raise ValueError("Artifact changed during restoration")
        shutil.copy2(manifest_path, staged / manifest_path.name)
        if sha256(staged / manifest_path.name) != expected_manifest:
            raise ValueError("Artifact manifest changed during restoration")
        completed = []
        try:
            for directory in entries:
                (staged / directory).rename(target / directory)
                completed.append(directory)
        except BaseException:
            for directory in reversed(completed):
                (target / directory).rename(staged / directory)
            raise
    print(f"Restored all Zcash WASM packages for {revision}; Yarn portal targets are ready.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--artifact-root", type=Path, required=True)
    parser.add_argument("--manifest-sha256", required=True)
    parser.add_argument("--source-revision", required=True)
    parser.add_argument("--target", type=Path, default=APP.parent / "app-modules/chain-runtimes/zcash")
    args = parser.parse_args()
    restore(args.artifact_root.resolve(), args.target.resolve(), args.manifest_sha256, args.source_revision)
