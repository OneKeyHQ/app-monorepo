import { sha512ProSync } from '@onekeyhq/core/src/secret/hash';
import { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { ICloudSyncCredential } from '@onekeyhq/shared/types/prime/primeCloudSyncTypes';

import localDb from '../../dbs/local/localDb';
import { LocalDbBase } from '../../dbs/local/LocalDbBase';
import cloudSyncItemBuilder from '../ServicePrimeCloudSync/cloudSyncItemBuilder';
import keylessCloudSyncUtils from '../ServicePrimeCloudSync/keylessCloudSyncUtils';

import {
  commitHardwareCloudSyncLocalRecovery,
  hasPendingDeletionFromPreviousHardwareKey,
  prepareHardwareCloudSyncLocalRecovery,
  prepareHardwareResign,
} from './hardwareCloudSyncRecovery';

import type { IDBCloudSyncItem } from '../../dbs/local/types';

jest.mock('../../dbs/local/localDb', () => ({
  __esModule: true,
  default: { updateSyncItem: jest.fn() },
}));

const syncCredential: ICloudSyncCredential = {
  primeAccountSalt: '',
  securityPasswordR1: '',
  masterPasswordUUID: '',
  keylessCredential: {
    keylessWalletId: 'public-test-hardware-source',
    signingPrivateKey: '',
    signingPublicKey: '',
    encryptionKey: 'public-test-current-key',
    pwdHash: 'hw-dek-current',
  },
};

function record(dataTime = 200): IDBCloudSyncItem {
  return {
    id: 'public-test-wallet',
    rawKey: 'public-test-raw-key',
    dataType: EPrimeCloudSyncDataType.Wallet,
    rawData: JSON.stringify({
      rawKey: 'public-test-raw-key',
      dataType: EPrimeCloudSyncDataType.Wallet,
      payload: { name: 'B' },
    }),
    data: 'public-test-old-ciphertext',
    dataTime,
    pwdHash: 'hw-dek-no-longer-in-history',
    isDeleted: false,
    localSceneUpdated: true,
    serverUploaded: false,
  };
}

test.each([
  ['previous key known from history', 'history-key', 200, true],
  ['only the stored credential knows the old key', 'stored-key', 200, true],
  [
    'current key can still authenticate the deletion',
    'current-key',
    200,
    false,
  ],
  ['a different space is not rewritten', 'foreign-key', 200, false],
  [
    'an ordinary previous-key record has no pending deletion',
    'history-key',
    undefined,
    false,
  ],
] as const)('%s', (_scenario, pwdHash, pendingAt, expected) => {
  const item: IDBCloudSyncItem = {
    ...record(),
    dataType: EPrimeCloudSyncDataType.Account,
    pendingPublicAccountDeletionAt: pendingAt,
    pwdHash,
  };
  const original = { ...item };
  expect(
    hasPendingDeletionFromPreviousHardwareKey({
      items: [item],
      currentPwdHash: 'current-key',
      previousPwdHashes: new Set(['history-key', 'stored-key']),
    }),
  ).toBe(expected);
  expect(item).toEqual(original);
});

describe('hardware re-sign recovery preserves business versions', () => {
  let local: IDBCloudSyncItem;
  let build: jest.SpiedFunction<
    typeof cloudSyncItemBuilder.buildSyncItemFromRawDataJson
  >;

  beforeEach(() => {
    local = record();
    build = jest
      .spyOn(cloudSyncItemBuilder, 'buildSyncItemFromRawDataJson')
      .mockImplementation(async ({ dataTime, rawDataJson }) => ({
        ...local,
        rawData: JSON.stringify(rawDataJson),
        data: 'public-test-current-ciphertext',
        dataTime,
        pwdHash: 'hw-dek-current',
      }));
    jest
      .spyOn(localDb, 'updateSyncItem')
      .mockImplementation(async ({ updater }) => {
        await updater(local);
      });
  });

  afterEach(() => jest.restoreAllMocks());

  test('re-sign skips ciphertext already marked with the current key version', async () => {
    const credential = syncCredential.keylessCredential;
    if (!credential) throw new OneKeyLocalError('Missing fixture credential');
    local.pwdHash = credential.pwdHash;
    const decrypt = jest.spyOn(keylessCloudSyncUtils, 'decryptWithKeylessKey');
    const readBusiness = jest.fn();
    await expect(
      prepareHardwareResign({
        items: [local],
        previousPwdHashes: [],
        existing: credential,
        credential,
        rebuildsLocalItemsNow: false,
        sameSelectedSource: true,
        sameSelectedWallet: true,
        makeCredential: () => syncCredential,
        loadAuthoritativeItems: readBusiness,
      }),
    ).resolves.toMatchObject({
      recoveredItems: [],
      restoresRotatedHardwareKey: true,
    });
    expect(decrypt).not.toHaveBeenCalled();
    expect(build).not.toHaveBeenCalled();
    expect(readBusiness).not.toHaveBeenCalled();
  });

  test.each(['hw-dek-current', 'hw-dek-previous'])(
    'leaves ciphertext that authenticates with the current key intact (%s)',
    async (pwdHash) => {
      local.pwdHash = pwdHash;
      local.serverUploaded = true;
      local.dataType = EPrimeCloudSyncDataType.BrowserBookmark;
      local.data = await keylessCloudSyncUtils.encryptWithKeylessKey({
        rawData: JSON.stringify({
          dataType: local.dataType,
          rawKey: local.rawKey,
          payload: { title: 'Authenticated version' },
        }),
        encryptionKey: 'public-test-current-key',
        itemId: local.id,
        dataType: local.dataType,
      });
      local.rawData = JSON.stringify({
        dataType: local.dataType,
        rawKey: local.rawKey,
        payload: { title: 'Older cache' },
      });
      const readBusiness = jest.fn();
      const before = { ...local };
      const recovered = await prepareHardwareCloudSyncLocalRecovery({
        items: [local],
        syncCredential,
        knownPwdHashes: new Set([pwdHash]),
        loadAuthoritativeItems: readBusiness,
      });
      await commitHardwareCloudSyncLocalRecovery(recovered);
      expect(local).toEqual({ ...before, pwdHash: 'hw-dek-current' });
      expect(build).not.toHaveBeenCalled();
      expect(readBusiness).not.toHaveBeenCalled();
    },
  );

  test.each(['hw-dek-previous', 'hw-dek-current'])(
    'reads exact business data when ciphertext fails and the raw cache is malformed (%s)',
    async (pwdHash) => {
      local = {
        ...local,
        dataType: EPrimeCloudSyncDataType.AddressBook,
        pwdHash,
        rawData: '{invalid',
      };
      const before = { ...local };
      const rebuilt = {
        ...local,
        rawData: 'authoritative-address-book-payload',
        data: 'new-ciphertext',
        dataTime: undefined,
        pwdHash: 'hw-dek-current',
      };
      const readBusiness = jest.fn(async () => [rebuilt]);
      const recovered = await prepareHardwareCloudSyncLocalRecovery({
        items: [local],
        syncCredential,
        knownPwdHashes: new Set([pwdHash]),
        loadAuthoritativeItems: readBusiness,
      });
      expect(readBusiness).toHaveBeenCalledWith([before]);
      await commitHardwareCloudSyncLocalRecovery(recovered);
      expect(local).toMatchObject({
        data: rebuilt.data,
        rawData: rebuilt.rawData,
        dataTime: before.dataTime,
        pwdHash: rebuilt.pwdHash,
      });
      expect(build).not.toHaveBeenCalled();
    },
  );

  test('retains an encrypted public account snapshot instead of rebuilding its cached plaintext', async () => {
    local = {
      ...local,
      dataType: EPrimeCloudSyncDataType.Account,
      pwdHash: 'hw-dek-current',
      rawData: JSON.stringify({
        dataType: EPrimeCloudSyncDataType.Account,
        rawKey: local.rawKey,
        payload: { publicAccountSnapshot: { version: 1 } },
      }),
    };
    const readBusiness = jest.fn();
    await expect(
      prepareHardwareCloudSyncLocalRecovery({
        items: [local],
        syncCredential,
        knownPwdHashes: new Set([local.pwdHash]),
        loadAuthoritativeItems: readBusiness,
      }),
    ).resolves.toEqual([]);
    expect(build).not.toHaveBeenCalled();
    expect(readBusiness).not.toHaveBeenCalled();
  });

  test.each([
    {
      scenario: 'A edits then B edits',
      localTime: 200,
      serverTime: 100,
      winner: 'B',
    },
    {
      scenario: 'A only rotates and B edits',
      localTime: 200,
      serverTime: 50,
      winner: 'B',
    },
    {
      scenario: 'B edits then A edits',
      localTime: 100,
      serverTime: 200,
      winner: 'A',
    },
  ])(
    '$scenario converges to $winner after B re-signs',
    async ({ localTime, serverTime, winner }) => {
      local.dataTime = localTime;
      const recovered = await prepareHardwareCloudSyncLocalRecovery({
        items: [local],
        syncCredential,
        knownPwdHashes: new Set([local.pwdHash]),
      });
      await commitHardwareCloudSyncLocalRecovery(recovered);
      expect(local).toMatchObject({
        dataTime: localTime,
        pwdHash: 'hw-dek-current',
        serverUploaded: false,
      });
      const server = {
        ...local,
        rawData: 'public-test-A',
        dataTime: serverTime,
        serverUploaded: true,
      };
      LocalDbBase.prototype._updateCloudSyncPoolItemFn({
        item: local,
        updateItem: server,
      });
      expect(local.rawData).toBe(
        winner === 'A' ? server.rawData : recovered[0].original.rawData,
      );
      expect(local.dataTime).toBe(Math.max(localTime, serverTime));
      expect(local.serverUploaded).toBe(winner === 'A');
    },
  );

  test('local deletion remains a deletion with its original version and pending upload', async () => {
    local.isDeleted = true;
    local.serverUploaded = true;
    local.localSceneUpdated = false;
    const recovered = await prepareHardwareCloudSyncLocalRecovery({
      items: [local],
      syncCredential,
      knownPwdHashes: new Set([local.pwdHash]),
    });
    await commitHardwareCloudSyncLocalRecovery(recovered);
    expect(local).toMatchObject({
      isDeleted: true,
      dataTime: 200,
      localSceneUpdated: false,
      serverUploaded: false,
      pwdHash: 'hw-dek-current',
    });
  });

  test('a concurrent edit is never overwritten by an earlier re-encryption snapshot', async () => {
    const recovered = await prepareHardwareCloudSyncLocalRecovery({
      items: [local],
      syncCredential,
      knownPwdHashes: new Set([local.pwdHash]),
    });
    local.rawData = 'public-test-later-edit';
    local.dataTime = 300;
    await commitHardwareCloudSyncLocalRecovery(recovered);
    expect(local).toMatchObject({
      rawData: 'public-test-later-edit',
      dataTime: 300,
      pwdHash: 'hw-dek-no-longer-in-history',
    });
  });

  test('a pending account deletion written after recovery preparation is preserved', async () => {
    local.dataType = EPrimeCloudSyncDataType.Account;
    local.rawData = JSON.stringify({
      rawKey: local.rawKey,
      dataType: local.dataType,
      payload: { name: 'B' },
    });
    const recovered = await prepareHardwareCloudSyncLocalRecovery({
      items: [local],
      syncCredential,
      knownPwdHashes: new Set([local.pwdHash]),
    });
    expect(recovered).toHaveLength(1);
    local.pendingPublicAccountDeletionAt = 300;
    local.pendingPublicAccountDeletionHash = 'public-test-account-identity';
    const before = { ...local };

    await commitHardwareCloudSyncLocalRecovery(recovered);

    expect(local).toEqual(before);
  });

  test('an edit made while encryption is waiting is compared to the original snapshot', async () => {
    build.mockImplementationOnce(async () => {
      local.rawData = 'public-test-edit-during-encryption';
      local.dataTime = 300;
      return {
        ...local,
        data: 'public-test-stale-ciphertext',
        pwdHash: 'hw-dek-current',
      };
    });
    const recovered = await prepareHardwareCloudSyncLocalRecovery({
      items: [local],
      syncCredential,
      knownPwdHashes: new Set([local.pwdHash]),
    });
    await commitHardwareCloudSyncLocalRecovery(recovered);
    expect(local.dataTime).toBe(300);
    expect(local.pwdHash).toBe('hw-dek-no-longer-in-history');
  });

  test.each([
    '',
    '{invalid',
    JSON.stringify({
      dataType: 'Account',
      rawKey: 'public-test-raw-key',
      payload: {},
    }),
  ])(
    'unreadable local plaintext is retained without committing any changes',
    async (rawData) => {
      local.rawData = rawData;
      if (!rawData) local.data = '';
      const before = { ...local };
      await expect(
        prepareHardwareCloudSyncLocalRecovery({
          items: [local],
          syncCredential,
          knownPwdHashes: new Set([local.pwdHash]),
        }),
      ).rejects.toMatchObject({
        reason: expect.stringContaining('Local hardware sync record'),
      });
      expect(local).toEqual(before);
    },
  );

  test('foreign keyless data is not authorized by the hardware recovery path', async () => {
    local.pwdHash = 'keyless-other-source';
    expect(
      await prepareHardwareCloudSyncLocalRecovery({
        items: [local],
        syncCredential,
        knownPwdHashes: new Set(),
      }),
    ).toEqual([]);
    expect(build).not.toHaveBeenCalled();
  });

  test('an unknown cached plaintext copy is never migrated into the current key', async () => {
    local.serverUploaded = true;
    const before = { ...local };
    const loadAuthoritativeItems = jest.fn();
    const recovered = await prepareHardwareCloudSyncLocalRecovery({
      items: [local],
      syncCredential,
      knownPwdHashes: new Set(),
      loadAuthoritativeItems,
    });
    expect(recovered).toEqual([]);
    expect(loadAuthoritativeItems).not.toHaveBeenCalled();
    expect(build).not.toHaveBeenCalled();
    expect(local).toEqual(before);
  });

  test('only asks the loader for applied, exact known-space opaque copies with no deletion', async () => {
    const eligible = { ...local, rawData: '', serverUploaded: true };
    const loadAuthoritativeItems = jest.fn(async () => []);
    await prepareHardwareCloudSyncLocalRecovery({
      items: [
        eligible,
        { ...eligible, id: 'foreign', pwdHash: 'hw-dek-unrelated' },
        {
          ...eligible,
          id: 'pending-delete',
          pendingPublicAccountDeletionAt: 300,
        },
        { ...eligible, id: 'tombstone', isDeleted: true },
        { ...eligible, id: 'not-applied', localSceneUpdated: false },
        { ...eligible, id: 'not-uploaded', serverUploaded: false },
      ],
      syncCredential,
      knownPwdHashes: new Set([eligible.pwdHash]),
      loadAuthoritativeItems,
    });
    expect(loadAuthoritativeItems).toHaveBeenCalledTimes(1);
    expect(loadAuthoritativeItems).toHaveBeenCalledWith([eligible]);
  });

  test.each([true, false])(
    'requires exact authoritative identity (matches=%s)',
    async (matches) => {
      local.rawData = '';
      local.serverUploaded = true;
      const before = { ...local };
      const replacement = {
        ...local,
        rawKey: matches ? local.rawKey : 'different-raw-key',
        rawData: 'canonical-local-business-record',
        data: 'current-canonical-ciphertext',
        pwdHash: 'hw-dek-current',
        dataTime: undefined,
      };
      const recovered = await prepareHardwareCloudSyncLocalRecovery({
        items: [local],
        syncCredential,
        knownPwdHashes: new Set([local.pwdHash]),
        loadAuthoritativeItems: async () => [replacement],
      });
      await commitHardwareCloudSyncLocalRecovery(recovered);
      expect(local).toEqual(
        matches
          ? {
              ...before,
              rawData: replacement.rawData,
              data: replacement.data,
              pwdHash: replacement.pwdHash,
              serverUploaded: false,
            }
          : before,
      );
      expect(build).not.toHaveBeenCalled();
    },
  );

  test.each([
    ...[
      EPrimeCloudSyncDataType.IndexedAccount,
      EPrimeCloudSyncDataType.AddressBook,
      EPrimeCloudSyncDataType.BrowserBookmark,
      EPrimeCloudSyncDataType.MarketWatchList,
      EPrimeCloudSyncDataType.CustomToken,
      EPrimeCloudSyncDataType.CustomNetwork,
      EPrimeCloudSyncDataType.CustomRpc,
      EPrimeCloudSyncDataType.BotWallet,
    ].map((dataType) => ({ dataType, uploaded: true })),
    { dataType: EPrimeCloudSyncDataType.AddressBook, uploaded: false },
    { dataType: EPrimeCloudSyncDataType.IndexedAccount, uploaded: false },
  ])(
    'rebuilds $dataType at the original version without old ciphertext (uploaded=$uploaded)',
    async ({ dataType, uploaded }) => {
      const rawKey = `${dataType} >> public-test-local-business-key`;
      local = {
        ...local,
        id: sha512ProSync({ data: rawKey }),
        dataType,
        data: '',
        rawKey: '',
        rawData: '',
        serverUploaded: uploaded,
        localSceneUpdated: true,
      };
      const rebuilt = {
        ...local,
        rawKey,
        rawData: 'canonical-indexed-account',
        data: 'current-indexed-account-ciphertext',
        pwdHash: 'hw-dek-current',
        dataTime: undefined,
      };
      const loadAuthoritativeItems = jest.fn(async () => [rebuilt]);
      const recovered = await prepareHardwareCloudSyncLocalRecovery({
        items: [local],
        syncCredential,
        knownPwdHashes: new Set(),
        loadAuthoritativeItems,
      });
      expect(loadAuthoritativeItems).toHaveBeenCalledWith([local]);
      await commitHardwareCloudSyncLocalRecovery(recovered);
      expect(local).toMatchObject({
        rawKey,
        rawData: rebuilt.rawData,
        data: rebuilt.data,
        pwdHash: rebuilt.pwdHash,
        dataTime: 200,
        serverUploaded: false,
        localSceneUpdated: true,
      });
      expect(build).not.toHaveBeenCalled();
    },
  );

  test.each([
    { localSceneUpdated: false },
    { dataTime: undefined },
    { isDeleted: true },
  ])(
    'leaves an acknowledged metadata row for the cloud to restore (%o)',
    async (patch) => {
      local = {
        ...local,
        dataType: EPrimeCloudSyncDataType.BrowserBookmark,
        rawData: '',
        serverUploaded: true,
        ...patch,
      };
      const before = { ...local };
      const loadAuthoritativeItems = jest.fn();
      const recovered = await prepareHardwareCloudSyncLocalRecovery({
        items: [local],
        syncCredential,
        knownPwdHashes: new Set(),
        loadAuthoritativeItems,
      });
      expect(recovered).toEqual([]);
      expect(local).toEqual(before);
      expect(loadAuthoritativeItems).not.toHaveBeenCalled();
      expect(build).not.toHaveBeenCalled();
    },
  );

  test.each([undefined, 200])(
    'prefers saved metadata and protects the original version (%s)',
    async (dataTime) => {
      const dataType = EPrimeCloudSyncDataType.AddressBook;
      local = {
        ...local,
        dataType,
        dataTime,
        rawData: JSON.stringify({
          dataType,
          rawKey: local.rawKey,
          payload: { name: 'Original edit' },
        }),
      };
      const loadAuthoritativeItems = jest.fn();
      const recovery = prepareHardwareCloudSyncLocalRecovery({
        items: [local],
        syncCredential,
        knownPwdHashes: new Set(),
        loadAuthoritativeItems,
      });
      if (dataTime === undefined) {
        await expect(recovery).rejects.toMatchObject({
          reason:
            'Local hardware sync record has no original modification time',
        });
        expect(build).not.toHaveBeenCalled();
      } else {
        await commitHardwareCloudSyncLocalRecovery(await recovery);
        expect(local).toMatchObject({ dataTime, pwdHash: 'hw-dek-current' });
        expect(build).toHaveBeenCalledWith(
          expect.objectContaining({ dataTime }),
        );
      }
      expect(loadAuthoritativeItems).not.toHaveBeenCalled();
    },
  );

  test('an opaque record accepted by key history is retained without re-encryption', async () => {
    local.rawData = '';
    const before = { ...local };
    const recovered = await prepareHardwareCloudSyncLocalRecovery({
      items: [local],
      syncCredential,
      knownPwdHashes: new Set([local.pwdHash]),
    });
    await commitHardwareCloudSyncLocalRecovery(recovered);
    expect(recovered).toEqual([]);
    expect(build).not.toHaveBeenCalled();
    expect(local).toEqual(before);
  });

  test('key history cannot recover a record with neither ciphertext nor plaintext', async () => {
    local.rawData = '';
    local.data = '';
    await expect(
      prepareHardwareCloudSyncLocalRecovery({
        items: [local],
        syncCredential,
        knownPwdHashes: new Set([local.pwdHash]),
      }),
    ).rejects.toMatchObject({
      reason: expect.stringContaining('Local hardware sync record'),
    });
  });
});
