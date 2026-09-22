#!/usr/bin/env python3
"""Cache installed dependencies as a SquashFS image on disposable Linux runners."""

import argparse
import hashlib
import json
import os
from pathlib import Path
import platform
import re
import shutil
import subprocess
import time


def output(name, value):
    with open(os.environ['GITHUB_OUTPUT'], 'a') as stream:
        stream.write(f'{name}={value}\n')


def checksum(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def fingerprint(root, runtime, compatible=False):
    # Include every manifest, Yarn patch/plugin and the snapshot implementation.
    # Source-dependent postinstall outputs are regenerated on every checkout.
    patterns = [
        'package.json', ':(glob)**/package.json', 'yarn.lock', '.yarnrc.yml',
        '.yarn/releases', '.yarn/plugins', '.yarn/patches', 'patches',
        'development/scripts/postinstall.js', 'development/scripts/copy-injected.js',
        'development/scripts/web-embed.js', '.env.example',
        '.github/scripts/ci-dependencies.py', '.github/actions/install-dependencies',
    ]
    names = subprocess.check_output(
        ['git', 'ls-files', '-z', '--', *patterns], cwd=root,
    ).decode().split('\0')
    digest = hashlib.sha256(json.dumps(runtime, sort_keys=True).encode())
    for name in sorted(set(filter(None, names))):
        if compatible and (name == 'yarn.lock' or name.startswith('patches/')):
            continue
        data = (root / name).read_bytes()
        if compatible and Path(name).name == 'package.json':
            manifest = json.loads(data)
            for field in ['dependencies', 'devDependencies', 'optionalDependencies',
                          'peerDependencies', 'resolutions']:
                manifest.pop(field, None)
            data = json.dumps(manifest, sort_keys=True).encode()
        digest.update(name.encode() + b'\0')
        digest.update(data)
        digest.update(b'\0')
    return digest.hexdigest()


def patch_target(name):
    # Sequence numbers and labels follow the version, including RN's six patches.
    if not isinstance(name, str) or not name.endswith('.patch') or '/' in name or '++' in name:
        raise ValueError('Unsupported patch filename')
    parts = name[:-6].split('+')
    count = 2 if parts[0].startswith('@') else 1
    if len(parts) <= count or not re.fullmatch(r'\d+\.\d+\.\d+[^/\\+]*', parts[count]):
        raise ValueError('Invalid patch version')
    for index, part in enumerate(parts[:count]):
        component = part[1:] if index == 0 and count == 2 else part
        if not re.fullmatch(r'[A-Za-z0-9_-][A-Za-z0-9._-]*', component):
            raise ValueError('Invalid patch package')
    return '/'.join(parts[:count])


def patch_state(root):
    result = {}
    for path in sorted((root / 'patches').glob('*.patch')):
        patch_target(path.name)
        result[path.name] = checksum(path)
    return result


def validate_patches(patches):
    if not isinstance(patches, dict):
        raise ValueError('Invalid snapshot patches')
    for name, digest in patches.items():
        patch_target(name)
        if not isinstance(digest, str) or not re.fullmatch(r'[0-9a-f]{64}', digest):
            raise ValueError('Invalid patch checksum')


def dependency_roots(root):
    result = []
    for directory, children, _ in os.walk(root, followlinks=False):
        children[:] = [name for name in children if name not in {'.git', '.yarn'}]
        if 'node_modules' in children:
            result.append((Path(directory) / 'node_modules').relative_to(root).as_posix())
            children.remove('node_modules')
    return sorted(result)


def validate_roots(root, roots):
    manifests = subprocess.check_output(
        ['git', 'ls-files', '-z', '--', 'package.json', ':(glob)**/package.json'], cwd=root,
    ).decode().split('\0')
    allowed = {(Path(name).parent / 'node_modules').as_posix() for name in manifests if name}
    if not isinstance(roots, list) or not roots or any(not isinstance(name, str) for name in roots):
        raise ValueError('Invalid snapshot dependency roots')
    if roots != sorted(set(roots)):
        raise ValueError('Invalid snapshot dependency roots')
    if 'node_modules' not in roots or any(name not in allowed for name in roots):
        raise ValueError('Snapshot paths do not match checkout manifests')
    # Never follow a checkout symlink when creating or removing a mount point.
    for name in roots:
        target = root / name
        if target.is_symlink() or target.parent.resolve() != target.parent:
            raise ValueError(f'Snapshot path contains a symlink: {name}')


def mounted(path):
    # Unlike os.path.ismount, mountpoint also detects same-filesystem bind mounts.
    return subprocess.run(['mountpoint', '-q', '--', str(path)]).returncode == 0


class Snapshot:
    def __init__(self):
        self.root = Path(os.environ['GITHUB_WORKSPACE']).resolve()
        self.temp = Path(os.environ['RUNNER_TEMP']) / 'onekey-ci-dependencies'
        self.cache = self.temp / 'cache'
        self.state_path = self.temp / 'state.json'
        self.state = json.loads(self.state_path.read_text()) if self.state_path.exists() else {}

    def save_state(self):
        self.state_path.write_text(json.dumps(self.state, indent=2) + '\n')

    def prepare(self):
        if platform.system() != 'Linux' or os.environ.get('GITHUB_ACTIONS') != 'true':
            raise RuntimeError('Dependency snapshots require a disposable Linux Actions runner')
        if self.state:
            raise RuntimeError('Dependency setup may only run once per job')
        self.cache.mkdir(parents=True)
        runtime = {
            'node': subprocess.check_output(['node', '--version'], text=True).strip(),
            'arch': platform.machine(),
            'os': Path('/etc/os-release').read_text(),
            'libc': list(platform.libc_ver()),
            'global_cache': os.environ.get('YARN_ENABLE_GLOBAL_CACHE'),
        }
        compatibility = fingerprint(self.root, runtime, compatible=True)
        prefix = f'ci-deps-squashfs-v2-{compatibility}-'
        self.state = {'key': prefix + fingerprint(self.root, runtime), 'runtime': runtime,
                      'compatibility': compatibility, 'prefix': prefix,
                      'mounts': [], 'owned_roots': []}
        self.save_state()
        output('key', self.state['key'])
        output('prefix', self.state['prefix'])
        output('path', str(self.cache))
        print(f'Dependency snapshot key: {self.state["key"]}')
        cpu_models = sorted({line.split(':', 1)[1].strip()
                             for line in Path('/proc/cpuinfo').read_text().splitlines()
                             if line.startswith('model name')})
        print('Dependency runner: ' + json.dumps({
            'node': runtime['node'], 'arch': runtime['arch'],
            'cpus': os.cpu_count(), 'cpu_models': cpu_models,
        }))

    def mount(self):
        manifest = json.loads((self.cache / 'manifest.json').read_text())
        if not isinstance(manifest, dict):
            raise ValueError('Invalid snapshot manifest')
        matched_key = os.environ.get('DEPENDENCY_SNAPSHOT_KEY')
        if (not isinstance(matched_key, str) or manifest.get('version') != 2 or manifest.get('source_ref') != 'refs/heads/x'
                or manifest.get('key') != matched_key
                or not matched_key.startswith(self.state['prefix'])
                or manifest.get('compatibility') != self.state['compatibility']
                or manifest.get('runtime') != self.state['runtime']):
            raise ValueError('Snapshot compatibility mismatch')
        validate_patches(manifest.get('patches'))
        roots = manifest['roots']
        validate_roots(self.root, roots)
        image = self.cache / 'dependencies.squashfs'
        if image.stat().st_size != manifest['bytes'] or checksum(image) != manifest['sha256']:
            raise ValueError('Snapshot checksum mismatch')
        if any((self.root / name).exists() for name in roots):
            raise ValueError('Snapshot mount requires an uninstalled checkout')
        lower = self.temp / 'lower'
        lower.mkdir()
        self.state['mounts'].append(str(lower))
        self.save_state()
        subprocess.run(['sudo', 'mount', '-t', 'squashfs', '-o', 'loop,ro',
                        str(image), str(lower)], check=True)
        for index, name in enumerate(roots):
            upper, work, target = self.temp / f'upper-{index}', self.temp / f'work-{index}', self.root / name
            for directory in [upper, work, target]:
                directory.mkdir(parents=True)
            self.state['owned_roots'].append(name)
            self.state['mounts'].append(str(target))
            self.save_state()
            subprocess.run(['sudo', 'mount', '-t', 'overlay', 'overlay', '-o',
                            f'lowerdir={lower / name},upperdir={upper},workdir={work}', str(target)], check=True)
        shutil.copy2(lower / '.yarn/install-state.gz', self.root / '.yarn/install-state.gz')
        self.state['snapshot_kind'] = 'exact' if matched_key == self.state['key'] else 'incremental'
        if self.state['snapshot_kind'] == 'incremental':
            self.reset_changed_patches(manifest['patches'])
        self.save_state()

    def reset_changed_patches(self, before):
        validate_patches(before)
        after = patch_state(self.root)
        changed = {patch_target(name) for name in before.keys() | after.keys()
                   if before.get(name) != after.get(name)}
        base = self.root / 'node_modules'
        for package in sorted(changed):
            target = base / package
            if target.is_symlink() or not target.resolve().is_relative_to(base):
                raise ValueError('Patched dependency resolves outside node_modules')
            if target.exists():
                shutil.rmtree(target)
            print(f'Reinstall changed patched package: {package}', flush=True)
        self.state['reset_packages'] = sorted(changed)

    def cleanup(self, remove=False):
        for target in reversed(self.state.get('mounts', [])):
            if mounted(target):
                subprocess.run(['sudo', 'umount', target], check=True)
        self.state['mounts'] = []
        if remove:
            roots = self.state['owned_roots']
            if roots:
                # Yarn may create additional workspace roots while updating the snapshot.
                roots = sorted(set(roots) | set(dependency_roots(self.root)))
                validate_roots(self.root, roots)
                for name in roots:
                    shutil.rmtree(self.root / name)
                (self.root / '.yarn/install-state.gz').unlink(missing_ok=True)
            self.state['owned_roots'] = []
        if self.state_path.exists():
            self.save_state()

    def install(self):
        start = time.monotonic()
        restored = False
        if os.environ.get('DEPENDENCY_SNAPSHOT_KEY'):
            try:
                self.mount()
                restored = True
            except (OSError, ValueError, KeyError, subprocess.CalledProcessError) as error:
                print(f'::warning::Dependency snapshot unavailable; installing normally: {error}', flush=True)
                self.cleanup(remove=True)
        restore_seconds = time.monotonic() - start
        install_start = time.monotonic()
        # Always preserve hardened-mode validation and this checkout's postinstall.
        status = subprocess.call(['yarn', 'install', '--immutable'], cwd=self.root)
        if status and restored:
            print('::warning::Snapshot installation failed; retrying from a clean dependency tree.', flush=True)
            self.cleanup(remove=True)
            restored = False
            status = subprocess.call(['yarn', 'install', '--immutable'], cwd=self.root)
        if status:
            self.cleanup()
            raise subprocess.CalledProcessError(status, ['yarn', 'install', '--immutable'])
        install_seconds = time.monotonic() - install_start
        kind = self.state.get('snapshot_kind', 'exact') if restored else 'none'
        output('snapshot-hit', str(restored).lower())
        output('snapshot-kind', kind)
        with open(os.environ['GITHUB_STEP_SUMMARY'], 'a') as summary:
            summary.write('### Dependencies\n\n'
                          f'- Snapshot: {kind}\n'
                          f'- Reset patched packages: {len(self.state.get("reset_packages", []))}\n'
                          f'- Verify/mount: {restore_seconds:.1f}s (cache transfer is a separate step)\n'
                          f'- Immutable install and postinstall: {install_seconds:.1f}s\n')

    def build(self):
        if (os.environ.get('GITHUB_REF') != 'refs/heads/x'
                or os.environ.get('GITHUB_WORKFLOW') != 'Cache Refresh'):
            raise RuntimeError('Only Cache Refresh on x may build dependency snapshots')
        build_mounts = []
        try:
            if shutil.which('mksquashfs') is None:
                subprocess.run(['sudo', 'apt-get', 'update', '-qq'], check=True)
                subprocess.run(['sudo', 'apt-get', 'install', '-y', 'squashfs-tools'], check=True)
            roots = dependency_roots(self.root)
            validate_roots(self.root, roots)
            stage = self.temp / 'stage'
            stage.mkdir()
            for name in roots:
                target = stage / name
                target.mkdir(parents=True)
                # Assemble the image without copying or hardlinking the dependency tree.
                build_mounts.append(str(target))
                self.state['mounts'].append(str(target))
                self.save_state()
                subprocess.run(['sudo', 'mount', '--bind', str(self.root / name), str(target)], check=True)
                subprocess.run(['sudo', 'mount', '-o', 'remount,bind,ro', str(target)], check=True)
            (stage / '.yarn').mkdir()
            shutil.copy2(self.root / '.yarn/install-state.gz', stage / '.yarn/install-state.gz')
            # Never overwrite the backing file of a currently mounted loop device.
            image = self.temp / 'dependencies-next.squashfs'
            subprocess.run(['mksquashfs', str(stage), str(image), '-noappend', '-comp', 'zstd',
                            '-Xcompression-level', '3', '-processors', '4', '-no-progress',
                            '-e', *[f'{name}/.cache' for name in roots]], check=True)
            manifest = {'version': 2, 'key': self.state['key'], 'roots': roots,
                        'compatibility': self.state['compatibility'], 'runtime': self.state['runtime'],
                        'source_ref': os.environ['GITHUB_REF'],
                        'source_commit': subprocess.check_output(
                            ['git', 'rev-parse', 'HEAD'], cwd=self.root, text=True).strip(),
                        'patches': patch_state(self.root),
                        'bytes': image.stat().st_size, 'sha256': checksum(image)}
            image.replace(self.cache / 'dependencies.squashfs')
            (self.cache / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
            output('built', 'true')
        except (OSError, ValueError, subprocess.CalledProcessError) as error:
            # An unavailable cache must not fail an otherwise valid installation.
            print(f'::warning::Could not populate dependency snapshot: {error}', flush=True)
            output('built', 'false')
        finally:
            for target in reversed(build_mounts):
                if mounted(target):
                    subprocess.run(['sudo', 'umount', target], check=True)
                self.state['mounts'].remove(target)
            self.save_state()


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('command', choices=['prepare', 'install', 'build', 'cleanup'])
    args = parser.parse_args()
    getattr(Snapshot(), args.command)()
