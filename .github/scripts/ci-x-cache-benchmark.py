"""Measure x-snapshot reuse on isolated, disposable Linux CI runners."""

import gzip
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import time
import zipfile

sys.dont_write_bytecode = True
BASE = '592f67d5c5cf2b221a546f7180773d5b77303008'
TOOLS = Path(__file__).parent
spec = importlib.util.spec_from_file_location('dependencies', TOOLS / 'ci-dependencies.py')
dependencies = importlib.util.module_from_spec(spec)
spec.loader.exec_module(dependencies)


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2) + '\n')


def sha(data):
    return hashlib.sha256(data).hexdigest()


def patch_target(name):
    if not name.endswith('.patch') or '/' in name or '++' in name:
        raise ValueError(f'Unsupported fixture patch name: {name}')
    parts = name.split('+')
    count = 2 if parts[0].startswith('@') else 1
    if len(parts) <= count or not re.match(r'^\d+\.\d+\.\d+', parts[count]):
        raise ValueError(f'Invalid patch version: {name}')
    package = '/'.join(parts[:count])
    if any(part in {'', '.', '..'} for part in package.split('/')):
        raise ValueError(f'Invalid package name: {name}')
    return f'node_modules/{package}'


def patches(root):
    return {p.name: {'sha256': sha(p.read_bytes()), 'target': patch_target(p.name)}
            for p in sorted((root / 'patches').glob('*.patch'))}


def changed_patches(before, after):
    return sorted(name for name in before.keys() | after.keys()
                  if before.get(name) != after.get(name))


def run(command, cwd, log=None, env=None):
    with subprocess.Popen(command, cwd=cwd, env=env, stdout=subprocess.PIPE,
                          stderr=subprocess.STDOUT, text=True, bufsize=1) as child:
        stream = log.open('w') if log else None
        try:
            for line in child.stdout:
                print(line, end='', flush=True)
                if stream:
                    stream.write(line)
            status = child.wait()
        finally:
            if stream:
                stream.close()
        if status:
            raise subprocess.CalledProcessError(status, command)


