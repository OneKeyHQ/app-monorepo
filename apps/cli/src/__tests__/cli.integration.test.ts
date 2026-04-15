import { execFileSync, spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

import { extractJson, stripDebugOutput } from './test-helpers';

const BIN = resolve(__dirname, '../../bin/onekey');

function run(...args: string[]): string {
  return execFileSync(BIN, args, { encoding: 'utf-8', timeout: 10_000 }).trim();
}

function runResult(...args: string[]) {
  const result = spawnSync(BIN, args, {
    encoding: 'utf-8',
    timeout: 10_000,
  });

  return {
    status: result.status,
    stdout: (result.stdout ?? '').trim(),
    stderr: (result.stderr ?? '').trim(),
  };
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
    expect(output).toContain('auth');
    expect(output).toContain('version');
    expect(output).toContain('status');
  });

  it('shows auth subcommands with auth --help', () => {
    const output = run('auth', '--help');
    expect(output).toContain(
      'Authenticate with a mnemonic or OneKey App Bot Wallet',
    );
    expect(output).toContain('login');
    expect(output).toContain('logout');
    expect(output).toContain('status');
  });

  it('shows auth subcommands when auth is invoked without a subcommand', () => {
    const result = runResult('auth');
    const helpOutput = stripDebugOutput(result.stderr);

    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(helpOutput).toContain(
      'Authenticate with a mnemonic or OneKey App Bot Wallet',
    );
    expect(helpOutput).toContain('Usage: onekey auth [options] [command]');
    expect(helpOutput).toContain('login');
    expect(helpOutput).toContain('logout');
    expect(helpOutput).toContain('status');
  });

  it('shows both login methods in auth login --help', () => {
    const output = run('auth', 'login', '--help');
    expect(output).toContain(
      'Authenticate with a mnemonic or OneKey App Bot Wallet',
    );
    expect(output).toContain('--mnemonic');
    expect(output).toContain('Authenticate with a BIP39 mnemonic phrase');
    expect(output).toContain('--app-transfer');
    expect(output).toContain('Authenticate with a OneKey App Bot Wallet');
  });

  it('formats bare auth discovery errors as JSON with --json', () => {
    const result = runResult('--json', 'auth');

    expect(result.status).toBe(2);
    expect(stripDebugOutput(result.stderr)).toBe('');

    const parsed = JSON.parse(extractJson(result.stdout));
    expect(parsed.status).toBe('error');
    expect(parsed.error.code).toBe('PARAM_MISSING_REQUIRED');
    expect(parsed.error.message).toBe('Auth subcommand is required');
  });

  it('reports missing auth --env values before auth subcommand parsing', () => {
    const result = runResult('--json', 'auth', '--env');

    expect(result.status).toBe(2);
    expect(stripDebugOutput(result.stderr)).toBe('');

    const parsed = JSON.parse(extractJson(result.stdout));
    expect(parsed.status).toBe('error');
    expect(parsed.error.code).toBe('PARAM_MISSING_REQUIRED');
    expect(parsed.error.message).toBe('Missing --env value');
  });

  it('formats unknown auth subcommands in quiet mode', () => {
    const result = runResult('--quiet', 'auth', 'foo');

    expect(result.status).toBe(2);
    expect(result.stdout).toBe('');
    expect(stripDebugOutput(result.stderr)).toBe(
      'PARAM_INVALID_COMMAND: Unknown auth subcommand: foo',
    );
  });

  it('keeps top-level status help focused on system status', () => {
    const output = run('status', '--help');
    expect(output).toContain('Check system status and API connectivity');
  });

  it('keeps top-level status structured output focused on connectivity', () => {
    const result = runResult('--json', 'status');

    expect(stripDebugOutput(result.stderr)).toBe('');

    const parsed = JSON.parse(extractJson(result.stdout));
    expect(JSON.stringify(parsed)).not.toContain(
      'Auth status is not implemented yet',
    );

    if (parsed.status === 'success') {
      expect(parsed.data).toEqual(
        expect.objectContaining({
          env: expect.any(String),
          status: 'connected',
        }),
      );
      return;
    }

    expect(parsed.status).toBe('error');
    expect(parsed.error.code).toMatch(/^NET_/);
  });

  it('requires an explicit mnemonic selector for auth login in JSON mode', () => {
    const result = runResult('--json', 'auth', 'login');

    expect(result.status).toBe(2);
    expect(stripDebugOutput(result.stderr)).toBe('');

    const parsed = JSON.parse(extractJson(result.stdout));
    expect(parsed.status).toBe('error');
    expect(parsed.error.code).toBe('PARAM_MISSING_REQUIRED');
    expect(parsed.error.message).toBe(
      'Login method required. Use --mnemonic or --app-transfer.',
    );
  });

  it('rejects app transfer login in non-tty JSON mode before pairing starts', () => {
    const result = runResult('--json', 'auth', 'login', '--app-transfer');

    expect(result.status).toBe(2);
    expect(stripDebugOutput(result.stderr)).toBe('');

    const parsed = JSON.parse(extractJson(result.stdout));
    expect(parsed.status).toBe('error');
    expect(parsed.error.code).toBe('PARAM_REQUIRES_TTY');
    expect(parsed.error.message).toBe(
      'App Transfer login requires an interactive TTY terminal.',
    );
  });

  it('reports auth status with structured output instead of placeholder errors', () => {
    const result = runResult('--json', 'auth', 'status');

    expect(result.stderr).not.toContain('--localstorage-file');
    expect(stripDebugOutput(result.stderr)).toBe('');

    const parsed = JSON.parse(extractJson(result.stdout));
    expect(JSON.stringify(parsed)).not.toContain(
      'Auth status is not implemented yet',
    );

    if (parsed.status === 'success') {
      expect(parsed.data).toEqual(
        expect.objectContaining({
          authStatus: expect.stringMatching(/authenticated|unauthenticated/),
          hasSecrets: expect.any(Boolean),
          storageBackend: expect.any(String),
        }),
      );
      return;
    }

    expect(result.status).not.toBe(0);
    expect(parsed.status).toBe('error');
    expect(parsed.error.code).toMatch(/^(AUTH_|SEC_)/);
  });

  it('shows dedicated help for auth status', () => {
    const output = run('auth', 'status', '--help');
    expect(output).toContain('Show the current auth session');
  });

  it('shows dedicated help for auth logout', () => {
    const output = run('auth', 'logout', '--help');
    expect(output).toContain('Log out of the current auth session');
  });

  it('includes auth subcommands in schema discovery output', () => {
    const output = run('schema', '--list');
    const parsed = JSON.parse(output) as string[];

    expect(parsed).toEqual(
      expect.arrayContaining(['auth-login', 'auth-status', 'auth-logout']),
    );
  });

  it('prints the auth login schema', () => {
    const output = run('schema', 'auth-login');
    const parsed = JSON.parse(output) as {
      name: string;
      input: { properties: Record<string, unknown> };
      output: { anyOf?: unknown[] };
    };

    expect(parsed.name).toBe('auth-login');
    expect(parsed.input.properties.mnemonic).toBeDefined();
    expect(parsed.input.properties.appTransfer).toBeDefined();
    expect(parsed.output.anyOf).toHaveLength(2);
  });

  it('shows mnemonic auth copy for the legacy import alias', () => {
    const output = run('import', '--help');
    expect(output).toContain('Authenticate with a BIP39 mnemonic wallet');
    expect(output).toContain('Authenticate with a BIP39 mnemonic phrase');
  });

  it('shows auth logout copy for the legacy logout alias', () => {
    const output = run('logout', '--help');
    expect(output).toContain('Log out of the current auth session');
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
