import {
  DEV_UNKNOWN_AVATAR_DEVICE_ID,
  WALLET_TYPE_HD,
  WALLET_TYPE_HW,
  WALLET_TYPE_QR,
} from '@onekeyhq/shared/src/consts/dbConsts';
import { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';
import errorUtils from '@onekeyhq/shared/src/errors/utils/errorUtils';
import { getVendorProfile } from '@onekeyhq/shared/src/hardware/config/vendorProfile';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { resolveBeforeTimeout } from '@onekeyhq/shared/src/utils/timerUtils';
import type {
  ICloudSyncCredential,
  ICloudSyncPayloadWallet,
  ICloudSyncTargetWallet,
} from '@onekeyhq/shared/types/prime/primeCloudSyncTypes';

import cloudSyncItemBuilder from '../cloudSyncItemBuilder';

import { CloudSyncFlowManagerBase } from './CloudSyncFlowManagerBase';

import type {
  IDBCloudSyncItem,
  IDBDevice,
  IDBSetWalletNameAndAvatarParams,
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

  async canUploadPendingWalletName({
    item,
    syncCredential,
  }: {
    item: IDBCloudSyncItem;
    syncCredential: ICloudSyncCredential;
  }): Promise<boolean> {
    if (
      item.dataType !== EPrimeCloudSyncDataType.Wallet ||
      !item.data ||
      item.isDeleted ||
      item.serverUploaded
    )
      return true;
    if (item.pwdHash !== cloudSyncItemBuilder.getPwdHash(syncCredential))
      return false;
    try {
      const { rawDataJson } = await cloudSyncItemBuilder.decryptSyncItem({
        item: { ...item },
        syncCredential,
      });
      if (rawDataJson?.dataType !== EPrimeCloudSyncDataType.Wallet)
        return false;
      const { payload } = rawDataJson;
      if (!payload || typeof payload.name !== 'string') return false;
      const localDb = this.backgroundApi.localDb;
      // The normal scene lookup refills presentation and may emit hardware
      // avatar events. This optional upload verification must only read.
      const { wallets } = await localDb.getAllWallets();
      const isHardware =
        payload.walletType === WALLET_TYPE_HW ||
        payload.walletType === WALLET_TYPE_QR;
      const device =
        isHardware && payload.hwDeviceId
          ? await localDb.getDeviceByQuery({
              featuresDeviceId: payload.hwDeviceId,
            })
          : undefined;
      const matching = wallets.filter(
        (wallet) =>
          wallet.type === payload.walletType &&
          (isHardware
            ? !!device &&
              wallet.associatedDevice === device.id &&
              (wallet.passphraseState || '') === (payload.passphraseState || '')
            : wallet.type === WALLET_TYPE_HD &&
              !!payload.walletHash &&
              wallet.hash === payload.walletHash),
      );
      if (matching.length !== 1) return false;
      const target = await this.buildSyncTargetByDBQuery({
        dbRecord: matching[0],
        allDevices: device ? [device] : undefined,
      });
      const key = await this.buildSyncKeyInfo({ target });
      if (key?.key !== item.id || rawDataJson.rawKey !== key.rawKey)
        return false;
      const wallet = await localDb.getWallet({
        walletId: target.wallet.id,
        withoutRefill: true,
      });
      return !payload.name?.trim() || wallet.name === payload.name;
    } catch (error) {
      errorUtils.autoPrintErrorIgnore(error);
      return false;
    }
  }

  override async syncToSceneEachItem(params: {
    isCurrent?: () => boolean;
    onWalletNameHistoryDeferred?: () => void;
    item?: IDBCloudSyncItem;
    target: ICloudSyncTargetWallet;
    payload: ICloudSyncPayloadWallet;
  }): Promise<boolean> {
    const { target, payload, item, isCurrent } = params;
    const walletId = target.wallet.id;
    let expectedCloudSyncWalletName: string | undefined;
    let deferCloudSyncWalletName = false;
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
        expectedCloudSyncWalletName = await resolveBeforeTimeout(
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
            if (canonical.name.trim() && canonical.name !== payload.name) {
              deferCloudSyncWalletName = true;
              if (
                !(await this.backgroundApi.simpleDb.changeHistory.retainWalletName(
                  { walletId, name: canonical.name },
                ))
              )
                return undefined;
              if (cancelled) return undefined;
              deferCloudSyncWalletName = false;
            }
            return canonical.name;
          })(),
          1500,
        );
      } catch (error) {
        errorUtils.autoPrintErrorIgnore(error);
      } finally {
        cancelled = true;
      }
      if (
        expectedCloudSyncWalletName === undefined &&
        !deferCloudSyncWalletName
      )
        return false;
    }
    if (isCurrent && !isCurrent()) return false;
    if (deferCloudSyncWalletName) params.onWalletNameHistoryDeferred?.();
    if (
      deferCloudSyncWalletName &&
      !payload.avatar &&
      !payload.firstEvmAddress &&
      !item?.localSceneUpdated
    )
      return false;

    const update: IDBSetWalletNameAndAvatarParams = {
      walletId,
      cloudSyncSource: item,
      ...(expectedCloudSyncWalletName === undefined
        ? {}
        : { expectedCloudSyncWalletName }),
      ...(deferCloudSyncWalletName ? { deferCloudSyncWalletName: true } : {}),
      name: deferCloudSyncWalletName ? undefined : payload.name,
      avatar: payload.avatar,
      firstEvmAddress: payload.firstEvmAddress,
      // avoid infinite loop sync
      skipSaveLocalSyncItem: true,
      skipEmitEvent: true,
    };
    const { serviceAccount } = this.backgroundApi;
    if (isCurrent && item) {
      await serviceAccount.setWalletNameAndAvatarFromCloud(update, isCurrent);
    } else {
      await serviceAccount.setWalletNameAndAvatar(update);
    }
    return !deferCloudSyncWalletName;
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
