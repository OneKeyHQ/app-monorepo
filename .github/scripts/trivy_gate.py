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
from urllib.parse import unquote, urlsplit

VERSION = '0.71.0'
SEVERITIES = {'HIGH', 'CRITICAL'}
POLICY = {
    'version': VERSION, 'scanners': 'vuln,misconfig,secret',
    'severity': 'HIGH,CRITICAL', 'ignoreUnfixed': True,
    'includeDevDeps': False, 'vulnerableVersionReplacement': 'new',
    'warningPolicy': 'fail-except-unchanged-pinned-yarn-git', 'identityVersion': 1,
    'yarnCoverage': 'complete-npm-inventory',
    'yarnProjection': 'omit-non-runtime-dependency-metadata',
    'yarnPatchEdges': 'reject-unsupported-reachability',
    'yarnLocalSources': 'reject',
    'yarnGitPromotion': 'reject',
    'yarnProduction': 'trivy-or-manifest-lockfile-reachability',
    'yarnAliases': 'per-selector-instances-assessed-by-resolved-name',
    'databases': ['ghcr.io/aquasecurity/trivy-db:2',
                  'ghcr.io/aquasecurity/trivy-java-db:1',
                  'ghcr.io/aquasecurity/trivy-checks:1'],
}
# Go's unicode.IsSpace set, which strings.TrimSpace removes in the IaC parser.
GO_SPACE = '\t\n\v\f\r \x85\xa0                　'
# Trivy silently skips file:, link: and portal: entries; they fail closed.
YARN_PROTOCOLS = {'npm', 'workspace', 'patch'}
YARN_NAME = r'((?:@[^/@\s:]+/)?[^/@\s:]+)'
# JavaScript's \s as a regex character-class body; semver trims and splits
# ranges on it. Python's \s also matches \x1c-\x1f and \x85 but not \ufeff.
JS_SPACE = '\t\n\v\f\r \u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff'


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


def source_path(root, target):
    require(isinstance(target, str) and bool(target), 'invalid_target')
    path = PurePosixPath(target)
    require(not path.is_absolute() and '..' not in path.parts, 'invalid_target')
    file = root / path
    require(file.resolve().is_relative_to(root.resolve()), 'target_outside_tree')
    # Module scanners such as Terraform report directory Targets (e.g. '.').
    require((file.is_file() or file.is_dir()) and not file.is_symlink(), 'missing_target')
    return file


def source_file(root, target):
    file = source_path(root, target)
    require(file.is_file(), 'missing_target')
    return file


def helm_archive(target):
    # Trivy names templates rendered from a chart archive '<archive>:<template>'.
    match = re.fullmatch(r'(.+?\.(?:tgz|tar\.gz|tar)):(.+)', target)
    if match is None:
        return None
    template = PurePosixPath(match[2])
    require(not template.is_absolute() and '..' not in template.parts, 'invalid_target')
    return match[1]


def rendered_identity(finding, key):
    # Helm findings number lines in the rendered manifest, which exists only in
    # the scanner; hash its reported lines for the whole finding range.
    start, end = finding.get('StartLine'), finding.get('EndLine')
    require(type(start) is int and type(end) is int and 0 < start <= end,
            'missing_source_range')
    code = finding.get('Code')
    lines = code.get('Lines') if isinstance(code, dict) else None
    require(isinstance(lines, list) and all(isinstance(line, dict) for line in lines)
            and [line.get('Number') for line in lines] == list(range(start, end + 1))
            and all(isinstance(line.get('Content'), str) for line in lines),
            'missing_source_range')
    return hmac.new(key, '\n'.join(line['Content'] for line in lines).encode(),
                    'sha256').hexdigest()


