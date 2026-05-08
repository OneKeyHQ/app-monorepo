import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';

import { version as PKG_VERSION } from '../../package.json';
import { createSimulatedExportFixture } from '../../scripts/_simulate-export';
import {
  type ILoginPipelineDependencies,
  executeLoginPipeline,
} from '../commands/auth/_internal/login-pipeline';
import {
  LEGACY_KEYCHAIN_ACCOUNTS,
  executeLogoutPipeline,
} from '../commands/auth/_internal/logout-pipeline';
import { triggerSelfHeal } from '../commands/auth/_internal/self-heal';
import { createSecureCacheKey } from '../core/secure-cache';
import {
  MASTER_KEY_ACCOUNT,
  VaultClient,
  createMasterKey,
} from '../infra/vault';
import { SignerSoftwareBase } from '../signer/base/SignerSoftwareBase';

import { extractJson, stripDebugOutput } from './test-helpers';

import type { IVaultClientPaths } from '../infra/vault';

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

function runResultWithEnv(env: Partial<NodeJS.ProcessEnv>, ...args: string[]) {
  const result = spawnSync(BIN, args, {
    encoding: 'utf-8',
    env: {
      ...process.env,
      ...env,
    },
    timeout: 10_000,
  });

  return {
    status: result.status,
    stdout: (result.stdout ?? '').trim(),
    stderr: (result.stderr ?? '').trim(),
  };
}

type IMemoryKeychainStorage = {
  delete(account: string): Promise<void>;
  get(account: string): Promise<Buffer | null>;
  set(account: string, value: Buffer): Promise<void>;
};

function createMemoryKeychain(events?: string[]): IMemoryKeychainStorage {
  const store = new Map<string, Buffer>();

  return {
    async delete(account: string) {
      events?.push(`delete:${account}`);
      store.delete(account);
    },
    async get(account: string) {
      const value = store.get(account);
      return value ? Buffer.from(value) : null;
    },
    async set(account: string, value: Buffer) {
      events?.push(`set:${account}`);
      store.set(account, Buffer.from(value));
    },
  };
}

function createTempVaultPaths(): IVaultClientPaths {
  const vaultDir = mkdtempSync(join(tmpdir(), 'onekey-cli-integration-'));
  return {
    masterKeyAccount: MASTER_KEY_ACCOUNT,
    vaultDir,
    vaultFile: join(vaultDir, 'vault.enc'),
    vaultLock: join(vaultDir, 'vault.enc.lock'),
  };
}

function createSessionCache() {
  return {
    get: jest.fn(() => null),
    set: jest.fn(),
  };
}

function createLoginDependencies({
  events,
  keychainStorage,
  paths,
  vaultClient,
}: {
  events?: string[];
  keychainStorage: IMemoryKeychainStorage;
  paths: IVaultClientPaths;
  vaultClient: VaultClient;
}): Required<
  Pick<ILoginPipelineDependencies, 'createMasterKey' | 'logoutPipeline'>
> {
  return {
    createMasterKey: () =>
      createMasterKey({
        account: paths.masterKeyAccount,
        keychainStorage,
        now: () => 1000,
        randomBytes: () => Buffer.alloc(32, 7),
      }),
    logoutPipeline: () =>
      executeLogoutPipeline({
        clearSecureCache: () => events?.push('clear-cache'),
        keychainStorage,
        masterKeyAccount: paths.masterKeyAccount,
        revokeKey: async (record) => {
          events?.push(`revoke:${record.keyId}`);
        },
        unlink: async (filePath) => {
          events?.push(`unlink:${basename(filePath)}`);
          await unlink(filePath);
        },
        vaultClient,
        vaultFile: paths.vaultFile,
        vaultLock: paths.vaultLock,
        warn: jest.fn(),
      }),
  };
}

