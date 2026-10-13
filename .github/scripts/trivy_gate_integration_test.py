"""Real pinned-scanner regressions. Raw reports stay in private temporary files."""

import argparse
import copy
import importlib.util
import io
import json
import os
from pathlib import Path
import random
import shutil
import subprocess
import sys
import tarfile
import tempfile
import unittest

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('gate', Path(__file__).with_name('trivy_gate.py'))
gate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gate)

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--trivy', default='trivy')
parser.add_argument('--cache-dir')
options = parser.parse_args()


def npm(name, version, metadata=False):
    identity = json.dumps(name + '@npm:' + version)
    result = identity + ':\n  version: ' + version + '\n  resolution: ' + identity + '\n'
    if metadata:
        result += '  dependenciesMeta:\n    "shadow@1.0.0":\n      unplugged: true\n'
    return result


class RealScannerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory(prefix='trivy-real-test-')
        cls.root = Path(cls.tmp.name)
        cls.binary = Path(shutil.which(options.trivy) or options.trivy).resolve()
        cls.config = cls.root / 'config'
        cls.config.mkdir()
        for name in ('trivy.yaml', 'secret.yaml'):
            (cls.config / name).write_text('{}\n')
        (cls.config / 'ignore').write_text('')
        cls.cache = Path(options.cache_dir).resolve() if options.cache_dir else cls.root / 'cache'
        cls.env = {'PATH': os.environ['PATH'], 'HOME': str(cls.root), 'LANG': 'C.UTF-8',
                   'GIT_AUTHOR_NAME': 'fixture', 'GIT_AUTHOR_EMAIL': 'fixture@example.invalid',
                   'GIT_COMMITTER_NAME': 'fixture', 'GIT_COMMITTER_EMAIL': 'fixture@example.invalid'}
        for name in ('HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'NO_PROXY', 'SSL_CERT_FILE', 'SSL_CERT_DIR'):
            if name in os.environ:
                cls.env[name] = os.environ[name]
        version = gate.execute([str(cls.binary), '--version'], env=cls.env)[0].decode()
        assert version.splitlines()[0] == 'Version: ' + gate.VERSION
        empty = cls.root / 'empty'
        empty.mkdir()
        gate.scan(cls.binary, empty, cls.root / 'warmup.json', cls.cache, cls.config, cls.env, frozen=False)

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def tree(self, name, lodash=False, dev=False, metadata=False, separator='\n'):
        root = self.root / name
        root.mkdir()
        header = '__metadata:\n  version: 8\n  cacheKey: 10c0\n'
        package = {'name': 'fixture', 'version': '1.0.0', 'dependencies': {'is-number': '7.0.0'}}
        if lodash:
            package.setdefault('devDependencies' if dev else 'dependencies', {})['lodash'] = '4.17.20'
        (root / 'package.json').write_text(json.dumps(package))
        lock = header + (separator + npm('lodash', '4.17.20', metadata) + '\n' if lodash else '\n')
        (root / 'yarn.lock').write_text(lock + npm('is-number', '7.0.0'))
        desktop = root / 'apps/desktop/app'
        desktop.mkdir(parents=True)
        (desktop / 'package.json').write_text(json.dumps({'name': 'desktop-fixture', 'version': '1.0.0',
                                                        'dependencies': {'is-number': '7.0.0'}}))
        (desktop / 'yarn.lock').write_text(header + '\n' + npm('is-number', '7.0.0'))
        return root

    def scan(self, root, name, scanners=None, dev=False):
        return gate.scan(self.binary, root, self.root / (name + '.json'), self.cache,
                         self.config, self.env, scanners=scanners, include_dev_deps=dev)

    def assessed(self, root, name):
        original = self.scan(root, name + '-original')
        projected = self.root / (name + '-projected')
        gate.project_yarn(root, projected)
        inventory = self.scan(projected, name + '-inventory', 'vuln', True)
        production = self.scan(projected, name + '-production', 'vuln')
        aliases = gate.verify_yarn_coverage(root, inventory, production)
        if any(aliases.values()):
            production = gate.assess_yarn_aliases(self.binary, production, aliases,
                                                  self.root / (name + '-aliases'),
                                                  self.cache, self.config, self.env)
        report = dict(original, Results=[r for r in original['Results'] if r.get('Class') != 'lang-pkgs']
                      + [r for r in production['Results'] if r.get('Type') == 'yarn'])
        return gate.collect(report, root, b'private-regression-key'), inventory, production

    def fixture_git(self, root, *args):
        return gate.execute(['git', '-c', 'core.hooksPath=/dev/null', '-c', 'commit.gpgsign=false',
                             '-C', str(root), *args], env=self.env)[0].decode().strip()

    def revisions(self, root, change):
        self.fixture_git(root, 'init', '--quiet')
        self.fixture_git(root, 'add', '.')
        self.fixture_git(root, 'commit', '--quiet', '-m', 'fixture base')
        base = self.fixture_git(root, 'rev-parse', 'HEAD')
        change(root)
        self.fixture_git(root, 'add', '.')
        self.fixture_git(root, 'commit', '--quiet', '-m', 'fixture candidate')
        head = self.fixture_git(root, 'rev-parse', 'HEAD')
        tree = self.fixture_git(root, 'rev-parse', 'HEAD^{tree}')
        merge = self.fixture_git(root, 'commit-tree', tree, '-p', base, '-p', head, '-m', 'fixture merge')
        self.fixture_git(root, 'checkout', '--quiet', '--detach', merge)
        gate.verify_revisions(root, base, head, merge)
        return base, head, merge

    def cli(self, root, revisions, name):
        output = self.root / (name + '-evidence')
        command = [sys.executable, '-I', str(Path(__file__).with_name('trivy_gate.py')),
                   '--repo', str(root), '--output', str(output), '--trivy', str(self.binary)]
        for flag, revision in zip(('base', 'head', 'merge'), revisions):
            command += ['--' + flag, revision]
        result = subprocess.run(command, env=self.env, capture_output=True, timeout=1500, check=False)
        return result.returncode, gate.read_json(output / 'result.json')

    def test_metadata_adjacency_rejected_by_complete_cli(self):
        root = self.tree('metadata-cli')
        def change(candidate):
            package = json.loads((candidate / 'package.json').read_text())
            package['dependencies']['lodash'] = '4.17.20'
            (candidate / 'package.json').write_text(json.dumps(package))
            data = (candidate / 'yarn.lock').read_text()
            (candidate / 'yarn.lock').write_text(data.replace('\n\n', '\n' + npm('lodash', '4.17.20') + '\n', 1))
        revisions = self.revisions(root, change)
        raw = self.scan(root, 'metadata-raw', 'vuln', True)
        self.assertFalse(any(p['Name'] == 'lodash' for r in raw['Results'] for p in r.get('Packages', [])))
        code, evidence = self.cli(root, revisions, 'metadata-cli')
        self.assertEqual(code, 2)
        self.assertEqual(evidence['error'], 'unsupported_yarn_block')

    def test_local_source_rejected_by_complete_cli(self):
        root = self.tree('local-source-cli')
        def change(candidate):
            package = json.loads((candidate / 'package.json').read_text())
            package['dependencies']['lodash'] = 'file:./vendor/lodash.tgz'
            (candidate / 'package.json').write_text(json.dumps(package))
            (candidate / 'vendor').mkdir()
            (candidate / 'vendor/lodash.tgz').write_bytes(b'')
            descriptor = 'lodash@file:./vendor/lodash.tgz::locator=fixture%40workspace%3A.'
            with (candidate / 'yarn.lock').open('a') as lock:
                lock.write('\n' + json.dumps(descriptor) + ':\n  version: 4.17.20\n  resolution: '
                           + json.dumps(descriptor.replace('::', '#./vendor/lodash.tgz::hash=abcdef&')) + '\n')
        revisions = self.revisions(root, change)
        raw = self.scan(root, 'local-source-raw', 'vuln', True)
        self.assertFalse(any(p['Name'] == 'lodash' for r in raw['Results'] for p in r.get('Packages', [])))
        code, evidence = self.cli(root, revisions, 'local-source-cli')
        self.assertEqual(code, 2)
        self.assertEqual(evidence['error'], 'unsupported_yarn_source')

    def test_grouped_alias_cannot_hide_production_promotion(self):
        base = self.tree('grouped-alias-base', lodash=True, dev=True)
        candidate = self.tree('grouped-alias-candidate', lodash=True, dev=True)
        manifest = candidate / 'package.json'
        package = json.loads(manifest.read_text())
        package['dependencies']['zalias'] = 'npm:lodash@4.17.20'
        manifest.write_text(json.dumps(package))
        lock = candidate / 'yarn.lock'
        # Yarn groups descriptors resolving to one locator into a single block.
        lock.write_text(lock.read_text().replace(
            '"lodash@npm:4.17.20":', '"lodash@npm:4.17.20, zalias@npm:lodash@4.17.20":'))
        raw = self.scan(candidate, 'grouped-alias-raw', 'vuln')
        self.assertFalse(any(p['Version'] == '4.17.20' for r in raw['Results'] for p in r.get('Packages', [])))
        a, _, _ = self.assessed(base, 'grouped-alias-base')
        b, _, production = self.assessed(candidate, 'grouped-alias-candidate')
        self.assertIn(('zalias@4.17.20', 'lodash'), {(p['ID'], p['Name']) for r in production['Results']
                                                     for p in r.get('Packages', [])})
        self.assertEqual(sum(f['count'] for f in gate.compare(a, b)), 2)

    def test_transitive_alias_assessed_by_resolved_name(self):
        base = self.tree('transitive-alias-base')
        candidate = self.tree('transitive-alias-candidate')
        for root in (base, candidate):
            manifest = root / 'package.json'
            package = json.loads(manifest.read_text())
            package['dependencies']['parent'] = '1.0.0'
            manifest.write_text(json.dumps(package))
            lock = root / 'yarn.lock'
            lock.write_text(lock.read_text() + '\n' + npm('parent', '1.0.0'))
        lock = candidate / 'yarn.lock'
        lock.write_text(lock.read_text() + '  dependencies:\n    alias: "npm:lodash@4.17.20"\n\n'
                        '"alias@npm:lodash@4.17.20":\n  version: 4.17.20\n'
                        '  resolution: "lodash@npm:4.17.20"\n')
        raw = self.scan(candidate, 'transitive-alias-raw', 'vuln')
        self.assertTrue(any(p['ID'] == 'alias@4.17.20' and p['Name'] == 'alias'
                            for r in raw['Results'] for p in r.get('Packages', [])))
        self.assertFalse(any(r.get('Vulnerabilities') for r in raw['Results']))
        a, _, _ = self.assessed(base, 'transitive-alias-base')
        b, _, _ = self.assessed(candidate, 'transitive-alias-candidate')
        findings = gate.compare(a, b)
        self.assertEqual(sum(f['count'] for f in findings), 2)
        self.assertTrue(all(f['severity'] == 'HIGH' for f in findings))

    def test_same_name_aliases_to_distinct_packages_fail_closed(self):
        root = self.tree('alias-collision')
        manifest = root / 'package.json'
        package = json.loads(manifest.read_text())
        package['workspaces'] = ['packages/*']
        package['dependencies']['alias'] = 'npm:lodash@3.10.1'
        manifest.write_text(json.dumps(package))
        workspace = root / 'packages/ws'
        workspace.mkdir(parents=True)
        (workspace / 'package.json').write_text(json.dumps(
            {'name': 'ws', 'version': '1.0.0', 'devDependencies': {'alias': 'npm:zod@3.10.1'}}))
        lock = root / 'yarn.lock'
        lock.write_text(lock.read_text() + '\n'
            '"alias@npm:lodash@3.10.1":\n  version: 3.10.1\n  resolution: "lodash@npm:3.10.1"\n\n'
            '"alias@npm:zod@3.10.1":\n  version: 3.10.1\n  resolution: "zod@npm:3.10.1"\n\n'
            '"ws@workspace:packages/ws":\n  version: 0.0.0-use.local\n  resolution: "ws@workspace:packages/ws"\n'
            '  dependencies:\n    alias: "npm:zod@3.10.1"\n')
        projected = self.root / 'alias-collision-projected'
        gate.project_yarn(root, projected)
        production = self.scan(projected, 'alias-collision-production', 'vuln')
        # Trivy merges both locators into one ID; only one package is assessed.
        self.assertEqual([p['Name'] for r in production['Results'] for p in r.get('Packages', [])
                          if p['ID'] == 'alias@3.10.1'], ['lodash'])
        with self.assertRaisesRegex(gate.GateError, '^ambiguous_yarn_package$'):
            gate.yarn_packages(root)

    def test_cloudformation_inline_suppressions_rejected(self):
        template = ('AWSTemplateFormatVersion: "2010-09-09"\nResources:{}\n  Bucket:\n'
                    '    Type: AWS::S3::Bucket\n    Properties:\n      AccessControl: AuthenticatedRead\n')
        def misconfigurations(name, suffix):
            root = self.root / name
            root.mkdir()
            (root / 'main.yaml').write_text(template.format(suffix), encoding='utf-8')
            report = self.scan(root, name, 'misconfig')
            return root, sum(1 for r in report['Results'] for m in r.get('Misconfigurations', [])
                             if m.get('Status') == 'FAIL')
        _, plain = misconfigurations('cfn-plain', '')
        self.assertGreater(plain, 0)
        # Directives are assembled at runtime so this file itself never holds one.
        for name, suffix in (('cfn-tfsec', '\n  #' + 'tfsec' + ':ignore:*'),
                             ('cfn-end-of-line', ' # ' + 'trivy' + ':ignore:*'),
                             ('cfn-nbsp', ' #  ' + 'trivy' + ':ignore:*'),
                             ('cfn-ideographic-space', ' # 　' + 'trivy' + ':ignore:*')):
            root, suppressed = misconfigurations(name, suffix)
            self.assertEqual(suppressed, 0)
            self.fixture_git(root, 'init', '--quiet')
            self.fixture_git(root, 'add', '.')
            self.fixture_git(root, 'commit', '--quiet', '-m', 'fixture')
            with self.subTest(name=name), \
                 self.assertRaisesRegex(gate.GateError, '^inline_suppression$'):
                gate.export_tree(root, self.fixture_git(root, 'rev-parse', 'HEAD'),
                                 self.root / (name + '-export'))

    def test_clean_terraform_module_directory_target_is_collected(self):
        root = self.tree('terraform-module')
        for directory in (root, root / 'infra'):
            directory.mkdir(exist_ok=True)
            (directory / 'main.tf').write_text('resource "null_resource" "example" {}\n')
        report, _, _ = self.assessed(root, 'terraform-module')
        self.assertTrue({('.', 'config', 'terraform'), ('infra', 'config', 'terraform')}
                        <= set(report['targets']))
        self.assertEqual(report['findings'], [])

    def test_separated_dependency_exposes_new_high_findings(self):
        base = self.tree('control-base')
        candidate = self.tree('control-candidate', lodash=True)
        a, _, _ = self.assessed(base, 'control-base')
        b, inventory, production = self.assessed(candidate, 'control-candidate')
        findings = gate.compare(a, b)
        self.assertEqual(sum(f['count'] for f in findings if f['kind'] == 'vulnerability'), 2)
        self.assertTrue(all(f['severity'] == 'HIGH' for f in findings))
        omitted = copy.deepcopy(inventory)
        for result in omitted['Results']:
            result['Packages'] = [p for p in result.get('Packages', []) if p['Name'] != 'lodash']
        with self.assertRaisesRegex(gate.GateError, '^missing_yarn_package$'):
            gate.verify_yarn_coverage(candidate, omitted, production)

    def test_manifest_only_dev_promotion_with_nested_metadata(self):
        base = self.tree('promotion-base', lodash=True, dev=True, metadata=True)
        candidate = self.tree('promotion-candidate', lodash=True, metadata=True)
        self.assertEqual((base / 'yarn.lock').read_bytes(), (candidate / 'yarn.lock').read_bytes())
        a, _, _ = self.assessed(base, 'promotion-base')
        b, _, _ = self.assessed(candidate, 'promotion-candidate')
        self.assertEqual(sum(f['count'] for f in gate.compare(a, b)), 2)
        self.assertFalse(any(f['kind'] == 'vulnerability' for f in a['findings']))

    def test_missing_alias_cannot_be_masked_by_canonical_package(self):
        root = self.tree('alias-coverage', lodash=True)
        manifest = root / 'package.json'
        package = json.loads(manifest.read_text())
        package['dependencies']['alias'] = 'npm:lodash@4.17.20'
        manifest.write_text(json.dumps(package))
        lock = root / 'yarn.lock'
        lock.write_text(lock.read_text() + '\n' +
            '"alias@npm:lodash@4.17.20":\n  version: 4.17.20\n'
            '  resolution: "lodash@npm:4.17.20"\n'
            '  ignoredMetadata:\n    "lodash@4.17.20":\n      optional: true\n')
        projected = self.root / 'alias-projected'
        gate.project_yarn(root, projected)
        inventory = self.scan(projected, 'alias-inventory', 'vuln', True)
        production = self.scan(projected, 'alias-production', 'vuln')
        packages = [p for r in inventory['Results'] for p in r.get('Packages', [])]
        self.assertTrue(any(p['Name'] == 'lodash' and p['Version'] == '4.17.20' for p in packages))
        self.assertFalse(any(p['ID'] == 'alias@4.17.20' for p in packages))
        with self.assertRaisesRegex(gate.GateError, '^missing_yarn_package$'):
            gate.verify_yarn_coverage(root, inventory, production)

    def test_patch_wrapped_npm_cannot_disappear_silently(self):
        root = self.tree('patch-coverage')
        manifest = root / 'package.json'
        package = json.loads(manifest.read_text())
        package['dependencies']['lodash'] = 'patch:lodash@npm%3A4.17.20#./fixture.patch'
        manifest.write_text(json.dumps(package))
        (root / 'fixture.patch').write_text('')
        lock = root / 'yarn.lock'
        lock.write_text(lock.read_text() + '\n' +
            '"lodash@patch:lodash@npm%3A4.17.20#./fixture.patch":\n  version: 4.17.20\n'
            '  resolution: "lodash@patch:lodash@npm%3A4.17.20#./fixture.patch::version=4.17.20&hash=abcdef"\n')
        inventory = self.scan(root, 'patch-inventory', 'vuln', True)
        production = self.scan(root, 'patch-production', 'vuln')
        self.assertTrue(all(r.get('Packages') for r in inventory['Results']))
        self.assertFalse(any(p['Name'] == 'lodash' for r in inventory['Results'] for p in r.get('Packages', [])))
        with self.assertRaisesRegex(gate.GateError, '^missing_yarn_package$'):
            gate.verify_yarn_coverage(root, inventory, production)

    def test_original_tree_secret_is_preserved(self):
        root = self.tree('metadata-secret', lodash=True, metadata=True)
        lock = root / 'yarn.lock'
        secret = 'AKIA' + ''.join(random.Random(42).sample('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 16))
        lock.write_text(lock.read_text().replace('      unplugged: true', '      access_key: ' + secret))
        # Default secret rules exclude dependency lockfiles. Retain coverage of
        # original source files that are deliberately absent from the projection.
        (root / 'settings.txt').write_text('aws_access_key_id = ' + json.dumps(secret) + '\n')
        report, _, _ = self.assessed(root, 'metadata-secret')
        self.assertTrue(any(f['kind'] == 'secret' for f in report['findings']))
        self.assertNotIn(secret, json.dumps(report))

    def test_patch_edge_cannot_hide_production_promotion_of_dev_package(self):
        root = self.tree('patch-edge-promotion', lodash=True, dev=True)
        manifest = root / 'package.json'
        package = json.loads(manifest.read_text())
        package['dependencies']['parent'] = '1.0.0'
        manifest.write_text(json.dumps(package))
        lock = root / 'yarn.lock'
        lock.write_text(lock.read_text() + '\n' + npm('parent', '1.0.0') +
            '  dependencies:\n    lodash: "patch:lodash@npm%3A4.17.20#./fixture.patch"\n\n'
            '"lodash@patch:lodash@npm%3A4.17.20#./fixture.patch":\n  version: 4.17.20\n'
            '  resolution: "lodash@patch:lodash@npm%3A4.17.20#./fixture.patch::version=4.17.20&hash=abcdef"\n')
        (root / 'fixture.patch').write_text('')
        inventory = self.scan(root, 'patch-edge-inventory', 'vuln', True)
        production = self.scan(root, 'patch-edge-production', 'vuln')
        packages = [p for r in inventory['Results'] for p in r.get('Packages', [])]
        self.assertTrue(any(p['Name'] == 'lodash' and p.get('Dev') for p in packages))
        self.assertFalse(any(p['Name'] == 'lodash' for r in production['Results'] for p in r.get('Packages', [])))
        with self.assertRaisesRegex(gate.GateError, '^unsupported_yarn_patch_dependency$'):
            self.assessed(root, 'patch-edge-assessed')

    def test_helm_entry_limit_rejected_by_warning_policy(self):
        for size in (1, 6):
            root = self.root / ('helm-' + str(size))
            root.mkdir()
            with tarfile.open(root / 'fixture.tgz', 'w:gz') as archive:
                for name, data in {
                    'fixture/Chart.yaml': b'apiVersion: v2\nname: fixture\nversion: 1.0.0\n',
                    'fixture/templates/pod.yaml': b'apiVersion: v1\nkind: Pod\nmetadata:\n  name: fixture\nspec:\n  containers:\n    - name: fixture\n      image: nginx:1.25\n',
                    'fixture/payload.txt': b'x' * (size * 1024 * 1024),
                }.items():
                    entry = tarfile.TarInfo(name)
                    entry.size = len(data)
                    archive.addfile(entry, io.BytesIO(data))
            if size == 6:
                with self.assertRaisesRegex(gate.GateError, '^scanner_warning$'):
                    self.scan(root, 'helm-large')
            else:
                self.assertTrue(self.scan(root, 'helm-small').get('Results'))


if __name__ == '__main__':
    unittest.main(argv=[sys.argv[0]])
