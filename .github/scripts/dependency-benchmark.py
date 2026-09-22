#!/usr/bin/env python3
"""Branch-only experiment: package cache vs tar vs mounted dependencies."""

import argparse
import hashlib
import json
import os
from pathlib import Path
import platform
import shutil
import subprocess
import time

ROOT = Path(os.environ.get('GITHUB_WORKSPACE', Path.cwd())).resolve()
TEMP = Path(os.environ.get('RUNNER_TEMP', '/tmp')) / 'onekey-dependency-benchmark'
RESULTS = ROOT / 'ci-dependency-results'
RESULTS.mkdir(exist_ok=True)
TEMP.mkdir(parents=True, exist_ok=True)
METRICS = RESULTS / 'metrics.json'


def record(name, seconds, **fields):
    rows = json.loads(METRICS.read_text()) if METRICS.exists() else []
    rows.append({'name': name, 'seconds': round(seconds, 3), **fields})
    METRICS.write_text(json.dumps(rows, indent=2) + '\n')


def run(name, command, cwd=ROOT, extra_env=None):
    env = dict(os.environ, **(extra_env or {}))
    start = time.monotonic()
    with (RESULTS / f'{name}.log').open('w') as log:
        process = subprocess.Popen(
            ['/usr/bin/time', '-v', '-o', str(RESULTS / f'{name}-resources.txt'), *command],
            cwd=cwd, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            text=True, errors='replace',
        )
        for line in process.stdout:
            print(line, end='', flush=True)
            log.write(line)
        status = process.wait()
    record(name, time.monotonic() - start, exit_code=status)
    if status:
        raise subprocess.CalledProcessError(status, command)


def node_version():
    return subprocess.check_output(['node', '--version'], text=True).strip()


def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def metadata():
    (RESULTS / 'runner.json').write_text(json.dumps({
        'sha': os.environ.get('GITHUB_SHA'),
        'node': node_version(),
        'kernel': platform.release(),
        'cpus': os.cpu_count(),
        'cpuinfo': Path('/proc/cpuinfo').read_text(),
        'sample': os.environ.get('BENCHMARK_SAMPLE', '1'),
        'mode': os.environ.get('BENCHMARK_MODE', 'producer'),
        'workload': os.environ.get('BENCHMARK_WORKLOAD'),
        'memory': Path('/proc/meminfo').read_text(),
    }, indent=2) + '\n')


def dependency_roots():
    roots = []
    for directory, children, _ in os.walk(ROOT, followlinks=False):
        children[:] = [p for p in children if p not in {'.git', '.yarn', 'ci-dependency-results'}]
        if 'node_modules' in children:
            roots.append(str((Path(directory) / 'node_modules').relative_to(ROOT)))
            children.remove('node_modules')
    return sorted(roots)


def install():
    run('install', ['yarn', 'install', '--immutable'])


