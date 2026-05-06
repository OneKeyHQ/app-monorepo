/* oxlint-disable @cspell/spellchecker */

import { AppError } from '../errors';
import {
  NAPI_RS_KEYRING_ACCOUNT_PREFIX,
  NapiRsKeyringSecureStorage,
  isNapiRsKeyringSupportedCliRuntime,
} from '../infra/secure-storage/secure-storage.napi-rs-keyring';

type ITestKeyringEntry = {
  getPassword(): Promise<string | null | undefined>;
  setPassword(password: string): Promise<void>;
  deletePassword(): Promise<unknown>;
};

function createTestKeyringModule(
  entryFactory: (service: string, account: string) => ITestKeyringEntry,
) {
  function AsyncEntry(this: unknown, service: string, account: string) {
    return entryFactory(service, account);
  }

  return {
    AsyncEntry: AsyncEntry as unknown as new (
      service: string,
      account: string,
    ) => ITestKeyringEntry,
  };
}

describe('NapiRsKeyringSecureStorage', () => {
  it('uses @napi-rs/keyring for stored secret bytes', async () => {
    const setPassword = jest.fn(async () => undefined);

    const storage = new NapiRsKeyringSecureStorage({
      keyringModuleLoader: async () =>
        createTestKeyringModule((service, account) => {
          expect(service).toBe('onekey-cli');
          expect(account).toBe(
            `${NAPI_RS_KEYRING_ACCOUNT_PREFIX}bot-wallet/master-key`,
          );

          return {
            getPassword: jest.fn(),
            setPassword,
            deletePassword: jest.fn(),
          };
        }),
      platform: 'darwin',
    });

    await storage.set('bot-wallet/master-key', Buffer.from('abc', 'utf-8'));

    expect(setPassword).toHaveBeenCalledWith('616263');
  });

  it('reads stored hex passwords through @napi-rs/keyring', async () => {
    const storage = new NapiRsKeyringSecureStorage({
      keyringModuleLoader: async () =>
        createTestKeyringModule(() => ({
          getPassword: jest.fn(async () => '616263'),
          setPassword: jest.fn(),
          deletePassword: jest.fn(),
        })),
      platform: 'linux',
    });

    await expect(storage.get('bot-wallet/master-key')).resolves.toEqual(
      Buffer.from('abc', 'utf-8'),
    );
  });

  it('returns null when @napi-rs/keyring reports a missing item', async () => {
    const storage = new NapiRsKeyringSecureStorage({
      keyringModuleLoader: async () =>
        createTestKeyringModule(() => ({
          getPassword: jest.fn(async () => {
            throw new AppError('TEST_NO_ENTRY', 'NoEntry', 'Test only');
          }),
          setPassword: jest.fn(),
          deletePassword: jest.fn(),
        })),
      platform: 'win32',
    });

    await expect(storage.get('bot-wallet/master-key')).resolves.toBeNull();
  });

  it('maps missing native keyring packages to backend unavailable', async () => {
    const moduleError = Object.assign(
      new Error("Cannot find module '@napi-rs/keyring'"),
      { code: 'MODULE_NOT_FOUND' },
    );
    const storage = new NapiRsKeyringSecureStorage({
      keyringModuleLoader: async () => {
        throw moduleError;
      },
      platform: 'darwin',
    });

    await expect(storage.get('bot-wallet/master-key')).rejects.toMatchObject({
      code: 'SEC_STORAGE_BACKEND_UNAVAILABLE',
    });
  });

  it.each([
    ['darwin' as NodeJS.Platform, 'macos-keychain'],
    ['linux' as NodeJS.Platform, 'linux-secret-service'],
    ['win32' as NodeJS.Platform, 'windows-credential-manager'],
  ])('reports the %s OS backend', (platform, backend) => {
    expect(new NapiRsKeyringSecureStorage({ platform }).getBackendType()).toBe(
      backend,
    );
  });

  it.each([
    ['darwin' as NodeJS.Platform, 'arm64' as NodeJS.Architecture, true],
    ['darwin' as NodeJS.Platform, 'x64' as NodeJS.Architecture, true],
    ['darwin' as NodeJS.Platform, 'ia32' as NodeJS.Architecture, false],
    ['linux' as NodeJS.Platform, 'arm64' as NodeJS.Architecture, true],
    ['linux' as NodeJS.Platform, 'x64' as NodeJS.Architecture, true],
    ['linux' as NodeJS.Platform, 'arm' as NodeJS.Architecture, true],
    ['linux' as NodeJS.Platform, 'riscv64' as NodeJS.Architecture, true],
    ['linux' as NodeJS.Platform, 's390x' as NodeJS.Architecture, false],
    ['win32' as NodeJS.Platform, 'arm64' as NodeJS.Architecture, true],
    ['win32' as NodeJS.Platform, 'x64' as NodeJS.Architecture, true],
    ['win32' as NodeJS.Platform, 'ia32' as NodeJS.Architecture, true],
    ['freebsd' as NodeJS.Platform, 'x64' as NodeJS.Architecture, false],
  ])(
    'reports napi-rs keyring support for %s/%s',
    (platform, arch, supported) => {
      expect(isNapiRsKeyringSupportedCliRuntime(platform, arch)).toBe(
        supported,
      );
    },
  );
});
