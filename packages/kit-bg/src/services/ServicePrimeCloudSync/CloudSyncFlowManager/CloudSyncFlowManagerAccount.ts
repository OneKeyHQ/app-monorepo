import { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type {
  ICloudSyncPayloadAccount,
  ICloudSyncTargetAccount,
} from '@onekeyhq/shared/types/prime/primeCloudSyncTypes';

import { CloudSyncFlowManagerBase } from './CloudSyncFlowManagerBase';

import type { IDBAccount, IDBDevice } from '../../../dbs/local/types';

export class CloudSyncFlowManagerAccount extends CloudSyncFlowManagerBase<
  EPrimeCloudSyncDataType.Account,
  IDBAccount
> {
  override dataType = EPrimeCloudSyncDataType.Account as any;

  override removeSyncItemIfServerDeleted = true;

  override async isSupportSync(
    target: ICloudSyncTargetAccount,
  ): Promise<boolean> {
    const { account } = target;

    if (accountUtils.isUrlAccountFn({ accountId: account.id })) {
      return false;
    }

    return (
      accountUtils.isWatchingAccount({ accountId: account.id }) ||
      accountUtils.isImportedAccount({ accountId: account.id })
    );
  }

  override async buildSyncRawKey({
    target,
  }: {
    target: ICloudSyncTargetAccount;
  }): Promise<string> {
    const { account } = target;
    return account.id;
  }

  override async buildSyncPayload({
    target,
  }: {
    target: ICloudSyncTargetAccount;
  }): Promise<ICloudSyncPayloadAccount> {
    const { account } = target;
    return {
      name: account.name,
      accountId: account.id,
    };
  }

  override async syncToSceneEachItem(params: {
    target: ICloudSyncTargetAccount;
    payload: ICloudSyncPayloadAccount;
  }): Promise<boolean> {
    const { target, payload } = params;
    await this.backgroundApi.serviceAccount.setAccountName({
      accountId: target.account.id,
      name: payload.name,
      // avoid infinite loop sync
      skipSaveLocalSyncItem: true,
      skipEventEmit: true,
    });
    return true;
  }

  override async getDBRecordBySyncPayload(params: {
    payload: ICloudSyncPayloadAccount;
  }): Promise<IDBAccount | undefined> {
    const { payload } = params;
    const { accountId } = payload;
    const account = await this.backgroundApi.localDb.getAccountSafe({
      accountId,
    });
    return account;
  }

  override async buildSyncTargetByPayload(params: {
    payload: ICloudSyncPayloadAccount;
  }): Promise<ICloudSyncTargetAccount | undefined> {
    return this.baseBuildSyncTargetByPayload(params);
  }

  override async buildSyncTargetByDBQuery(params: {
    dbRecord: IDBAccount;
    allDevices?: IDBDevice[];
  }): Promise<ICloudSyncTargetAccount> {
    const { dbRecord: account } = params;
    return {
      targetId: account.id,
      dataType: EPrimeCloudSyncDataType.Account,
      account,
    };
  }
}
