import { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type {
  ICloudSyncPayloadWallet,
  ICloudSyncTargetWallet,
} from '@onekeyhq/shared/types/prime/primeCloudSyncTypes';

import cloudSyncItemBuilder from '../cloudSyncItemBuilder';

import { CloudSyncFlowManagerBase } from './CloudSyncFlowManagerBase';

import type { IDBDevice, IDBWallet } from '../../../dbs/local/types';

export class CloudSyncFlowManagerWallet extends CloudSyncFlowManagerBase<
  EPrimeCloudSyncDataType.Wallet,
  IDBWallet
> {
  override dataType = EPrimeCloudSyncDataType.Wallet as any;

  override removeSyncItemIfServerDeleted = true;

  override async isSupportSync(
    target: ICloudSyncTargetWallet,
  ): Promise<boolean> {
    const { wallet } = target;

    console.log('isSupportSync', wallet.id);

    return (
      accountUtils.isHdWallet({ walletId: wallet.id }) ||
      accountUtils.isQrWallet({ walletId: wallet.id }) ||
      accountUtils.isHwWallet({ walletId: wallet.id }) // hw and hidden wallet
    );
  }

  override async buildSyncRawKey({
    target,
  }: {
    target: ICloudSyncTargetWallet;
  }) {
    const { wallet, dbDevice } = target;

    const { rawKey } = cloudSyncItemBuilder.buildWalletSyncKey({
      dataType: EPrimeCloudSyncDataType.Wallet,
      wallet,
      dbDevice,
      accountIndex: undefined,
    });

    return rawKey;
  }

  override async buildSyncPayload({
    target,
  }: {
    target: ICloudSyncTargetWallet;
  }): Promise<ICloudSyncPayloadWallet> {
    const { wallet, dbDevice } = target;
    const {
      // use hd exclusive hash, not shared xfp, avoid software and hardware wallets' avatar and name shared
      hash: hdWalletHash,
      // xfp: walletXfp, // do NOT use xfp
      type: walletType,
      passphraseState = '',
    } = wallet;

    return {
      name: wallet.name,
      avatar: wallet.avatarInfo,
      //
      walletType,
      walletHash: hdWalletHash,
      hwDeviceId: dbDevice?.deviceId,
      passphraseState,
    };
  }

  override async syncToSceneEachItem(params: {
    target: ICloudSyncTargetWallet;
    payload: ICloudSyncPayloadWallet;
  }): Promise<boolean> {
    const { target, payload } = params;
    await this.backgroundApi.serviceAccount.setWalletNameAndAvatar({
      walletId: target.wallet.id,
      name: payload.name,
      avatar: payload.avatar,
      // avoid infinite loop sync
      skipSaveLocalSyncItem: true,
      skipEmitEvent: true,
    });
    return true;
  }

  override async getDBRecordBySyncPayload(params: {
    payload: ICloudSyncPayloadWallet;
  }): Promise<IDBWallet | undefined> {
    const { payload } = params;
    return this.backgroundApi.localDb.getWalletBySyncPayload({ payload });
  }

  override async buildSyncTargetByPayload(params: {
    payload: ICloudSyncPayloadWallet;
  }): Promise<ICloudSyncTargetWallet | undefined> {
    return this.baseBuildSyncTargetByPayload(params);
  }

  override async buildSyncTargetByDBQuery(params: {
    dbRecord: IDBWallet;
    allDevices?: IDBDevice[];
  }): Promise<ICloudSyncTargetWallet> {
    // dbRecord -> target -> payload
    const { dbRecord: wallet, allDevices } = params;
    let dbDevice: IDBDevice | undefined;
    if (wallet.associatedDevice) {
      dbDevice = await this.backgroundApi.localDb.getWalletDeviceSafe({
        walletId: wallet?.id || '',
        dbWallet: wallet,
        allDevices,
      });
    }
    return {
      targetId: wallet.id,
      dataType: EPrimeCloudSyncDataType.Wallet,
      wallet: {
        ...wallet,
        name: wallet.name,
        avatarInfo: wallet.avatarInfo,
      },
      dbDevice,
    };
  }
}
