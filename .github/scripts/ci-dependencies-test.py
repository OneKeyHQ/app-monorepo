"""Regressions for dependency cache invalidation and safe fallback."""

import importlib.util
import contextlib
import io
import json
import shutil
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time
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
        snapshot.state = {'key': 'prefix-expected', 'prefix': 'prefix-',
                          'compatibility': 'compatible', 'runtime': {}}
        (snapshot.cache / 'dependencies.squashfs').write_bytes(b'corrupt')
        (snapshot.cache / 'manifest.json').write_text(json.dumps({
            'version': 2, 'key': 'prefix-expected', 'source_ref': 'refs/heads/x',
            'compatibility': 'compatible', 'runtime': {}, 'patches': {},
            'roots': ['node_modules'], 'bytes': 7, 'sha256': 'wrong',
        }))
        with patch.dict(os.environ, {'DEPENDENCY_SNAPSHOT_KEY': 'prefix-expected'}), \
                patch.object(dependencies.subprocess, 'run', wraps=subprocess.run) as run:
            with self.assertRaisesRegex(ValueError, 'checksum'):
                snapshot.mount()
            self.assertFalse(any(call.args[0][0] == 'sudo' for call in run.call_args_list))

    def test_mount_failure_falls_back_to_immutable_install(self):
        snapshot = dependencies.Snapshot()
        with patch.dict(os.environ, {'DEPENDENCY_SNAPSHOT_KEY': 'restored-key'}), \
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
        with patch.dict(os.environ, {'DEPENDENCY_SNAPSHOT_KEY': 'restored-key'}), \
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
        with patch.object(dependencies, 'mounted', return_value=True), \
                patch.object(dependencies.subprocess, 'run', side_effect=subprocess.CalledProcessError(1, 'umount')):
            with self.assertRaises(subprocess.CalledProcessError):
                snapshot.cleanup(remove=True)
        self.assertTrue(marker.exists())

    def test_compatible_key_allows_dependencies_but_rejects_scripts_and_workspace_changes(self):
        runtime = {'node': 'v24.21.0'}
        package = self.root / 'package.json'
        package.write_text(json.dumps({'name': 'fixture', 'dependencies': {'foo': '1.0.0'},
                                       'scripts': {'postinstall': 'node setup.js'}}))
        key = dependencies.fingerprint(self.root, runtime, compatible=True)
        exact = dependencies.fingerprint(self.root, runtime)
        package.write_text(json.dumps({'name': 'fixture', 'dependencies': {'foo': '2.0.0'},
                                       'scripts': {'postinstall': 'node setup.js'}}))
        (self.root / 'yarn.lock').write_text('updated lock')
        (self.root / 'patches/example.patch').write_text('updated patch')
        self.assertEqual(key, dependencies.fingerprint(self.root, runtime, compatible=True))
        self.assertNotEqual(exact, dependencies.fingerprint(self.root, runtime))
        package.write_text(json.dumps({'name': 'fixture', 'scripts': {'postinstall': 'node other.js'}}))
        self.assertNotEqual(key, dependencies.fingerprint(self.root, runtime, compatible=True))
        self.assertNotEqual(key, dependencies.fingerprint(self.root, {'node': 'v24.22.0'}, compatible=True))
        package.write_text(json.dumps({'name': 'fixture', 'scripts': {'postinstall': 'node setup.js'}}))
        (self.root / 'apps/web/package.json').write_text('{"name":"changed-workspace"}')
        self.assertNotEqual(key, dependencies.fingerprint(self.root, runtime, compatible=True))

    def test_patch_delta_cleans_added_changed_deleted_and_sequenced_packages_only(self):
        (self.root / 'patches/example.patch').unlink()
        before = {}
        for name in ['removed+1.0.0.patch', 'changed+1.0.0.patch', 'unchanged+1.0.0.patch',
                     'react-native+0.86.2+001+first.patch', 'react-native+0.86.2+006+last.patch',
                     '@scope+pkg+1.0.0+001+label.patch']:
            p = self.root / 'patches' / name
            p.write_text('old')
            before[name] = dependencies.checksum(p)
            target = self.root / 'node_modules' / dependencies.patch_target(name)
            target.mkdir(parents=True, exist_ok=True)
            (target / 'index.js').write_text('old installed content')
        (self.root / 'patches/removed+1.0.0.patch').unlink()
        for name in ['changed+1.0.0.patch', 'react-native+0.86.2+001+first.patch',
                     'react-native+0.86.2+006+last.patch', '@scope+pkg+1.0.0+001+label.patch',
                     'added+1.0.0.patch']:
            (self.root / 'patches' / name).write_text('new')
        (self.root / 'node_modules/added').mkdir()
        (self.root / 'node_modules/unrelated').mkdir()
        snapshot = dependencies.Snapshot()
        with contextlib.redirect_stdout(io.StringIO()):
            snapshot.reset_changed_patches(before)
        self.assertEqual(snapshot.state['reset_packages'], ['@scope/pkg', 'added', 'changed', 'react-native', 'removed'])
        self.assertEqual(sorted(p.name for p in (self.root / 'node_modules').iterdir()), ['@scope', 'unchanged', 'unrelated'])
        self.assertTrue((self.root / 'node_modules/unchanged/index.js').exists())

    def test_unsafe_patch_metadata_and_symlink_packages_are_rejected(self):
        for name in ['../foo+1.0.0.patch', '@scope+..+1.0.0.patch', 'foo++bar+1.0.0.patch',
                     'foo+../version.patch', 'foo+1.0.0.patch/escape']:
            with self.assertRaises(ValueError):
                dependencies.patch_target(name)
        with self.assertRaises(ValueError):
            dependencies.validate_patches({'foo+1.0.0.patch': '../invalid'})
        (self.root / 'patches/example.patch').unlink()
        outside = self.root / 'workspace'
        outside.mkdir()
        (outside / 'keep').write_text('keep')
        (self.root / 'node_modules').mkdir()
        (self.root / 'node_modules/foo').symlink_to(outside, target_is_directory=True)
        with self.assertRaises(ValueError):
            dependencies.Snapshot().reset_changed_patches({'foo+1.0.0.patch': '0' * 64})
        self.assertTrue((outside / 'keep').exists())

    def test_legacy_fallback_uses_committed_x_inputs_and_survives_cache_code_changes(self):
        runtime = {'node': 'v24.21.0', 'arch': 'x86_64'}
        (self.root / 'patches/example.patch').rename(self.root / 'patches/removed+1.0.0.patch')
        for name in ['.github/scripts/ci-dependencies.py', '.github/actions/install-dependencies/action.yml']:
            target = self.root / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text('old cache implementation')
        subprocess.run(['git', 'add', '-A'], cwd=self.root, check=True)
        subprocess.run(['git', '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid',
                        'commit', '-qm', 'x inputs'], cwd=self.root, check=True)
        ref = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=self.root, text=True).strip()
        expected = 'ci-deps-squashfs-v1-' + dependencies.fingerprint(self.root, runtime)
        compatibility = dependencies.fingerprint(self.root, runtime, compatible=True)
        removed_hash = dependencies.checksum(self.root / 'patches/removed+1.0.0.patch')
        (self.root / 'patches/removed+1.0.0.patch').unlink()
        (self.root / 'patches/added+2.0.0.patch').write_text('new patch')
        (self.root / 'package.json').write_text('{"dependencies":{"added":"2.0.0"}}')
        (self.root / 'yarn.lock').write_text('changed lock')
        (self.root / '.github/scripts/ci-dependencies.py').write_text('new snapshot reader')
        (self.root / '.github/actions/install-dependencies/action.yml').write_text('new restore steps')
        subprocess.run(['git', 'add', '-A'], cwd=self.root, check=True)
        self.assertEqual(compatibility, dependencies.fingerprint(self.root, runtime, compatible=True))
        legacy = dependencies.legacy_snapshot(self.root, runtime, compatibility, ref)
        self.assertEqual(legacy['key'], expected)
        self.assertEqual(legacy['patches'], {'removed+1.0.0.patch': removed_hash})
        self.assertEqual(legacy['source_commit'], ref)
        (self.root / 'package.json').write_text('{"scripts":{"postinstall":"changed.js"}}')
        changed = dependencies.fingerprint(self.root, runtime, compatible=True)
        with self.assertRaisesRegex(ValueError, 'incompatible'):
            dependencies.legacy_snapshot(self.root, runtime, changed, ref)

    def test_legacy_manifest_rejects_unbound_key_and_corruption_before_mount(self):
        snapshot = dependencies.Snapshot()
        snapshot.cache.mkdir(parents=True)
        snapshot.state = {'key': 'v2-key', 'legacy': {'key': 'v1-x-key', 'patches': {}}}
        (snapshot.cache / 'dependencies.squashfs').write_bytes(b'corrupt')
        manifest = {'key': 'v1-x-key', 'roots': ['node_modules'], 'bytes': 7, 'sha256': 'wrong'}
        (snapshot.cache / 'manifest.json').write_text(json.dumps(manifest))
        with patch.object(dependencies.subprocess, 'run', wraps=subprocess.run) as run:
            with patch.dict(os.environ, {'DEPENDENCY_SNAPSHOT_KEY': 'arbitrary-v1-key'}):
                with self.assertRaisesRegex(ValueError, 'compatibility'):
                    snapshot.mount()
            with patch.dict(os.environ, {'DEPENDENCY_SNAPSHOT_KEY': 'v1-x-key'}):
                with self.assertRaisesRegex(ValueError, 'checksum'):
                    snapshot.mount()
            self.assertFalse(any(call.args[0][0] == 'sudo' for call in run.call_args_list))

    def test_clean_retry_removes_new_workspace_roots(self):
        snapshot = dependencies.Snapshot()
        for name in ['node_modules', 'apps/web/node_modules']:
            (self.root / name).mkdir()
            (self.root / name / 'partial').write_text('partial installation')
        (self.root / '.yarn').mkdir()
        (self.root / '.yarn/install-state.gz').write_bytes(b'partial state')
        snapshot.state = {'mounts': [], 'owned_roots': ['node_modules']}
        with patch.object(dependencies, 'mounted', return_value=False):
            snapshot.cleanup(remove=True)
        self.assertFalse((self.root / 'node_modules').exists())
        self.assertFalse((self.root / 'apps/web/node_modules').exists())
        self.assertFalse((self.root / '.yarn/install-state.gz').exists())

    def test_only_x_refresh_can_build_snapshots(self):
        for ref, workflow in [('refs/pull/1/merge', 'Cache Refresh'), ('refs/heads/x', 'Unit Tests')]:
            with patch.dict(os.environ, {'GITHUB_REF': ref, 'GITHUB_WORKFLOW': workflow}):
                with self.assertRaisesRegex(RuntimeError, 'Only Cache Refresh'):
                    dependencies.Snapshot().build()


