"""Run with python3 -I .github/scripts/trivy_gate_test.py (stdlib only)."""

import copy
import importlib.util
import io
import json
import os
from pathlib import Path
import tempfile
import sys
import unittest
from contextlib import redirect_stdout
from types import SimpleNamespace
from unittest.mock import patch

sys.dont_write_bytecode = True

spec = importlib.util.spec_from_file_location('gate', Path(__file__).with_name('trivy_gate.py'))
gate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gate)


def vulnerability(id='CVE-A', version='1', severity='HIGH'):
    return {'PkgName': 'example', 'VulnerabilityID': id, 'InstalledVersion': version,
            'Severity': severity}


class GateTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        for name in ('yarn.lock', 'apps/desktop/app/yarn.lock', 'source.txt', 'Dockerfile'):
            file = self.root / name
            file.parent.mkdir(parents=True, exist_ok=True)
            file.write_text('first fake credential\nsecond fake credential\n')
        self.key = b'ephemeral-test-key'
        self.report = {'SchemaVersion': 2, 'ArtifactType': 'filesystem',
                       'Trivy': {'Version': gate.VERSION}, 'Results': [
            {'Target': name, 'Class': 'lang-pkgs', 'Type': 'yarn',
             'Packages': [{'Name': 'example', 'Version': '1'}], 'Vulnerabilities': []}
            for name in ('yarn.lock', 'apps/desktop/app/yarn.lock')]}

    def collect(self, report):
        return gate.collect(report, self.root, self.key)

    def pair(self, base, merge):
        a, b = copy.deepcopy(self.report), copy.deepcopy(self.report)
        a['Results'][0]['Vulnerabilities'] = base
        b['Results'][0]['Vulnerabilities'] = merge
        return gate.compare(self.collect(a), self.collect(b))

    def test_identical_and_reordered(self):
        self.assertEqual(self.pair([vulnerability(), vulnerability('CVE-B')],
                                   [vulnerability('CVE-B'), vulnerability()]), [])

    def test_equal_total_different_vulnerability(self):
        self.assertEqual(self.pair([vulnerability()], [vulnerability('CVE-B')])[0]['count'], 1)

    def test_duplicate_instances(self):
        self.assertEqual(self.pair([vulnerability()], [vulnerability()] * 2)[0]['count'], 1)

    def test_fewer_instances(self):
        self.assertEqual(self.pair([vulnerability()] * 2, [vulnerability()]), [])

    def test_version_replacement_is_new(self):
        self.assertEqual(len(self.pair([vulnerability()], [vulnerability(version='2')])), 1)

    def test_severity_escalation_is_new(self):
        self.assertEqual(len(self.pair([vulnerability()], [vulnerability(severity='CRITICAL')])), 1)

    def secret_report(self, start=1, end=1):
        result = copy.deepcopy(self.report)
        result['Results'].append({'Target': 'source.txt', 'Class': 'secret',
            'Secrets': [{'RuleID': 'test-rule', 'Severity': 'HIGH', 'Match': '***',
                         'StartLine': start, 'EndLine': end}]})
        return result

    def test_redacted_secret_collision(self):
        first = self.collect(self.secret_report())
        second = self.collect(self.secret_report(2, 2))
        self.assertEqual(len(gate.compare(first, second)), 1)

    def test_secret_line_move(self):
        first = self.collect(self.secret_report())
        (self.root / 'source.txt').write_text('\nfirst fake credential\n')
        self.assertEqual(gate.compare(first, self.collect(self.secret_report(2, 2))), [])

    def test_secret_duplicate(self):
        one = self.secret_report()
        two = copy.deepcopy(one)
        two['Results'][-1]['Secrets'] *= 2
        self.assertEqual(gate.compare(self.collect(one), self.collect(two))[0]['count'], 1)

    def test_secret_missing_or_out_of_range_location(self):
        for start, end in ((0, 1), (None, 1), (1, 500)):
            with self.subTest(start=start, end=end), self.assertRaises(gate.GateError):
                self.collect(self.secret_report(start, end))

    def test_misconfiguration_resource_identity(self):
        a = copy.deepcopy(self.report)
        a['Results'].append({'Target': 'Dockerfile', 'Class': 'config', 'Type': 'dockerfile',
            'Misconfigurations': [{'ID': 'AVD-1', 'Severity': 'HIGH',
                                  'CauseMetadata': {'Resource': 'USER', 'StartLine': 1}}]})
        b = copy.deepcopy(a)
        b['Results'][-1]['Misconfigurations'][0]['CauseMetadata']['StartLine'] = 2
        self.assertEqual(gate.compare(self.collect(a), self.collect(b)), [])
        b['Results'][-1]['Misconfigurations'][0]['CauseMetadata']['Resource'] = 'RUN'
        self.assertEqual(len(gate.compare(self.collect(a), self.collect(b))), 1)

    def test_invalid_report_structures(self):
        cases = [None, {}, dict(self.report, SchemaVersion=1), dict(self.report, Results=None),
                 dict(self.report, Results=[]), dict(self.report, Trivy={'Version': '0.69.0'}),
                 dict(self.report, ArtifactType='container_image')]
        for report in cases:
            with self.subTest(report=report), self.assertRaises(gate.GateError):
                self.collect(report)

    def test_missing_inventory(self):
        del self.report['Results'][0]['Packages']
        with self.assertRaisesRegex(gate.GateError, 'missing_lockfile_inventory'):
            self.collect(self.report)

    def test_malformed_finding(self):
        for value in (None, {}, [None], [{'Severity': 'HIGH'}]):
            report = copy.deepcopy(self.report)
            report['Results'][0]['Vulnerabilities'] = value
            with self.subTest(value=value), self.assertRaises(gate.GateError):
                self.collect(report)

    def test_missing_bad_json(self):
        with self.assertRaises(gate.GateError):
            gate.read_json(self.root / 'missing.json')
        (self.root / 'bad.json').write_text('{fake sensitive source')
        with self.assertRaisesRegex(gate.GateError, '^missing_or_invalid_report$'):
            gate.read_json(self.root / 'bad.json')

    def test_path_escape(self):
        for target in ('../secret', '/etc/passwd'):
            with self.assertRaises(gate.GateError):
                gate.source_file(self.root, target)

    def test_revision_db_and_policy_validation(self):
        expected = dict(base='a' * 40, head='b' * 40, merge='c' * 40)
        meta = dict(expected, revision=expected['base'], complete=True,
                    database='db', binary='binary', policy=gate.digest(gate.canonical(gate.POLICY)))
        a = {'metadata': meta}
        b = {'metadata': dict(meta, revision=expected['merge'])}
        gate.verify_pair(a, b, expected)
        for name in ('database', 'binary', 'policy', 'base', 'head', 'merge', 'revision', 'complete'):
            changed = copy.deepcopy(b)
            changed['metadata'][name] = 'wrong'
            with self.subTest(field=name), self.assertRaises(gate.GateError):
                gate.verify_pair(a, changed, expected)

    def test_wrong_merge_parents(self):
        with patch.object(gate, 'git', side_effect=[b'c' * 40, b'd' * 40 + b' ' + b'b' * 40]):
            with self.assertRaisesRegex(gate.GateError, 'merge_parents_mismatch'):
                gate.verify_revisions(self.root, 'a' * 40, 'b' * 40, 'c' * 40)

    def test_scanner_warning_fails_without_text_leak(self):
        for level in ('WARN', 'ERROR', 'FATAL'):
            with patch.object(gate, 'execute', return_value=(b'', (level + ' private source').encode())):
                with self.assertRaisesRegex(gate.GateError, '^scanner_warning$'):
                    gate.scan('trivy', self.root, self.root / 'out', self.root, self.root, {})

    def test_scan_failure_and_timeout(self):
        with self.assertRaises(gate.GateError):
            gate.execute(['/nonexistent/trivy'])
        with self.assertRaises(gate.GateError):
            gate.execute(['python3', '-c', 'raise SystemExit(7)'])

    def test_frozen_command_uses_explicit_configuration(self):
        command = gate.scan_command('trivy', self.root, self.root / 'out', self.root, self.root, True)
        for flag in ('--skip-db-update', '--skip-java-db-update', '--skip-check-update',
                     '--secret-config', '--ignorefile', '--config', '--list-all-pkgs'):
            self.assertIn(flag, command)

    def test_failure_retains_only_safe_evidence(self):
        args = SimpleNamespace(output=str(self.root / 'evidence'), repo=str(self.root),
                               base='a', head='b', merge='c', trivy='trivy')
        with redirect_stdout(io.StringIO()), patch.dict(os.environ, {'GITHUB_STEP_SUMMARY': ''}):
            self.assertEqual(gate.run(args), 2)
        evidence = json.loads((self.root / 'evidence/result.json').read_text())
        self.assertEqual(evidence['status'], 'incomplete')
        self.assertEqual(evidence['error'], 'invalid_revision')
        self.assertTrue((self.root / 'evidence/summary.txt').exists())

    def test_export_ignore_cannot_hide_file(self):
        entries = (b'100644 blob ' + b'a' * 40 + b'\t.gitattributes\0'
                   b'100644 blob ' + b'b' * 40 + b'\tpackage.json\0')
        with patch.object(gate, 'git', side_effect=[entries, b'package.json export-ignore', b'{}']):
            target = self.root / 'export'
            gate.export_tree(self.root, 'a' * 40, target)
        self.assertEqual((target / 'package.json').read_text(), '{}')

    def test_export_rejects_escaping_symlink_and_submodule(self):
        for entry, blob in [(b'120000 blob ' + b'a' * 40 + b'\tlink\0', b'/etc/passwd'),
                            (b'160000 commit ' + b'a' * 40 + b'\tsubmodule\0', b'')]:
            with self.subTest(entry=entry), tempfile.TemporaryDirectory() as tmp:
                with patch.object(gate, 'git', side_effect=[entry, blob]), self.assertRaises(gate.GateError):
                    gate.export_tree(self.root, 'a' * 40, Path(tmp) / 'export')

    def test_inline_suppression_is_coverage_failure(self):
        entry = b'100644 blob ' + b'a' * 40 + b'\tDockerfile\0'
        with patch.object(gate, 'git', side_effect=[entry, b'# trivy:ignore:DS002']), \
             self.assertRaisesRegex(gate.GateError, 'inline_suppression'):
            gate.export_tree(self.root, 'a' * 40, self.root / 'export')

    def test_missing_report_after_successful_process(self):
        with patch.object(gate, 'execute', return_value=(b'', b'')), \
             self.assertRaisesRegex(gate.GateError, 'missing_or_invalid_report'):
            gate.scan('trivy', self.root, self.root / 'missing.json', self.root, self.root, {})

    def test_real_docker_file_level_check(self):
        report = copy.deepcopy(self.report)
        report['Results'].append({'Target': 'Dockerfile', 'Class': 'config', 'Type': 'dockerfile',
            'Misconfigurations': [{'ID': 'DS-0002', 'Severity': 'HIGH',
                                  'CauseMetadata': {'Provider': 'Dockerfile'}}]})
        self.assertEqual(gate.compare(self.collect(report), self.collect(report)), [])

    def test_failure_on_second_scan_retains_sanitized_base(self):
        args = SimpleNamespace(output=str(self.root / 'evidence'), repo=str(self.root),
                               base='a' * 40, head='b' * 40, merge='c' * 40,
                               trivy=str(self.root / 'scanner'))
        (self.root / 'scanner').write_text('fake executable')
        def export(repo, revision, target):
            target.mkdir()
            for name in ('yarn.lock', 'apps/desktop/app/yarn.lock'):
                file = target / name
                file.parent.mkdir(parents=True, exist_ok=True)
                file.write_text('fixture')
        with patch.object(gate, 'verify_revisions'), \
             patch.object(gate, 'execute', return_value=(b'Version: 0.70.0', b'')), \
             patch.object(gate, 'snapshot', return_value='database'), \
             patch.object(gate, 'export_tree', side_effect=export), \
             patch.object(gate, 'scan', side_effect=[{}, self.report, gate.GateError('scanner_warning')]), \
             redirect_stdout(io.StringIO()), \
             patch.dict(os.environ, {'GITHUB_STEP_SUMMARY': ''}):
            self.assertEqual(gate.run(args), 2)
        saved = json.loads((self.root / 'evidence/result.json').read_text())
        self.assertEqual(saved['error'], 'scanner_warning')
        self.assertIn('base', saved)
        self.assertNotIn('merge', saved)
        self.assertEqual(saved['base']['metadata']['revision'], args.base)

    def test_db_content_change_and_missing_db(self):
        cache = self.root / 'cache'
        with self.assertRaisesRegex(gate.GateError, 'missing_database'):
            gate.snapshot(cache)
        for name in ('db', 'java-db', 'policy'):
            (cache / name).mkdir(parents=True)
            (cache / name / 'data').write_text('initial')
        before = gate.snapshot(cache)
        (cache / 'db/data').write_text('changed')
        self.assertNotEqual(before, gate.snapshot(cache))

    def test_sanitized_secret_report(self):
        report = self.collect(self.secret_report())
        serialized = json.dumps(report['findings'])
        for sensitive in ('credential', '***', 'Match', 'synthetic-credential'):
            self.assertNotIn(sensitive, serialized)

    def test_sensitive_target_names_use_run_local_path_ids(self):
        target = 'synthetic-private-client-name.txt'
        (self.root / target).write_text('fake credential\n')
        for category, finding in (
            ('Vulnerabilities', vulnerability()),
            ('Misconfigurations', {'ID': 'AVD-1', 'Severity': 'HIGH',
                                   'CauseMetadata': {'Resource': 'USER'}}),
            ('Secrets', {'RuleID': 'test-rule', 'Severity': 'HIGH',
                         'StartLine': 1, 'EndLine': 1}),
        ):
            with self.subTest(category=category):
                report = copy.deepcopy(self.report)
                report['Results'].append({'Target': target, 'Class': 'lang-pkgs',
                                          'Type': 'yarn', category: [finding]})
                first = self.collect(report)['findings'][0]
                second = self.collect(report)['findings'][0]
                other_run = gate.collect(report, self.root, b'other-run-key')['findings'][0]
                self.assertNotIn(target, json.dumps(first))
                self.assertNotIn('path', first)
                self.assertRegex(first['pathId'], '^[0-9a-f]{64}$')
                self.assertEqual(first['pathId'], second['pathId'])
                self.assertNotEqual(first['pathId'], other_run['pathId'])

    def test_sensitive_target_names_never_reach_published_evidence(self):
        target = 'synthetic-private-client-name.txt'
        report = self.secret_report()
        report['Results'][-1]['Target'] = target
        args = SimpleNamespace(output=str(self.root / 'evidence'), repo=str(self.root),
                               base='a' * 40, head='b' * 40, merge='c' * 40,
                               trivy=str(self.root / 'scanner'))
        (self.root / 'scanner').write_text('fake executable')
        def export(repo, revision, destination):
            destination.mkdir()
            for result in report['Results']:
                file = destination / result['Target']
                file.parent.mkdir(parents=True, exist_ok=True)
                file.write_text('fake credential\n')
        for outcome in ('passed', 'new_findings', 'incomplete'):
            with self.subTest(outcome=outcome):
                baseline = copy.deepcopy(report)
                if outcome == 'new_findings':
                    baseline['Results'][-1]['Secrets'] = []
                candidate = gate.GateError('scanner_warning') if outcome == 'incomplete' else report
                stdout = io.StringIO()
                summary = self.root / 'step-summary.txt'
                summary.write_text('')
                with patch.object(gate, 'verify_revisions'), \
                     patch.object(gate, 'execute', return_value=(b'Version: 0.70.0', b'')), \
                     patch.object(gate, 'snapshot', return_value='database'), \
                     patch.object(gate, 'export_tree', side_effect=export), \
                     patch.object(gate, 'scan', side_effect=[{}, baseline, candidate]), \
                     redirect_stdout(stdout), \
                     patch.dict(os.environ, {'GITHUB_STEP_SUMMARY': str(summary)}):
                    self.assertEqual(gate.run(args), {'passed': 0, 'new_findings': 1,
                                                     'incomplete': 2}[outcome])
                saved = json.loads((self.root / 'evidence/result.json').read_text())
                self.assertEqual(saved['status'], outcome)
                for artifact in (self.root / 'evidence').iterdir():
                    self.assertNotIn(target, artifact.read_text())
                self.assertNotIn(target, stdout.getvalue())
                self.assertNotIn(target, summary.read_text())


if __name__ == '__main__':
    unittest.main()
