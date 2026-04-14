import { WALLET_TYPE_HD } from '@onekeyhq/shared/src/consts/dbConsts';
import { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type {
  ICloudSyncBotWalletRecord,
  ICloudSyncPayloadBotWallet,
  ICloudSyncTargetBotWallet,
} from '@onekeyhq/shared/types/prime/primeCloudSyncTypes';

import simpleDb from '../../../dbs/simple/simpleDb';
import cloudSyncItemBuilder from '../cloudSyncItemBuilder';

import { CloudSyncFlowManagerBase } from './CloudSyncFlowManagerBase';

import type {
  IDBCloudSyncItem,
  IDBDevice,
  IDBWallet,
} from '../../../dbs/local/types';

export class CloudSyncFlowManagerBotWallet extends CloudSyncFlowManagerBase<
  EPrimeCloudSyncDataType.BotWallet,
  ICloudSyncBotWalletRecord
> {
  override dataType = EPrimeCloudSyncDataType.BotWallet as any;

  override removeSyncItemIfServerDeleted = true;

  override async isSupportSync(
    target: ICloudSyncTargetBotWallet,
  ): Promise<boolean> {
    return Boolean(
      target.walletId &&
      target.parentKeylessWalletId &&
      accountUtils.isKeylessWallet({
        walletId: target.parentKeylessWalletId,
      }),
    );
  }

  override async buildSyncRawKey({
    target,
  }: {
    target: ICloudSyncTargetBotWallet;
  }): Promise<string> {
    const { rawKey } = cloudSyncItemBuilder.buildWalletSyncKey({
      dataType: EPrimeCloudSyncDataType.BotWallet,
      wallet: (target.wallet ??
        ({
          id: target.walletId,
          hash: target.walletHash,
          type: WALLET_TYPE_HD,
          passphraseState: '',
          name: target.metadata.name,
          avatarInfo: undefined,
        } as IDBWallet & { avatarInfo?: IDBWallet['avatarInfo'] })) as any,
      accountIndex: undefined,
    });

    return rawKey;
  }

  override async buildSyncPayload({
    target,
  }: {
    target: ICloudSyncTargetBotWallet;
  }): Promise<ICloudSyncPayloadBotWallet> {
    return {
      walletId: target.walletId,
      parentKeylessWalletId: target.parentKeylessWalletId,
      walletHash: target.wallet?.hash || target.walletHash,
      name: target.wallet?.name || target.metadata.name,
      avatar: target.wallet?.avatarInfo,
      index: target.metadata.index,
      visible: target.metadata.visible,
      status: target.metadata.status,
      deactivatedAt: target.metadata.deactivatedAt,
      createdAt: target.metadata.createdAt,
    };
  }

  override async syncToSceneEachItem(params: {
    item: IDBCloudSyncItem;
    target: ICloudSyncTargetBotWallet;
    payload: ICloudSyncPayloadBotWallet;
  }): Promise<boolean> {
    const { item, target, payload } = params;

    if (item.isDeleted) {
      return true;
    }

    if (target.wallet) {
      await this.backgroundApi.serviceAccount.setWalletNameAndAvatar({
        walletId: target.wallet.id,
        name: payload.name,
        avatar: payload.avatar,
        skipSaveLocalSyncItem: true,
        skipEmitEvent: true,
      });
      await simpleDb.botWallet.setMetadata(target.wallet.id, {
        index: payload.index,
        name: payload.name,
        visible: payload.visible,
        status: payload.status,
        deactivatedAt: payload.deactivatedAt,
        createdAt: payload.createdAt,
      });
      return true;
    }

    return this.backgroundApi.serviceAccount.createBotWalletFromCloudSync({
      walletId: payload.walletId,
      parentKeylessWalletId: payload.parentKeylessWalletId,
      index: payload.index,
      name: payload.name,
      avatar: payload.avatar,
      visible: payload.visible,
      status: payload.status,
      deactivatedAt: payload.deactivatedAt,
      createdAt: payload.createdAt,
    });
  }

  override async getDBRecordBySyncPayload(params: {
    payload: ICloudSyncPayloadBotWallet;
  }): Promise<ICloudSyncBotWalletRecord | undefined> {
    const metadata = await simpleDb.botWallet.getMetadata(
      params.payload.walletId,
    );
    if (!metadata) {
      return undefined;
    }
    return {
      walletId: params.payload.walletId,
      metadata,
    };
  }

  override async buildSyncTargetByPayload(params: {
    payload: ICloudSyncPayloadBotWallet;
  }): Promise<ICloudSyncTargetBotWallet | undefined> {
    return this.buildTarget({
      walletId: params.payload.walletId,
      parentKeylessWalletId: params.payload.parentKeylessWalletId,
      walletHash: params.payload.walletHash,
      metadata: {
        index: params.payload.index,
        name: params.payload.name,
        visible: params.payload.visible,
        status: params.payload.status,
        deactivatedAt: params.payload.deactivatedAt,
        createdAt: params.payload.createdAt,
      },
    });
  }

  override async buildSyncTargetByDBQuery(params: {
    dbRecord: ICloudSyncBotWalletRecord;
    allDevices?: IDBDevice[];
  }): Promise<ICloudSyncTargetBotWallet> {
    const target = await this.buildTarget({
      walletId: params.dbRecord.walletId,
      metadata: params.dbRecord.metadata,
    });
    if (!target) {
      throw new OneKeyLocalError('Bot wallet target is invalid');
    }
    return target;
  }

  private async buildTarget({
    walletId,
    parentKeylessWalletId,
    walletHash,
    metadata,
  }: {
    walletId: string;
    parentKeylessWalletId?: string;
    walletHash?: string;
    metadata: ICloudSyncBotWalletRecord['metadata'];
  }): Promise<ICloudSyncTargetBotWallet | undefined> {
    const parsedId = accountUtils.parseBotWalletId(walletId);
    if (
      !parsedId?.parentId ||
      parsedId.index !== metadata.index ||
      (parentKeylessWalletId && parsedId.parentId !== parentKeylessWalletId)
    ) {
      return undefined;
    }

    const parentWallet = await this.backgroundApi.localDb.getWalletSafe({
      walletId: parsedId.parentId,
      withoutRefill: true,
    });
    if (!parentWallet?.isKeyless) {
      return undefined;
    }

    const wallet = (await this.backgroundApi.localDb.getWalletSafe({
      walletId,
      withoutRefill: true,
    })) as (IDBWallet & { avatarInfo?: IDBWallet['avatarInfo'] }) | undefined;

    return {
      targetId: walletId,
      dataType: EPrimeCloudSyncDataType.BotWallet,
      walletId,
      parentKeylessWalletId: parsedId.parentId,
      walletHash: wallet?.hash || walletHash,
      metadata,
      wallet: wallet
        ? {
            ...wallet,
            name: wallet.name,
            avatarInfo: wallet.avatarInfo,
          }
        : undefined,
    };
  }
}
