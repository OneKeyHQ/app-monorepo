/* oxlint-disable @cspell/spellchecker */

import { MacOSSecureStorage } from '../infra/secure-storage/secure-storage.macos';
import { createSecureStorage } from '../infra/secure-storage/storage-factory';

describe('MacOSSecureStorage', () => {
  it('writes through legacy security cli', async () => {
    const spawnWithStdin = jest.fn(async () => ({ stdout: '', stderr: '' }));
    const storage = new MacOSSecureStorage({
      execFileAsync: jest.fn(),
      spawnWithStdin,
    });

    await storage.set('bot-wallet/master-key', Buffer.from('abc', 'utf-8'));

    expect(spawnWithStdin).toHaveBeenCalledWith(
      'security',
      ['-i'],
      'add-generic-password -s "onekey-cli" -a "bot-wallet/master-key" -w "616263" -U',
    );
  });

  it('reads through legacy security cli', async () => {
    const execFileAsync = jest.fn(async () => ({
      stdout: '616263\n',
      stderr: '',
    }));
    const storage = new MacOSSecureStorage({
      execFileAsync,
      spawnWithStdin: jest.fn(),
    });

    await expect(storage.get('bot-wallet/master-key')).resolves.toEqual(
      Buffer.from('abc', 'utf-8'),
    );
    expect(execFileAsync).toHaveBeenCalledWith('security', [
      'find-generic-password',
      '-s',
      'onekey-cli',
      '-a',
      'bot-wallet/master-key',
      '-w',
    ]);
  });

  it('returns null when legacy security cli reports a missing item', async () => {
    const storage = new MacOSSecureStorage({
      execFileAsync: jest.fn(async () => {
        const error = new Error('missing') as Error & {
          code?: number;
          stderr?: string;
        };
        error.code = 44;
        error.stderr = 'The specified item could not be found in the keychain.';
        throw error;
      }),
      spawnWithStdin: jest.fn(),
    });

    await expect(storage.get('bot-wallet/master-key')).resolves.toBeNull();
  });

  it('falls back to legacy security cli when napi-rs keyring is disabled', async () => {
    const spawnWithStdin = jest.fn(async () => ({ stdout: '', stderr: '' }));
    const storage = createSecureStorage('darwin', {
      runner: {
        execFileAsync: jest.fn(),
        spawnWithStdin,
      },
      useNapiRsKeyring: false,
    });

    await storage.set('bot-wallet/master-key', Buffer.from('abc', 'utf-8'));

    expect(spawnWithStdin).toHaveBeenCalledWith(
      'security',
      ['-i'],
      'add-generic-password -s "onekey-cli" -a "bot-wallet/master-key" -w "616263" -U',
    );
  });
});
