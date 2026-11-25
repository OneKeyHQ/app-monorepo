import { IDBFactory } from 'fake-indexeddb';

import { buildLocalSecretEnvelopeAesGcmLayerAdapter } from './aesGcmLayerAdapter';
import { DEFAULT_MMKV_PROFILE_KEY_LSE_KEY_REF } from './consts';
import {
  buildIndexedDbCryptoKeyLocalSecretEnvelopeLayerAdapter,
  deleteIndexedDbCryptoKeyForLocalSecretEnvelope,
} from './indexedDbCryptoKeyLayerAdapter';
import { DEFAULT_SECURE_STORAGE_LSE_GLOBAL_KEY_REF } from './secureStorageLayerAdapter';
import {
  assertLocalSecretEnvelopeWalletKeyLossAllowed,
  simulateWalletLocalSecretEnvelopeKeyLoss,
} from './walletKeyLoss';
import {
  unwrapLocalSecretEnvelopeV1,
  wrapLocalSecretEnvelopeV1,
} from './wrapping';

import type {
  ILocalSecretEnvelopeLayerAdapter,
  ILocalSecretEnvelopeLayerKind,
} from './types';
import type { IWalletLseKeyLossSnapshot } from './walletKeyLoss';

const mockIsLocalBuild = jest.fn(() => true);

jest.mock('@onekeyhq/shared/src/utils/localSecretEnvelopeDevUtils', () => ({
  isLocalSecretEnvelopeKeyLossDevBuild: () => mockIsLocalBuild(),
}));

function fixture() {
  const indexedDBInstance = new IDBFactory();
  const secureKeys = new Map<string, string>();
  const profileKeys = new Map<string, string>();
  const memoryAdapter = (
    kind: ILocalSecretEnvelopeLayerKind,
    keyRef: string,
    records: Map<string, string>,
  ) =>
    buildLocalSecretEnvelopeAesGcmLayerAdapter({
      kind,
      keyRef,
      capabilities: {
        sync: 'local-only',
        extractable: true,
        keyAccess: 'raw-key-readable',
      },
      keyStorage: {
        getItem: async (ref) => records.get(ref) ?? null,
        setItem: async (ref, value) => {
          records.set(ref, value);
        },
      },
    });
  const secure = memoryAdapter(
    'secure-storage',
    DEFAULT_SECURE_STORAGE_LSE_GLOBAL_KEY_REF,
    secureKeys,
  );
  const profile = memoryAdapter(
    'mmkv-profile-key',
    DEFAULT_MMKV_PROFILE_KEY_LSE_KEY_REF,
    profileKeys,
  );
  const indexedDb = buildIndexedDbCryptoKeyLocalSecretEnvelopeLayerAdapter({
    indexedDBInstance,
  });
  const adapters = [secure, profile, indexedDb];
  const read = (envelope: string) =>
    unwrapLocalSecretEnvelopeV1({
      envelope,
      resolveLayerAdapter: ({ kind }) =>
        adapters.find((adapter) => adapter.kind === kind),
    });
  const removeKey = jest.fn(
    async ({
      kind,
      keyRef,
    }: {
      kind: ILocalSecretEnvelopeLayerKind;
      keyRef: string;
    }) => {
      if (kind === 'indexeddb-cryptokey') {
        await deleteIndexedDbCryptoKeyForLocalSecretEnvelope({
          indexedDBInstance,
          keyRef,
        });
      } else {
        (kind === 'secure-storage' ? secureKeys : profileKeys).delete(keyRef);
      }
    },
  );
  const wrap = (
    recordId: string,
    layerAdapters: ILocalSecretEnvelopeLayerAdapter[],
    dataType: 'credential' | 'verify-string' = 'credential',
  ) =>
    wrapLocalSecretEnvelopeV1({
      dataType,
      recordId,
      layerAdapters,
      plaintext:
        dataType === 'credential'
          ? '|RP|fixture-encrypted-inner'
          : 'verifier-fixture',
      strength: 'profile-bound',
    });
  return { secure, profile, indexedDb, read, wrap, removeKey };
}

beforeEach(() => {
  mockIsLocalBuild.mockReturnValue(true);
});

it.each([
  { localBuild: false, developerMode: true },
  { localBuild: true, developerMode: false },
])(
  'rejects the background operation before inspecting any data with $localBuild / $developerMode',
  async ({ localBuild, developerMode }) => {
    mockIsLocalBuild.mockReturnValue(localBuild);
    const readSnapshot = jest.fn();
    const removeKey = jest.fn();
    const enabled = jest.fn(async () => developerMode);
    await expect(
      simulateWalletLocalSecretEnvelopeKeyLoss({
        assertAllowed: () =>
          assertLocalSecretEnvelopeWalletKeyLossAllowed(enabled),
        readSnapshot,
        authenticate: jest.fn(),
        removeKey,
      }),
    ).rejects.toThrow(
      'requires a local development build with developer mode enabled',
    );
    expect(readSnapshot).not.toHaveBeenCalled();
    expect(removeKey).not.toHaveBeenCalled();
    expect(enabled).toHaveBeenCalledTimes(localBuild ? 1 : 0);
  },
);