def build():
    roots = dependency_roots()
    stage = TEMP / 'stage'
    stage.mkdir()
    start = time.monotonic()
    for relative in roots:
        target = stage / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        # Hard links avoid a second full copy during image creation.
        subprocess.run(['cp', '-al', str(ROOT / relative), str(target)], check=True)
        cache = target / '.cache'
        if cache.exists():
            shutil.rmtree(cache)
    (stage / '.yarn').mkdir()
    shutil.copy2(ROOT / '.yarn/install-state.gz', stage / '.yarn/install-state.gz')
    record('stage', time.monotonic() - start, roots=roots)
    run('pack-tar', ['tar', '--zstd', '-cf', str(TEMP / 'deps.tar.zst'), '-C', str(stage), '.'])
    run('pack-squashfs', [
        'mksquashfs', str(stage), str(TEMP / 'deps.squashfs'), '-noappend',
        '-comp', 'zstd', '-Xcompression-level', '3', '-processors', '4', '-no-progress',
    ])
    manifest = {
        'sha': os.environ['GITHUB_SHA'], 'node': node_version(), 'roots': roots,
        'files': {name: {'bytes': (TEMP / name).stat().st_size, 'sha256': digest(TEMP / name)}
                  for name in ['deps.tar.zst', 'deps.squashfs']},
    }
    (TEMP / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    shutil.copy2(TEMP / 'manifest.json', RESULTS / 'manifest.json')
    print(json.dumps(manifest, indent=2))


def restore(mode):
    if mode == 'packages':
        return
    manifest = json.loads((TEMP / 'manifest.json').read_text())
    if manifest['sha'] != os.environ['GITHUB_SHA'] or manifest['node'] != node_version():
        raise RuntimeError('Snapshot source or Node version mismatch')
    name = 'deps.tar.zst' if mode == 'tar' else 'deps.squashfs'
    start = time.monotonic()
    if digest(TEMP / name) != manifest['files'][name]['sha256']:
        raise RuntimeError('Snapshot checksum mismatch')
    record('verify-snapshot', time.monotonic() - start)
    if any((ROOT / p).exists() for p in manifest['roots']):
        raise RuntimeError('Expected a fresh checkout without installed dependencies')
    if mode == 'tar':
        run('restore-tar', ['tar', '--zstd', '-xf', str(TEMP / name), '-C', str(ROOT)])
        return
    lower = TEMP / 'lower'
    lower.mkdir()
    mounts = []
    mounts_file = TEMP / 'mounts.json'
    start = time.monotonic()
    subprocess.run(['sudo', 'mount', '-t', 'squashfs', '-o', 'loop,ro', str(TEMP / name), str(lower)], check=True)
    mounts.append(str(lower))
    mounts_file.write_text(json.dumps(mounts))
    for index, relative in enumerate(manifest['roots']):
        upper = TEMP / f'upper-{index}'
        work = TEMP / f'work-{index}'
        target = ROOT / relative
        for directory in [upper, work, target]:
            directory.mkdir(parents=True, exist_ok=True)
        # Bind at the original paths so relative workspace links resolve to this checkout.
        subprocess.run([
            'sudo', 'mount', '-t', 'overlay', 'overlay', '-o',
            f'lowerdir={lower / relative},upperdir={upper},workdir={work}', str(target),
        ], check=True)
        mounts.append(str(target))
        mounts_file.write_text(json.dumps(mounts))
    shutil.copy2(lower / '.yarn/install-state.gz', ROOT / '.yarn/install-state.gz')
    record('mount-squashfs', time.monotonic() - start, roots=manifest['roots'])
    print(subprocess.check_output(['findmnt', '-t', 'squashfs,overlay'], text=True))


def workload(kind):
    # Build/transform caches are cold in all three groups.
    yarn_cache = Path(subprocess.check_output(['yarn', 'config', 'get', 'cacheFolder'], text=True).strip())
    (yarn_cache / '.app-mono-ts-cache').unlink(missing_ok=True)
    for relative in dependency_roots():
        cache = ROOT / relative / '.cache'
        if cache.exists():
            shutil.rmtree(cache)
    if kind == 'unit':
        run('unit', [
            'yarn', 'jest', '--maxWorkers=3', '--shard=4/5', '--coverage',
            f'--cacheDirectory={TEMP / "jest"}', f'--coverageDirectory={RESULTS / "coverage"}',
            '--coverageReporters=text', '--coverageReporters=lcov',
            '--coverageReporters=json-summary', '--coverageReporters=json',
            '--coverageThreshold={}', '--json', f'--outputFile={RESULTS / "test-results.json"}',
        ], extra_env={'NODE_OPTIONS': '--max_old_space_size=8192'})
    elif kind == 'lint':
        run('native-storage-check', ['yarn', 'check:third-party-native-storage'])
        run('lint', ['yarn', 'lint'])
        run('developer-tests', ['node', '--test',
            'development/scripts/command-batches.node-test.js',
            'development/lint/background-api-contract.node-test.js',
            'development/lint/test-integrity.node-test.js',
            'development/lint/onekeyfe-patches.node-test.js',
            'apps/cli/esbuild.config.node-test.js',
            'apps/mobile/scripts/check-third-party-async-storage.node-test.js',
            'apps/mobile/scripts/native-storage-metro-policy.node-test.js',
        ])
        run('cli-build', ['yarn', 'workspace', '@onekeyfe/cli', 'build'])
    else:
        env = {'NODE_OPTIONS': '--max_old_space_size=8192',
               'ENABLE_NATIVE_BACKGROUND_THREAD': 'true', 'UNION_BUILD': 'true'}
        run('native-build', ['node', 'scripts/unionBuild.js', '--platform', 'ios',
            '--common-bundle-output', '/tmp/common.jsbundle',
            '--common-sourcemap-output', '/tmp/common.jsbundle.map',
            '--main-bundle-output', '/tmp/main.jsbundle',
            '--main-sourcemap-output', '/tmp/main.jsbundle.map',
            '--background-bundle-output', '/tmp/background.bundle.js',
            '--background-sourcemap-output', '/tmp/background.bundle.map',
            '--assets-dest', '/tmp/assets',
        ], cwd=ROOT / 'apps/mobile', extra_env=env)
        for entry, modules, size in [('main', '3000', '13.8'), ('background', '2600', '19.5')]:
            run(f'budget-{entry}', ['node', 'apps/mobile/scripts/check-startup-graph-budget.js'],
                extra_env={**env, 'ENTRY': entry, 'STARTUP_MODULE_BUDGET': modules,
                           'STARTUP_SIZE_BUDGET_MB': size})
        run('architecture', ['node', 'apps/mobile/scripts/check-bundle-architecture.js'])


def cleanup():
    for upper in sorted(TEMP.glob('upper-*')):
        print(subprocess.check_output(['du', '-sh', str(upper)], text=True).strip())
    mounts_file = TEMP / 'mounts.json'
    if mounts_file.exists():
        for mount in reversed(json.loads(mounts_file.read_text())):
            subprocess.run(['sudo', 'umount', mount], check=True)
        mounts_file.unlink()


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('action', choices=['metadata', 'install', 'build', 'restore', 'workload', 'cleanup'])
    parser.add_argument('--mode', choices=['packages', 'tar', 'squashfs'], default='packages')
    parser.add_argument('--workload', choices=['unit', 'lint', 'native'], default='unit')
    args = parser.parse_args()
    if args.action == 'restore':
        restore(args.mode)
    elif args.action == 'workload':
        workload(args.workload)
    else:
        globals()[args.action]()
