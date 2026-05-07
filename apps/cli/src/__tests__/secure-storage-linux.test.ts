/* oxlint-disable @cspell/spellchecker */

import { LinuxSecureStorage } from '../infra/secure-storage/secure-storage.linux';
import { createSecureStorage } from '../infra/secure-storage/storage-factory';

describe('LinuxSecureStorage', () => {
  it('returns stored secret bytes from lookup output', async () => {
    const storage = new LinuxSecureStorage({
      execFileAsync: jest.fn(async () => ({ stdout: '616263\n', stderr: '' })),
      spawnWithStdin: jest.fn(),
    });

    await expect(storage.get('wallet:default/mnemonic')).resolves.toEqual(
      Buffer.from('abc', 'utf-8'),
    );
  });

  it('returns null when lookup reports a missing secret item', async () => {
    const storage = new LinuxSecureStorage({
      execFileAsync: jest.fn(async () => {
        const error = new Error('missing') as Error & {
          code?: number;
          stderr?: string;
        };
        error.code = 1;
        error.stderr = 'No such secret item at path';
        throw error;
      }),
      spawnWithStdin: jest.fn(),
    });

    await expect(storage.get('wallet:default/mnemonic')).resolves.toBeNull();
  });

  it('maps missing secret-tool binary to SEC_STORAGE_BACKEND_UNAVAILABLE', async () => {
    const storage = new LinuxSecureStorage({
      execFileAsync: jest.fn(),
      spawnWithStdin: jest.fn(async () => {
        const error = new Error('spawn ENOENT') as Error & { code?: string };
        error.code = 'ENOENT';
        throw error;
      }),
    });

    await expect(
      storage.set('wallet:default/mnemonic', Buffer.from('abcd', 'utf-8')),
    ).rejects.toMatchObject({
      code: 'SEC_STORAGE_BACKEND_UNAVAILABLE',
    });
  });

  it('maps generic delete failures to SEC_STORAGE_ERROR', async () => {
    const storage = new LinuxSecureStorage({
      execFileAsync: jest.fn(async () => {
        const error = new Error('dbus failed') as Error & {
          code?: number;
          stderr?: string;
        };
        error.code = 2;
        error.stderr = 'dbus failed';
        throw error;
      }),
      spawnWithStdin: jest.fn(),
    });

    await expect(
      storage.delete('wallet:default/mnemonic'),
    ).rejects.toMatchObject({
      code: 'SEC_STORAGE_ERROR',
    });
  });
});

describe('createSecureStorage', () => {
  it('selects the linux backend through napi-rs keyring by default', () => {
    expect(createSecureStorage('linux', { arch: 'x64' }).getBackendType()).toBe(
      'linux-secret-service',
    );
  });

  it('selects the macOS backend through napi-rs keyring by default', () => {
    expect(
      createSecureStorage('darwin', { arch: 'arm64' }).getBackendType(),
    ).toBe('macos-keychain');
  });

  it('selects the Windows backend through napi-rs keyring by default', () => {
    expect(createSecureStorage('win32', { arch: 'x64' }).getBackendType()).toBe(
      'windows-credential-manager',
    );
  });

  it('falls back to linux legacy backend when napi-rs keyring is disabled', async () => {
    const spawnWithStdin = jest.fn(async () => ({ stdout: '', stderr: '' }));
    const storage = createSecureStorage('linux', {
      runner: {
        execFileAsync: jest.fn(),
        spawnWithStdin,
      },
      useNapiRsKeyring: false,
    });

    await storage.set('bot-wallet/master-key', Buffer.from('abc', 'utf-8'));

    expect(spawnWithStdin).toHaveBeenCalledWith(
      'secret-tool',
      [
        'store',
        '--label',
        'OneKey CLI Secret',
        'service',
        'onekey-cli',
        'account',
        'bot-wallet/master-key',
      ],
      '616263',
    );
  });

  it('falls back to linux legacy backend when napi-rs keyring has no native target for the runtime', async () => {
    const spawnWithStdin = jest.fn(async () => ({ stdout: '', stderr: '' }));
    const storage = createSecureStorage('linux', {
      arch: 's390x',
      runner: {
        execFileAsync: jest.fn(),
        spawnWithStdin,
      },
    });

    await storage.set('bot-wallet/master-key', Buffer.from('abc', 'utf-8'));

    expect(spawnWithStdin).toHaveBeenCalledWith(
      'secret-tool',
      [
        'store',
        '--label',
        'OneKey CLI Secret',
        'service',
        'onekey-cli',
        'account',
        'bot-wallet/master-key',
      ],
      '616263',
    );
  });

  it('keeps Windows unsupported when napi-rs keyring is disabled because there is no legacy backend', () => {
    expect(() =>
      createSecureStorage('win32', { useNapiRsKeyring: false }),
    ).toThrow(
      expect.objectContaining({
        code: 'SEC_STORAGE_BACKEND_UNAVAILABLE',
      }),
    );
  });

  it('throws SEC_STORAGE_BACKEND_UNAVAILABLE on unsupported platforms', () => {
    expect(() => createSecureStorage('freebsd')).toThrow(
      expect.objectContaining({
        code: 'SEC_STORAGE_BACKEND_UNAVAILABLE',
      }),
    );
  });
});