def source_identity(root, target, finding, key):
    start, end = finding.get('StartLine'), finding.get('EndLine')
    require(type(start) is int and type(end) is int and 0 < start <= end,
            'missing_source_range')
    # Scanners number lines by LF only; splitlines() would also split at a
    # bare CR and hash only part of the reported line.
    lines = source_file(root, target).read_bytes().split(b'\n')
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
        kind = text(result, 'Class')
        ecosystem = 'secret' if kind == 'secret' else text(result, 'Type')
        rendered = kind == 'config' and ecosystem == 'helm' and not (root / target).exists()
        if rendered:
            archive = helm_archive(target)
            require(archive is not None, 'missing_target')
            source_file(root, archive)
        else:
            source_path(root, target)
        path_id = hmac.new(key, b'path\0' + target.encode(), 'sha256').hexdigest()
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
                        resource = (rendered_identity(cause, key) if rendered
                                    else source_identity(root, target, cause, key))
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


def verify_target_coverage(base, merge, root):
    """A surviving target disappearing from results is a coverage failure."""
    for target, kind, ecosystem in set(map(tuple, base)) - set(map(tuple, merge)):
        # Secret results exist only for files with matches; removing the last
        # secret removes the result while retaining the file.
        if kind == 'secret':
            continue
        path = root / target
        archive = helm_archive(target) if kind == 'config' and ecosystem == 'helm' else None
        if archive and not path.exists():
            # A rendered template can be verified gone only with its archive.
            require(not (root / archive).exists(), 'lost_target_coverage')
            continue
        if ecosystem == 'terraform' and path.is_dir() and not path.is_symlink():
            # A module Result disappears with the module's last Terraform file.
            require(not any(f.is_file() and f.name.endswith(('.tf', '.tf.json'))
                            for f in path.iterdir()), 'lost_target_coverage')
            continue
        require(not path.exists(), 'lost_target_coverage')


def snapshot(cache):
    result = {}
    for directory in ('db', 'java-db', 'policy'):
        files = sorted(p for p in (cache / directory).rglob('*') if p.is_file())
        require(bool(files), 'missing_database')
        result[directory] = digest(canonical([
            (str(p.relative_to(cache)), digest(p.read_bytes())) for p in files]))
    return digest(canonical(result))


def scan_command(binary, root, output, cache, config, frozen,
                 scanners=None, include_dev_deps=False):
    args = [str(binary), 'fs', '--config', str(config / 'trivy.yaml'),
            '--cache-dir', str(cache), '--cache-backend', 'memory',
            '--scanners', scanners or POLICY['scanners'], '--severity', POLICY['severity'],
            '--ignore-unfixed', '--include-dev-deps=' + str(include_dev_deps).lower(), '--list-all-pkgs',
            '--ignorefile', str(config / 'ignore'),
            '--secret-config', str(config / 'secret.yaml'),
            '--format', 'json', '--output', str(output), '--exit-code', '0',
            '--timeout', '20m0s', '--skip-version-check', '--disable-telemetry',
            '--checks-bundle-repository', 'ghcr.io/aquasecurity/trivy-checks:1']
    if frozen:
        args += ['--skip-db-update', '--skip-java-db-update', '--skip-check-update']
    return args + ['.']


def yarn_files(root):
    for file in root.rglob('yarn.lock'):
        with source_file(root, str(file.relative_to(root))).open(newline='') as source:
            raw = source.read()
        data = raw.replace('\r\n', '\n')
        # Trivy prioritizes LF delimiters over CRLF delimiters in a buffer.
        require('\r' not in data and ('\r' not in raw or raw == data.replace('\n', '\r\n')),
                'unsupported_yarn_block')
        header_pattern = r'(?m)^[^\s#][^\n]*(?:\n|$)'
        for block in data.split('\n\n'):
            meaningful = [line for line in block.splitlines()
                          if line.strip() and not line.startswith('#')]
            if not meaningful:
                continue
            matches = list(re.finditer(header_pattern, block))
            require(len(matches) == 1 and meaningful[0] == matches[0].group().rstrip(),
                    'unsupported_yarn_block')
            for line in meaningful[1:]:
                require(line.startswith('  ') and not line.startswith('  \t'),
                        'unsupported_yarn_block')
                if not line.startswith('   '):
                    require(bool(re.match(r'^  [a-zA-Z][a-zA-Z0-9]*:', line)),
                            'unsupported_yarn_block')
                if meaningful[0] == '__metadata:':
                    require(bool(re.match(r'^  (?:version|cacheKey): ', line)),
                            'unsupported_yarn_block')
        headers = list(re.finditer(header_pattern, data))
        yield str(file.relative_to(root)), data, headers