it('deletes deduplicated keys across mixed layers and leaves envelopes for genuine missing-key reads', async () => {
  const { secure, profile, indexedDb, read, wrap, removeKey } = fixture();
  const credentials = [
    { id: 'hd-1', credential: await wrap('hd-1', [profile, secure]) },
    { id: 'hd-2', credential: await wrap('hd-2', [profile, secure]) },
    { id: 'hd-3', credential: await wrap('hd-3', [indexedDb]) },
  ];
  const snapshot = {
    credentials,
    credentialOwners: new Map(credentials.map(({ id }) => [id, id])),
    verifyString: 'plain-verifier-fixture',
  };
  const assertAllowed = jest.fn(async () => undefined);
  const result = await simulateWalletLocalSecretEnvelopeKeyLoss({
    assertAllowed,
    readSnapshot: async () => snapshot,
    authenticate: async ({ credential }) => {
      await read(credential);
    },
    removeKey,
  });
  expect(result).toMatchObject({
    walletCount: 3,
    affectedWalletCount: 3,
    skippedWalletCount: 0,
    deletedKeyCount: 3,
  });
  expect(assertAllowed).toHaveBeenCalledTimes(7);
  expect(removeKey.mock.calls.map(([{ kind }]) => kind)).toEqual([
    'mmkv-profile-key',
    'secure-storage',
    'indexeddb-cryptokey',
  ]);
  for (const { credential } of credentials) {
    await expect(read(credential)).rejects.toMatchObject({
      data: { localSecretEnvelopeFailureReason: 'key-missing' },
    });
  }
  await expect(read(await wrap('hd-1', [profile, secure]))).resolves.toBe(
    '|RP|fixture-encrypted-inner',
  );
});

it('preserves verifier and non-wallet shared keys and reports actual wallet coverage', async () => {
  const { secure, profile, indexedDb, read, wrap, removeKey } = fixture();
  const verifyString = await wrap('main', [profile], 'verify-string');
  const other = {
    id: 'other-service',
    credential: await wrap('other-service', [secure]),
  };
  const wallet = {
    id: 'hd-1',
    credential: await wrap('hd-1', [profile, secure]),
  };
  const walletWithOwnKey = {
    id: 'hd-2',
    credential: await wrap('hd-2', [indexedDb, secure]),
  };
  const result = await simulateWalletLocalSecretEnvelopeKeyLoss({
    assertAllowed: async () => undefined,
    readSnapshot: async () => ({
      credentials: [other, wallet, walletWithOwnKey],
      credentialOwners: new Map([
        ['hd-1', 'hd-1'],
        ['hd-2', 'hd-2'],
      ]),
      verifyString,
    }),
    authenticate: async ({ credential }) => {
      await read(credential);
    },
    removeKey,
  });
  expect(result).toMatchObject({
    walletCount: 2,
    affectedWalletCount: 1,
    skippedWalletCount: 1,
    deletedKeyCount: 1,
    protectedKeyCount: 2,
  });
  await expect(read(verifyString)).resolves.toBe('verifier-fixture');
  await expect(read(other.credential)).resolves.toBe(
    '|RP|fixture-encrypted-inner',
  );
  await expect(read(wallet.credential)).resolves.toBe(
    '|RP|fixture-encrypted-inner',
  );
  await expect(read(walletWithOwnKey.credential)).rejects.toThrow(
    'wrapping key unavailable',
  );
});

it('halts before removing a key when the verifier changes during the scan', async () => {
  const { secure, read, wrap, removeKey } = fixture();
  const snapshot: IWalletLseKeyLossSnapshot = {
    credentials: [{ id: 'hd-1', credential: await wrap('hd-1', [secure]) }],
    credentialOwners: new Map([['hd-1', 'hd-1']]),
    verifyString: 'verifier-before',
  };
  const readSnapshot = jest
    .fn(async () => ({ ...snapshot, verifyString: 'verifier-after' }))
    .mockResolvedValueOnce(snapshot);
  const result = await simulateWalletLocalSecretEnvelopeKeyLoss({
    assertAllowed: async () => undefined,
    readSnapshot,
    authenticate: async ({ credential }) => {
      await read(credential);
    },
    removeKey,
  });
  expect(result).toMatchObject({ deletedKeyCount: 0, stopped: true });
  expect(removeKey).not.toHaveBeenCalled();
});

it('rejects deletion when developer mode is disabled after the last snapshot', async () => {
  const { secure, read, wrap, removeKey } = fixture();
  const snapshot: IWalletLseKeyLossSnapshot = {
    credentials: [{ id: 'hd-1', credential: await wrap('hd-1', [secure]) }],
    credentialOwners: new Map([['hd-1', 'hd-1']]),
    verifyString: 'plain-verifier-fixture',
  };
  const enabled = jest
    .fn(async () => false)
    .mockResolvedValueOnce(true)
    .mockResolvedValueOnce(true);
  const readSnapshot = jest.fn(async () => snapshot);
  await expect(
    simulateWalletLocalSecretEnvelopeKeyLoss({
      assertAllowed: () =>
        assertLocalSecretEnvelopeWalletKeyLossAllowed(enabled),
      readSnapshot,
      authenticate: async ({ credential }) => {
        await read(credential);
      },
      removeKey,
    }),
  ).rejects.toThrow(
    'requires a local development build with developer mode enabled',
  );
  expect(readSnapshot).toHaveBeenCalledTimes(2);
  expect(removeKey).not.toHaveBeenCalled();
  await expect(read(snapshot.credentials[0].credential)).resolves.toBe(
    '|RP|fixture-encrypted-inner',
  );
});