class Benchmark:
    def __init__(self):
        self.snapshot = dependencies.Snapshot()
        self.root = self.snapshot.root
        self.runner = Path(os.environ['RUNNER_TEMP'])
        self.fixtures = self.runner / 'x-cache-fixtures'
        self.results = self.runner / 'x-cache-results'
        self.results.mkdir(exist_ok=True)
        self.metrics_path = self.results / 'metrics.json'
        self.metrics = json.loads(self.metrics_path.read_text()) if self.metrics_path.exists() else {}

    def save(self):
        write_json(self.metrics_path, self.metrics)

    def prepare(self):
        revision = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=self.root, text=True).strip()
        if revision != BASE:
            raise ValueError('The fixture checkout must be the pinned x revision')
        seed = os.environ['BENCHMARK_SEED']
        if not re.fullmatch(r'\d+', seed):
            raise ValueError('Invalid seed run ID')
        self.snapshot.prepare()
        state = self.snapshot.state
        state['base_fingerprint'] = state['key']
        state['base_commit'] = revision
        runtime = sha(json.dumps(state['runtime'], sort_keys=True).encode())[:16]
        state['key'] = f'ci-x-snapshot-bench-v1-{seed}-{BASE[:12]}-{runtime}'
        self.snapshot.save_state()
        yarn_path = subprocess.check_output(['yarn', 'config', 'get', 'cacheFolder'], cwd=self.root, text=True).strip()
        dependencies.output('key', state['key'])
        dependencies.output('yarn-key', state['key'] + '-yarn')
        dependencies.output('yarn-path', yarn_path)
        self.metrics = {'base_commit': revision, 'method': os.environ.get('BENCHMARK_METHOD', 'seed'),
                        'scenario': os.environ.get('BENCHMARK_SCENARIO', 'seed'),
                        'runtime': state['runtime'], 'key': state['key'],
                        'cpu_models': sorted({line.split(':', 1)[1].strip()
                                              for line in Path('/proc/cpuinfo').read_text().splitlines()
                                              if line.startswith('model name')})}
        self.save()

    def seed(self):
        self.snapshot.install()
        self.snapshot.build()
        manifest_path = self.snapshot.cache / 'manifest.json'
        manifest = json.loads(manifest_path.read_text())
        manifest.update({'base_commit': BASE, 'runtime': self.snapshot.state['runtime'],
                         'patches': patches(self.root)})
        write_json(manifest_path, manifest)

    def generate_patch(self, package, filename, destination, marker):
        installed = self.root / 'node_modules' / package
        version = json.loads((installed / 'package.json').read_text())['version']
        yarn_path = Path(subprocess.check_output(['yarn', 'config', 'get', 'cacheFolder'], cwd=self.root, text=True).strip())
        archives = list(yarn_path.glob(f'{package}-npm-{version}-*.zip'))
        if len(archives) != 1:
            raise ValueError(f'Expected one pristine archive for {package}, found {archives}')
        relative = Path('node_modules') / package / filename
        with zipfile.ZipFile(archives[0]) as archive:
            pristine = archive.read(relative.as_posix())
        target = (installed / filename).read_bytes() + f'\n// {marker}\n'.encode()
        work = self.runner / f'generate-{package}'
        path = work / relative
        path.parent.mkdir(parents=True)
        path.write_bytes(pristine)
        subprocess.run(['git', 'init', '-q', str(work)], check=True)
        subprocess.run(['git', 'add', '-f', relative.as_posix()], cwd=work, check=True)
        path.write_bytes(target)
        data = subprocess.check_output(['git', 'diff', '--', relative.as_posix()], cwd=work)
        if not data:
            raise ValueError('Generated fixture patch is empty')
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(data)

    def fixtures_create(self):
        self.fixtures.mkdir(exist_ok=True)
        base_package = (self.root / 'package.json').read_bytes()
        base_lock = (self.root / 'yarn.lock').read_bytes()
        metadata = {'base_commit': BASE, 'base_package_sha': sha(base_package),
                    'base_lock_sha': sha(base_lock), 'base_patches': patches(self.root)}
        patch_dir = self.fixtures / 'patches' / 'patches'
        self.generate_patch('reflect-metadata', 'Reflect.js',
                            patch_dir / 'reflect-metadata+0.2.2.patch', 'ONEKEY_X_CACHE_MODIFIED_PATCH')
        self.generate_patch('isarray', 'index.js', patch_dir / 'isarray+2.0.5.patch',
                            'ONEKEY_X_CACHE_ADDED_PATCH')
        write_json(self.fixtures / 'patches' / 'remove.json', ['patches/bignumber.js+9.1.2.patch'])
        package = json.loads(base_package)
        if package['devDependencies']['semver'] != '7.5.4':
            raise ValueError('Unexpected base semver version')
        package['devDependencies']['semver'] = '7.7.3'
        package['devDependencies']['ci-cache-benchmark-extra'] = 'npm:is-number@7.0.0'
        (self.root / 'package.json').write_text(json.dumps(package, indent=2) + '\n')
        # This command creates a target lockfile fixture, not a validation install.
        run(['yarn', 'install', '--mode=update-lockfile'], self.root,
            env={**os.environ, 'YARN_ENABLE_IMMUTABLE_INSTALLS': 'false'})
        for name in ['package.json', 'yarn.lock']:
            target = self.fixtures / 'deps' / name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(self.root / name, target)
        (self.root / 'package.json').write_bytes(base_package)
        (self.root / 'yarn.lock').write_bytes(base_lock)
        metadata['files'] = {p.relative_to(self.fixtures).as_posix(): sha(p.read_bytes())
                             for p in self.fixtures.rglob('*') if p.is_file()}
        write_json(self.fixtures / 'manifest.json', metadata)

    def fixture_apply(self):
        metadata = json.loads((self.fixtures / 'manifest.json').read_text())
        if metadata['base_commit'] != BASE or patches(self.root) != metadata['base_patches']:
            raise ValueError('Base patch fixture mismatch')
        if sha((self.root / 'package.json').read_bytes()) != metadata['base_package_sha']:
            raise ValueError('Base manifest fixture mismatch')
        if sha((self.root / 'yarn.lock').read_bytes()) != metadata['base_lock_sha']:
            raise ValueError('Base lock fixture mismatch')
        for name, expected in metadata['files'].items():
            if sha((self.fixtures / name).read_bytes()) != expected:
                raise ValueError(f'Corrupt target fixture: {name}')
        scenario = self.metrics['scenario']
        if scenario == 'deps':
            for name in ['package.json', 'yarn.lock']:
                shutil.copy2(self.fixtures / scenario / name, self.root / name)
        elif scenario == 'patches':
            for name in json.loads((self.fixtures / scenario / 'remove.json').read_text()):
                if name != 'patches/bignumber.js+9.1.2.patch':
                    raise ValueError('Unexpected fixture removal')
                (self.root / name).unlink()
            for path in (self.fixtures / scenario / 'patches').glob('*.patch'):
                shutil.copy2(path, self.root / 'patches' / path.name)
        elif scenario != 'same':
            raise ValueError('Unknown scenario')
        self.metrics['target'] = {'package_sha': sha((self.root / 'package.json').read_bytes()),
                                  'lock_sha': sha((self.root / 'yarn.lock').read_bytes()),
                                  'patches': patches(self.root)}
        self.save()

    def begin(self):
        self.metrics['dependency_start'] = time.time()
        self.save()

    def install(self):
        started = time.monotonic()
        method = self.metrics['method']
        removed = []
        if method not in {'yarn-only', 'x-reset-all', 'x-delta'}:
            raise ValueError('Unknown method')
        if method != 'yarn-only':
            manifest = json.loads((self.snapshot.cache / 'manifest.json').read_text())
            if manifest['base_commit'] != BASE or manifest['runtime'] != self.snapshot.state['runtime']:
                raise ValueError('Incompatible x image runtime or revision')
            expected = json.loads((self.fixtures / 'manifest.json').read_text())['base_patches']
            if manifest['patches'] != expected:
                raise ValueError('Image patch metadata mismatch')
            # The original mount still validates image key, checksum and workspace paths.
            self.snapshot.mount()
            self.metrics['mount_seconds'] = time.monotonic() - started
            before, after = manifest['patches'], patches(self.root)
            names = sorted(before.keys() | after.keys()) if method == 'x-reset-all' else changed_patches(before, after)
            cleanup_started = time.monotonic()
            if names:
                work = self.runner / 'patch-cleanup'
                (work / 'patches').mkdir(parents=True)
                (work / 'node_modules').symlink_to(self.root / 'node_modules', target_is_directory=True)
                for name in names:
                    details = after.get(name) or before[name]
                    if patch_target(name) != details['target']:
                        raise ValueError('Unsafe patch target')
                    (work / 'patches' / name).write_text('Fixture target name only; source patches remain in the checkout.\n')
                    removed.append(details['target'])
                run(['node', str(TOOLS / 'patch-fix.js')], work)
                for name in removed:
                    if (self.root / name).exists():
                        raise ValueError(f'Patch cleanup did not remove {name}')
            self.metrics['patch_cleanup_seconds'] = time.monotonic() - cleanup_started
        self.metrics['removed_packages'] = sorted(set(removed))
        install_started = time.monotonic()
        try:
            run(['yarn', 'install', '--immutable'], self.root, self.results / 'install.log')
        finally:
            self.metrics['yarn_seconds'] = time.monotonic() - install_started
            self.metrics['dependency_seconds'] = time.time() - self.metrics['dependency_start']
            self.metrics['setup_without_transfer_seconds'] = time.monotonic() - started
            self.save()
        self.metrics['install_success'] = True
        if method != 'yarn-only':
            uppers = sorted(self.snapshot.temp.glob('upper-*'))
            self.metrics['overlay_disk_bytes'] = sum(int(subprocess.check_output(['du', '-s', '-B1', str(p)]).split()[0]) for p in uppers)
        self.save()

    def inventory(self):
        started = time.monotonic()
        tree = {}
        roots = dependencies.dependency_roots(self.root)
        dependencies.validate_roots(self.root, roots)
        for name in roots:
            base = self.root / name
            for directory, directories, files in os.walk(base, followlinks=False):
                directories[:] = [d for d in directories if d != '.cache']
                for entry in sorted(directories + files):
                    path = Path(directory) / entry
                    relative = path.relative_to(self.root).as_posix()
                    if path.is_symlink():
                        target = os.readlink(path).replace(str(self.root), '$WORKSPACE')
                        tree[relative] = {'symlink': target}
                    elif path.is_file() and path.name != '.yarn-state.yml':
                        tree[relative] = {'sha256': dependencies.checksum(path),
                                          'executable': bool(path.stat().st_mode & 0o111)}
        with gzip.open(self.results / 'tree.json.gz', 'wt') as stream:
            json.dump(tree, stream, sort_keys=True)
        if self.metrics['scenario'] == 'deps':
            for name, version in [('semver', '7.7.3'), ('ci-cache-benchmark-extra', '7.0.0')]:
                if json.loads((self.root / 'node_modules' / name / 'package.json').read_text())['version'] != version:
                    raise ValueError(f'Wrong installed version: {name}')
        if self.metrics['scenario'] == 'patches':
            checks = [('bignumber.js/bignumber.d.ts', b'type BigNumberBase =', 0),
                      ('reflect-metadata/Reflect.js', b'ONEKEY_X_CACHE_MODIFIED_PATCH', 1),
                      ('isarray/index.js', b'ONEKEY_X_CACHE_ADDED_PATCH', 1)]
            for name, marker, count in checks:
                if (self.root / 'node_modules' / name).read_bytes().count(marker) != count:
                    raise ValueError(f'Patch state mismatch: {name}')
        self.metrics['tree_entries'] = len(tree)
        self.metrics['inventory_seconds'] = time.monotonic() - started
        self.metrics['correctness_assertions_passed'] = True
        self.save()
        print('Benchmark result: ' + json.dumps(self.metrics))

    def cleanup(self):
        self.snapshot.cleanup()