def yarn_git_entries(root):
    entries = {}
    for relative, data, headers in yarn_files(root):
        covered = []
        for match in headers:
            header = match.group().rstrip()
            protocols = set(re.findall(r'@([a-z][a-z0-9+.-]*):', header))
            protocols -= YARN_PROTOCOLS
            if not protocols:
                continue
            # Trivy skips Git sources. Admit only unchanged, commit-pinned
            # GitHub entries; new/edited opaque code cannot be assessed safely.
            require(protocols == {'https'}, 'unsupported_yarn_source')
            end = data.find('\n\n', match.start())
            end = end if end >= 0 else len(data)
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
            identity = (relative, header)
            require(identity not in entries, 'unsupported_yarn_source')
            entries[identity] = digest(block.encode())
            covered.append((match.start(), end))
        # Do not overlook sources in indented/nonstandard headers or dependency
        # fields. Trivy silently skips some Git protocols without warning.
        for match in re.finditer(r'@([a-z][a-z0-9+.-]*):', data):
            if match[1] not in YARN_PROTOCOLS:
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
            if protocols - YARN_PROTOCOLS:
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


def yarn_range(value):
    # normalizeDependency and normalizeLocator prefix npm: to semver ranges and
    # tags, never to values with a protocol. Ranges may contain JavaScript
    # whitespace (JS_SPACE), whose spelling is kept and compared exactly. Other
    # strings of these characters cannot resolve, so no lockfile edge or
    # locator carries them.
    if ':' not in value and re.fullmatch('[' + JS_SPACE + r'0-9A-Za-z.^~<>=|*+_-]*', value):
        return 'npm:' + value
    return value


def yarn_resolution_key(key):
    """Parse a resolutions key with Yarn's grammar; None where Yarn skips it.

    resolution := specifier '/' specifier | specifier
    specifier := fullName '@' description | fullName
    fullName := '@' ident '/' ident | ident; ident := [^/@]+; description := [^/]+
    """
    def specifier(start):
        name = re.match(r'@[^/@]+/[^/@]+|[^/@]+', key[start:])
        if name is None:
            return None
        end = start + name.end()
        description = re.match(r'@([^/]+)', key[end:])
        if description:
            return (name[0], description[1]), end + description.end()
        return (name[0], None), end
    # Yarn rejects legacy glob keys; like keys that do not parse completely,
    # the manifest then skips them.
    if re.match(r'\*{1,2}/', key):
        return None
    first = specifier(0)
    if first is None:
        return None
    if key[first[1]:first[1] + 1] == '/':
        second = specifier(first[1] + 1)
        if second is not None:
            return (first[0], second[0]) if second[1] == len(key) else None
    return ((None, None), first[0]) if first[1] == len(key) else None


def yarn_resolutions(manifest):
    """Parse manifest resolutions as (parent, reference, name, range, value)."""
    resolutions = manifest.get('resolutions') or {}
    require(isinstance(resolutions, dict), 'unsupported_yarn_source')
    patterns = []
    for key, value in resolutions.items():
        # The manifest skips non-string values and keys it cannot parse.
        parsed = yarn_resolution_key(key) if isinstance(value, str) else None
        if parsed is not None:
            (parent, reference), (name, constraint) = parsed
            patterns.append((parent, reference and yarn_range(reference), name,
                             constraint and yarn_range(constraint), yarn_range(value)))
    return patterns


def yarn_edge(patterns, parent, name, constraint):
    """Return the lockfile descriptor Yarn resolves for a dependency edge.

    Mirrors Project's reduceDependency: the first pattern whose parent
    matches the exact locator and whose dependency matches the edge's range
    replaces it. The lockfile edge keeps the original range.
    """
    for parent_name, reference, child, child_range, value in patterns:
        if parent_name is not None and (parent_name, reference or parent[1]) != parent:
            continue
        if child == name and child_range in (None, constraint):
            return name + '@' + value
    return name + '@' + constraint


