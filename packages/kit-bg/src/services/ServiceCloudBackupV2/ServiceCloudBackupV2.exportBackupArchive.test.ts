import { webcrypto } from 'crypto';

import {
  ESecretEncryptPayloadFormat,
  encryptAsync,
} from '@onekeyhq/core/src/secret';
import {
  ECloudBackupProviderType,
  type IBackupCloudServerDownloadData,
} from '@onekeyhq/shared/src/cloudBackup/cloudBackupTypes';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import type { IPrimeTransferData } from '@onekeyhq/shared/types/prime/primeTransferTypes';

import { createBackupExportArchive } from './createBackupExportArchive';
import ServiceCloudBackupV2 from './ServiceCloudBackupV2';

import type { IZipJsNativeModule } from './zipJsTypes';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => {
  const passthroughDecorator =
    () =>
    (...args: unknown[]) =>
      args.length === 1 ? args[0] : args[2];
  return {
    backgroundClass: passthroughDecorator,
    backgroundMethod: passthroughDecorator,
    toastIfError: passthroughDecorator,
  };
});

jest.mock('../ServiceBase', () => ({
  __esModule: true,
  default: class ServiceBase {},
}));
jest.mock('./backupProviders/OneKeyBackupProvider', () => ({
  OneKeyBackupProvider: jest.fn(),
}));
jest.mock('../../states/jotai/atoms/cloudBackup', () => ({
  cloudBackupStatusAtom: {},
}));

const data: IPrimeTransferData = {
  privateData: {
    credentials: {},
    decryptedCredentials: { fixture: { privateKey: 'synthetic-private-key' } },
    importedAccounts: {},
    watchingAccounts: {},
    wallets: {},
  },
  publicData: {
    dataTime: 1,
    totalWalletsCount: 0,
    totalAccountsCount: 0,
    walletDetails: [],
  },
  appVersion: 'test',
  isEmptyData: false,
  isWatchingOnly: false,
};

async function readArchive(archiveBase64: string, password?: string) {
  const { ZipReader, Uint8ArrayReader, Uint8ArrayWriter } =
    (await import('@zip.js/zip.js/index-native.js')) as unknown as IZipJsNativeModule;
  const reader = new ZipReader(
    new Uint8ArrayReader(Buffer.from(archiveBase64, 'base64')),
    { useWebWorkers: false, useCompressionStream: false },
  );
  try {
    const entries = await reader.getEntries();
    expect(entries).toHaveLength(1);
    const [entry] = entries;
    if (entry.directory) throw new OneKeyLocalError('Expected a JSON file');
    expect(entry.filename).toBe('backup.json');
    expect(entry.encrypted).toBe(true);
    const bytes = await entry.getData(new Uint8ArrayWriter(), { password });
    return Buffer.from(bytes).toString('utf8');
  } finally {
    await reader.close();
  }
}

