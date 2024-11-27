import { InteractionManager } from 'react-native';

import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import localDb from '../../dbs/local/localDb';
import simpleDb from '../../dbs/simple/simpleDb';
import ServiceBase from '../ServiceBase';

import type { IDBAccount } from '../../dbs/local/types';

class ServiceAppCleanup extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  async isCleanupTime() {
    const appCleanupData = await simpleDb.appCleanup.getRawData();
    const lastCleanupTime = appCleanupData?.lastCleanupTime;
    const currentTime = Date.now();
    if (
      lastCleanupTime &&
      currentTime - lastCleanupTime <
        timerUtils.getTimeDurationMs({
          day: 1,
        })
    ) {
      return false;
    }
    return true;
  }

  async updateCleanupTime() {
    await simpleDb.appCleanup.setRawData((v) => ({
      ...v,
      lastCleanupTime: Date.now(),
    }));
  }

  @backgroundMethod()
  async clearCleanupTime() {
    await simpleDb.appCleanup.setRawData((v) => ({
      ...v,
      lastCleanupTime: undefined,
    }));
  }

  @backgroundMethod()
  async cleanup(
    params: { accountsRemoved: IDBAccount[] | undefined } = {
      accountsRemoved: undefined,
    },
  ) {
    const isCleanupTime = await this.isCleanupTime();
    if (!isCleanupTime && !platformEnv.isDev) {
      return;
    }
    await this.updateCleanupTime();

    // **** cleanup accounts
    await this.cleanupAccounts(params.accountsRemoved);

    // **** cleanup indexed accounts
    await this.cleanupIndexedAccounts();

    // **** cleanup credentials
    // The number of private key and mnemonic wallets will not be many, so we don't clean up here
    // await this.cleanupCredentials();

    // **** cleanup address/tokens/tx history
    // getAccountNameFromAddress()

    // **** cleanup sign messages history
    // **** cleanup sign transactions history
    // **** cleanup connected sites history
    // TODO export log with connected sites records counts

    // **** cleanup not keep hidden wallets

    // **** cleanup device which not associated with any wallet

    return {
      success: true,
    };
  }

  async cleanupAccounts(accountsRemoved?: IDBAccount[]) {
    await this.runCleanupTask(async () => {
      if (!accountsRemoved) {
        // eslint-disable-next-line no-param-reassign
        ({ accountsRemoved } =
          await this.backgroundApi.serviceAccount.getAllAccounts({
            filterRemoved: true,
          }));
      }
      if (accountsRemoved?.length) {
        await localDb.removeAccounts({ accounts: accountsRemoved });
      }
    });
  }

  async cleanupIndexedAccounts() {
    await this.runCleanupTask(async () => {
      const { indexedAccountsRemoved } =
        await this.backgroundApi.serviceAccount.getAllIndexedAccounts({
          filterRemoved: true,
        });
      if (indexedAccountsRemoved.length) {
        await localDb.removeIndexedAccounts({
          indexedAccounts: indexedAccountsRemoved,
        });
      }
    });
  }

  async cleanupCredentials() {
    await this.runCleanupTask(async () => {
      const { credentialsRemoved } =
        await this.backgroundApi.serviceAccount.getAllCredentials();
      if (credentialsRemoved.length) {
        await localDb.removeCredentials({ credentials: credentialsRemoved });
      }
    });
  }

  async runCleanupTask(fn: () => Promise<void>) {
    await InteractionManager.runAfterInteractions(async () => {
      try {
        await fn();
      } catch (error) {
        console.error(error);
      }
    });
  }
}

export default ServiceAppCleanup;