def yarn_production(root, inventory):
    """Return (lockfile, ID) instances and admitted Git entries in production.

    Trivy's dev classification can lose production edges: it skips Git blocks
    and edges to them, matches a renamed alias by its resolved name in later
    workspaces, and does not decode JSON-escaped ranges. Reachability is
    computed independently from workspace manifests and decoded lockfile
    edges, seeded also with every package Trivy itself classifies as
    production (a package missing from the inventory counts as production).
    """
    git_entries = set(yarn_git_entries(root))
    instances, git = set(), set()
    for relative, data, _ in yarn_files(root):
        results = [r for r in inventory['Results'] if r.get('Target') == relative
                   and r.get('Class') == 'lang-pkgs' and r.get('Type') == 'yarn']
        dev = {text(p, 'ID'): p.get('Dev') is True for r in results for p in list_field(r, 'Packages')}
        blocks, descriptors = [], {}
        manifest = PurePosixPath(relative).parent / 'package.json'
        manifest = read_json(source_file(root, str(manifest))) if (root / manifest).is_file() else {}
        require(isinstance(manifest, dict), 'unsupported_yarn_source')
        patterns = yarn_resolutions(manifest)
        for block in data.split('\n\n'):
            header = next((line for line in block.split('\n') if re.match(r'[^\s#]', line)), '')
            if not header.startswith('"'):
                continue
            selector, _ = json.JSONDecoder().raw_decode(header)
            resolution = re.search(r'(?m)^  resolution: ("(?:[^"\\]|\\.)*")$', block)
            locator = re.fullmatch(YARN_NAME + r'@(.+)', json.loads(resolution[1]) if resolution else '')
            require(locator is not None, 'unsupported_yarn_source')
            version = re.search(r'(?m)^  version: (.+)$', block)
            section, edges = None, []
            for line in block.split('\n'):
                if line.startswith('  ') and not line.startswith('   '):
                    section = line.strip()
                elif section == 'dependencies:' and line.startswith('    '):
                    edge = re.fullmatch(r'    ("(?:[^"\\]|\\.)*"|[^\s:]+): ("(?:[^"\\]|\\.)*")\s*', line)
                    require(edge is not None, 'unsupported_yarn_source')
                    name = json.loads(edge[1]) if edge[1].startswith('"') else edge[1]
                    edges.append((name, json.loads(edge[2])))
            workspace = re.fullmatch(r'workspace:(.+)', locator[2])
            if workspace:
                # Workspace blocks merge dev and production edges; the manifest decides.
                manifest = read_json(source_file(root, str(PurePosixPath(relative).parent
                                                           / workspace[1] / 'package.json')))
                require(isinstance(manifest, dict), 'unsupported_yarn_source')
                names = {name for field in ('dependencies', 'optionalDependencies')
                         for name in manifest.get(field) or {}}
                edges = [(name, target) for name, target in edges if name in names]
            version = version[1].strip('"') if version else ''
            for pattern in selector.split(', '):
                descriptors[pattern] = (len(blocks), yarn_selector_name(pattern))
            blocks.append({'git': (relative, header) if (relative, header) in git_entries else None,
                           'workspace': bool(workspace), 'version': version, 'edges': edges,
                           'locator': (locator[1], locator[2]),
                           'names': {yarn_selector_name(p) for p in selector.split(', ')}})
        queue = []
        for index, block in enumerate(blocks):
            if block['workspace']:
                queue.append((index, None))
            elif not block['git']:
                queue += [(index, name) for name in block['names']
                          if not dev.get(name + '@' + block['version'], False)]
        seen = set()
        while queue:
            index, name = queue.pop()
            if (index, name) in seen:
                continue
            seen.add((index, name))
            block = blocks[index]
            if block['git']:
                git.add(block['git'])
            elif name:
                instances.add((relative, name + '@' + block['version']))
            for edge, constraint in block['edges']:
                descriptor = yarn_edge(patterns, block['locator'], edge, constraint)
                require(descriptor in descriptors, 'unsupported_yarn_reachability')
                queue.append(descriptors[descriptor])
    return instances, git


