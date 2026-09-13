#!/usr/bin/env python3
"""Compile and exercise native trace gates and file delivery without a device."""
import sys
if not __debug__:
    raise RuntimeError('Optimized Python disables verification and is unsupported')
import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
import platform
import plistlib
import re
import shutil
import stat
import subprocess
from pathlib import Path

HERE = Path(__file__).resolve().parent
SOURCE_NAMES = ['RNCOneKeyWebEmbedAssets.h', 'RNCOneKeyWebEmbedAssets.m', 'RNCWebViewImpl.m']
RUN_ID = '00112233445566778899aabbccddeeff'

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def plain_file(path):
    if not stat.S_ISREG(path.lstat().st_mode):
        raise ValueError('Expected a regular source or artifact file')
    return path

def execute(command, log, timeout=120):
    result = subprocess.run(command, text=True, capture_output=True, timeout=timeout)
    log.write_text(result.stdout + result.stderr)
    return result

def fixture_assets(args, directory):
    supplied = [args.artifact, args.manifest, args.manifest_sha256]
    if any(supplied) and not all(supplied):
        raise ValueError('Exact artifact mode requires artifact, manifest and manifest SHA256')
    if all(supplied):
        artifact = args.artifact.resolve(strict=True)
        if not re.fullmatch('[a-f0-9]{64}', args.manifest_sha256) or digest(plain_file(args.manifest)) != args.manifest_sha256:
            raise ValueError('Exact artifact manifest digest mismatch')
        manifest = json.loads(args.manifest.read_text())
        actual = {}
        for path in sorted(artifact.rglob('*')):
            mode = path.lstat().st_mode
            if not (stat.S_ISDIR(mode) or stat.S_ISREG(mode)):
                raise ValueError('Artifact contains a non-regular entry')
            if stat.S_ISREG(mode):
                actual[path.relative_to(artifact).as_posix()] = digest(path)
        if len(actual) != 43 or actual != manifest:
            raise ValueError('Exact 43-file inventory mismatch')
        selected = {}
        for chunk, name in [('871', 'loader'), ('693', 'sdk')]:
            matches = [relative for relative in actual if re.fullmatch('static/js/' + chunk + r'\.[a-f0-9]+\.chunk\.js', relative)]
            if len(matches) != 1:
                raise ValueError('Expected exactly one public Kaspa resource per class')
            relative = matches[0]
            target = directory / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(artifact / relative, target)
            if digest(target) != actual[relative]:
                raise ValueError('Copied resource changed')
            selected[name] = {'path': relative, 'bytes': target.stat().st_size, 'sha256': digest(target)}
        return selected, {'mode': 'exact-public-candidate-resource-bytes', 'manifestSha256': args.manifest_sha256, 'artifactFileCount': 43}
    selected = {}
    for chunk, name, size in [('871', 'loader', 379907), ('693', 'sdk', 15594038)]:
        relative = 'static/js/' + chunk + '.0123456789.chunk.js'
        target = directory / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        # Public transport bytes only. This fixture is never executed as JavaScript.
        block = b'/* OneKey native reader fixture; no SDK code or private data. */\n' * 1024
        with target.open('wb') as stream:
            remaining = size
            while remaining:
                part = block[:min(remaining, len(block))]
                stream.write(part)
                remaining -= len(part)
        selected[name] = {'path': relative, 'bytes': size, 'sha256': digest(target)}
    return selected, {'mode': 'deterministic-public-transport-bytes', 'manifestSha256': '0' * 64}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--source-directory', type=Path)
    parser.add_argument('--real-timer', action='store_true', help='Also exercise actual 65-second utility scheduling and full-budget system log submission; allow 80 seconds')
    parser.add_argument('--artifact', type=Path)
    parser.add_argument('--manifest', type=Path)
    parser.add_argument('--manifest-sha256')
    args = parser.parse_args()
    if args.source_directory is None:
        args.source_directory = HERE.parents[4] / 'node_modules/react-native-webview/apple'
    if platform.system() != 'Darwin':
        raise RuntimeError('This test requires macOS, Xcode and the system unifdef; it never skips silently')
    out = args.output.resolve()
    out.mkdir(parents=True, exist_ok=False)
    source = out / 'source'
    source.mkdir()
    source_hashes = {}
    for name in SOURCE_NAMES:
        original = plain_file(args.source_directory / name)
        shutil.copyfile(original, source / name)
        source_hashes[name] = digest(source / name)
    test_names = ['TraceHarness.m', 'BufferHarness.m', 'ActualLogTimerHarness.m', 'deferred_trace_parser.py']
    test_hashes = {}
    for name in test_names:
        original = plain_file(HERE / name)
        shutil.copyfile(original, out / name)
        test_hashes[name] = digest(out / name)
    baseline = json.loads((HERE / 'disabled-source-baseline.json').read_text())
    equivalence = []
    for profile, flags in [('off', ['-UONEKEY_MOBILE_LOCKDOWN_NATIVE_TRACE', '-UDEBUG']),
                           ('zero', ['-DONEKEY_MOBILE_LOCKDOWN_NATIVE_TRACE=0', '-UDEBUG']),
                           ('debug', ['-DONEKEY_MOBILE_LOCKDOWN_NATIVE_TRACE=1', '-DDEBUG=1'])]:
        for name in SOURCE_NAMES:
            result = execute(['/usr/bin/unifdef', '-k', *flags, str(source / name)], out / (profile + '-' + name + '.preprocess.log'))
            if result.returncode not in [0, 1]:
                raise RuntimeError('Native source preprocessing failed')
            normalized = '\n'.join(line.strip() for line in result.stdout.splitlines() if line.strip())
            if hashlib.sha256(normalized.encode()).hexdigest() != baseline[profile][name]:
                raise RuntimeError('Disabled native business source changed: ' + profile + '/' + name)
            if 'traceLifecycle' in normalized or 'OneKeyNativeWebEmbedDeferredV1' in normalized:
                raise RuntimeError('Disabled source retained diagnostics')
            equivalence.append({'profile': profile, 'file': name, 'passed': True})
    app = out / 'TraceHarness.app'
    mac = app / 'Contents/MacOS'
    resources = app / 'Contents/Resources'
    mac.mkdir(parents=True)
    resources.mkdir(parents=True)
    assets, artifact = fixture_assets(args, resources / 'web-embed')
    identity = {'runId': RUN_ID, 'manifestDigest': artifact['manifestSha256'], 'version': '1.0.0', 'buildNumber': '1', 'bundleVersion': '1'}
    info = {'CFBundleIdentifier': 'so.onekey.wallet', 'CFBundleExecutable': 'TraceHarness', 'CFBundlePackageType': 'APPL', 'CFBundleShortVersionString': identity['version'], 'CFBundleVersion': identity['buildNumber'], 'BUNDLE_VERSION': identity['bundleVersion'], 'OneKeyMobileLockdownNativeTrace': identity}
    (app / 'Contents/Info.plist').write_bytes(plistlib.dumps(info))
    constants = {'ONEKEY_MOBILE_LOCKDOWN_NATIVE_TRACE': 1,
        'ONEKEY_MOBILE_LOCKDOWN_NATIVE_TRACE_RUN_ID': RUN_ID,
        'ONEKEY_MOBILE_LOCKDOWN_NATIVE_TRACE_MANIFEST': identity['manifestDigest'],
        'ONEKEY_MOBILE_LOCKDOWN_NATIVE_TRACE_VERSION': identity['version'],
        'ONEKEY_MOBILE_LOCKDOWN_NATIVE_TRACE_BUILD': identity['buildNumber'],
        'ONEKEY_MOBILE_LOCKDOWN_NATIVE_TRACE_BUNDLE': identity['bundleVersion'],
        'ONEKEY_TRACE_TEST_LOADER_PATH': assets['loader']['path'],
        'ONEKEY_TRACE_TEST_SDK_PATH': assets['sdk']['path'],
        'ONEKEY_TRACE_TEST_LOADER_BYTES': assets['loader']['bytes'],
        'ONEKEY_TRACE_TEST_SDK_BYTES': assets['sdk']['bytes']}
    config = out / 'TraceConfig.h'
    config.write_text(''.join('#define ' + key + ' ' + json.dumps(value) + '\n' for key, value in constants.items()))
    base = ['xcrun', '--sdk', 'macosx', 'clang', '-fobjc-arc', '-fmodules', '-Werror',
            '-fmodules-cache-path=' + str(out / 'module-cache'), '-I', str(source)]
    profiles = []
    for profile, flags in [('off', []), ('zero', ['-DONEKEY_MOBILE_LOCKDOWN_NATIVE_TRACE=0']),
                           ('debug', ['-include', str(config), '-DDEBUG=1']), ('release', ['-include', str(config)])]:
        obj = out / (profile + '.o')
        result = execute(base + flags + ['-c', str(source / SOURCE_NAMES[1]), '-o', str(obj)], out / (profile + '-compile.log'))
        if result.returncode:
            raise RuntimeError('Native compiler profile failed: ' + profile)
        strings = subprocess.run(['strings', str(obj)], check=True, capture_output=True, text=True).stdout
        symbols = subprocess.run(['nm', str(obj)], check=True, capture_output=True, text=True).stdout
        if ('OneKeyNativeWebEmbedDeferredV1' in strings) != (profile == 'release'):
            raise RuntimeError('Native marker presence does not match the compiler gate')
        if profile != 'release' and ('OKTrace' in symbols or 'traceLifecycle' in symbols):
            raise RuntimeError('Disabled object contains native trace symbols')
        profiles.append({'profile': profile, 'passed': True})
    rejected = execute(base + ['-DONEKEY_MOBILE_LOCKDOWN_NATIVE_TRACE=1', '-fsyntax-only', str(source / SOURCE_NAMES[1])], out / 'incomplete-identity.log')
    if rejected.returncode == 0 or 'Native trace requires every exact public E2E identity constant' not in rejected.stderr:
        raise RuntimeError('Incomplete native compiler identity was not rejected')
    compiled = execute(base + ['-framework', 'Foundation', '-framework', 'WebKit', str(out / 'TraceHarness.m'), '-o', str(mac / 'TraceHarness')], out / 'harness-compile.log')
    if compiled.returncode:
        raise RuntimeError('Native callback harness compilation failed')
    reports = []
    for mode in ['core', 'budget', 'disabled-identity']:
        executable = mac / 'TraceHarness'
        if mode == 'disabled-identity':
            disabled = out / 'TraceHarnessDisabled.app'
            shutil.copytree(app, disabled)
            wrong = dict(info)
            wrong['CFBundleIdentifier'] = 'so.onekey.lavamoat.invalid-trace-identity'
            (disabled / 'Contents/Info.plist').write_bytes(plistlib.dumps(wrong))
            executable = disabled / 'Contents/MacOS/TraceHarness'
        report = out / (mode + '-report.json')
        result = execute([str(executable), str(report), mode], out / (mode + '-run.log'))
        if result.returncode:
            raise RuntimeError('Native callback/identity harness failed: ' + mode)
        checks = json.loads(report.read_text())
        if not checks['passed'] or not checks['checks'] or not all(check['passed'] for check in checks['checks']):
            raise RuntimeError('Native assertion report did not pass')
        reports.append({'mode': mode, 'checks': len(checks['checks']), 'reportSha256': digest(report)})
    def make_program(name, source_name, flags=()):
        program_app = out / (name + '.app')
        mac_dir = program_app / 'Contents/MacOS'
        mac_dir.mkdir(parents=True)
        (program_app / 'Contents/Resources').mkdir()
        (program_app / 'Contents/Info.plist').write_bytes(plistlib.dumps(info))
        program = mac_dir / 'TraceHarness'
        result = execute(base + list(flags) + ['-framework', 'Foundation', '-framework', 'WebKit',
                         str(out / source_name), '-o', str(program)], out / (name + '-compile.log'))
        if result.returncode:
            raise RuntimeError('Native buffer/timer program compilation failed: ' + name)
        return program

    def run_buffer(program, mode, label):
        report = out / (label + '-report.json')
        result = execute([str(program), str(report), mode], out / (label + '-run.log'), timeout=80)
        if result.returncode or 'ThreadSanitizer' in result.stderr:
            raise RuntimeError('Native buffer/timer test failed: ' + label)
        checks = json.loads(report.read_text())
        if not checks.get('passed') or not checks.get('checks') or not all(check['passed'] for check in checks['checks']):
            raise RuntimeError('Native buffer assertion report did not pass')
        return {'mode': label, 'checks': len(checks['checks']), 'reportSha256': digest(report)}

    buffer_program = make_program('BufferHarness', 'BufferHarness.m')
    buffer_reports = []
    for mode in ['clock', 'partial', 'late-publication', 'late-reservation', 'concurrency']:
        buffer_reports.append(run_buffer(buffer_program, mode, 'buffer-' + mode))
    tsan_program = make_program('BufferTSan', 'BufferHarness.m', ['-fsanitize=thread', '-g'])
    tsan_report = run_buffer(tsan_program, 'concurrency', 'buffer-tsan')
    parsed = execute([sys.executable, str(out / 'deferred_trace_parser.py')], out / 'parser-run.log')
    if parsed.returncode:
        raise RuntimeError('Fixed deferred-log parser test failed')
    parser_report = json.loads(parsed.stdout)
    if not parser_report.get('passed') or parser_report.get('checks', 0) < 25:
        raise RuntimeError('Fixed deferred-log parser did not exercise all negative cases')
    timer_report = {'status': 'not-requested', 'option': '--real-timer'}
    if args.real_timer:
        log_program = make_program('ActualLogTimerHarness', 'ActualLogTimerHarness.m')
        def actual_log_timer():
            report = out / 'actual-log-timer-report.json'
            result = execute([str(log_program), str(report)], out / 'actual-log-timer-run.log', timeout=80)
            if result.returncode:
                raise RuntimeError('Actual full-budget native log timer failed')
            values = json.loads(report.read_text())
            if not values.get('passed') or values.get('timerCalls') != 1 or values.get('records') != 256 or not 65000 <= values.get('actualUtilityFlushCompletedMs', 0) < 75000:
                raise RuntimeError('Actual native timer missed the unchanged observation window')
            return {'reportSha256': digest(report), 'completedMs': values['actualUtilityFlushCompletedMs']}
        # Independent command-line fixture processes; no app install or device.
        with ThreadPoolExecutor(max_workers=2) as pool:
            buffered = pool.submit(run_buffer, buffer_program, 'real-timer', 'buffer-real-timer')
            logged = pool.submit(actual_log_timer)
            timer_report = {'status': 'passed', 'buffered': buffered.result(), 'actualLogging': logged.result()}
    for name, expected in test_hashes.items():
        if digest(plain_file(HERE / name)) != expected:
            raise RuntimeError('Native test source changed while the test ran')
    for name in SOURCE_NAMES:
        if digest(plain_file(args.source_directory / name)) != source_hashes[name]:
            raise RuntimeError('Native source changed while the test ran')
    summary = {'passed': True, 'scope': 'Real native helper/file reader with fake WK tasks and a harness-only log sink/outer exception boundary. No simulator, OneKey app, Hermes RPC, wallet data, SDK execution or app acceptance.', 'artifact': artifact, 'resources': assets, 'sourceHashes': source_hashes, 'equivalence': equivalence, 'compilerProfiles': profiles, 'incompleteIdentityRejected': True, 'runtimeChecks': reports, 'testSourceHashes': test_hashes, 'bufferChecks': buffer_reports,
               'threadSanitizer': tsan_report, 'parser': parser_report, 'realTimer': timer_report}
    (out / 'report.json').write_text(json.dumps(summary, indent=2) + '\n')
    print(json.dumps({'passed': True, 'runtimeChecks': sum(report['checks'] for report in reports), 'preprocessorEquivalence': len(equivalence), 'bufferChecks': sum(report['checks'] for report in buffer_reports),
                      'tsanChecks': tsan_report['checks'], 'parserChecks': parser_report['checks'], 'realTimer': timer_report['status'], 'report': str(out / 'report.json')}))

if __name__ == '__main__':
    main()
