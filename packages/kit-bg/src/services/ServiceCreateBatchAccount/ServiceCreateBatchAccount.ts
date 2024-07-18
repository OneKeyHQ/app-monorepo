import { chunk, isNil, range } from 'lodash';

import {
  backgroundClass,
  backgroundMethod,
  toastIfError,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { IMPL_EVM } from '@onekeyhq/shared/src/engine/engineConsts';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IBatchCreateAccount } from '@onekeyhq/shared/types/account';

import localDb from '../../dbs/local/localDb';
import ServiceBase from '../ServiceBase';

import type { IAccountDeriveTypes } from '../../vaults/types';

export type IBatchBuildAccountsBaseParams = {
  walletId: string;
  networkId: string;
  deriveType: IAccountDeriveTypes;
  // skipDeviceCancel?: boolean;
  // hideCheckingDeviceLoading?: boolean;
};
export type IBatchBuildAccountsParams = IBatchBuildAccountsBaseParams & {
  fromIndex?: number;
  toIndex?: number;
  indexes?: number[];
  excludedIndexes?: {
    [index: number]: true;
  };
  saveToDb?: boolean;
};

@backgroundClass()
class ServiceCreateBatchAccount extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  networkAccountsCache: Partial<{
    [key: string]: IBatchCreateAccount;
  }> = {};

  buildNetworkAccountCacheKey({
    walletId,
    networkId,
    deriveType,
    index,
  }: IBatchBuildAccountsBaseParams & {
    index: number;
  }) {
    let networkIdOrImpl = networkId;
    const impl = networkUtils.getNetworkImpl({ networkId });
    if ([IMPL_EVM].includes(impl)) {
      networkIdOrImpl = impl;
    }

    return `${walletId}_${networkIdOrImpl}_${deriveType}_${index}`;
  }

  @backgroundMethod()
  async clearNetworkAccountCache() {
    this.networkAccountsCache = {};
  }

  async updateAccountExistsInDb({ account }: { account: IBatchCreateAccount }) {
    if (await localDb.getAccountSafe({ accountId: account.id })) {
      account.existsInDb = true;
    } else {
      account.existsInDb = false;
    }
  }

  @backgroundMethod()
  async prepareBatchCreate() {
    await this.clearNetworkAccountCache();
  }

  isCreateFlowCancelled = false;

  @backgroundMethod()
  @toastIfError()
  async startBatchCreateAccountsFlow(params: IBatchBuildAccountsParams) {
    this.isCreateFlowCancelled = false;
    return this.batchBuildAccounts({ ...params, saveToDb: true });
  }

  @backgroundMethod()
  async cancelBatchCreateAccountsFlow() {
    this.isCreateFlowCancelled = true;
  }

  checkIfCancelled({ saveToDb }: { saveToDb: boolean | undefined }) {
    if (saveToDb && this.isCreateFlowCancelled) {
      throw new Error('Batch Create Accounts Cancelled');
    }
  }

  @backgroundMethod()
  @toastIfError()
  async batchBuildAccounts({
    walletId,
    networkId,
    deriveType,
    fromIndex,
    toIndex,
    indexes,
    excludedIndexes,
    saveToDb,
  }: IBatchBuildAccountsParams) {
    if (!indexes) {
      if (isNil(fromIndex)) {
        throw new Error('fromIndex is required');
      }
      if (isNil(toIndex)) {
        throw new Error('toIndex is required');
      }
      // eslint-disable-next-line no-param-reassign
      indexes = range(fromIndex, toIndex + 1);
    }
    if (!indexes || !indexes?.length) {
      throw new Error('indexes is required');
    }

    const totalCount = indexes.length;
    let createdCount = 0;
    const progressTotal =
      totalCount - Object.keys(excludedIndexes || {}).length;
    let progressCurrent = 0;

    const accountsForCreate: IBatchCreateAccount[] = [];

    const indexesForRebuild: number[] = [];

    const processAccountForCreate = async ({
      key,
      accountForCreate,
    }: {
      key: string;
      accountForCreate: IBatchCreateAccount;
    }) => {
      this.checkIfCancelled({ saveToDb });
      await this.updateAccountExistsInDb({ account: accountForCreate });
      this.networkAccountsCache[key] = accountForCreate;
      accountsForCreate.push(accountForCreate);
      if (saveToDb) {
        if (!accountForCreate.existsInDb) {
          this.checkIfCancelled({ saveToDb });
          await this.backgroundApi.serviceAccount.addBatchCreatedHdOrHwAccount({
            walletId,
            networkId,
            account: accountForCreate,
          });
          createdCount += 1;
          await timerUtils.wait(100);
        }
        progressCurrent += 1;
        appEventBus.emit(EAppEventBusNames.BatchCreateAccount, {
          totalCount,
          createdCount,
          progressTotal,
          progressCurrent,
        });
        await timerUtils.wait(100);
      }
    };

    // for loop indexes
    for (const index of indexes) {
      this.checkIfCancelled({ saveToDb });
      if (excludedIndexes?.[index] === true) {
        // eslint-disable-next-line no-continue
        continue;
      }
      const key = this.buildNetworkAccountCacheKey({
        walletId,
        networkId,
        deriveType,
        index,
      });
      const cacheAccount = this.networkAccountsCache[key];
      if (cacheAccount) {
        await processAccountForCreate({
          key,
          accountForCreate: cacheAccount,
        });
      } else {
        indexesForRebuild.push(index);
      }
    }

    if (indexesForRebuild.length) {
      const indexesChunks = chunk(indexesForRebuild, 10);
      for (const indexesForRebuildChunk of indexesChunks) {
        this.checkIfCancelled({ saveToDb });
        const { vault, accounts } =
          await this.backgroundApi.serviceAccount.prepareHdOrHwAccounts({
            walletId,
            networkId,
            deriveType,
            indexes: indexesForRebuildChunk,
            indexedAccountId: undefined,
          });
        const networkInfo = await vault.getNetworkInfo();
        for (const account of accounts) {
          this.checkIfCancelled({ saveToDb });
          if (isNil(account.pathIndex)) {
            throw new Error(
              'batchBuildNetworkAccounts ERROR: pathIndex is required',
            );
          }
          if (excludedIndexes?.[account.pathIndex] === true) {
            // eslint-disable-next-line no-continue
            continue;
          }
          const key = this.buildNetworkAccountCacheKey({
            walletId,
            networkId,
            deriveType,
            index: account.pathIndex,
          });
          this.checkIfCancelled({ saveToDb });

          const addressDetail = await vault?.buildAccountAddressDetail({
            account,
            networkId,
            networkInfo,
          });
          const accountForCreate: IBatchCreateAccount = {
            ...account,
            addressDetail,
            existsInDb: false,
          };
          await processAccountForCreate({
            key,
            accountForCreate,
          });
        }
      }
    }

    if (saveToDb) {
      appEventBus.emit(EAppEventBusNames.BatchCreateAccount, {
        totalCount,
        createdCount,
        progressTotal,
        progressCurrent: progressTotal,
      });
      await timerUtils.wait(600);
      appEventBus.emit(EAppEventBusNames.AccountUpdate, undefined);
      void this.backgroundApi.serviceCloudBackup.requestAutoBackup();
    }
    return { accountsForCreate };
  }
}

export default ServiceCreateBatchAccount;