def promote_yarn_reachability(root, inventory, production):
    """Treat every production-reachable package instance as production.

    Returns the corrected production report and the admitted Git entries
    reachable from production. Promoted instances take their findings from
    the complete inventory scan, which includes development dependencies.
    """
    instances, git = yarn_production(root, inventory)
    results = []
    for result in production['Results']:
        if (isinstance(result, dict) and result.get('Class') == 'lang-pkgs'
                and result.get('Type') == 'yarn'):
            assessed = {text(p, 'ID') for p in list_field(result, 'Packages')}
            missing = {i for t, i in instances if t == result.get('Target')} - assessed
            if missing:
                source = [r for r in inventory['Results'] if isinstance(r, dict)
                          and r.get('Target') == result.get('Target')
                          and r.get('Class') == 'lang-pkgs' and r.get('Type') == 'yarn']
                require(len(source) == 1, 'missing_lockfile_inventory')
                packages = [dict(p, Dev=False) for p in list_field(source[0], 'Packages')
                            if text(p, 'ID') in missing]
                require(len(packages) == len(missing), 'missing_yarn_package')
                result = dict(result, Packages=list_field(result, 'Packages') + packages,
                              Vulnerabilities=list_field(result, 'Vulnerabilities')
                              + [v for v in list_field(source[0], 'Vulnerabilities')
                                 if isinstance(v, dict) and v.get('PkgID') in missing])
        results.append(result)
    return dict(production, Results=results), git


def supported_yarn_dependency(constraint):
    require(isinstance(constraint, str), 'unsupported_yarn_source')
    # Trivy drops patch edges even if the underlying package is in inventory;
    # that can incorrectly retain its dev classification after a promotion.
    require(not re.search(r'(?:^|@)patch:', constraint), 'unsupported_yarn_patch_dependency')


def yarn_selector_name(pattern):
    name = re.match(YARN_NAME + '@', pattern)
    require(name is not None, 'unsupported_yarn_source')
    return name[1]


def split_yarn_groups(data):
    # Trivy names a block and all of its patterns after the first selector, so
    # edges and direct dependencies through other names (npm aliases) are lost
    # and can hide production paths. Give each selector name its own block.
    blocks = []
    split = False
    for block in data.rstrip('\n').split('\n\n'):
        lines = block.split('\n')
        index = next((i for i, line in enumerate(lines) if re.match(r'[^\s#]', line)), None)
        if index is None or not lines[index].startswith('"'):
            blocks.append(block)
            continue
        try:
            selector, suffix = json.JSONDecoder().raw_decode(lines[index])
        except ValueError:
            raise GateError('unsupported_yarn_source') from None
        require(isinstance(selector, str), 'unsupported_yarn_source')
        groups = {}
        for pattern in selector.split(', '):
            groups.setdefault(yarn_selector_name(pattern), []).append(pattern)
        if len(groups) == 1:
            blocks.append(block)
            continue
        split = True
        tail = lines[index][suffix:]
        for patterns in groups.values():
            lines[index] = json.dumps(', '.join(patterns)) + tail
            blocks.append('\n'.join(lines))
    return '\n\n'.join(blocks) + '\n' if split else data


def project_yarn(root, destination):
    require(not destination.resolve().is_relative_to(root.resolve()), 'invalid_projection_destination')
    destination.mkdir()
    for file in root.rglob('package.json'):
        relative = str(file.relative_to(root))
        target = destination / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        source = source_file(root, relative)
        manifest = read_json(source)
        require(isinstance(manifest, dict), 'unsupported_yarn_source')
        for field in ('dependencies', 'optionalDependencies', 'devDependencies'):
            dependencies = manifest.get(field, {})
            require(isinstance(dependencies, dict), 'unsupported_yarn_source')
            for constraint in dependencies.values():
                supported_yarn_dependency(constraint)
        target.write_bytes(source.read_bytes())
    for relative, data, _ in yarn_files(root):
        lines = []
        skipping = False
        in_dependencies = False
        for line in split_yarn_groups(data).splitlines(keepends=True):
            # These Yarn installation hints are not runtime dependencies. Trivy
            # otherwise interprets their descriptor keys as package headers.
            if re.fullmatch(r'  (?:dependenciesMeta|peerDependenciesMeta):\s*', line):
                skipping = True
                continue
            if skipping and line.startswith('   '):
                continue
            if line.strip() and not line.startswith('#'):
                skipping = False
            if line.startswith('  ') and not line.startswith('   '):
                in_dependencies = line.rstrip() == '  dependencies:'
            elif line.strip() and not line.startswith('    ') and not line.startswith('#'):
                in_dependencies = False
            if in_dependencies and line.startswith('    '):
                dependency = re.fullmatch(r'    (?:"(?:[^"\\]|\\.)*"|[^\s:]+): ("(?:[^"\\]|\\.)*")\s*', line)
                require(dependency is not None, 'unsupported_yarn_source')
                supported_yarn_dependency(json.loads(dependency[1]))
            lines.append(line)
        target = destination / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(''.join(lines))


