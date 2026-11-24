import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IKeylessCloudSyncCredential } from '@onekeyhq/shared/types/keylessCloudSync';

import keylessStorageUtils from './keylessStorageUtils';
import keylessSyncCredentialStorage from './keylessSyncCredentialStorage';

let mockEnvironment: 'prod' | 'test' = 'prod';
jest.mock('../../../states/jotai/jotaiStorageConsts', () => ({
  ...jest.requireActual<
    typeof import('../../../states/jotai/jotaiStorageConsts')
  >('../../../states/jotai/jotaiStorageConsts'),
  getCloudSyncStorageEnvironmentForRuntime: () => mockEnvironment,
}));

const mockDiagnostic = jest.fn<void, unknown[]>();
jest.mock('../../ServiceKeylessCloudSync/hardwareCloudSyncLog', () => ({
  logHardwareCloudSyncDiagnostic: (...args: unknown[]) =>
    mockDiagnostic(...args),
}));

let mockStoredPayload: string | null = null;

jest.mock('./keylessStorageUtils', () => ({
  __esModule: true,
  default: {
    storageGetItem: jest.fn(async () => mockStoredPayload),
    storageSetItem: jest.fn(async (_key: string, value: string) => {
      mockStoredPayload = value;
    }),
    storageRemoveItem: jest.fn(async () => {
      mockStoredPayload = null;
    }),
  },
}));

const credential: IKeylessCloudSyncCredential = {
  keylessWalletId: 'public-hardware-storage-fixture',
  signingPrivateKey: 'public-test-placeholder-signing',
  signingPublicKey: 'public-test-placeholder-public',
  encryptionKey: 'public-test-placeholder-encryption',
  pwdHash: 'keyless-public-test-fixture',
};

describe('shared Cloud credential storage source changes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStoredPayload = null;
  });

  test('a stale source lookup cannot delete the currently encrypted credential', async () => {
    await keylessSyncCredentialStorage.saveCredential(credential);
    expect(mockStoredPayload).not.toContain(credential.signingPrivateKey);
    await expect(
      keylessSyncCredentialStorage.getCredential('old-keyless-id'),
    ).resolves.toBeNull();
    expect(keylessStorageUtils.storageRemoveItem).not.toHaveBeenCalled();
    await expect(
      keylessSyncCredentialStorage.getCredential(credential.keylessWalletId),
    ).resolves.toEqual(credential);
  });

  test('a corrupt read completing after a new save cannot remove the new credential', async () => {
    let release: () => void = () => undefined;
    let reached: () => void = () => undefined;
    const paused = new Promise<void>((resolve) => {
      release = resolve;
    });
    const entered = new Promise<void>((resolve) => {
      reached = resolve;
    });
    jest
      .mocked(keylessStorageUtils.storageGetItem)
      .mockImplementationOnce(async () => {
        reached();
        await paused;
        return 'corrupt-payload';
      });
    const staleRead =
      keylessSyncCredentialStorage.getCredential('old-keyless-id');
    await entered;
    await keylessSyncCredentialStorage.saveCredential(credential);
    release();
    await expect(staleRead).resolves.toBeNull();
    expect(keylessStorageUtils.storageRemoveItem).not.toHaveBeenCalled();
    await expect(
      keylessSyncCredentialStorage.getCredential(credential.keylessWalletId),
    ).resolves.toEqual(credential);
  });

  test.each(['saveCredential', 'removeAllCredentials'] as const)(
    'invalidates the preflight witness before an asynchronous %s publishes',
    async (operation) => {
      const entered = Promise.withResolvers<void>();
      const release = Promise.withResolvers<void>();
      const storageMethod =
        operation === 'saveCredential' ? 'storageSetItem' : 'storageRemoveItem';
      jest
        .mocked(keylessStorageUtils[storageMethod])
        .mockImplementationOnce(async () => {
          entered.resolve();
          await release.promise;
        });
      const before = keylessSyncCredentialStorage.captureWriteGuard();
      expect(before()).toBe(true);
      const writer =
        operation === 'saveCredential'
          ? keylessSyncCredentialStorage.saveCredential(credential)
          : keylessSyncCredentialStorage.removeAllCredentials();
      try {
        expect(before()).toBe(false);
        await entered.promise;
        const during = keylessSyncCredentialStorage.captureWriteGuard();
        expect(during()).toBe(false);
        release.resolve();
        await writer;
        expect(during()).toBe(false);
        expect(before()).toBe(false);
        expect(keylessSyncCredentialStorage.captureWriteGuard()()).toBe(true);
      } finally {
        release.resolve();
        await writer;
      }
    },
  );

  test('explicit disable cleanup still removes the shared persisted credential', async () => {
    await keylessSyncCredentialStorage.saveCredential(credential);
    await keylessSyncCredentialStorage.removeAllCredentials();
    expect(keylessStorageUtils.storageRemoveItem).toHaveBeenCalledTimes(1);
    await expect(
      keylessSyncCredentialStorage.getCredential(credential.keylessWalletId),
    ).resolves.toBeNull();
  });

  test('ignores unbound hardware sessions and their recovery state', async () => {
    const session = {
      deviceKeyJwk: {
        kty: 'EC' as const,
        crv: 'P-256' as const,
        x: 'public-x',
        y: 'public-y',
        d: 'fixture-d',
      },
      accessToken: 'fixture-access',
      accessTokenExpiresAt: 1,
      refreshToken: 'fixture-refresh',
      sessionId: 'fixture-session',
      dekId: 'fixture-dek',
    };
    const stale: IKeylessCloudSyncCredential = {
      ...credential,
      hardwareSession: session,
      pendingDataKey: {
        dek: 'fixture-data',
        dekId: 'fixture-pending',
        pwdHash: 'fixture-hash',
      },
      pendingHardwareKeyMigration: {
        target: { ...credential, hardwareSession: session },
        recordsHash: 'fixture-records',
        phase: 'committing',
      },
    };
    await keylessSyncCredentialStorage.saveCredential(stale);
    await expect(
      keylessSyncCredentialStorage.getCredential(stale.keylessWalletId),
    ).resolves.toBeNull();
    await expect(
      keylessSyncCredentialStorage.getPendingHardwareKeyMigration(),
    ).resolves.toBeUndefined();
    const fresh = {
      ...credential,
      hardwareSession: {
        ...session,
        boundBaseURL: 'https://prime.example.invalid',
      },
    };
    await keylessSyncCredentialStorage.saveCredential(fresh);
    await expect(
      keylessSyncCredentialStorage.getCredential(stale.keylessWalletId),
    ).resolves.toEqual({
      ...fresh,
      hardwareSession: {
        ...fresh.hardwareSession,
        environment: mockEnvironment,
      },
    });
  });
});

