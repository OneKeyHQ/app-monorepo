#!/usr/bin/env python3
"""Run focused integration checks against an intact Intercom 19.9.1 fixture.

Usage: python3 apps/mobile/scripts/__tests__/patch-intercom-ios.test.py \
    --framework /path/to/pristine/Intercom.xcframework
The official framework remains outside Git and is never modified by these tests.
"""
import argparse
import hashlib
import json
from pathlib import Path
import plistlib
import shutil
import subprocess
import tempfile
import unittest


SCRIPT = Path(__file__).resolve().parents[1] / 'patch-intercom-ios.py'
MANIFEST = json.loads(SCRIPT.with_suffix('.json').read_text())
FIXTURE = None


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


class IntercomRecordingPatchTests(unittest.TestCase):
    def setUp(self):
        scratch = SCRIPT.parents[3] / 'node_modules' / '.cache' / 'intercom-patch-tests'
        scratch.mkdir(parents=True, exist_ok=True)
        self.temporary = tempfile.TemporaryDirectory(dir=scratch)
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name) / 'Intercom.xcframework'
        shutil.copytree(FIXTURE, self.root, symlinks=True)
        self.binaries = {
            name: self.root / name / 'Intercom.framework' / 'Intercom'
            for name in MANIFEST['binaries']
        }
        for name, binary in self.binaries.items():
            self.assertEqual(digest(binary), MANIFEST['binaries'][name]['inputSha256'])

    def run_patch(self):
        return subprocess.run(
            ['python3', '-B', str(SCRIPT), str(self.root)],
            capture_output=True,
            text=True,
            check=False,
        )

    def snapshot(self):
        return {name: binary.read_bytes() for name, binary in self.binaries.items()}

    def assert_unmodified_failure(self, expected):
        before = self.snapshot()
        result = self.run_patch()
        self.assertNotEqual(result.returncode, 0, result.stdout)
        self.assertIn(expected, result.stderr)
        self.assertEqual(self.snapshot(), before)

    def test_all_architectures_and_idempotence(self):
        result = self.run_patch()
        self.assertEqual(result.returncode, 0, result.stderr)
        for name, binary in self.binaries.items():
            self.assertEqual(digest(binary), MANIFEST['binaries'][name]['outputSha256'])
        before = self.snapshot()
        result = self.run_patch()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.snapshot(), before)
        self.assertEqual(result.stdout.count('verified '), 2)
        self.assertFalse((self.root / '_CodeSignature').exists())
        for binary in self.binaries.values():
            imports = subprocess.run(
                ['xcrun', 'dyld_info', '-imports', str(binary)],
                capture_output=True, text=True, check=True,
            ).stdout
            for symbol in MANIFEST['imports']:
                self.assertNotIn(symbol, imports)
            self.assertIn('_OBJC_CLASS_$_AVPlayer', imports)

    def test_unknown_second_hash_changes_neither_binary(self):
        binary = self.binaries['ios-arm64_x86_64-simulator']
        data = bytearray(binary.read_bytes())
        data[-1] ^= 1
        binary.write_bytes(data)
        self.assert_unmodified_failure('Unsupported Intercom binary SHA-256')

    def test_unknown_version_changes_neither_binary(self):
        path = self.root / 'ios-arm64_x86_64-simulator' / 'Intercom.framework' / 'Info.plist'
        info = plistlib.loads(path.read_bytes())
        info['CFBundleVersion'] = '19.9.2'
        path.write_bytes(plistlib.dumps(info))
        self.assert_unmodified_failure('Expected Intercom 19.9.1')

    def test_extra_library_is_rejected_before_mutation(self):
        path = self.root / 'Info.plist'
        info = plistlib.loads(path.read_bytes())
        info['AvailableLibraries'].append({'LibraryIdentifier': 'unknown'})
        path.write_bytes(plistlib.dumps(info))
        self.assert_unmodified_failure('Unsupported Intercom XCFramework libraries')

    def test_incomplete_architecture_is_rejected_before_mutation(self):
        path = self.root / 'Info.plist'
        info = plistlib.loads(path.read_bytes())
        info['AvailableLibraries'][1]['SupportedArchitectures'] = ['arm64']
        path.write_bytes(plistlib.dumps(info))
        self.assert_unmodified_failure('Unsupported Intercom XCFramework architectures')

    def test_loader_path_metadata_is_rejected_before_mutation(self):
        path = self.root / 'Info.plist'
        original = path.read_bytes()
        for key in ['LibraryPath', 'BinaryPath']:
            with self.subTest(key=key):
                info = plistlib.loads(original)
                info['AvailableLibraries'][1][key] = 'Other.framework/Intercom'
                path.write_bytes(plistlib.dumps(info))
                self.assert_unmodified_failure('Unsupported Intercom XCFramework library paths')

    def test_linked_signature_is_rejected_before_mutation(self):
        path = self.root / '_CodeSignature'
        if path.exists():
            shutil.rmtree(path)
        path.symlink_to(self.root / 'ios-arm64' / 'Intercom.framework')
        self.assert_unmodified_failure('Refusing to remove a linked Intercom signature')

    def test_non_directory_signature_is_rejected_before_mutation(self):
        path = self.root / '_CodeSignature'
        if path.exists():
            shutil.rmtree(path)
        path.write_text('invalid signature directory')
        self.assert_unmodified_failure('Intercom signature must be a real directory')

    def test_linked_library_is_rejected_before_mutation(self):
        path = self.root / 'ios-arm64_x86_64-simulator'
        destination = self.root.parent / 'linked-library-target'
        path.rename(destination)
        path.symlink_to(destination)
        self.assert_unmodified_failure('Refusing to modify a linked Intercom framework')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--framework', required=True, type=Path)
    options, remaining = parser.parse_known_args()
    FIXTURE = options.framework
    unittest.main(argv=[__file__] + remaining)