def yarn_packages(root):
    """Map each expected Trivy (ID, version) to the resolved npm package name."""
    expected = {}
    for relative, data, headers in yarn_files(root):
        expected[relative] = {}
        for match in headers:
            header = match.group().rstrip()
            if header == '__metadata:':
                continue
            try:
                selector, suffix = json.JSONDecoder().raw_decode(header)
                require(isinstance(selector, str) and header[suffix:].strip() == ':',
                        'unsupported_yarn_source')
            except ValueError:
                raise GateError('unsupported_yarn_source') from None
            end = data.find('\n\n', match.start())
            block = data[match.start():end if end >= 0 else len(data)]
            resolutions = re.findall(r'(?m)^  resolution: ("(?:[^"\\]|\\.)*")$', block)
            require(len(resolutions) == 1, 'unsupported_yarn_source')
            resolution = json.loads(resolutions[0])
            if '@workspace:' in resolution:
                continue
            names = {pattern.split('@npm:', 1)[0] for pattern in selector.split(', ')
                     if '@npm:' in pattern}
            npm_resolution = re.fullmatch(YARN_NAME + r'@npm:(.+)', resolution)
            if '@patch:' in resolution:
                patched = re.fullmatch(YARN_NAME + r'@patch:([^#]+)#.+', resolution)
                require(patched is not None, 'unsupported_yarn_source')
                npm_resolution = re.fullmatch(YARN_NAME + r'@npm:(.+)', unquote(patched[2]))
                require(npm_resolution is not None and patched[1] == npm_resolution[1]
                        and all(pattern.startswith(patched[1] + '@patch:')
                                for pattern in selector.split(', ')), 'unsupported_yarn_source')
                # Trivy skips patch descriptors. The underlying npm version
                # must still appear in its inventory, or coverage is incomplete.
            if npm_resolution:
                names.add(npm_resolution[1])
            if not names:
                continue
            versions = re.findall(r'(?m)^  version: (.+)$', block)
            require(len(versions) == 1, 'unsupported_yarn_source')
            version = json.loads(versions[0]) if versions[0].startswith('"') else versions[0]
            require(isinstance(version, str) and bool(version), 'unsupported_yarn_source')
            if npm_resolution:
                require(version == npm_resolution[2], 'unsupported_yarn_source')
                for pattern in selector.split(', '):
                    name, separator, constraint = pattern.partition('@npm:')
                    require(not separator or name == npm_resolution[1]
                            or constraint.startswith(npm_resolution[1] + '@'), 'unsupported_yarn_source')
            # The projection gives every selector name its own Trivy instance.
            for pattern in selector.split(', '):
                name = yarn_selector_name(pattern)
                resolved = npm_resolution[1] if npm_resolution else name
                # Trivy keys packages by name@version. Different packages behind
                # one ID (e.g. two same-name aliases) merge into one instance.
                require(expected[relative].setdefault((name + '@' + version, version),
                                                      resolved) == resolved,
                        'ambiguous_yarn_package')
    return expected


