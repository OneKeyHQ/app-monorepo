import { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';
import type { IDBCustomRpc } from '@onekeyhq/shared/types/customRpc';
import type {
  ICloudSyncCredential,
  ICloudSyncPayloadCustomRpc,
} from '@onekeyhq/shared/types/prime/primeCloudSyncTypes';

import cloudSyncItemBuilder from '../cloudSyncItemBuilder';

import { CloudSyncFlowManagerCustomRpc } from './CloudSyncFlowManagerCustomRpc';

import type { IBackgroundApi } from '../../../apis/IBackgroundApi';
import type { IDBCloudSyncItem } from '../../../dbs/local/types';

const credential: ICloudSyncCredential = {
  primeAccountSalt: '',
  securityPasswordR1: '',
  masterPasswordUUID: '',
  keylessCredential: {
    keylessWalletId: 'custom-rpc-test-wallet',
    signingPrivateKey: '11'.repeat(32),
    signingPublicKey: '02'.repeat(33),
    encryptionKey: '22'.repeat(32),
    pwdHash: 'keyless-custom-rpc-test',
  },
};

const sampleCustomRpc: IDBCustomRpc = {
  networkId: 'evm--1',
  rpc: 'https://eth-mainnet.g.alchemy.com/v2/secret-api-key-12345',
  enabled: true,
  isCustomNetwork: false,
  updatedAt: 1_750_000_000_000,
};

function setup() {
  const pool = new Map<string, IDBCloudSyncItem>();
  const deleteCustomRpc = jest.fn(async (): Promise<void> => undefined);
  const addCustomRpc = jest.fn(async (): Promise<void> => undefined);
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
  const manager = new CloudSyncFlowManagerCustomRpc({
    backgroundApi: {
      localDb: { updateSyncItem },
      serviceCustomRpc: { deleteCustomRpc, addCustomRpc },
      servicePrimeCloudSync: {
        getCloudSyncDataTime: jest.fn(async () => 1_750_000_000_500),
      },
    } as unknown as IBackgroundApi,
  });

  return { manager, pool, deleteCustomRpc, addCustomRpc, updateSyncItem };
}

describe('CloudSyncFlowManagerCustomRpc deletion privacy', () => {
  it('redacts rpc URL and clears rawData when building an encrypted deletion tombstone', async () => {
    const { manager } = setup();
    const item = await manager.buildSyncItemByDBQuery({
      dbRecord: sampleCustomRpc,
      isDeleted: true,
      dataTime: undefined,
      syncCredential: credential,
    });

    expect(item).toBeDefined();
    expect(item?.isDeleted).toBe(true);
    expect(item?.localSceneUpdated).toBe(true);
    expect(item?.data).toBeTruthy();
    expect(item?.rawData).toBe('');

    const decrypted = await cloudSyncItemBuilder.decryptSyncItem({
      item: { ...item! },
      syncCredential: credential,
    });
    const payload = decrypted.rawDataJson
      ?.payload as ICloudSyncPayloadCustomRpc;
    expect(payload.networkId).toBe(sampleCustomRpc.networkId);
    expect(payload.rpc).toBe('');
    expect(decrypted.dbItem.rawData).not.toContain('secret-api-key-12345');
  });

  it('redacts rpc URL in offline unencrypted deletion rawData while retaining networkId', async () => {
    const { manager } = setup();
    const item = await manager.buildSyncItemByDBQuery({
      dbRecord: sampleCustomRpc,
      isDeleted: true,
      dataTime: undefined,
      syncCredential: undefined,
    });

    expect(item).toBeDefined();
    expect(item?.data).toBeUndefined();
    expect(item?.isDeleted).toBe(true);
    expect(item?.rawData).toBeTruthy();
    expect(item?.rawData).not.toContain('secret-api-key-12345');

    const parsed = JSON.parse(item!.rawData!) as {
      payload: ICloudSyncPayloadCustomRpc;
    };
    expect(parsed.payload.networkId).toBe(sampleCustomRpc.networkId);
    expect(parsed.payload.rpc).toBe('');
  });

  it('preserves rpc URL for live add/update sync items', async () => {
    const { manager } = setup();
    const item = await manager.buildSyncItemByDBQuery({
      dbRecord: sampleCustomRpc,
      isDeleted: false,
      dataTime: undefined,
      syncCredential: credential,
    });

    expect(item?.isDeleted).toBe(false);
    expect(item?.rawData).toContain(sampleCustomRpc.rpc);
  });

  it('does not persist decrypted plaintext rpc URL when applying a remote deletion tombstone', async () => {
    const { manager, pool, deleteCustomRpc, updateSyncItem } = setup();
    const rawKey = `${EPrimeCloudSyncDataType.CustomRpc} >> ${sampleCustomRpc.networkId}`;
    const key = manager.rawKeyToHashKey(rawKey);
    // Simulate a remote peer sending a legacy deletion ciphertext containing the RPC URL.
    const remoteDeletion: IDBCloudSyncItem = {
      ...(await cloudSyncItemBuilder.buildSyncItemFromRawDataJson({
        key,
        rawDataJson: {
          dataType: EPrimeCloudSyncDataType.CustomRpc,
          rawKey,
          payload: sampleCustomRpc,
        },
        syncCredential: credential,
        dataTime: 1_750_000_000_900,
      })),
      rawData: '',
      rawKey: '',
      isDeleted: true,
      localSceneUpdated: false,
      serverUploaded: true,
    };
    pool.set(remoteDeletion.id, { ...remoteDeletion });

    await manager.syncToScene({
      syncCredential: credential,
      items: [remoteDeletion],
    });

    expect(deleteCustomRpc).toHaveBeenCalledWith({
      customRpc: sampleCustomRpc,
      skipSaveLocalSyncItem: true,
      skipEventEmit: true,
    });
    expect(updateSyncItem).toHaveBeenCalledTimes(1);
    expect(pool.get(remoteDeletion.id)).toMatchObject({
      isDeleted: true,
      localSceneUpdated: true,
      rawData: '',
      rawKey,
    });
  });
});
