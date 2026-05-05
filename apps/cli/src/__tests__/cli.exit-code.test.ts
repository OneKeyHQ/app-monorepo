import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

import {
  emitCliTopLevelError,
  normalizeCliTopLevelError,
  resolveCliErrorOutputFormat,
  resolveCliErrorOutputMode,
} from '../cli-error-boundary';
import {
  CLI_ERROR_CODES,
  LockError,
  ServiceError,
  VaultError,
} from '../errors';

import { extractJson, stripDebugOutput } from './test-helpers';

const CLI_SOURCE = resolve(__dirname, '../cli.ts');

function runCliSourceSubprocess(...args: string[]) {
  const bootstrap = `
    const source = ${JSON.stringify(CLI_SOURCE)};
    const Module = require('node:module');
    const originalLoad = Module._load;
    function createShim() {
      const fn = function() { return createShim(); };
      return new Proxy(fn, {
        get(target, prop) {
          if (prop === '__esModule') return true;
          if (prop === 'Platform') return { OS: 'web', select: (obj) => obj.default || obj.web };
          if (typeof prop === 'symbol') return target[prop];
          return createShim();
        },
        apply() { return createShim(); },
        construct() { return createShim(); },
      });
    }
    const shimPatterns = [
      /^react-native$/,
      /^react-native\\//,
      /^react-native-nitro-modules/,
      /^react-native-webview/,
      /^react-native-mmkv/,
      /^react-native-keyboard-controller/,
      /^react-native-reanimated/,
      /^react-native-gesture-handler/,
      /^react-native-safe-area-context/,
      /^react-native-screens/,
      /^@react-native\\//,
      /^@react-native-community\\//,
      /^@react-native-async-storage/,
      /^@react-native-firebase/,
      /^expo-/,
      /^expo$/,
      /^@sentry\\/react-native/,
    ];
    Module._load = function(request, parent, isMain) {
      if (shimPatterns.some((pattern) => pattern.test(request))) {
        return createShim();
      }
      return originalLoad.call(this, request, parent, isMain);
    };
    globalThis.window = globalThis;
    globalThis.self = globalThis;
    const storage = {
      _d: {},
      getItem(key) { return this._d[key] || null; },
      setItem(key, value) { this._d[key] = String(value); },
      removeItem(key) { delete this._d[key]; },
      clear() { this._d = {}; },
      key(index) { return Object.keys(this._d)[index] || null; },
      get length() { return Object.keys(this._d).length; },
    };
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, writable: true, value: storage });
    Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, writable: true, value: storage });
    require('esbuild-register/dist/node').register({ target: 'node22' });
    process.argv = [process.execPath, 'onekey', ...${JSON.stringify(args)}];
    require(source);
  `;

  return spawnSync(process.execPath, ['-e', bootstrap], {
    encoding: 'utf8',
    env: {
      ...process.env,
      NODE_NO_WARNINGS: '1',
    },
    timeout: 10_000,
  });
}

describe('CLI top-level exit code boundary', () => {
  it('maps VaultError(VAULT_CORRUPT) to exit code 2', () => {
    const normalized = normalizeCliTopLevelError(
      new VaultError(CLI_ERROR_CODES.VAULT_CORRUPT),
    );

    expect(normalized).toMatchObject({
      code: CLI_ERROR_CODES.VAULT_CORRUPT,
      exitCode: 2,
    });
  });

  it('maps ServiceError(SESSION_EXPIRED) to exit code 1', () => {
    const normalized = normalizeCliTopLevelError(
      new ServiceError(CLI_ERROR_CODES.SESSION_EXPIRED),
    );

    expect(normalized).toMatchObject({
      code: CLI_ERROR_CODES.SESSION_EXPIRED,
      exitCode: 1,
    });
  });

  it('maps LockError(LOCK_TIMEOUT) to exit code 2', () => {
    const normalized = normalizeCliTopLevelError(
      new LockError(CLI_ERROR_CODES.LOCK_TIMEOUT),
    );

    expect(normalized).toMatchObject({
      code: CLI_ERROR_CODES.LOCK_TIMEOUT,
      exitCode: 2,
    });
  });

  it('maps non-CliError throws to UNKNOWN_ERROR exit code 2', () => {
    const normalized = normalizeCliTopLevelError(new Error('boom'));

    expect(normalized).toMatchObject({
      code: CLI_ERROR_CODES.UNKNOWN_ERROR,
      exitCode: 2,
    });
  });

  it('defaults top-level error formatting to text on TTY and JSON off TTY', () => {
    expect(resolveCliErrorOutputFormat([], true)).toBe('text');
    expect(resolveCliErrorOutputFormat([], false)).toBe('json');
    expect(resolveCliErrorOutputFormat(['--json'], true)).toBe('json');
    expect(resolveCliErrorOutputMode([], true)).toBe('human');
  });

  it('writes top-level human errors to stderr in TTY mode', () => {
    const originalExitCode = process.exitCode;
    let stdout = '';
    let stderr = '';

    try {
      emitCliTopLevelError(
        {
          code: 'commander.missingMandatoryOptionValue',
          message: "error: required option '--amount <amount>' not specified",
        },
        {
          argv: ['transfer', '--to', '0x2222'],
          isTTY: true,
          stdout: { write: (chunk) => (stdout += String(chunk)) },
          stderr: { write: (chunk) => (stderr += String(chunk)) },
        },
      );

      expect(stdout).toBe('');
      expect(stderr).toContain('Error [PARAM_MISSING_REQUIRED]');
      expect(stderr).toContain('PARAM_MISSING_REQUIRED');
    } finally {
      process.exitCode = originalExitCode;
    }
  });

  it('emits UNKNOWN_COMMAND JSON from a real CLI subprocess', () => {
    const result = runCliSourceSubprocess('--json', 'missing-command');

    expect(result.status).toBe(1);
    expect(stripDebugOutput(result.stderr ?? '')).toBe('');

    const parsed = JSON.parse(extractJson(result.stdout ?? '')) as {
      ok: false;
      error: { code: string; message: string };
    };
    expect(parsed).toMatchObject({
      ok: false,
      error: {
        code: CLI_ERROR_CODES.UNKNOWN_COMMAND,
      },
    });
    expect(parsed.error.message).toMatch(/unknown command/i);
  });
});
