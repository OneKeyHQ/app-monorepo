import 'fake-indexeddb/auto';

import { encodePasswordAsync } from '@onekeyhq/core/src/secret';
import { EHyperLiquidAgentName } from '@onekeyhq/shared/src/consts/perp';
import * as indexedDbCryptoKeyStore from '@onekeyhq/shared/src/storage/indexedDbCryptoKeyStore';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { HyperLiquidAgentSecretSession } from './hyperLiquidAgentSecret';

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isExtension: true,
    isNative: false,
  },
}));

jest.mock('@onekeyhq/shared/src/storage/indexedDbCryptoKeyStore', () => {
  const actual = jest.requireActual<
    typeof import('@onekeyhq/shared/src/storage/indexedDbCryptoKeyStore')
  >('@onekeyhq/shared/src/storage/indexedDbCryptoKeyStore');
  return {
    ...actual,
    deleteCryptoKeyRecord: jest.fn(actual.deleteCryptoKeyRecord),
  };
});

jest.mock('../../states/jotai/atoms/settings', () => ({
  settingsPersistAtom: {
    get: jest.fn(async () => ({
      sensitiveEncodeKey: 'test-extension-sensitive-encode-key',
    })),
  },
}));

describe('HyperLiquid agent Extension session', () => {
  const sessionStorageData: Record<string, unknown> = {};

  beforeEach(() => {
    const actual = jest.requireActual<
      typeof import('@onekeyhq/shared/src/storage/indexedDbCryptoKeyStore')
    >('@onekeyhq/shared/src/storage/indexedDbCryptoKeyStore');
    jest
      .mocked(indexedDbCryptoKeyStore.deleteCryptoKeyRecord)
      .mockImplementation(actual.deleteCryptoKeyRecord);
  });

  beforeAll(() => {
    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      value: {
        storage: {
          session: {
            get: async (key: string) => ({
              [key]: sessionStorageData[key],
            }),
            remove: async (key: string) => {
              delete sessionStorageData[key];
            },
            set: async (values: Record<string, unknown>) => {
              Object.assign(sessionStorageData, values);
            },
          },
        },
      },
    });
  });

  afterEach(() => {
    for (const key of Object.keys(sessionStorageData)) {
      delete sessionStorageData[key];
    }
  });

  it('restores only an unlocked browser-session key after worker restart', async () => {
    const password = await encodePasswordAsync({
      password: 'test-extension-password',
    });
    const firstWorkerSession = new HyperLiquidAgentSecretSession();
    await firstWorkerSession.unlock({ password });
    await firstWorkerSession.setPersistedSessionUnlocked(true);

    expect(JSON.stringify(sessionStorageData)).not.toContain(
      'test-extension-password',
    );

    const restartedWorkerSession = new HyperLiquidAgentSecretSession();
    await expect(
      restartedWorkerSession.restorePersistedSession(),
    ).resolves.toEqual({ restored: true, unlocked: true });

    const credential = {
      agentAddress: '0x2222222222222222222222222222222222222222',
      agentName: EHyperLiquidAgentName.OneKeyAgent1,
      privateKey:
        '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      userAddress: '0x1111111111111111111111111111111111111111',
      validUntil: 2_000_000_000_000,
    };
    const recordId = accountUtils.buildHyperLiquidAgentCredentialId({
      agentName: credential.agentName,
      userAddress: credential.userAddress,
    });
    const encrypted = await restartedWorkerSession.encryptCredential({
      credential,
      recordId,
    });
    await expect(
      restartedWorkerSession.decryptCredential({
        credential: encrypted,
        recordId,
      }),
    ).resolves.toEqual(credential);
  });

  it('does not restore a key before the app session is marked unlocked', async () => {
    const password = await encodePasswordAsync({
      password: 'test-extension-password',
    });
    const firstWorkerSession = new HyperLiquidAgentSecretSession();
    await firstWorkerSession.unlock({ password });

    const restartedWorkerSession = new HyperLiquidAgentSecretSession();
    await expect(
      restartedWorkerSession.restorePersistedSession(),
    ).resolves.toEqual({ restored: false, unlocked: false });
  });

  it('cannot restore a stale browser payload written after clear', async () => {
    const password = await encodePasswordAsync({
      password: 'test-extension-password',
    });
    const firstWorkerSession = new HyperLiquidAgentSecretSession();
    await firstWorkerSession.unlock({ password });
    await firstWorkerSession.setPersistedSessionUnlocked(true);
    const staleSessionStorageData = { ...sessionStorageData };

    await firstWorkerSession.clear();
    Object.assign(sessionStorageData, staleSessionStorageData);

    const restartedWorkerSession = new HyperLiquidAgentSecretSession();
    await expect(
      restartedWorkerSession.restorePersistedSession(),
    ).resolves.toEqual({ restored: false, unlocked: false });
    expect(restartedWorkerSession.isReady()).toBe(false);
  });

  it('reports wrapping-key deletion failure before a stale payload can be treated as cleared', async () => {
    const password = await encodePasswordAsync({
      password: 'test-extension-password',
    });
    const session = new HyperLiquidAgentSecretSession();
    await session.unlock({ password });
    await session.setPersistedSessionUnlocked(true);
    const staleSessionStorageData = { ...sessionStorageData };
    const deleteKeyMock = jest
      .mocked(indexedDbCryptoKeyStore.deleteCryptoKeyRecord)
      .mockRejectedValue(new Error('Mock wrapping-key deletion failure'));

    try {
      await expect(session.clear()).rejects.toThrow(
        'HyperLiquid agent session wrapping key invalidation failed',
      );
      expect(session.isReady()).toBe(false);

      Object.assign(sessionStorageData, staleSessionStorageData);
      const restartedWorkerSession = new HyperLiquidAgentSecretSession();
      await expect(
        restartedWorkerSession.restorePersistedSession(),
      ).resolves.toEqual({ restored: true, unlocked: true });
    } finally {
      const actual = jest.requireActual<
        typeof import('@onekeyhq/shared/src/storage/indexedDbCryptoKeyStore')
      >('@onekeyhq/shared/src/storage/indexedDbCryptoKeyStore');
      deleteKeyMock.mockImplementation(actual.deleteCryptoKeyRecord);
      await session.clear();
    }
  });
});
