import { DEV_UNKNOWN_AVATAR_DEVICE_ID } from '@onekeyhq/shared/src/consts/dbConsts';
import { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';
import errorUtils from '@onekeyhq/shared/src/errors/utils/errorUtils';
import { getVendorProfile } from '@onekeyhq/shared/src/hardware/config/vendorProfile';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type {
  ICloudSyncPayloadWallet,
  ICloudSyncTargetWallet,
} from '@onekeyhq/shared/types/prime/primeCloudSyncTypes';

import { withWalletNameHistoryDeadline } from '../../../dbs/simple/entity/SimpleDbEntityChangeHistory';
import cloudSyncItemBuilder from '../cloudSyncItemBuilder';

import { CloudSyncFlowManagerBase } from './CloudSyncFlowManagerBase';

import type {
  IDBCloudSyncItem,
  IDBDevice,
  IDBWallet,
} from '../../../dbs/local/types';

export class CloudSyncFlowManagerWallet extends CloudSyncFlowManagerBase<
  EPrimeCloudSyncDataType.Wallet,
  IDBWallet
> {
  override dataType = EPrimeCloudSyncDataType.Wallet as any;

  override removeSyncItemIfServerDeleted = true;

  override async isSupportSync(
    target: ICloudSyncTargetWallet,
  ): Promise<boolean> {
    const { wallet, dbDevice } = target;

    // The reserved QA device must stay local, including during full sync.
    if (
      accountUtils.isQrWallet({ walletId: wallet.id }) &&
      dbDevice?.deviceId === DEV_UNKNOWN_AVATAR_DEVICE_ID
    ) {
      return false;
    }

    // Third-party HW vendors (Ledger, ...) don't participate in cloud sync.
    // Without this gate, buildSyncRawKey falls through to '' and every
    // such wallet collapses onto the same hashed sync key.
    if (
      dbDevice?.vendor &&
      !getVendorProfile(dbDevice.vendor).supportsCloudSync
    ) {
      return false;
    }

    return (
      (accountUtils.isHdWallet({ walletId: wallet.id }) &&
        !accountUtils.isBotWallet({ walletId: wallet.id })) ||
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

    const result = cloudSyncItemBuilder.buildWalletSyncKey({
      dataType: EPrimeCloudSyncDataType.Wallet,
      wallet,
      dbDevice,
      accountIndex: undefined,
    });

    // Third-party HW wallets (Ledger) skip cloud sync
    if (!result) return '';

    return result.rawKey;
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
      firstEvmAddress: wallet.firstEvmAddress,
      //
      walletType,
      walletHash: hdWalletHash,
      hwDeviceId: dbDevice?.deviceId,
      passphraseState,
    };
  }

  override async syncToSceneEachItem(params: {
    isCurrent?: () => boolean;
    item?: IDBCloudSyncItem;
    target: ICloudSyncTargetWallet;
    payload: ICloudSyncPayloadWallet;
  }): Promise<boolean> {
    const { target, payload, item, isCurrent } = params;
    const walletId = target.wallet.id;
    let expectedCloudSyncWalletName: string | undefined;
    // The base flow has already authenticated and matched the Wallet payload.
    // Local pending ciphertext is upload intent, not permission to replace a
    // divergent canonical name (including after turning the same key back on).
    // An exact canonical match still allows ordinary same-name scene replay.
    const isLiveEncryptedSource =
      item?.data && !item.isDeleted && !item.pendingPublicAccountDeletionAt;
    const requiresNameCheck = item?.serverUploaded
      ? !!payload.name?.trim()
      : !!payload.name;
    if (isLiveEncryptedSource && requiresNameCheck) {
      let cancelled = false;
      try {
        expectedCloudSyncWalletName = await withWalletNameHistoryDeadline(
          (async () => {
            const canonical = await this.backgroundApi.localDb.getWallet({
              walletId,
              withoutRefill: true,
            });
            if (cancelled || (isCurrent && !isCurrent())) return undefined;
            if (!item.serverUploaded)
              return canonical.name === payload.name
                ? canonical.name
                : undefined;
            if (
              canonical.name.trim() &&
              canonical.name !== payload.name &&
              !(await this.backgroundApi.simpleDb.changeHistory.retainWalletName(
                {
                  walletId,
                  name: canonical.name,
                },
              ))
            )
              return undefined;
            return canonical.name;
          })(),
        );
        if (expectedCloudSyncWalletName === undefined) return false;
      } catch (error) {
        errorUtils.autoPrintErrorIgnore(error);
        return false;
      } finally {
        cancelled = true;
      }
    }
    if (isCurrent && !isCurrent()) return false;
    await this.backgroundApi.serviceAccount.setWalletNameAndAvatar({
      walletId,
      cloudSyncSource: item,
      ...(expectedCloudSyncWalletName === undefined
        ? {}
        : { expectedCloudSyncWalletName }),
      name: payload.name,
      avatar: payload.avatar,
      firstEvmAddress: payload.firstEvmAddress,
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
