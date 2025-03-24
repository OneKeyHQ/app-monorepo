/* eslint-disable @typescript-eslint/no-unused-vars */

import { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type {
  ICloudSyncKeyInfoIndexedAccount,
  ICloudSyncPayloadIndexedAccount,
  ICloudSyncTargetIndexedAccount,
} from '@onekeyhq/shared/types/prime/primeCloudSyncTypes';

import cloudSyncItemBuilder from '../cloudSyncItemBuilder';

import { CloudSyncFlowManagerBase } from './CloudSyncFlowManagerBase';

import type {
  IDBDevice,
  IDBIndexedAccount,
  IDBWallet,
} from '../../../dbs/local/types';

export class CloudSyncFlowManagerIndexedAccount extends CloudSyncFlowManagerBase<
  EPrimeCloudSyncDataType.IndexedAccount,
  IDBIndexedAccount
> {
  override dataType = EPrimeCloudSyncDataType.IndexedAccount as any;

  override async isSupportSync(
    target: ICloudSyncTargetIndexedAccount,
  ): Promise<boolean> {
    // const { indexedAccount } = target;
    return true;
  }

  override async buildSyncRawKey({
    target,
  }: {
    target: ICloudSyncTargetIndexedAccount;
  }): Promise<string> {
    const { wallet, dbDevice, indexedAccount } = target;

    const { rawKey } = cloudSyncItemBuilder.buildWalletSyncKey({
      dataType: EPrimeCloudSyncDataType.IndexedAccount,
      wallet,
      dbDevice,
      accountIndex: indexedAccount.index,
    });

    return rawKey;
  }

  override async buildSyncPayload({
    target,
    callerName,
  }: {
    target: ICloudSyncTargetIndexedAccount;
    callerName?: string;
  }): Promise<ICloudSyncPayloadIndexedAccount> {
    const { wallet, dbDevice, indexedAccount } = target;
    const {
      hash: walletHash,
      type: walletType,
      passphraseState = '',
    } = wallet ?? {};

    console.log(
      'CloudSyncFlowManagerIndexedAccount buildSyncKeyAndPayload',
      callerName,
      indexedAccount,
    );

    return {
      name: indexedAccount.name,
      index: indexedAccount.index,
      //
      walletType,
      walletHash,
      hwDeviceId: dbDevice?.deviceId,
      passphraseState,
    };
  }

  override async syncToSceneEachItem(params: {
    target: ICloudSyncTargetIndexedAccount;
    payload: ICloudSyncPayloadIndexedAccount;
  }): Promise<boolean> {
    const { target, payload } = params;
    await this.backgroundApi.serviceAccount.setAccountName({
      indexedAccountId: target.indexedAccount.id,
      name: payload.name,
      // avoid infinite loop sync
      skipSaveLocalSyncItem: true,
      skipEventEmit: true,
    });
    return true;
  }

  override async getDBRecordBySyncPayload(params: {
    payload: ICloudSyncPayloadIndexedAccount;
  }): Promise<IDBIndexedAccount | undefined> {
    const { payload } = params;
    const wallet = await this.backgroundApi.localDb.getWalletBySyncPayload({
      payload: {
        ...payload,
        avatar: undefined,
      },
    });
    if (!wallet) {
      return undefined;
    }
    const { index } = payload;
    const indexedAccountId = accountUtils.buildIndexedAccountId({
      walletId: wallet.id,
      index,
    });

    const account = await this.backgroundApi.localDb.getIndexedAccountSafe({
      id: indexedAccountId,
    });
    return account;
  }

  override async buildSyncTargetByPayload(params: {
    payload: ICloudSyncPayloadIndexedAccount;
  }): Promise<ICloudSyncTargetIndexedAccount | undefined> {
    return this.baseBuildSyncTargetByPayload(params);
  }

  override async buildSyncTargetByDBQuery(params: {
    dbRecord: IDBIndexedAccount;
    allDevices?: IDBDevice[];
  }): Promise<ICloudSyncTargetIndexedAccount> {
    const { dbRecord: indexedAccount, allDevices } = params;
    let wallet: IDBWallet | undefined;
    if (indexedAccount.id) {
      wallet = await this.backgroundApi.localDb.getWalletByIndexedAccountId({
        indexedAccountId: indexedAccount.id,
      });
    }
    let dbDevice: IDBDevice | undefined;
    if (wallet?.associatedDevice) {
      dbDevice = await this.backgroundApi.localDb.getWalletDeviceSafe({
        walletId: wallet?.id || '',
        dbWallet: wallet,
        allDevices,
      });
    }
    return {
      targetId: indexedAccount.id,
      dataType: EPrimeCloudSyncDataType.IndexedAccount,
      indexedAccount,
      wallet: wallet && {
        ...wallet,
        name: wallet?.name,
        avatarInfo: wallet?.avatarInfo,
      },
      dbDevice,
    };
  }
}