test('credential diagnostics distinguish missing storage from unreadable storage without clearing it', async () => {
  mockDiagnostic.mockClear();
  mockStoredPayload = null;
  await expect(
    keylessSyncCredentialStorage.getCredential('unused'),
  ).resolves.toBeNull();
  expect(mockDiagnostic).not.toHaveBeenCalled();
  const failure = new OneKeyLocalError('synthetic-private-storage-error');
  jest
    .mocked(keylessStorageUtils.storageGetItem)
    .mockRejectedValueOnce(failure);
  await expect(
    keylessSyncCredentialStorage.getCredential('unused'),
  ).rejects.toBe(failure);
  expect(mockDiagnostic).toHaveBeenCalledWith('credential_storage_read_failed');
  mockStoredPayload = 'synthetic-private-corrupt-ciphertext';
  await expect(
    keylessSyncCredentialStorage.getCredential('unused'),
  ).resolves.toBeNull();
  expect(mockDiagnostic).toHaveBeenCalledWith(
    'credential_storage_decrypt_failed',
  );
  expect(JSON.stringify(mockDiagnostic.mock.calls)).not.toContain(
    'synthetic-private',
  );
});

test('repeated successful credential reads do not produce diagnostics', async () => {
  await keylessSyncCredentialStorage.saveCredential(credential);
  mockDiagnostic.mockClear();
  for (let i = 0; i < 5; i += 1)
    await keylessSyncCredentialStorage.getCredential(
      credential.keylessWalletId,
    );
  expect(mockDiagnostic).not.toHaveBeenCalled();
});

test('keeps the legacy production key and does not read or remove it from Test', async () => {
  const payloads = new Map<string, string>();
  const get = jest
    .spyOn(keylessStorageUtils, 'storageGetItem')
    .mockImplementation(async (key) => payloads.get(key) ?? null);
  const set = jest
    .spyOn(keylessStorageUtils, 'storageSetItem')
    .mockImplementation(async (key, value) => {
      payloads.set(key, value);
    });
  const remove = jest
    .spyOn(keylessStorageUtils, 'storageRemoveItem')
    .mockImplementation(async (key) => {
      payloads.delete(key);
    });
  try {
    mockEnvironment = 'prod';
    await keylessSyncCredentialStorage.saveCredential(credential);
    const production = payloads.get('keyless_sync_credentials');
    expect(production).toBeTruthy();
    mockEnvironment = 'test';
    await expect(
      keylessSyncCredentialStorage.getCredential(credential.keylessWalletId),
    ).resolves.toBeNull();
    expect(get).toHaveBeenLastCalledWith('keyless_sync_credentials_test');
    const testCredential = { ...credential, signingPublicKey: 'test-only' };
    await keylessSyncCredentialStorage.saveCredential(testCredential);
    await expect(
      keylessSyncCredentialStorage.getCredential(credential.keylessWalletId),
    ).resolves.toEqual(testCredential);
    await keylessSyncCredentialStorage.removeAllCredentials();
    expect(remove).toHaveBeenLastCalledWith('keyless_sync_credentials_test');
    expect(payloads.get('keyless_sync_credentials')).toBe(production);
    mockEnvironment = 'prod';
    await expect(
      keylessSyncCredentialStorage.getCredential(credential.keylessWalletId),
    ).resolves.toEqual(credential);
  } finally {
    mockEnvironment = 'prod';
    get.mockReset().mockImplementation(async () => mockStoredPayload);
    set.mockReset().mockImplementation(async (_key, value) => {
      mockStoredPayload = value;
    });
    remove.mockReset().mockImplementation(async () => {
      mockStoredPayload = null;
    });
  }
});