def compare():
    root = Path(os.environ['BENCHMARK_RESULTS'])
    summary = []
    failure = False
    for scenario in ['same', 'deps', 'patches']:
        before_dir = root / f'x-cache-{scenario}-yarn-only'
        before_metrics = json.loads((before_dir / 'metrics.json').read_text())
        with gzip.open(before_dir / 'tree.json.gz', 'rt') as stream:
            before = json.load(stream)
        for method in ['x-reset-all', 'x-delta']:
            directory = root / f'x-cache-{scenario}-{method}'
            metrics = json.loads((directory / 'metrics.json').read_text())
            if metrics['target'] != before_metrics['target']:
                raise ValueError('Comparison target inputs differ')
            with gzip.open(directory / 'tree.json.gz', 'rt') as stream:
                after = json.load(stream)
            differences = [{'path': name, 'clean': before.get(name), 'reuse': after.get(name)}
                           for name in sorted(before.keys() | after.keys()) if before.get(name) != after.get(name)]
            row = {'scenario': scenario, 'method': method, 'clean_seconds': before_metrics['dependency_seconds'],
                   'reuse_seconds': metrics['dependency_seconds'], 'difference_count': len(differences),
                   'differences': differences}
            summary.append(row)
            failure |= bool(differences)
            print(json.dumps({k: v for k, v in row.items() if k != 'differences'}))
            if differences:
                print('First differences: ' + json.dumps(differences[:20]))
    write_json(root / 'comparison.json', summary)
    if failure:
        raise ValueError('Installed trees differ; inspect comparison.json before drawing a correctness conclusion')


if __name__ == '__main__':
    if sys.argv[1] == 'compare':
        compare()
    else:
        getattr(Benchmark(), sys.argv[1])()