@unittest.skipUnless(os.environ.get('CI_DEPENDENCY_INTEGRATION') == 'true',
                     'Requires a disposable Linux runner with mount permissions')
class SnapshotIntegrationTests(unittest.TestCase):
    def test_real_overlay_incremental_patches_and_copy_free_republication(self):
        repository = Path(__file__).resolve().parents[2]
        with tempfile.TemporaryDirectory(prefix='dependency-integration-') as temporary:
            directory = Path(temporary)
            root = directory / 'checkout'
            root.mkdir()
            tools = directory / 'tools'
            tools.mkdir()
            # The same real Yarn afterInstall hook and patch-package CLI as the repo.
            shutil.copy2(repository / '.yarn/plugins/@yarnpkg/plugin-after-install.cjs', tools / 'after-install.cjs')
            package = {'name': 'snapshot-fixture', 'private': True, 'packageManager': 'yarn@4.12.0',
                       'dependencies': {'isarray': '2.0.5', 'is-number': '7.0.0', 'is-odd': '3.0.1'},
                       'scripts': {'postinstall': f'node {repository}/node_modules/patch-package/index.js --error-on-fail'}}
            (root / 'package.json').write_text(json.dumps(package))
            (root / '.yarnrc.yml').write_text(
                f'yarnPath: {repository}/.yarn/releases/yarn-4.12.0.cjs\n'
                f'nodeLinker: node-modules\nafterInstall: yarn postinstall\nplugins:\n  - path: {tools}/after-install.cjs\n')
            (root / 'patches').mkdir()
            subprocess.run(['git', 'init', '-q', str(root)], check=True)
            subprocess.run(['yarn', 'install'], cwd=root, check=True,
                           env={**os.environ, 'YARN_ENABLE_IMMUTABLE_INSTALLS': 'false'})
            originals = {name: (root / 'node_modules' / name / 'index.js').read_bytes()
                         for name in package['dependencies']}

            def make_patch(name, marker):
                work = directory / ('patch-' + marker)
                target = work / 'node_modules' / name / 'index.js'
                target.parent.mkdir(parents=True)
                source = originals[name]
                target.write_bytes(source)
                subprocess.run(['git', 'init', '-q', str(work)], check=True)
                subprocess.run(['git', 'add', '.'], cwd=work, check=True)
                # Replace a code line so repeated postinstall applications are idempotent.
                anchor = next(line for line in source.splitlines(True) if b'module.exports =' in line)
                target.write_bytes(source.replace(anchor, anchor.rstrip(b'\n') + f' // {marker}\n'.encode(), 1))
                data = subprocess.check_output(['git', 'diff', '--', 'node_modules'], cwd=work)
                (root / 'patches' / f'{name}+{package["dependencies"][name]}.patch').write_bytes(data)

            make_patch('isarray', 'OLD_REMOVED')
            make_patch('is-number', 'OLD_CHANGED')
            subprocess.run(['yarn', 'install', '--immutable'], cwd=root, check=True)
            subprocess.run(['git', 'add', 'package.json', '.yarnrc.yml', 'yarn.lock', 'patches'], cwd=root, check=True)
            subprocess.run(['git', '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid',
                            'commit', '-qm', 'fixture'], cwd=root, check=True)
            (root / 'node_modules/.cache').mkdir(exist_ok=True)
            (root / 'node_modules/.cache/keep-in-checkout').write_text('job-specific')
            environment = {'GITHUB_WORKSPACE': str(root), 'GITHUB_REF': 'refs/heads/x',
                           'GITHUB_WORKFLOW': 'Cache Refresh', 'DEPENDENCY_SNAPSHOT_KEY': '',
                           'GITHUB_OUTPUT': str(directory / 'output'),
                           'GITHUB_STEP_SUMMARY': str(directory / 'summary')}
            snapshots = []
            with patch.dict(os.environ, environment):
                try:
                    def prepare(name):
                        runner = directory / name
                        runner.mkdir()
                        os.environ['RUNNER_TEMP'] = str(runner)
                        snapshot = dependencies.Snapshot()
                        snapshot.prepare()
                        snapshots.append(snapshot)
                        return snapshot

                    seed = prepare('seed')
                    started = time.monotonic()
                    seed.build()
                    self.assertTrue((seed.cache / 'manifest.json').exists())
                    self.assertEqual(seed.state['mounts'], [])
                    self.assertEqual(list((seed.temp / 'stage/node_modules').iterdir()), [])
                    self.assertTrue((root / 'node_modules/.cache/keep-in-checkout').exists())
                    print(f'Integration seed build: {time.monotonic() - started:.2f}s', flush=True)
                    shutil.rmtree(root / 'node_modules')
                    (root / '.yarn/install-state.gz').unlink()
                    (root / 'patches/isarray+2.0.5.patch').unlink()
                    make_patch('is-number', 'NEW_CHANGED')
                    make_patch('is-odd', 'NEW_ADDED')
                    # Emulate a checkout of the target commit, including deleted tracked patches.
                    subprocess.run(['git', 'add', '-A', 'patches'], cwd=root, check=True)
                    updated = prepare('updated')
                    self.assertEqual(seed.state['compatibility'], updated.state['compatibility'])
                    self.assertNotEqual(seed.state['key'], updated.state['key'])
                    shutil.copytree(seed.cache, updated.cache, dirs_exist_ok=True)
                    os.environ['DEPENDENCY_SNAPSHOT_KEY'] = seed.state['key']
                    updated.install()
                    self.assertEqual(updated.state['snapshot_kind'], 'incremental')
                    self.assertEqual(updated.state['reset_packages'], ['is-number', 'is-odd', 'isarray'])
                    self.assertEqual((root / 'node_modules/isarray/index.js').read_bytes(), originals['isarray'])
                    for name, marker in [('is-number', b'NEW_CHANGED'), ('is-odd', b'NEW_ADDED')]:
                        data = (root / 'node_modules' / name / 'index.js').read_bytes()
                        self.assertEqual(data.count(marker), 1)
                        self.assertNotIn(b'OLD_CHANGED', data)
                    self.assertFalse((root / 'node_modules/.cache/keep-in-checkout').exists())
                    started = time.monotonic()
                    updated.build()
                    self.assertEqual(len(updated.state['mounts']), 2)
                    self.assertEqual(list((updated.temp / 'stage/node_modules').iterdir()), [])
                    print(f'Integration OverlayFS republish: {time.monotonic() - started:.2f}s', flush=True)
                    updated.cleanup(remove=True)
                    exact = prepare('exact')
                    shutil.copytree(updated.cache, exact.cache, dirs_exist_ok=True)
                    os.environ['DEPENDENCY_SNAPSHOT_KEY'] = updated.state['key']
                    exact.install()
                    self.assertEqual(exact.state['snapshot_kind'], 'exact')
                    self.assertEqual((root / 'node_modules/isarray/index.js').read_bytes(), originals['isarray'])
                    self.assertEqual((root / 'node_modules/is-number/index.js').read_bytes().count(b'NEW_CHANGED'), 1)
                    exact.cleanup(remove=True)
                    legacy = prepare('legacy')
                    legacy.state['legacy'] = dependencies.legacy_snapshot(
                        root, legacy.state['runtime'], legacy.state['compatibility'], 'HEAD')
                    shutil.copytree(seed.cache, legacy.cache, dirs_exist_ok=True)
                    # v1 used the same image layout, but its manifest had no runtime/patch metadata.
                    manifest = json.loads((legacy.cache / 'manifest.json').read_text())
                    manifest = {name: manifest[name] for name in ['roots', 'bytes', 'sha256']}
                    manifest['key'] = legacy.state['legacy']['key']
                    (legacy.cache / 'manifest.json').write_text(json.dumps(manifest))
                    os.environ['DEPENDENCY_SNAPSHOT_KEY'] = manifest['key']
                    legacy.install()
                    self.assertEqual(legacy.state['snapshot_kind'], 'incremental')
                    self.assertEqual(legacy.state['reset_packages'], ['is-number', 'is-odd', 'isarray'])
                    self.assertEqual((root / 'node_modules/isarray/index.js').read_bytes(), originals['isarray'])
                    self.assertEqual((root / 'node_modules/is-number/index.js').read_bytes().count(b'NEW_CHANGED'), 1)
                    self.assertEqual((root / 'node_modules/is-odd/index.js').read_bytes().count(b'NEW_ADDED'), 1)
                    legacy.cleanup(remove=True)
                    self.assertTrue(all(not snapshot.state['mounts'] for snapshot in snapshots))
                finally:
                    # Unmount before TemporaryDirectory can remove any fixture paths.
                    for snapshot in reversed(snapshots):
                        snapshot.cleanup()
                        # OverlayFS creates root-owned work subdirectories even after unmount.
                        for work in snapshot.temp.glob('work-*'):
                            subprocess.run(['sudo', 'chown', '-R', f'{os.getuid()}:{os.getgid()}',
                                            str(work)], check=True)


if __name__ == '__main__':
    unittest.main()
