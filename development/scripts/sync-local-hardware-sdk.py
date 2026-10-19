#!/usr/bin/env python3
"""Verify and consume a complete local hardware SDK build without reading local config."""

import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import tempfile


APP = Path(__file__).resolve().parents[2]
PACKAGES = (
    "shared", "hd-transport", "core", "hd-transport-http",
    "hd-transport-electron", "hd-transport-web-device", "hd-transport-lowlevel",
    "hd-transport-usb", "hd-transport-emulator", "hd-transport-react-native",
    "hd-ble-sdk", "hd-common-connect-sdk", "hd-web-sdk",
)


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def inventory(directory):
    if directory.is_symlink():
        raise ValueError(f"Build output is a symlink: {directory}")
    result = {}
    for path in sorted(directory.rglob("*")):
        if path.is_symlink():
            raise ValueError(f"Build output contains a symlink: {path.relative_to(directory)}")
        if path.is_file():
            result[path.relative_to(directory).as_posix()] = sha256(path)
    if not result:
        raise ValueError(f"Empty build output: {directory}")
    return result


def main(sdk, expected_version):
    revision = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=sdk, text=True).strip()
    dirty = bool(subprocess.check_output([
        "git", "-c", "core.fsmonitor=false", "status", "--porcelain", "--untracked-files=normal", "--", "packages", "build",
    ], cwd=sdk, text=True).strip())
    packages = []
    for directory in PACKAGES:
        source = sdk / "packages" / directory
        manifest = json.loads((source / "package.json").read_text())
        name = manifest["name"]
        expected_name = f"@onekeyfe/hd-{directory}" if directory in ("core", "shared") else f"@onekeyfe/{directory}"
        if name != expected_name:
            raise ValueError(f"Unexpected package identity: {directory}")
        target = APP / "node_modules" / name
        if target.is_symlink():
            raise ValueError(f"Refusing to replace linked package: {name}")
        installed = json.loads((target / "package.json").read_text())
        if manifest["version"] != expected_version:
            raise ValueError(f"SDK version mismatch: {name}")
        for field in ("dependencies", "optionalDependencies", "peerDependencies"):
            foreign = lambda value: {key: version for key, version in value.get(field, {}).items() if not key.startswith("@onekeyfe/hd-")}
            if foreign(manifest) != foreign(installed):
                raise ValueError(f"Dependency review required before consuming {name}: {field} changed")
        for name_key, version in manifest.get("dependencies", {}).items():
            if name_key.startswith("@onekeyfe/hd-") and version != expected_version:
                raise ValueError(f"Mixed SDK dependency versions in {name}")
        for entry in (manifest["main"], manifest["types"]):
            relative = Path(entry)
            if relative.is_absolute() or ".." in relative.parts or relative.parts[0] not in ("dist", "build"):
                raise ValueError(f"Unsupported SDK entry: {name}")
            if not (source / entry).is_file():
                raise ValueError(f"Missing SDK entry: {name}/{entry}")
        outputs = ["dist", "build"] if directory == "hd-web-sdk" else ["dist"]
        hashes = {output: inventory(source / output) for output in outputs}
        hashes["package.json"] = sha256(source / "package.json")
        packages.append((source, target, outputs, hashes))
    core_types = (sdk / "packages/core/dist/index.d.ts").read_text()
    for method in ("zcashGetUnifiedAddress", "zcashSignPczt"):
        if method not in core_types:
            raise ValueError(f"Core declarations omit {method}")
    iframe = sdk / "packages/hd-web-sdk/build/iframe.html"
    if not iframe.is_file():
        raise ValueError("The SDK iframe has not been built")

    cache = APP / "node_modules/.cache"
    cache.mkdir(parents=True, exist_ok=True)
    receipt_root = Path(tempfile.mkdtemp(prefix="local-hardware-sdk-", dir=cache))
    receipt = {"sourceRevision": revision, "sourceDirty": dirty, "version": expected_version, "packages": {}}
    completed = []
    try:
        for source, target, outputs, hashes in packages:
            staged = receipt_root / "staged" / target.name
            staged.mkdir(parents=True)
            for output in outputs:
                shutil.copytree(source / output, staged / output)
                if inventory(staged / output) != hashes[output]:
                    raise ValueError(f"Build changed while copying {target.name}")
            shutil.copy2(source / "package.json", staged / "package.json")
            if sha256(staged / "package.json") != hashes["package.json"]:
                raise ValueError(f"Manifest changed while copying {target.name}")
            backup = receipt_root / "previous" / target.name
            backup.parent.mkdir(parents=True, exist_ok=True)
            target.rename(backup)
            try:
                dependencies = backup / "node_modules"
                if dependencies.exists() or dependencies.is_symlink():
                    dependencies.rename(staged / "node_modules")
                staged.rename(target)
            except BaseException:
                dependencies = staged / "node_modules"
                if dependencies.exists() or dependencies.is_symlink():
                    dependencies.rename(backup / "node_modules")
                backup.rename(target)
                raise
            completed.append((target, backup))
            receipt["packages"][target.name] = hashes
        receipt_path = receipt_root / "receipt.json"
        receipt_path.write_text(json.dumps(receipt, indent=2, sort_keys=True) + "\n")
        print(f"Consumed {len(packages)} packages at {expected_version}; receipt: {receipt_path}")
        print("Local development only: reinstalling App dependencies restores the lockfile versions.")
    except BaseException:
        for target, backup in reversed(completed):
            dependencies = target / "node_modules"
            if dependencies.exists() or dependencies.is_symlink():
                dependencies.rename(backup / "node_modules")
            failed = receipt_root / "failed" / target.name
            failed.parent.mkdir(parents=True, exist_ok=True)
            target.rename(failed)
            backup.rename(target)
        raise


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sdk-root", type=Path, required=True)
    parser.add_argument("--expected-version", required=True)
    args = parser.parse_args()
    main(args.sdk_root.resolve(), args.expected_version)
