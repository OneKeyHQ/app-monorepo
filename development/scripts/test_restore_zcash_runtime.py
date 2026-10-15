import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch


spec = importlib.util.spec_from_file_location("restore_zcash", Path(__file__).with_name("restore-zcash-runtime.py"))
restore_zcash = importlib.util.module_from_spec(spec)
spec.loader.exec_module(restore_zcash)


class RestoreZcashRuntimeTests(unittest.TestCase):
    def prepare(self, root, dirty=False):
        source = root / "artifact"
        for directory, module in restore_zcash.REQUIRED.items():
            target = source / directory
            target.mkdir(parents=True, exist_ok=True)
            for name in ("package.json", f"{module}.js", f"{module}.d.ts", f"{module}_bg.wasm"):
                (target / name).write_text("synthetic artifact")
        manifest = source / "zcash-wasm-manifest.json"
        manifest.write_text(json.dumps({
            "formatVersion": 1, "sourceRepository": "OneKeyHQ/app-modules",
            "sourceRevision": "revision", "sourceDirty": dirty,
            "files": restore_zcash.inventory(source),
        }))
        return source, restore_zcash.sha256(manifest)

    def test_clean_pinned_artifact_restores_complete_portal_layout(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source, digest = self.prepare(root)
            target = root / "consumer"
            restore_zcash.restore(source, target, digest, "revision")
            self.assertEqual(restore_zcash.inventory(source), restore_zcash.inventory(target))
            with self.assertRaisesRegex(ValueError, "Refusing to replace"):
                restore_zcash.restore(source, target, digest, "revision")

    def test_dirty_source_wrong_revision_and_tampering_are_rejected_before_writes(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source, digest = self.prepare(root, dirty=True)
            target = root / "consumer"
            with self.assertRaisesRegex(ValueError, "clean source revision"):
                restore_zcash.restore(source, target, digest, "revision")
            manifest = source / "zcash-wasm-manifest.json"
            value = json.loads(manifest.read_text())
            value["sourceDirty"] = False
            manifest.write_text(json.dumps(value))
            digest = restore_zcash.sha256(manifest)
            with self.assertRaisesRegex(ValueError, "clean source revision"):
                restore_zcash.restore(source, target, digest, "different-revision")
            (source / "pkg-keys/onekey_zcash_keys_bg.wasm").write_text("tampered")
            with self.assertRaisesRegex(ValueError, "checksum mismatch"):
                restore_zcash.restore(source, target, digest, "revision")
            self.assertFalse(target.exists())

    def test_existing_manifest_and_symlink_are_never_overwritten(self):
        for symlink in (False, True):
            with self.subTest(symlink=symlink), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                source, digest = self.prepare(root)
                target = root / "consumer"
                target.mkdir()
                marker = root / "existing-marker"
                marker.write_text("preserve")
                manifest = target / "zcash-wasm-manifest.json"
                if symlink:
                    manifest.symlink_to(marker)
                else:
                    manifest.write_text("preserve")
                with self.assertRaisesRegex(ValueError, "Refusing to replace"):
                    restore_zcash.restore(source, target, digest, "revision")
                self.assertEqual(marker.read_text(), "preserve")
                self.assertEqual(manifest.read_text(), "preserve")
                self.assertFalse((target / "pkg").exists())

    def test_manifest_commit_failure_rolls_back_both_packages(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source, digest = self.prepare(root)
            target = root / "consumer"
            original_rename = Path.rename

            def fail_manifest(path, destination):
                if path.name == "zcash-wasm-manifest.json":
                    raise OSError("synthetic manifest failure")
                return original_rename(path, destination)

            with patch.object(Path, "rename", fail_manifest):
                with self.assertRaisesRegex(OSError, "synthetic manifest failure"):
                    restore_zcash.restore(source, target, digest, "revision")
            self.assertEqual(list(target.iterdir()), [])


if __name__ == "__main__":
    unittest.main()
