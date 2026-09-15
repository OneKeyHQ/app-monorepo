import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch


spec = importlib.util.spec_from_file_location("sync_sdk", Path(__file__).with_name("sync-local-hardware-sdk.py"))
sync_sdk = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sync_sdk)


class SyncLocalHardwareSdkTests(unittest.TestCase):
    def prepare(self, root):
        sdk, app = root / "sdk", root / "app"
        for directory in sync_sdk.PACKAGES:
            source = sdk / "packages" / directory
            name = f"@onekeyfe/hd-{directory}" if directory in ("shared", "core") else f"@onekeyfe/{directory}"
            target = app / "node_modules" / name
            for location, version in ((source, "1.0.1"), (target, "1.0.0")):
                (location / "dist").mkdir(parents=True)
                (location / "dist/index.js").write_text(version)
                (location / "dist/index.d.ts").write_text("zcashGetUnifiedAddress zcashSignPczt")
                (location / "package.json").write_text(json.dumps({
                    "name": name, "version": version, "main": "dist/index.js", "types": "dist/index.d.ts",
                }))
            if directory == "hd-web-sdk":
                (source / "build").mkdir()
                (source / "build/iframe.html").write_text("synthetic iframe")
        return sdk, app

    def test_consumer_replaces_all_packages_and_records_checksums(self):
        with tempfile.TemporaryDirectory() as directory:
            sdk, app = self.prepare(Path(directory))
            nested = app / "node_modules/@onekeyfe/hd-core/node_modules/dependency"
            nested.mkdir(parents=True)
            (nested / "index.js").write_text("existing nested dependency")
            with patch.object(sync_sdk, "APP", app), patch.object(sync_sdk.subprocess, "check_output", side_effect=["revision", "dirty"]):
                sync_sdk.main(sdk, "1.0.1")
            receipts = list((app / "node_modules/.cache").glob("*/receipt.json"))
            receipt = json.loads(receipts[0].read_text())
            self.assertEqual(len(receipt["packages"]), len(sync_sdk.PACKAGES))
            self.assertTrue(receipt["sourceDirty"])
            self.assertEqual((app / "node_modules/@onekeyfe/hd-core/dist/index.js").read_text(), "1.0.1")
            self.assertEqual((nested / "index.js").read_text(), "existing nested dependency")

    def test_partial_failure_restores_previous_packages_and_nested_dependencies(self):
        with tempfile.TemporaryDirectory() as directory:
            sdk, app = self.prepare(Path(directory))
            nested = app / "node_modules/@onekeyfe/hd-shared/node_modules/dependency"
            nested.mkdir(parents=True)
            (nested / "index.js").write_text("existing dependency")
            original_copy = sync_sdk.shutil.copy2

            def fail_core_manifest(source, target, **kwargs):
                if Path(source) == sdk / "packages/core/package.json":
                    raise OSError("synthetic copy failure")
                return original_copy(source, target, **kwargs)

            with patch.object(sync_sdk, "APP", app), patch.object(sync_sdk.subprocess, "check_output", side_effect=["revision", "dirty"]), patch.object(sync_sdk.shutil, "copy2", side_effect=fail_core_manifest):
                with self.assertRaisesRegex(OSError, "synthetic copy failure"):
                    sync_sdk.main(sdk, "1.0.1")
            self.assertEqual((app / "node_modules/@onekeyfe/hd-shared/dist/index.js").read_text(), "1.0.0")
            self.assertEqual((nested / "index.js").read_text(), "existing dependency")

    def test_dependency_change_fails_before_any_installed_package_is_replaced(self):
        with tempfile.TemporaryDirectory() as directory:
            sdk, app = self.prepare(Path(directory))
            manifest = sdk / "packages/hd-web-sdk/package.json"
            value = json.loads(manifest.read_text())
            value["dependencies"] = {"new-package": "1.0.0"}
            manifest.write_text(json.dumps(value))
            with patch.object(sync_sdk, "APP", app), patch.object(sync_sdk.subprocess, "check_output", side_effect=["revision", "dirty"]):
                with self.assertRaisesRegex(ValueError, "Dependency review required"):
                    sync_sdk.main(sdk, "1.0.1")
            self.assertEqual((app / "node_modules/@onekeyfe/hd-core/dist/index.js").read_text(), "1.0.0")


if __name__ == "__main__":
    unittest.main()
