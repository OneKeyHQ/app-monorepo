import { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';
import type {
  ICloudSyncCredential,
  ICloudSyncPayloadIndexedAccount,
  ICloudSyncTargetIndexedAccount,
} from '@onekeyhq/shared/types/prime/primeCloudSyncTypes';

import cloudSyncItemBuilder from '../cloudSyncItemBuilder';

import { CloudSyncFlowManagerIndexedAccount } from './CloudSyncFlowManagerIndexedAccount';

import type { IBackgroundApi } from '../../../apis/IBackgroundApi';
import type { IDBCloudSyncItem } from '../../../dbs/local/types';

const credential: ICloudSyncCredential = {
  primeAccountSalt: '',
  securityPasswordR1: '',
  masterPasswordUUID: '',
  keylessCredential: {
    keylessWalletId: 'acknowledgment-test-wallet',
    signingPrivateKey: '11'.repeat(32),
    signingPublicKey: '02'.repeat(33),
    encryptionKey: '22'.repeat(32),
    pwdHash: 'keyless-acknowledgment-test',
  },
};
const payload: ICloudSyncPayloadIndexedAccount = {
  name: 'Account #1',
  index: 0,
  walletXfp: '12345678',
};
const rawKey = `${EPrimeCloudSyncDataType.IndexedAccount} >> ${payload.walletXfp}__0`;
const target: ICloudSyncTargetIndexedAccount = {
  targetId: 'hw-test--0',
  dataType: EPrimeCloudSyncDataType.IndexedAccount,
  indexedAccount: {
    id: 'hw-test--0',
    name: payload.name,
    walletId: 'hw-test',
    index: payload.index,
    idHash: 'indexed-account-test',
  },
  wallet: undefined,
};

async function harness(overrides: Partial<IDBCloudSyncItem> = {}) {
  const setUniversalIndexedAccountName = jest.fn(
    async (): Promise<void> => undefined,
  );
  const pool = new Map<string, IDBCloudSyncItem>();
  const updateSyncItem = jest.fn(
    async ({
      ids,
      updater,
    }: Parameters<IBackgroundApi['localDb']['updateSyncItem']>[0]) => {
      for (const id of ids) {
        const record = pool.get(id);
        if (record) pool.set(id, await updater(record));
      }
    },
  );
  const manager = new CloudSyncFlowManagerIndexedAccount({
    backgroundApi: {
      localDb: { updateSyncItem },
      serviceAccount: { setUniversalIndexedAccountName },
    } as unknown as IBackgroundApi,
  });
  const buildTarget = jest
    .spyOn(manager, 'buildSyncTargetByPayload')
    .mockResolvedValue(target);
  const isSupportSync = jest
    .spyOn(manager, 'isSupportSync')
    .mockResolvedValue(true);
  const buildKey = jest
    .spyOn(manager, 'buildSyncKeyAndPayload')
    .mockResolvedValue({
      key: manager.rawKeyToHashKey(rawKey),
      rawKey,
      dataType: EPrimeCloudSyncDataType.IndexedAccount,
      payload,
    });
  const syncEachItem = jest.spyOn(manager, 'syncToSceneEachItem');
  const item = {
    ...(await cloudSyncItemBuilder.buildSyncItemFromRawDataJson({
      key: manager.rawKeyToHashKey(rawKey),
      rawDataJson: {
        dataType: EPrimeCloudSyncDataType.IndexedAccount,
        rawKey,
        payload,
      },
      syncCredential: credential,
      dataTime: 1_750_000_000_000,
    })),
    localSceneUpdated: true,
    serverUploaded: true,
    ...overrides,
  };
  // The replay input is a snapshot, not the current persisted row.
  pool.set(item.id, { ...item });
  const decrypt = jest.spyOn(cloudSyncItemBuilder, 'decryptSyncItem');
  const replay = (forceSync = true) =>
    manager.syncToScene({
      syncCredential: credential,
      items: [item],
      forceSync,
    });
  return {
    item,
    pool,
    manager,
    replay,
    decrypt,
    buildTarget,
    isSupportSync,
    buildKey,
    syncEachItem,
    setUniversalIndexedAccountName,
    updateSyncItem,
  };
}

describe('CloudSyncFlowManagerBase scene acknowledgments', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('forced unchanged replay decrypts and applies the business scene without rewriting its acknowledgment', async () => {
    const h = await harness();
    const stored = { ...h.pool.get(h.item.id) };
    await h.replay();

    expect(h.decrypt).toHaveBeenCalledWith({
      item: h.item,
      syncCredential: credential,
    });
    expect(h.item.rawDataJson?.payload).toEqual(payload);
    expect(h.buildTarget).toHaveBeenCalledWith({ payload });
    expect(h.isSupportSync).toHaveBeenCalledWith(target);
    expect(h.buildKey).toHaveBeenCalledWith({
      target,
      callerName: 'syncToScene',
    });
    expect(h.syncEachItem).toHaveBeenCalledTimes(1);
    expect(h.setUniversalIndexedAccountName).toHaveBeenCalledWith({
      indexedAccountId: undefined,
      ...payload,
      skipSaveLocalSyncItem: true,
      skipEventEmit: true,
    });
    expect(h.updateSyncItem).not.toHaveBeenCalled();
    expect(h.pool.get(h.item.id)).toEqual(stored);
  });

  test.each<Partial<IDBCloudSyncItem>>([
    { localSceneUpdated: false },
    { pwdHash: 'keyless-old-acknowledgment' },
    { rawData: '' },
    { rawData: undefined },
    { rawKey: '' },
  ])('persists changed acknowledgment fields: %j', async (overrides) => {
    const h = await harness(overrides);
    await h.replay();

    expect(h.syncEachItem).toHaveBeenCalledTimes(1);
    expect(h.updateSyncItem).toHaveBeenCalledTimes(1);
    expect(h.pool.get(h.item.id)).toMatchObject({
      localSceneUpdated: true,
      pwdHash: cloudSyncItemBuilder.getPwdHash(credential),
      rawData: h.item.rawData,
      rawKey,
    });
    expect(h.item.pwdHash).toBe(cloudSyncItemBuilder.getPwdHash(credential));
    expect(h.item.rawKey).toBe(rawKey);
    expect(h.item.rawData).toBeTruthy();
  });

  test('persists fields when a caller already decrypted the replay input', async () => {
    const h = await harness({ rawData: '', rawKey: '' });
    await cloudSyncItemBuilder.decryptSyncItem({
      item: h.item,
      syncCredential: credential,
    });
    expect(h.item.rawDataJson?.payload).toEqual(payload);
    expect(h.pool.get(h.item.id)?.rawData).toBe('');
    await h.replay();

    expect(h.decrypt).toHaveBeenCalledTimes(2);
    expect(h.syncEachItem).toHaveBeenCalledTimes(1);
    expect(h.updateSyncItem).toHaveBeenCalledTimes(1);
    expect(h.pool.get(h.item.id)).toMatchObject({
      localSceneUpdated: true,
      rawData: h.item.rawData,
      rawKey,
    });
  });

  test('ordinary pending replay still persists its acknowledgment', async () => {
    const h = await harness({ localSceneUpdated: false });
    await h.replay(false);

    expect(h.syncEachItem).toHaveBeenCalledTimes(1);
    expect(h.updateSyncItem).toHaveBeenCalledTimes(1);
    expect(h.pool.get(h.item.id)?.localSceneUpdated).toBe(true);
  });

  test('ordinary already-applied items are still not replayed', async () => {
    const h = await harness();
    await h.replay(false);

    expect(h.decrypt).not.toHaveBeenCalled();
    expect(h.syncEachItem).not.toHaveBeenCalled();
    expect(h.updateSyncItem).not.toHaveBeenCalled();
  });

  test('compares the effective raw key without overwriting an existing stored key', async () => {
    const h = await harness({ rawKey: 'existing-local-raw-key' });
    await h.replay();

    expect(h.item.rawKey).toBe(rawKey);
    expect(h.syncEachItem).toHaveBeenCalledTimes(1);
    expect(h.updateSyncItem).not.toHaveBeenCalled();
    expect(h.pool.get(h.item.id)?.rawKey).toBe('existing-local-raw-key');
  });

  test('leaves concurrent invalidation pending when the original acknowledgment was unchanged', async () => {
    const h = await harness();
    h.setUniversalIndexedAccountName.mockImplementation(async () => {
      h.pool.set(h.item.id, {
        ...h.item,
        localSceneUpdated: false,
        dataTime: 1_750_000_000_001,
        rawData: 'newer-pending-data',
      });
    });
    await h.replay();

    expect(h.updateSyncItem).not.toHaveBeenCalled();
    expect(h.pool.get(h.item.id)).toMatchObject({
      localSceneUpdated: false,
      dataTime: 1_750_000_000_001,
      rawData: 'newer-pending-data',
    });
  });

  test('a necessary acknowledgment preserves the current transaction record raw key', async () => {
    const h = await harness({ rawKey: '' });
    h.setUniversalIndexedAccountName.mockImplementation(async () => {
      const record = h.pool.get(h.item.id);
      if (record) record.rawKey = 'concurrently-filled-raw-key';
    });
    await h.replay();

    expect(h.updateSyncItem).toHaveBeenCalledTimes(1);
    expect(h.pool.get(h.item.id)?.rawKey).toBe('concurrently-filled-raw-key');
  });

  test.each([true, false])(
    'deleted item with prior acknowledgment %s is still replayed',
    async (localSceneUpdated) => {
      const h = await harness({ isDeleted: true, localSceneUpdated });
      await h.replay();

      expect(h.syncEachItem).toHaveBeenCalledWith({
        item: expect.objectContaining({ isDeleted: true }),
        target,
        payload,
      });
      expect(h.updateSyncItem).toHaveBeenCalledTimes(localSceneUpdated ? 0 : 1);
    },
  );

  test('does not acknowledge failed authentication or decryption', async () => {
    const h = await harness({
      localSceneUpdated: false,
      data: 'invalid-ciphertext',
    });
    await h.replay();

    expect(h.decrypt).toHaveBeenCalledTimes(1);
    expect(h.syncEachItem).not.toHaveBeenCalled();
    expect(h.updateSyncItem).not.toHaveBeenCalled();
    expect(h.pool.get(h.item.id)?.localSceneUpdated).toBe(false);
  });

  test('does not acknowledge an invalid key', async () => {
    const h = await harness({ localSceneUpdated: false });
    h.buildKey.mockResolvedValue({
      key: 'incorrect-key',
      rawKey,
      dataType: EPrimeCloudSyncDataType.IndexedAccount,
      payload,
    });
    await h.replay();

    expect(h.decrypt).toHaveBeenCalledTimes(1);
    expect(h.syncEachItem).not.toHaveBeenCalled();
    expect(h.updateSyncItem).not.toHaveBeenCalled();
    expect(h.pool.get(h.item.id)?.localSceneUpdated).toBe(false);
  });

  test('does not replay or acknowledge an unsupported target', async () => {
    const h = await harness({ localSceneUpdated: false });
    h.isSupportSync.mockResolvedValue(false);
    await h.replay();

    expect(h.decrypt).toHaveBeenCalledTimes(1);
    expect(h.buildKey).not.toHaveBeenCalled();
    expect(h.syncEachItem).not.toHaveBeenCalled();
    expect(h.updateSyncItem).not.toHaveBeenCalled();
  });

  test.each(['rejected', 'error'])(
    'does not acknowledge a business result of %s',
    async (result) => {
      const h = await harness({ localSceneUpdated: false });
      if (result === 'error') {
        h.syncEachItem.mockRejectedValue(new Error('scene-application-failed'));
      } else {
        h.syncEachItem.mockResolvedValue(false);
      }
      await h.replay();

      expect(h.syncEachItem).toHaveBeenCalledTimes(1);
      expect(h.updateSyncItem).not.toHaveBeenCalled();
      expect(h.pool.get(h.item.id)?.localSceneUpdated).toBe(false);
    },
  );
});
