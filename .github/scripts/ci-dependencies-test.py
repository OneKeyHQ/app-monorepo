"""Regressions for dependency cache invalidation and safe fallback."""

import importlib.util
import contextlib
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.dont_write_bytecode = True

spec = importlib.util.spec_from_file_location('ci_dependencies', Path(__file__).with_name('ci-dependencies.py'))
dependencies = importlib.util.module_from_spec(spec)
spec.loader.exec_module(dependencies)


class SnapshotTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve() / 'checkout'
        self.root.mkdir()
        self.runner = self.root.parent / 'runner'
        self.runner.mkdir()
        for name in ['package.json', 'apps/web/package.json', 'yarn.lock', 'patches/example.patch', 'source.ts']:
            target = self.root / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text('{}')
        subprocess.run(['git', 'init', '-q', str(self.root)], check=True)
        subprocess.run(['git', 'add', '.'], cwd=self.root, check=True)
        environment = patch.dict(os.environ, {
            'GITHUB_WORKSPACE': str(self.root), 'RUNNER_TEMP': str(self.runner),
            'GITHUB_OUTPUT': str(self.runner / 'output'),
            'GITHUB_STEP_SUMMARY': str(self.runner / 'summary'),
        })
        environment.start()
        self.addCleanup(environment.stop)

    def test_key_changes_for_dependencies_and_runtime_but_not_source(self):
        runtime = {'node': 'v24.21.0', 'arch': 'x86_64'}
        key = dependencies.fingerprint(self.root, runtime)
        (self.root / 'source.ts').write_text('changed source')
        self.assertEqual(key, dependencies.fingerprint(self.root, runtime))
        for name in ['package.json', 'apps/web/package.json', 'yarn.lock', 'patches/example.patch']:
            target = self.root / name
            target.write_text('changed dependency input')
            self.assertNotEqual(key, dependencies.fingerprint(self.root, runtime))
            target.write_text('{}')
        self.assertNotEqual(key, dependencies.fingerprint(self.root, {**runtime, 'node': 'v24.22.0'}))
        self.assertNotEqual(key, dependencies.fingerprint(self.root, {**runtime, 'arch': 'aarch64'}))

    def test_roots_reject_traversal_duplicates_and_symlink_parents(self):
        dependencies.validate_roots(self.root, ['apps/web/node_modules', 'node_modules'])
        for roots in [['../node_modules'], ['node_modules', 'node_modules'], [None], ['unknown/node_modules']]:
            with self.assertRaises(ValueError):
                dependencies.validate_roots(self.root, roots)
        (self.root / 'apps/web').rename(self.root / 'apps/actual')
        (self.root / 'apps/web').symlink_to(self.root / 'apps/actual', target_is_directory=True)
        with self.assertRaises(ValueError):
            dependencies.validate_roots(self.root, ['apps/web/node_modules', 'node_modules'])

    def test_corrupted_snapshot_is_rejected_before_mount(self):
        snapshot = dependencies.Snapshot()
        snapshot.cache.mkdir(parents=True)
        snapshot.state = {'key': 'expected'}
        (snapshot.cache / 'dependencies.squashfs').write_bytes(b'corrupt')
        (snapshot.cache / 'manifest.json').write_text(json.dumps({
            'key': 'expected', 'roots': ['node_modules'], 'bytes': 7, 'sha256': 'wrong',
        }))
        with patch.object(dependencies.subprocess, 'run', wraps=subprocess.run) as run:
            with self.assertRaisesRegex(ValueError, 'checksum'):
                snapshot.mount()
            self.assertFalse(any(call.args[0][0] == 'sudo' for call in run.call_args_list))

    def test_mount_failure_falls_back_to_immutable_install(self):
        snapshot = dependencies.Snapshot()
        with patch.dict(os.environ, {'DEPENDENCY_SNAPSHOT_HIT': 'true'}), \
                patch.object(snapshot, 'mount', side_effect=ValueError('invalid snapshot')), \
                patch.object(snapshot, 'cleanup') as cleanup, \
                patch.object(dependencies.subprocess, 'call', return_value=0) as install, \
                contextlib.redirect_stdout(io.StringIO()):
            snapshot.install()
        cleanup.assert_called_once_with(remove=True)
        install.assert_called_once_with(['yarn', 'install', '--immutable'], cwd=self.root)
        self.assertIn('snapshot-hit=false', (self.runner / 'output').read_text())

    def test_failed_snapshot_install_retries_clean_and_preserves_failure(self):
        snapshot = dependencies.Snapshot()
        with patch.dict(os.environ, {'DEPENDENCY_SNAPSHOT_HIT': 'true'}), \
                patch.object(snapshot, 'mount'), patch.object(snapshot, 'cleanup') as cleanup, \
                patch.object(dependencies.subprocess, 'call', side_effect=[1, 1]) as install, \
                contextlib.redirect_stdout(io.StringIO()):
            with self.assertRaises(subprocess.CalledProcessError):
                snapshot.install()
        self.assertEqual(install.call_count, 2)
        self.assertEqual(cleanup.call_args_list[0].kwargs, {'remove': True})

    def test_unmount_failure_does_not_delete_a_mounted_dependency_tree(self):
        snapshot = dependencies.Snapshot()
        target = self.root / 'node_modules'
        target.mkdir()
        marker = target / 'keep'
        marker.write_text('dependency')
        snapshot.state = {'mounts': [str(target)], 'owned_roots': ['node_modules']}
        with patch.object(dependencies.os.path, 'ismount', return_value=True), \
                patch.object(dependencies.subprocess, 'run', side_effect=subprocess.CalledProcessError(1, 'umount')):
            with self.assertRaises(subprocess.CalledProcessError):
                snapshot.cleanup(remove=True)
        self.assertTrue(marker.exists())


if __name__ == '__main__':
    unittest.main()