describe('onekey CLI (integration)', () => {
  it('prints version in human format', () => {
    const output = run('version');
    expect(output).toContain(PKG_VERSION);
  });

  it('prints version as JSON with --json', () => {
    const output = run('--json', 'version');
    const parsed = JSON.parse(extractJson(output));
    expect(parsed.ok).toBe(true);
    expect(parsed.data.version).toBe(PKG_VERSION);
    expect(parsed.data.env).toBe('prod');
  });

  it('prints only version value with --quiet', () => {
    const output = run('--quiet', 'version');
    expect(stripDebugOutput(output)).toBe(PKG_VERSION);
  });

  it('respects --env test', () => {
    const output = run('--json', '--env', 'test', 'version');
    const parsed = JSON.parse(extractJson(output));
    expect(parsed.data.env).toBe('test');
  });

  it('respects --version global flag with the package version', () => {
    const output = run('--version');
    expect(output.trim()).toBe(PKG_VERSION);
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
    expect(output).toContain('Authenticate with OneKey App Bot Wallet');
    expect(output).toContain('login');
    expect(output).toContain('logout');
    expect(output).toContain('status');
  });

  it('shows auth subcommands when auth is invoked without a subcommand', () => {
    const result = runResult('auth');
    const helpOutput = stripDebugOutput(result.stderr);

    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(helpOutput).toContain('Authenticate with OneKey App Bot Wallet');
    expect(helpOutput).toContain('Usage: onekey auth [options] [command]');
    expect(helpOutput).toContain('login');
    expect(helpOutput).toContain('logout');
    expect(helpOutput).toContain('status');
  });

  it('shows supported auth login methods in auth login --help', () => {
    const output = run('auth', 'login', '--help');
    expect(output).toContain('Authenticate with a OneKey App Bot Wallet');
    expect(output).toContain('--app-transfer');
    expect(output).toContain('--hardware');
    expect(output).toContain('--passphrase-mode');
    expect(output).not.toContain('--mnemonic');
    expect(output).not.toContain('BIP39 mnemonic phrase');
  });

  it('formats bare auth discovery errors as JSON with --json', () => {
    const result = runResult('--json', 'auth');

    expect(result.status).toBe(2);
    expect(stripDebugOutput(result.stderr)).toBe('');

    const parsed = JSON.parse(extractJson(result.stdout)) as {
      ok: boolean;
      error: { code: string; message: string };
    };
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe('PARAM_MISSING_REQUIRED');
    expect(parsed.error.message).toBe('Auth subcommand is required');
  });

  it('reports missing auth --env values before auth subcommand parsing', () => {
    const result = runResult('--json', 'auth', '--env');

    expect(result.status).toBe(2);
    expect(stripDebugOutput(result.stderr)).toBe('');

    const parsed = JSON.parse(extractJson(result.stdout)) as {
      ok: boolean;
      error: { code: string; message: string };
    };
    expect(parsed.ok).toBe(false);
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

    const parsed = JSON.parse(extractJson(result.stdout)) as
      | { ok: true; data: { env: string; status: string } }
      | { ok: false; error: { code: string } };
    expect(JSON.stringify(parsed)).not.toContain(
      'Auth status is not implemented yet',
    );

    if (parsed.ok) {
      expect(parsed.data).toEqual(
        expect.objectContaining({
          env: expect.any(String),
          status: 'connected',
        }),
      );
      return;
    }

    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toMatch(/^NET_/);
  });

  it('auth login with no flag exits with PARAM_MISSING_REQUIRED', () => {
    const result = runResult('--json', 'auth', 'login');

    expect(result.status).toBe(2);
    expect(stripDebugOutput(result.stderr)).toBe('');

    const parsed = JSON.parse(extractJson(result.stdout)) as {
      ok: boolean;
      error: { code: string; message: string };
    };
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe('PARAM_MISSING_REQUIRED');
    expect(parsed.error.message).toContain('--app-transfer');
    expect(parsed.error.message).not.toContain('--mnemonic');
  });

  it('rejects app transfer login in non-tty JSON mode before pairing starts', () => {
    const result = runResult('--json', 'auth', 'login', '--app-transfer');

    expect(result.status).toBe(2);
    expect(stripDebugOutput(result.stderr)).toBe('');

    const parsed = JSON.parse(extractJson(result.stdout));
    expect(parsed.ok).toBe(false);
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

    if (parsed.ok) {
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
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toMatch(/^(AUTH_|SEC_)/);
  });

  it('checks auth before transfer command option validation', () => {
    const homeDir = mkdtempSync(join(tmpdir(), 'onekey-cli-auth-first-'));
    try {
      const result = runResultWithEnv(
        { HOME: homeDir },
        'transfer',
        '--to',
        '0x2222',
      );

      expect(result.status).toBe(4);
      expect(stripDebugOutput(result.stderr)).toBe('');

      const parsed = JSON.parse(extractJson(result.stdout)) as {
        ok: boolean;
        error: { code: string; message: string };
      };
      expect(parsed.ok).toBe(false);
      expect(parsed.error.code).toBe('AUTH_NO_WALLET');
      expect(parsed.error.message).toBe(
        'This command requires an authenticated wallet.',
      );
    } finally {
      rmSync(homeDir, { recursive: true, force: true });
    }
  });

  it('checks auth before swap command option validation', () => {
    const homeDir = mkdtempSync(join(tmpdir(), 'onekey-cli-swap-auth-first-'));
    try {
      const result = runResultWithEnv(
        { HOME: homeDir },
        'swap',
        'quote',
        '--chain',
        'eth',
      );

      expect(result.status).toBe(4);
      expect(stripDebugOutput(result.stderr)).toBe('');

      const parsed = JSON.parse(extractJson(result.stdout)) as {
        ok: boolean;
        error: { code: string; message: string };
      };
      expect(parsed.ok).toBe(false);
      expect(parsed.error.code).toBe('AUTH_NO_WALLET');
    } finally {
      rmSync(homeDir, { recursive: true, force: true });
    }
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
      output: { properties?: Record<string, unknown> };
    };

    expect(parsed.name).toBe('auth-login');
    expect(parsed.input.properties.appTransfer).toBeDefined();
    expect(parsed.input.properties.hardware).toBeDefined();
    expect(parsed.input.properties.passphraseMode).toBeDefined();
    expect(parsed.input.properties.mnemonic).toBeUndefined();
    expect(parsed.output.properties).toBeDefined();
  });

  it('onekey import is no longer a registered command', () => {
    const result = runResult('import');
    expect(result.status).toBe(1);
    expect(stripDebugOutput(result.stderr)).toBe('');

    const parsed = JSON.parse(extractJson(result.stdout)) as {
      ok: false;
      error: { code: string };
    };
    expect(parsed).toMatchObject({
      ok: false,
      error: { code: 'UNKNOWN_COMMAND' },
    });
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
    expect(parsed.ok).toBe(false);
    expect((parsed.error as Record<string, unknown>).code).toBe(
      'PARAM_INVALID_CONFIG',
    );
  });

  describe('BotWallet PoC flow', () => {
    const tempDirs: string[] = [];

    afterEach(() => {
      for (const dir of tempDirs.splice(0)) {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    function createVaultContext(events?: string[]) {
      const paths = createTempVaultPaths();
      tempDirs.push(paths.vaultDir);
      const keychainStorage = createMemoryKeychain(events);
      const vaultClient = new VaultClient({ keychainStorage, paths });
      return { keychainStorage, paths, vaultClient };
    }

    it('runs auth login end-to-end with mocked keychain and encrypted vault storage', async () => {
      const events: string[] = [];
      const { keychainStorage, paths, vaultClient } =
        createVaultContext(events);
      const fixture = createSimulatedExportFixture({
        accessToken: 'A'.repeat(43),
        keyId: 'B'.repeat(43),
        walletId: 'wallet-integration-login',
      });
      const loginDependencies = createLoginDependencies({
        events,
        keychainStorage,
        paths,
        vaultClient,
      });

      await expect(
        executeLoginPipeline(fixture.input, {
          ...loginDependencies,
          now: () => 2000,
          vaultClient,
        }),
      ).resolves.toEqual({ ok: true, data: { keyId: 'B'.repeat(43) } });

      await expect(keychainStorage.get(MASTER_KEY_ACCOUNT)).resolves.toEqual(
        expect.any(Buffer),
      );
      await expect(
        vaultClient.readOnly((vault) => ({
          activeKeyId: vault.metadata.activeKeyId,
          activeWalletId: vault.metadata.activeWalletId,
          recordCount: Object.keys(vault.records).length,
        })),
      ).resolves.toEqual({
        activeKeyId: 'B'.repeat(43),
        activeWalletId: 'wallet-integration-login',
        recordCount: 1,
      });
      expect(existsSync(paths.vaultFile)).toBe(true);
    });

    it('uses vault.cache on a second sign credential lookup without hitting the service', async () => {
      const { keychainStorage, paths, vaultClient } = createVaultContext();
      const fixture = createSimulatedExportFixture({
        accessToken: 'C'.repeat(43),
        keyId: 'D'.repeat(43),
        walletId: 'wallet-integration-cache',
      });
      const loginDependencies = createLoginDependencies({
        keychainStorage,
        paths,
        vaultClient,
      });
      await executeLoginPipeline(fixture.input, {
        ...loginDependencies,
        now: () => 3000,
        vaultClient,
      });

      const fetchKey = jest.fn(async () => ({
        kind: 'ok' as const,
        keyBase64: fixture.keyBase64,
      }));
      const decryptCredential = jest.fn(async () => 'hd-credential-from-fetch');
      const firstSigner = new SignerSoftwareBase({
        decryptCredential,
        fetchKey,
        now: () => 4000,
        sessionCache: createSessionCache(),
        vaultClient,
      });
      const secondSigner = new SignerSoftwareBase({
        decryptCredential,
        fetchKey,
        now: () => 4100,
        sessionCache: createSessionCache(),
        vaultClient,
      });

      await expect(firstSigner.getHdCredential()).resolves.toBe(
        'hd-credential-from-fetch',
      );
      await expect(secondSigner.getHdCredential()).resolves.toBe(
        'hd-credential-from-fetch',
      );

      expect(fetchKey).toHaveBeenCalledTimes(1);
      expect(decryptCredential).toHaveBeenCalledTimes(1);
      await expect(
        vaultClient.readOnly(
          (vault) =>
            vault.cache[
              createSecureCacheKey('wallet-integration-cache', 'D'.repeat(43))
            ],
        ),
      ).resolves.toMatchObject({
        hdCredentialBlob: 'hd-credential-from-fetch',
      });
    });

    it('keeps logout cleanup in the strict seven-step order', async () => {
      const events: string[] = [];
      const { keychainStorage, paths, vaultClient } =
        createVaultContext(events);
      const fixture = createSimulatedExportFixture({
        accessToken: 'E'.repeat(43),
        keyId: 'F'.repeat(43),
        walletId: 'wallet-integration-logout',
      });
      const loginDependencies = createLoginDependencies({
        keychainStorage,
        paths,
        vaultClient,
      });
      await executeLoginPipeline(fixture.input, {
        ...loginDependencies,
        now: () => 5000,
        vaultClient,
      });
      events.length = 0;

      await executeLogoutPipeline({
        clearSecureCache: () => events.push('clear-cache'),
        keychainStorage,
        masterKeyAccount: paths.masterKeyAccount,
        readVaultRecords: async () => {
          events.push('read-vault');
          return vaultClient.readOnly((vault) =>
            Object.entries(vault.records).map(([keyId, record]) => ({
              accessToken: record.accessToken,
              keyId,
            })),
          );
        },
        revokeKey: async (record) => {
          events.push(`revoke:${record.keyId}`);
        },
        unlink: async (filePath) => {
          events.push(`unlink:${basename(filePath)}`);
          await unlink(filePath);
        },
        vaultClient,
        vaultFile: paths.vaultFile,
        vaultLock: paths.vaultLock,
        warn: jest.fn(),
      });

      expect(
        events.filter((event) => event !== 'unlink:vault.enc.lock'),
      ).toEqual([
        'read-vault',
        `revoke:${'F'.repeat(43)}`,
        `delete:${MASTER_KEY_ACCOUNT}`,
        'unlink:vault.enc',
        ...LEGACY_KEYCHAIN_ACCOUNTS.map((account) => `delete:${account}`),
        'clear-cache',
      ]);
      expect(existsSync(paths.vaultFile)).toBe(false);
      await expect(keychainStorage.get(MASTER_KEY_ACCOUNT)).resolves.toBeNull();
    });

    it('self-heals service 404 by running full logout after vault lock release', async () => {
      const events: string[] = [];
      const { keychainStorage, paths, vaultClient } =
        createVaultContext(events);
      const fixture = createSimulatedExportFixture({
        accessToken: 'G'.repeat(43),
        keyId: 'H'.repeat(43),
        walletId: 'wallet-integration-self-heal',
      });
      const loginDependencies = createLoginDependencies({
        events,
        keychainStorage,
        paths,
        vaultClient,
      });
      await executeLoginPipeline(fixture.input, {
        ...loginDependencies,
        now: () => 6000,
        vaultClient,
      });
      events.length = 0;

      const signer = new SignerSoftwareBase({
        fetchKey: jest.fn(async () => ({
          kind: 'self-heal' as const,
          reason: 'KEY_NOT_FOUND' as const,
        })),
        now: () => 7000,
        selfHeal: (reason) =>
          triggerSelfHeal(reason, {
            logoutPipeline: () =>
              executeLogoutPipeline({
                clearSecureCache: () => events.push('clear-cache'),
                keychainStorage,
                masterKeyAccount: paths.masterKeyAccount,
                revokeKey: async (record) => {
                  events.push(`revoke:${record.keyId}`);
                },
                unlink: async (filePath) => {
                  events.push(`unlink:${basename(filePath)}`);
                  await unlink(filePath);
                },
                vaultClient,
                vaultFile: paths.vaultFile,
                vaultLock: paths.vaultLock,
                warn: jest.fn(),
              }),
          }),
        sessionCache: createSessionCache(),
        vaultClient,
      });

      await expect(signer.getHdCredential()).rejects.toMatchObject({
        code: 'SERVICE_KEY_NOT_FOUND',
      });
      expect(events).toEqual(
        expect.arrayContaining([
          `revoke:${'H'.repeat(43)}`,
          `delete:${MASTER_KEY_ACCOUNT}`,
          'unlink:vault.enc',
          'clear-cache',
        ]),
      );
      expect(existsSync(paths.vaultFile)).toBe(false);
      await expect(keychainStorage.get(MASTER_KEY_ACCOUNT)).resolves.toBeNull();
    });
  });
});
