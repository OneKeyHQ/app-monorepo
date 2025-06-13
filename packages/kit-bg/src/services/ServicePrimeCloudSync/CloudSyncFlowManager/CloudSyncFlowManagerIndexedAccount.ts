/* eslint-disable @typescript-eslint/no-unused-vars */

import { sha512 } from '@noble/hashes/sha512';
import { isNil } from 'lodash';

import {
  WALLET_TYPE_HW,
  WALLET_TYPE_QR,
} from '@onekeyhq/shared/src/consts/dbConsts';
import { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
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

  override removeSyncItemIfServerDeleted = true;

  override async isSupportSync(
    target: ICloudSyncTargetIndexedAccount,
  ): Promise<boolean> {
    const { indexedAccount, wallet } = target;
    if (wallet?.xfp && accountUtils.isValidWalletXfp({ xfp: wallet.xfp })) {
      return true;
    }
    return false;
  }

  override async buildSyncRawKey({
    target,
  }: {
    target: ICloudSyncTargetIndexedAccount;
  }): Promise<string> {
    const { wallet, indexedAccount } = target;

    // const { rawKey } = cloudSyncItemBuilder.buildWalletSyncKey({
    //   dataType: EPrimeCloudSyncDataType.IndexedAccount,
    //   wallet,
    //   dbDevice,
    //   accountIndex: indexedAccount.index,
    // });
    // return rawKey;

    const accountIndex = indexedAccount.index;

    if (!wallet) {
      throw new OneKeyLocalError(
        'buildWalletSyncKey ERROR: wallet is required',
      );
    }
    const { xfp: walletXfp } = wallet;

    if (!walletXfp) {
      throw new OneKeyLocalError(
        'buildWalletSyncKey ERROR: walletXfp is required',
      );
    }
    if (isNil(accountIndex)) {
      throw new OneKeyLocalError(
        'buildWalletSyncKey ERROR: accountIndex is required',
      );
    }

    const rawKey = [walletXfp, accountIndex.toString()].join('__');
    return rawKey;
  }

  override async buildSyncPayload({
    target,
    callerName,
  }: {
    target: ICloudSyncTargetIndexedAccount;
    callerName?: string;
  }): Promise<ICloudSyncPayloadIndexedAccount> {
    const { wallet, indexedAccount } = target;
    const {
      // because the name of indexedAccount needs to be shared between software and hardware wallets with the same mnemonic, so use xfp to identify
      xfp: walletXfp,
      // hash: hdWalletHash, // do NOT use hash
      type: walletType,
      passphraseState = '',
    } = wallet ?? {};

    if (!walletXfp) {
      throw new OneKeyLocalError(
        'buildSyncPayload ERROR: walletXfp is required',
      );
    }
    if (isNil(indexedAccount.index)) {
      throw new OneKeyLocalError(
        'buildSyncPayload ERROR: accountIndex is required',
      );
    }

    console.log(
      'CloudSyncFlowManagerIndexedAccount buildSyncKeyAndPayload',
      callerName,
      indexedAccount,
    );

    return {
      name: indexedAccount.name,
      index: indexedAccount.index,
      walletXfp,
      //
      // walletType,
      // walletHash,
      // hwDeviceId: dbDevice?.deviceId,
      // passphraseState,
    };
  }

  override async syncToSceneEachItem(params: {
    target: ICloudSyncTargetIndexedAccount;
    payload: ICloudSyncPayloadIndexedAccount;
  }): Promise<boolean> {
    const { target, payload } = params;
    await this.backgroundApi.serviceAccount.setUniversalIndexedAccountName({
      indexedAccountId: undefined,
      index: payload.index,
      walletXfp: payload?.walletXfp,
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
    const { walletXfp, index } = params.payload;
    const wallets = await this.backgroundApi.localDb.getWalletsByXfp({
      xfp: walletXfp,
    });
    if (!wallets.length) {
      return undefined;
    }
    const wallet = wallets[0];
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
    const { dbRecord: indexedAccount } = params;
    let wallet: IDBWallet | undefined;
    if (indexedAccount.id) {
      wallet = await this.backgroundApi.localDb.getWalletByIndexedAccountId({
        indexedAccountId: indexedAccount.id,
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
    };
  }
}
