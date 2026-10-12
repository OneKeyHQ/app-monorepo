"""Trusted Trivy PR gate. Execute only from the trusted workflow revision.

Raw scanner output is private temporary data. Published evidence contains only
allowlisted fields and run-local HMAC identities, never source or scanner text.
"""

import argparse
from collections import Counter
import hashlib
import hmac
import json
import os
from pathlib import Path, PurePosixPath
import re
import secrets
import shutil
import subprocess
import tempfile
from urllib.parse import urlsplit

VERSION = '0.70.0'
SEVERITIES = {'HIGH', 'CRITICAL'}
POLICY = {
    'version': VERSION, 'scanners': 'vuln,misconfig,secret',
    'severity': 'HIGH,CRITICAL', 'ignoreUnfixed': True,
    'includeDevDeps': False, 'vulnerableVersionReplacement': 'new',
    'warningPolicy': 'fail-except-unchanged-pinned-yarn-git', 'identityVersion': 1,
    'databases': ['ghcr.io/aquasecurity/trivy-db:2',
                  'ghcr.io/aquasecurity/trivy-java-db:1',
                  'ghcr.io/aquasecurity/trivy-checks:1'],
}


class GateError(Exception):
    """Messages must be fixed codes: never include scanner/source text."""


def require(condition, code):
    if not condition:
        raise GateError(code)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':')).encode()


def execute(args, cwd=None, env=None, timeout=1500):
    try:
        result = subprocess.run(args, cwd=cwd, env=env, capture_output=True,
                                timeout=timeout, check=False)
    except (OSError, subprocess.TimeoutExpired):
        raise GateError('process_failed') from None
    require(result.returncode == 0, 'process_failed')
    return result.stdout, result.stderr


def git(repo, *args):
    return execute(['git', '-C', str(repo), *args])[0]


def verify_revisions(repo, base, head, merge):
    for sha in (base, head, merge):
        require(bool(re.fullmatch('[0-9a-f]{40}', sha)), 'invalid_revision')
    require(git(repo, 'rev-parse', 'HEAD').decode().strip() == merge,
            'checkout_mismatch')
    parents = git(repo, 'show', '-s', '--format=%P', merge).decode().split()
    require(parents == [base, head], 'merge_parents_mismatch')


def read_json(file):
    try:
        return json.loads(Path(file).read_bytes())
    except (OSError, ValueError):
        raise GateError('missing_or_invalid_report') from None


def text(obj, key):
    require(isinstance(obj, dict), 'invalid_finding')
    value = obj.get(key)
    require(isinstance(value, str) and bool(value), 'missing_identity')
    return value


def source_file(root, target):
    require(isinstance(target, str) and bool(target), 'invalid_target')
    path = PurePosixPath(target)
    require(not path.is_absolute() and '..' not in path.parts, 'invalid_target')
    file = root / path
    require(file.resolve().is_relative_to(root.resolve()), 'target_outside_tree')
    require(file.is_file() and not file.is_symlink(), 'missing_target')
    return file


def source_identity(root, target, finding, key):
    start, end = finding.get('StartLine'), finding.get('EndLine')
    require(type(start) is int and type(end) is int and 0 < start <= end,
            'missing_source_range')
    lines = source_file(root, target).read_bytes().splitlines()
    require(end <= len(lines), 'invalid_source_range')
    # Never use redacted Match: different credentials can have identical Match.
    # Whole finding lines are conservative: edits on the same line count as new.
    return hmac.new(key, b'\n'.join(lines[start - 1:end]), 'sha256').hexdigest()


def list_field(obj, name):
    value = obj.get(name, [])
    require(isinstance(value, list), 'invalid_result_array')
    return value