describe('cloud backup ZIP export', () => {
  const globalNames = [
    'crypto',
    'ReadableStream',
    'WritableStream',
    'TransformStream',
  ];
  const descriptors = globalNames.map((name) =>
    Object.getOwnPropertyDescriptor(globalThis, name),
  );

  beforeAll(() => {
    // Exercise the Hermes path: no Web Crypto acceleration or Streams API.
    Object.defineProperty(globalThis, 'crypto', {
      value: { getRandomValues: webcrypto.getRandomValues.bind(webcrypto) },
      configurable: true,
    });
    for (const name of globalNames.slice(1)) {
      Object.defineProperty(globalThis, name, {
        value: undefined,
        configurable: true,
        writable: true,
      });
    }
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(() => {
    globalNames.forEach((name, index) => {
      const descriptor = descriptors[index];
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    });
  });

  it('creates independently password-protected ZIPs containing plaintext JSON without native Streams', async () => {
    const first = await createBackupExportArchive(data);
    const second = await createBackupExportArchive(data);
    expect(first.password).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32}$/);
    expect(first.password).not.toBe(second.password);
    expect(first.archiveBase64).not.toBe(second.archiveBase64);
    expect(Buffer.from(first.archiveBase64, 'base64').subarray(0, 4)).toEqual(
      Buffer.from([0x50, 0x4b, 0x03, 0x04]),
    );
    expect(await readArchive(first.archiveBase64, first.password)).toBe(
      stringUtils.stableStringify(data),
    );
    expect(await readArchive(second.archiveBase64, second.password)).toBe(
      stringUtils.stableStringify(data),
    );
    await expect(readArchive(first.archiveBase64)).rejects.toThrow();
    await expect(
      readArchive(first.archiveBase64, second.password),
    ).rejects.toThrow();
  });

  async function prepareCloudBackup(userId: string) {
    jest.spyOn(ServiceCloudBackupV2.prototype, 'init').mockResolvedValue();
    const service = new ServiceCloudBackupV2({ backgroundApi: {} });
    jest.spyOn(service, 'getCloudAccountInfo').mockResolvedValue({
      userId,
      userEmail: 'synthetic@example.com',
      providerType: ECloudBackupProviderType.GoogleDrive,
    });
    const password = 'synthetic-original-backup-password';
    const encrypted = await encryptAsync({
      data: Buffer.from(stringUtils.stableStringify(data.privateData)),
      password: await service.buildFullBackupPassword({ password }),
      allowRawPassword: true,
      format: ESecretEncryptPayloadFormat.legacy,
    });
    const { privateData: _privateData, ...publicFields } = data;
    const backup: IBackupCloudServerDownloadData = {
      content: 'encrypted backup',
      payload: {
        ...publicFields,
        privateDataEncrypted: encrypted.toString('base64'),
      },
    };
    jest.spyOn(service, 'download').mockResolvedValue(backup);
    return { service, password, backup };
  }

  it.each(['synthetic-google-user-id', 'synthetic-cloudkit-user-id'])(
    'decrypts the original backup for %s and exports only its data',
    async (userId) => {
      const { service, password, backup } = await prepareCloudBackup(userId);
      const original = stringUtils.stableStringify(backup);
      const exported = await service.exportBackupArchive({
        recordId: 'fixture',
        password,
      });
      const json = await readArchive(exported.archiveBase64, exported.password);
      expect(JSON.parse(json)).toEqual(data);
      for (const excluded of [
        userId,
        password,
        'privateDataEncrypted',
        'userEmail',
      ]) {
        expect(json).not.toContain(excluded);
      }
      expect(stringUtils.stableStringify(backup)).toBe(original);
      await expect(
        readArchive(exported.archiveBase64, password),
      ).rejects.toThrow();
    },
  );

  it('removes redundant wrapped credentials and refuses exports that still need another password', async () => {
    const { service, password } = await prepareCloudBackup('synthetic-user-id');
    const prepare = jest.spyOn(service, 'restorePreparePrivateData');
    prepare.mockResolvedValueOnce({
      ...data.privateData,
      credentials: { fixture: 'redundant-encrypted-credential' },
    });
    const exported = await service.exportBackupArchive({
      recordId: 'fixture',
      password,
    });
    expect(
      JSON.parse(await readArchive(exported.archiveBase64, exported.password)),
    ).toEqual(data);
    prepare.mockResolvedValueOnce({
      ...data.privateData,
      credentials: { missing: 'encrypted-credential' },
    });
    await expect(
      service.exportBackupArchive({ recordId: 'fixture', password }),
    ).rejects.toThrow('cannot be exported as plaintext');
    prepare.mockResolvedValueOnce({
      ...data.privateData,
      decryptedCredentialsHex: 'encrypted-transfer-credentials',
    });
    await expect(
      service.exportBackupArchive({ recordId: 'fixture', password }),
    ).rejects.toThrow('cannot be exported as plaintext');
  });

  it('does not produce an archive for a wrong backup password or missing backup', async () => {
    const { service, password } = await prepareCloudBackup('synthetic-user-id');
    await expect(
      service.exportBackupArchive({
        recordId: 'fixture',
        password: 'wrong-password',
      }),
    ).rejects.toThrow();
    jest.spyOn(service, 'download').mockResolvedValue(null);
    await expect(
      service.exportBackupArchive({ recordId: 'fixture', password }),
    ).rejects.toThrow('Backup data is empty');
  });
});