def verify_yarn_coverage(root, inventory, production):
    """Return production alias instances Trivy did not assess by resolved name."""
    for report in (inventory, production):
        require(isinstance(report, dict) and report.get('SchemaVersion') == 2
                and report.get('ArtifactType') == 'filesystem'
                and report.get('Trivy', {}).get('Version') == VERSION
                and isinstance(report.get('Results'), list), 'invalid_inventory_report')
    aliases = {}
    for target, expected in yarn_packages(root).items():
        matches = []
        for report in (inventory, production):
            results = [r for r in report['Results'] if isinstance(r, dict)
                       and r.get('Target') == target and r.get('Class') == 'lang-pkgs'
                       and r.get('Type') == 'yarn']
            require(len(results) == 1 and not results[0].get('Error')
                    and not results[0].get('Errors'), 'missing_lockfile_inventory')
            matches.append(list_field(results[0], 'Packages'))
        # ID retains the selector name when Trivy rewrites npm alias Names.
        # A canonical Name/Version cannot stand in for a missing alias instance.
        seen = {(text(p, 'ID'), p.get('Version', '')) for p in matches[0]}
        require(expected.keys() <= seen, 'missing_yarn_package')
        production_ids = {(text(p, 'ID'), p.get('Version', '')) for p in matches[1]}
        require(all((text(p, 'ID'), p.get('Version', '')) in production_ids
                    for p in matches[0] if not p.get('Dev')), 'missing_production_package')
        # Trivy renames only direct aliases. Transitive or resolutions-only
        # aliases keep the selector Name, so advisories would be looked up for
        # the wrong package.
        aliases[target] = {}
        for package in matches[1]:
            key = (text(package, 'ID'), package.get('Version', ''))
            if key in expected and package.get('Name') != expected[key]:
                aliases[target][key[0]] = (expected[key], key[1])
    return aliases


def assess_yarn_aliases(binary, production, aliases, destination, cache, config, env):
    """Replace wrong-name advisories of alias instances with resolved-name ones."""
    destination.mkdir()
    for target, instances in aliases.items():
        if not instances:
            continue
        entries = []
        for name, version in sorted(set(instances.values())):
            require(bool(re.fullmatch(YARN_NAME, name))
                    and bool(re.fullmatch(r'[0-9A-Za-z][0-9A-Za-z.+-]*', version)),
                    'unsupported_yarn_source')
            identity = json.dumps(name + '@npm:' + version)
            entries.append(f'{identity}:\n  version: {version}\n  resolution: {identity}\n')
        lockfile = destination / target
        lockfile.parent.mkdir(parents=True, exist_ok=True)
        # No manifest: every resolved package is assessed as production.
        lockfile.write_text('\n'.join(entries))
    report = scan(binary, destination, destination.parent / (destination.name + '.json'),
                  cache, config, env, scanners='vuln')
    require(isinstance(report, dict) and isinstance(report.get('Results'), list),
            'invalid_inventory_report')
    # A partial result could replace alias findings with an incomplete list.
    require(all(isinstance(r, dict) and not r.get('Error') and not r.get('Errors')
                for r in report['Results']), 'result_error')
    results = []
    for result in production['Results']:
        instances = aliases.get(result.get('Target')) if (
            result.get('Class') == 'lang-pkgs' and result.get('Type') == 'yarn') else None
        if instances:
            assessed = [r for r in report['Results'] if isinstance(r, dict)
                        and r.get('Target') == result['Target']
                        and r.get('Class') == 'lang-pkgs' and r.get('Type') == 'yarn']
            require(len(assessed) == 1, 'missing_lockfile_inventory')
            packages = {(text(p, 'ID'), p.get('Version', ''))
                        for p in list_field(assessed[0], 'Packages')}
            require(all((name + '@' + version, version) in packages
                        for name, version in instances.values()), 'missing_yarn_package')
            advisories = list_field(assessed[0], 'Vulnerabilities')
            vulnerabilities = [v for v in list_field(result, 'Vulnerabilities')
                               if not isinstance(v, dict) or v.get('PkgID') not in instances]
            # Each alias instance retains its own findings, as direct aliases do.
            for package, (name, version) in sorted(instances.items()):
                vulnerabilities += [dict(v, PkgID=package) for v in advisories
                                    if isinstance(v, dict)
                                    and v.get('PkgID') == name + '@' + version]
            result = dict(result, Vulnerabilities=vulnerabilities)
        results.append(result)
    return dict(production, Results=results)


