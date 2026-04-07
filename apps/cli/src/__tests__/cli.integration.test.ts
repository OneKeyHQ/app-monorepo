import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

import { extractJson, stripDebugOutput } from './test-helpers';

const BIN = resolve(__dirname, '../../bin/onekey');

function run(...args: string[]): string {
  return execFileSync(BIN, args, { encoding: 'utf-8', timeout: 10_000 }).trim();
}

describe('onekey CLI (integration)', () => {
  it('prints version in human format', () => {
    const output = run('version');
    expect(output).toContain('0.1.0');
  });

  it('prints version as JSON with --json', () => {
    const output = run('--json', 'version');
    const parsed = JSON.parse(extractJson(output));
    expect(parsed.status).toBe('success');
    expect(parsed.data.version).toBe('0.1.0');
    expect(parsed.data.env).toBe('test');
  });

  it('prints only version value with --quiet', () => {
    const output = run('--quiet', 'version');
    expect(stripDebugOutput(output)).toBe('0.1.0');
  });

  it('respects --env prod', () => {
    const output = run('--json', '--env', 'prod', 'version');
    const parsed = JSON.parse(extractJson(output));
    expect(parsed.data.env).toBe('prod');
  });

  it('shows help with --help', () => {
    const output = run('--help');
    expect(output).toContain('--json');
    expect(output).toContain('--env');
    expect(output).toContain('version');
    expect(output).toContain('status');
  });

  it('rejects invalid --env value with PARAM_INVALID_CONFIG', () => {
    let caughtError: (NodeJS.ErrnoException & { stdout?: string }) | null =
      null;
    try {
      run('--json', '--env', 'invalid', 'version');
    } catch (e) {
      caughtError = e as NodeJS.ErrnoException & { stdout?: string };
    }
    expect(caughtError).not.toBeNull();
    const parsed = JSON.parse(
      extractJson(caughtError!.stdout ?? '{}'),
    ) as Record<string, unknown>;
    expect(parsed.status).toBe('error');
    expect((parsed.error as Record<string, unknown>).code).toBe(
      'PARAM_INVALID_CONFIG',
    );
  });
});