def collect(report, root, key):
    require(isinstance(report, dict) and report.get('SchemaVersion') == 2,
            'unsupported_schema')
    require(report.get('ArtifactType') == 'filesystem', 'wrong_artifact_type')
    require(report.get('Trivy', {}).get('Version') == VERSION, 'tool_mismatch')
    require(isinstance(report.get('Results'), list) and bool(report['Results']),
            'missing_results')
    findings = []
    targets = set()
    package_count = 0
    for result in report['Results']:
        require(isinstance(result, dict), 'invalid_result')
        target = text(result, 'Target')
        source_file(root, target)
        path_id = hmac.new(key, b'path\0' + target.encode(), 'sha256').hexdigest()
        kind = text(result, 'Class')
        ecosystem = 'secret' if kind == 'secret' else text(result, 'Type')
        require(not result.get('Error') and not result.get('Errors'), 'result_error')
        targets.add((target, kind, ecosystem))
        packages = list_field(result, 'Packages')
        package_count += len(packages)
        for field, category in [('Vulnerabilities', 'vulnerability'),
                                ('Misconfigurations', 'misconfiguration'),
                                ('Secrets', 'secret')]:
            for finding in list_field(result, field):
                severity = text(finding, 'Severity')
                require(severity in {'UNKNOWN', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'},
                        'unknown_severity')
                if severity not in SEVERITIES:
                    continue
                identity = [category, target, ecosystem, severity]
                if category == 'vulnerability':
                    identity += [text(finding, 'PkgName'), text(finding, 'VulnerabilityID'),
                                 text(finding, 'InstalledVersion')]
                    # Distinguish instances when a scanner supplies a package path.
                    identity += [finding.get('PkgPath', '')]
                elif category == 'misconfiguration':
                    cause = finding.get('CauseMetadata')
                    require(isinstance(cause, dict), 'missing_resource_identity')
                    resource = cause.get('Resource')
                    if not resource and cause.get('StartLine'):
                        resource = source_identity(root, target, cause, key)
                    # Some Docker checks apply to the entire file (e.g. missing
                    # USER) and intentionally have neither resource nor range.
                    identity += [text(finding, 'ID'), resource or 'whole-file']
                else:
                    identity += [text(finding, 'RuleID'),
                                 source_identity(root, target, finding, key)]
                # File names can contain secrets. Publish only run-local HMACs
                # for locations and findings, never raw paths or scanner text.
                fingerprint = hmac.new(key, canonical(identity), 'sha256').hexdigest()
                findings.append({'kind': category, 'severity': severity,
                                 'fingerprint': fingerprint, 'pathId': path_id,
                                 'rule': finding.get('VulnerabilityID') or finding.get('ID')
                                         or finding.get('RuleID')})
    # These are the two Yarn inventories the existing workflow scans. Require
    # nonempty inventories even when no vulnerabilities match the threshold.
    for target in ('yarn.lock', 'apps/desktop/app/yarn.lock'):
        matches = [r for r in report['Results'] if r.get('Target') == target
                   and r.get('Class') == 'lang-pkgs' and r.get('Type') == 'yarn']
        require(len(matches) == 1 and bool(matches[0].get('Packages')),
                'missing_lockfile_inventory')
    return {'findings': findings, 'targetCount': len(targets),
            'packageCount': package_count,
            'targets': sorted(targets)}


def compare(base, merge):
    baseline = Counter((f['kind'], f['severity'], f['fingerprint'])
                       for f in base['findings'])
    candidate = Counter((f['kind'], f['severity'], f['fingerprint'])
                        for f in merge['findings'])
    return [{'kind': kind, 'severity': severity, 'fingerprint': fingerprint,
             'count': count}
            for (kind, severity, fingerprint), count in sorted((candidate - baseline).items())]


def verify_pair(base, merge, expected):
    for report, revision in ((base, expected['base']), (merge, expected['merge'])):
        meta = report['metadata']
        require(meta['revision'] == revision, 'revision_mismatch')
        require(meta['base'] == expected['base'] and meta['head'] == expected['head']
                and meta['merge'] == expected['merge'], 'baseline_mismatch')
        require(meta['complete'] is True, 'incomplete_scan')
        require(meta['policy'] == digest(canonical(POLICY)), 'policy_mismatch')
    for field in ('database', 'binary', 'policy'):
        require(base['metadata'][field] == merge['metadata'][field], field + '_mismatch')


def snapshot(cache):
    result = {}
    for directory in ('db', 'java-db', 'policy'):
        files = sorted(p for p in (cache / directory).rglob('*') if p.is_file())
        require(bool(files), 'missing_database')
        result[directory] = digest(canonical([
            (str(p.relative_to(cache)), digest(p.read_bytes())) for p in files]))
    return digest(canonical(result))


def scan_command(binary, root, output, cache, config, frozen):
    args = [str(binary), 'fs', '--config', str(config / 'trivy.yaml'),
            '--cache-dir', str(cache), '--cache-backend', 'memory',
            '--scanners', POLICY['scanners'], '--severity', POLICY['severity'],
            '--ignore-unfixed', '--include-dev-deps=false', '--list-all-pkgs',
            '--ignorefile', str(config / 'ignore'),
            '--secret-config', str(config / 'secret.yaml'),
            '--format', 'json', '--output', str(output), '--exit-code', '0',
            '--timeout', '20m0s', '--skip-version-check', '--disable-telemetry',
            '--checks-bundle-repository', 'ghcr.io/aquasecurity/trivy-checks:1']
    if frozen:
        args += ['--skip-db-update', '--skip-java-db-update', '--skip-check-update']
    return args + ['.']


def yarn_git_entries(root):
    entries = {}
    for file in root.rglob('yarn.lock'):
        data = source_file(root, str(file.relative_to(root))).read_text()
        headers = list(re.finditer(r'(?m)^[^\s#][^\n]*(?:\n|$)', data))
        covered = []
        for index, match in enumerate(headers):
            header = match.group().rstrip()
            protocols = set(re.findall(r'@([a-z][a-z0-9+.-]*):', header))
            protocols -= {'npm', 'workspace', 'patch', 'file', 'link', 'portal'}
            if not protocols:
                continue
            # Trivy skips Git sources. Admit only unchanged, commit-pinned
            # GitHub entries; new/edited opaque code cannot be assessed safely.
            require(protocols == {'https'}, 'unsupported_yarn_source')
            end = headers[index + 1].start() if index + 1 < len(headers) else len(data)
            block = data[match.start():end].rstrip('\r\n')
            resolutions = re.findall(r'(?m)^  resolution: ("(?:[^"\\]|\\.)*")$', block)
            require(len(resolutions) == 1, 'unsupported_yarn_source')
            try:
                resolution = json.loads(resolutions[0])
                selector, suffix = json.JSONDecoder().raw_decode(header)
                require(header[suffix:].lstrip().startswith(':'), 'unsupported_yarn_source')
                patterns = selector.split(', ')
            except ValueError:
                raise GateError('unsupported_yarn_source') from None
            package, separator, location = resolution.rpartition('@https://')
            url = urlsplit('https://' + location)
            require(separator and url.netloc == 'github.com' and not url.query
                    and bool(re.fullmatch('commit=[0-9a-f]{40}', url.fragment)),
                    'unsupported_yarn_source')
            for pattern in patterns:
                name, separator, location = pattern.rpartition('@https://')
                source = urlsplit('https://' + location)
                require(separator and name == package and source.netloc == url.netloc
                        and source.path.removesuffix('.git') == url.path.removesuffix('.git')
                        and not source.query,
                        'unsupported_yarn_source')
            identity = (str(file.relative_to(root)), header)
            require(identity not in entries, 'unsupported_yarn_source')
            entries[identity] = digest(block.encode())
            covered.append((match.start(), end))
        # Do not overlook sources in indented/nonstandard headers or dependency
        # fields. Trivy silently skips some Git protocols without warning.
        for match in re.finditer(r'@([a-z][a-z0-9+.-]*):', data):
            if match[1] not in {'npm', 'workspace', 'patch', 'file', 'link', 'portal'}:
                require(any(start <= match.start() < end for start, end in covered),
                        'unsupported_yarn_source')
        # YAML double-quoted strings can encode protocol characters. Decode
        # JSON-compatible strings and reject unsupported escapes, failing closed.
        quoted = r'"(?:[^"\\]|\\.)*"'
        require('"' not in re.sub(quoted, '', data, flags=re.S), 'unsupported_yarn_source')
        for match in re.finditer(quoted, data, flags=re.S):
            try:
                value = json.loads(match.group())
            except ValueError:
                raise GateError('unsupported_yarn_source') from None
            protocols = set(re.findall(r'@([a-z][a-z0-9+.-]*):', value))
            if protocols - {'npm', 'workspace', 'patch', 'file', 'link', 'portal'}:
                require(any(start <= match.start() < end for start, end in covered),
                        'unsupported_yarn_source')
    return entries


def yarn_git_warnings(base, merge):
    entries = {name: yarn_git_entries(root) for name, root in (('base', base), ('merge', merge))}
    require(all(entries['base'].get(identity) == value
                for identity, value in entries['merge'].items()),
            'changed_unsupported_dependency')
    # Trivy strips the opening header quote before formatting this warning.
    return {name: Counter("unknown protocol: 'https', line: " + header.removeprefix('"')
                          for _, header in inventory)
            for name, inventory in entries.items()}


def scan(binary, root, output, cache, config, env, frozen=True, allowed_warnings=None):
    stdout, stderr = execute(scan_command(binary, root, output, cache, config, frozen),
                              cwd=root, env=env)
    # Exceptions are exact parser messages derived from validated source pairs.
    # Never persist warning text, which can quote credentials or arbitrary input.
    remaining = Counter(allowed_warnings or {})
    logs = []
    for line in (stdout + stderr).splitlines():
        match = re.fullmatch(rb'[0-9TZ:+. -]+\tWARN\t\[yarn\] Protocol error\terr=("(?:[^"\\]|\\.)*")', line)
        if match and remaining:
            try:
                error = json.loads(match[1])
            except (ValueError, UnicodeDecodeError):
                raise GateError('scanner_warning') from None
            if remaining[error] > 0:
                remaining.subtract([error])
                continue
        logs.append(line)
    require(not +remaining and not re.search(rb'\b(WARN|ERROR|FATAL)\b', b'\n'.join(logs)),
            'scanner_warning')
    return read_json(output)


def export_tree(repo, revision, destination):
    destination.mkdir()
    # git archive honors export-ignore attributes. Export tracked blobs instead,
    # so a PR cannot hide a new dependency/file via .gitattributes.
    listing = git(repo, 'ls-tree', '-r', '-z', revision)
    for entry in listing.split(b'\0'):
        if not entry:
            continue
        header, name = entry.split(b'\t', 1)
        mode, object_type, oid = header.split()
        relative = Path(os.fsdecode(name))
        require(not relative.is_absolute() and '..' not in relative.parts, 'invalid_git_path')
        require(object_type == b'blob', 'unsupported_submodule')
        target = destination / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        data = git(repo, 'cat-file', 'blob', oid.decode())
        # Inline suppressions cannot be redirected by --ignorefile. Treat them
        # as unsupported coverage rather than silently accepting suppression.
        require(not re.search(rb'(?m)^\s*(?:#|//|;)\s*trivy:ignore', data),
                'inline_suppression')
        if mode == b'120000':
            # Preserve safe links, reject links escaping the exported source.
            link = os.fsdecode(data)
            require(not Path(link).is_absolute()
                    and (target.parent / link).resolve().is_relative_to(destination.resolve()),
                    'unsafe_symlink')
            target.symlink_to(link)
        else:
            require(mode in (b'100644', b'100755'), 'unsupported_git_mode')
            target.write_bytes(data)


def write_evidence(output, value):
    output.mkdir(parents=True, exist_ok=True)
    (output / 'result.json').write_text(json.dumps(value, indent=2) + '\n')
    count = sum(f['count'] for f in value.get('newFindings', []))
    message = (f"Trivy incremental gate: {value['status']}. "
               f"New HIGH/CRITICAL instances: {count}. "
               f"Diagnostic: {value.get('error', 'none')}.\n")
    (output / 'summary.txt').write_text(message)
    if os.environ.get('GITHUB_STEP_SUMMARY'):
        with open(os.environ['GITHUB_STEP_SUMMARY'], 'a') as summary:
            summary.write(message)
    print(message.strip())


def run(args):
    output = Path(args.output).resolve()
    result = {'schemaVersion': 1, 'status': 'incomplete', 'policy': POLICY}
    try:
        repo = Path(args.repo).resolve()
        verify_revisions(repo, args.base, args.head, args.merge)
        expected = {name: getattr(args, name) for name in ('base', 'head', 'merge')}
        result['revisions'] = expected
        binary = Path(shutil.which(args.trivy) or args.trivy).resolve()
        require(binary.is_file(), 'missing_scanner')
        binary_hash = digest(binary.read_bytes())
        # Do not forward credentials or TRIVY_* overrides to the scanner.
        with tempfile.TemporaryDirectory(prefix='trivy-private-') as tmp:
            private = Path(tmp)
            env = {'PATH': os.environ['PATH'], 'HOME': str(private), 'LANG': 'C.UTF-8'}
            # Preserve runner network transport, but no application credentials
            # or Trivy policy overrides. Scanner output remains private.
            for name in ('HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'NO_PROXY',
                         'SSL_CERT_FILE', 'SSL_CERT_DIR'):
                if name in os.environ:
                    env[name] = os.environ[name]
            version = execute([str(binary), '--version'], env=env)[0].decode()
            require(version.splitlines()[0] == 'Version: ' + VERSION, 'tool_mismatch')
            config = private / 'config'
            config.mkdir()
            (config / 'trivy.yaml').write_text('{}\n')
            (config / 'secret.yaml').write_text('{}\n')
            (config / 'ignore').write_text('')
            result['phase'] = 'database'
            cache = private / 'cache'
            cache.mkdir()
            empty = private / 'empty'
            empty.mkdir()
            for flag in ('--download-db-only', '--download-java-db-only'):
                registry = ('--db-repository' if flag == '--download-db-only'
                            else '--java-db-repository')
                image = ('ghcr.io/aquasecurity/trivy-db:2' if flag == '--download-db-only'
                         else 'ghcr.io/aquasecurity/trivy-java-db:1')
                execute([str(binary), 'fs', '--cache-dir', str(cache), registry, image, flag],
                        cwd=empty, env=env)
            scan(binary, empty, private / 'warmup.json', cache, config, env, frozen=False)
            database = snapshot(cache)
            key = secrets.token_bytes(32)
            roots = {}
            for name in ('base', 'merge'):
                result['phase'] = name
                roots[name] = private / name
                export_tree(repo, expected[name], roots[name])
            allowed_warnings = yarn_git_warnings(roots['base'], roots['merge'])
            result['opaqueGitDependencyCount'] = sum(allowed_warnings['merge'].values())
            scans = {}
            for name in ('base', 'merge'):
                result['phase'] = name
                root = roots[name]
                require(snapshot(cache) == database, 'database_changed')
                report = scan(binary, root, private / (name + '.json'), cache, config, env,
                              allowed_warnings=allowed_warnings[name])
                require(snapshot(cache) == database, 'database_changed')
                require(digest(binary.read_bytes()) == binary_hash, 'binary_changed')
                scans[name] = collect(report, root, key)
                scans[name]['metadata'] = dict(expected, revision=expected[name],
                    complete=True, database=database, binary=binary_hash,
                    policy=digest(canonical(POLICY)))
                # Persist only the sanitized schema, including when scan two fails.
                result[name] = {k: v for k, v in scans[name].items() if k != 'targets'}
            verify_pair(scans['base'], scans['merge'], expected)
            # A surviving target disappearing from results is a coverage failure.
            for target in set(scans['base']['targets']) - set(scans['merge']['targets']):
                # Secret results exist only for files with matches; removing
                # the last secret removes the result while retaining the file.
                if target[1] == 'secret':
                    continue
                require(not (private / 'merge' / target[0]).exists(), 'lost_target_coverage')
            result['phase'] = 'comparison'
            result['newFindings'] = compare(scans['base'], scans['merge'])
            result['status'] = 'new_findings' if result['newFindings'] else 'passed'
    except GateError as error:
        result['error'] = str(error)
    except Exception:
        # Exceptions can contain source/secret data. Never print a traceback.
        result['error'] = 'unexpected_gate_error'
    write_evidence(output, result)
    return 0 if result['status'] == 'passed' else (1 if result['status'] == 'new_findings' else 2)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for argument in ('repo', 'base', 'head', 'merge', 'output'):
        parser.add_argument('--' + argument, required=True)
    parser.add_argument('--trivy', default='trivy')
    raise SystemExit(run(parser.parse_args()))