def scan(binary, root, output, cache, config, env, frozen=True, allowed_warnings=None,
         scanners=None, include_dev_deps=False):
    stdout, stderr = execute(scan_command(binary, root, output, cache, config, frozen,
                                         scanners, include_dev_deps),
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


def inline_suppression(data):
    # Mirror the pinned IaC ignore parser: on any line, a token separated by
    # ASCII spaces and trimmed with Go's strings.TrimSpace that starts with the
    # tfsec or trivy prefix after optional leading '#', '/' or '*' characters,
    # with an ignore key among its colon-separated sections. Unicode whitespace
    # inside a token (e.g. NBSP in a section value) does not split it.
    if b'tfsec:' not in data and b'trivy:' not in data:
        return False
    for line in data.decode('utf-8', 'surrogateescape').split('\n'):
        for token in line.strip(GO_SPACE).split(' '):
            token = token.strip(GO_SPACE).lstrip('#/*')
            for prefix in ('tfsec:', 'trivy:'):
                if token.startswith(prefix) and 'ignore' in token[len(prefix):].split(':')[0::2]:
                    return True
    return False


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
        require(not inline_suppression(data), 'inline_suppression')
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
            roots = {}
            for name in ('base', 'merge'):
                result['phase'] = name
                roots[name] = private / name
                export_tree(repo, expected[name], roots[name])
            allowed_warnings = yarn_git_warnings(roots['base'], roots['merge'])
            result['opaqueGitDependencyCount'] = sum(allowed_warnings['merge'].values())
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
            scans = {}
            git_production = {}
            for name in ('base', 'merge'):
                result['phase'] = name
                root = roots[name]
                require(snapshot(cache) == database, 'database_changed')
                report = scan(binary, root, private / (name + '.json'), cache, config, env,
                              allowed_warnings=allowed_warnings[name])
                require(isinstance(report, dict) and isinstance(report.get('Results'), list),
                        'missing_results')
                require(all(isinstance(r, dict) and not r.get('Error') and not r.get('Errors')
                            for r in report['Results']), 'result_error')
                projected = private / (name + '-yarn')
                project_yarn(root, projected)
                inventory = scan(binary, projected, private / (name + '-inventory.json'),
                                 cache, config, env, allowed_warnings=allowed_warnings[name],
                                 scanners='vuln', include_dev_deps=True)
                production = scan(binary, projected, private / (name + '-production.json'),
                                  cache, config, env, allowed_warnings=allowed_warnings[name],
                                  scanners='vuln')
                production, git_production[name] = promote_yarn_reachability(
                    root, inventory, production)
                aliases = verify_yarn_coverage(root, inventory, production)
                if any(aliases.values()):
                    production = assess_yarn_aliases(binary, production, aliases,
                                                     private / (name + '-aliases'),
                                                     cache, config, env)
                # Original trees retain secret/misconfiguration and other ecosystem
                # coverage. Only Yarn vulnerability Results use the projection.
                yarn_targets = {r['Target'] for r in production['Results']
                                if r.get('Class') == 'lang-pkgs' and r.get('Type') == 'yarn'}
                report = dict(report, Results=[r for r in report['Results']
                    if not (r.get('Class') == 'lang-pkgs' and r.get('Type') == 'yarn'
                            and r.get('Target') in yarn_targets)]
                    + [r for r in production['Results']
                       if r.get('Class') == 'lang-pkgs' and r.get('Type') == 'yarn'])
                require(snapshot(cache) == database, 'database_changed')
                require(digest(binary.read_bytes()) == binary_hash, 'binary_changed')
                scans[name] = collect(report, root, key)
                scans[name]['metadata'] = dict(expected, revision=expected[name],
                    complete=True, database=database, binary=binary_hash,
                    policy=digest(canonical(POLICY)))
                # Persist only the sanitized schema, including when scan two fails.
                result[name] = {k: v for k, v in scans[name].items() if k != 'targets'}
            verify_pair(scans['base'], scans['merge'], expected)
            # Unscanned Git sources must not become production-reachable.
            require(git_production['merge'] <= git_production['base'],
                    'promoted_unsupported_dependency')
            verify_target_coverage(scans['base']['targets'], scans['merge']['targets'],
                                   private / 'merge')
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
