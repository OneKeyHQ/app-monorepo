import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  IMPL_ALLNETWORKS,
  IMPL_EVM,
  getEnabledNFTNetworkIds,
} from '@onekeyhq/shared/src/engine/engineConsts';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import perfUtils, {
  EPerformanceTimerLogNames,
} from '@onekeyhq/shared/src/utils/perfUtils';

import ServiceBase from '../ServiceBase';

import type { IDBAccount } from '../../dbs/local/types';
import type { IAccountDeriveTypes } from '../../vaults/types';

export type IAllNetworkAccountInfo = {
  networkId: string;
  accountId: string;
  apiAddress: string;
  accountXpub: string | undefined;
  pub: string | undefined;
  dbAccount: IDBAccount | undefined;
  isNftEnabled: boolean;
  isBackendIndexed: boolean | undefined;
};
export type IAllNetworkAccountsInfoResult = {
  accountsInfo: IAllNetworkAccountInfo[];
  accountsInfoBackendIndexed: IAllNetworkAccountInfo[];
  accountsInfoBackendNotIndexed: IAllNetworkAccountInfo[];
};
export type IAllNetworkAccountsParams = {
  networkId: string; // all networkId or single networkId
  deriveType?: IAccountDeriveTypes; // required for single network, all network should pass undefined
  accountId: string;
  nftEnabledOnly?: boolean;
  includingNonExistingAccount?: boolean;
  includingNotEqualGlobalDeriveTypeAccount?: boolean;
  fetchAllNetworkAccounts?: boolean;
};
export type IAllNetworkAccountsParamsForApi = {
  networkId: string;
  accountAddress: string;
  xpub?: string;
};
@backgroundClass()
class ServiceAllNetwork extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  @backgroundMethod()
  public async sampleMethod() {
    console.log('sampleMethod');
    return 'sampleMethod';
  }

  @backgroundMethod()
  async getAllNetworkDbAccounts({
    networkId,
    singleNetworkDeriveType,
    indexedAccountId,
    othersWalletAccountId,
    fetchAllNetworkAccounts = false,
  }: {
    networkId: string;
    singleNetworkDeriveType: IAccountDeriveTypes | undefined;
    indexedAccountId: string | undefined;
    othersWalletAccountId: string | undefined;
    fetchAllNetworkAccounts?: boolean;
  }): Promise<IDBAccount[]> {
    const isAllNetwork =
      fetchAllNetworkAccounts ||
      (networkId && networkUtils.isAllNetwork({ networkId }));
    let dbAccounts: IDBAccount[] = [];
    const isOthersWallet = !!(
      othersWalletAccountId &&
      !indexedAccountId &&
      accountUtils.isOthersAccount({ accountId: othersWalletAccountId })
    );

    if (isOthersWallet) {
      if (!othersWalletAccountId) {
        throw new Error('getAllNetworkDbAccounts ERROR: accountId is required');
      }
      const dbAccount = await this.backgroundApi.serviceAccount.getDBAccount({
        accountId: othersWalletAccountId,
      });
      dbAccounts = [dbAccount].filter(Boolean);
    } else {
      if (!indexedAccountId) {
        throw new Error(
          'getAllNetworkDbAccounts ERROR: indexedAccountId is required',
        );
      }
      if (isAllNetwork) {
        dbAccounts =
          await this.backgroundApi.serviceAccount.getAccountsInSameIndexedAccountId(
            {
              indexedAccountId,
            },
          );
      } else {
        if (!singleNetworkDeriveType) {
          throw new Error(
            'getAllNetworkDbAccounts ERROR: deriveType is required',
          );
        }
        const dbAccountId =
          await this.backgroundApi.serviceAccount.getDbAccountIdFromIndexedAccountId(
            {
              indexedAccountId,
              networkId,
              deriveType: singleNetworkDeriveType,
            },
          );
        const dbAccount = await this.backgroundApi.serviceAccount.getDBAccount({
          accountId: dbAccountId,
        });
        dbAccounts = [dbAccount].filter(Boolean);
      }
    }

    dbAccounts = dbAccounts
      .filter(Boolean)
      .filter((acc) => acc.impl !== IMPL_ALLNETWORKS);

    return dbAccounts;
  }

  @backgroundMethod()
  async getAllNetworkAccounts(
    params: IAllNetworkAccountsParams,
  ): Promise<IAllNetworkAccountsInfoResult> {
    defaultLogger.account.allNetworkAccountPerf.getAllNetworkAccountsStart();

    const {
      accountId,
      networkId,
      deriveType: singleNetworkDeriveType,
      includingNonExistingAccount,
      includingNotEqualGlobalDeriveTypeAccount,
      fetchAllNetworkAccounts,
    } = params;

    const isAllNetwork =
      fetchAllNetworkAccounts || networkUtils.isAllNetwork({ networkId });

    defaultLogger.account.allNetworkAccountPerf.consoleLog('getAccount');

    // single network account or all network mocked account
    const networkAccount = await this.backgroundApi.serviceAccount.getAccount({
      accountId,
      networkId,
    });

    defaultLogger.account.allNetworkAccountPerf.consoleLog('getAccount done');

    defaultLogger.account.allNetworkAccountPerf.consoleLog(
      'getAllNetworkDbAccounts',
    );
    const dbAccounts = await this.getAllNetworkDbAccounts({
      networkId,
      singleNetworkDeriveType,
      indexedAccountId: networkAccount.indexedAccountId,
      othersWalletAccountId: accountId,
      fetchAllNetworkAccounts,
    });
    defaultLogger.account.allNetworkAccountPerf.consoleLog(
      'getAllNetworkDbAccounts done',
    );

    const accountsInfo: Array<IAllNetworkAccountInfo> = [];
    const accountsInfoBackendIndexed: Array<IAllNetworkAccountInfo> = [];
    const accountsInfoBackendNotIndexed: Array<IAllNetworkAccountInfo> = [];

    defaultLogger.account.allNetworkAccountPerf.consoleLog('getAllNetworks');
    const { networks: allNetworks } =
      await this.backgroundApi.serviceNetwork.getAllNetworks({
        excludeTestNetwork: true,
      });
    defaultLogger.account.allNetworkAccountPerf.consoleLog(
      'getAllNetworks done',
    );

    defaultLogger.account.allNetworkAccountPerf.consoleLog(
      'process all networks',
    );
    const enableNFTNetworkIds = getEnabledNFTNetworkIds();
    await Promise.all(
      allNetworks.map(async (n) => {
        const { backendIndex: isBackendIndexed } = n;
        const realNetworkId = n.id;
        const isNftEnabled = enableNFTNetworkIds.includes(realNetworkId);

        const appendAccountInfo = (accountInfo: IAllNetworkAccountInfo) => {
          if (!params.nftEnabledOnly || isNftEnabled) {
            accountsInfo.push(accountInfo);
            if (isBackendIndexed) {
              accountsInfoBackendIndexed.push(accountInfo);
            } else {
              accountsInfoBackendNotIndexed.push(accountInfo);
            }
          }
        };

        let compatibleAccountExists = false;

        await Promise.all(
          dbAccounts.map(async (a) => {
            const perf = perfUtils.createPerf(
              EPerformanceTimerLogNames.allNetwork__getAllNetworkAccounts_EachAccount,
            );

            const isCompatible = accountUtils.isAccountCompatibleWithNetwork({
              account: a,
              networkId: realNetworkId,
            });

            let isMatched = isAllNetwork
              ? isCompatible
              : networkId === realNetworkId;

            if (
              !includingNotEqualGlobalDeriveTypeAccount &&
              isAllNetwork &&
              isMatched &&
              a.template &&
              !networkUtils
                .getDefaultDeriveTypeVisibleNetworks()
                .includes(realNetworkId)
            ) {
              const { deriveType } =
                await this.backgroundApi.serviceNetwork.getDeriveTypeByTemplate(
                  {
                    networkId: realNetworkId,
                    template: a.template,
                  },
                );

              const globalDeriveType =
                await this.backgroundApi.serviceNetwork.getGlobalDeriveTypeOfNetwork(
                  {
                    networkId: realNetworkId,
                  },
                );

              if (a.impl === IMPL_EVM) {
                // console.log({ deriveType, globalDeriveType, realNetworkId });
              }
              if (deriveType !== globalDeriveType) {
                isMatched = false;
              }
            }

            let apiAddress = '';
            let accountXpub: string | undefined;
            if (isMatched) {
              perf.markStart('getAccountAddressForApi');
              apiAddress =
                await this.backgroundApi.serviceAccount.getAccountAddressForApi(
                  {
                    dbAccount: a,
                    accountId: a.id,
                    networkId: realNetworkId,
                  },
                );
              perf.markEnd('getAccountAddressForApi');

              // TODO pass dbAccount for better performance
              perf.markStart('getAccountXpub');
              accountXpub =
                await this.backgroundApi.serviceAccount.getAccountXpub({
                  dbAccount: a,
                  accountId: a.id,
                  networkId: realNetworkId,
                });
              perf.markEnd('getAccountXpub');

              const accountInfo: IAllNetworkAccountInfo = {
                networkId: realNetworkId,
                accountId: a.id,
                apiAddress,
                pub: a?.pub,
                accountXpub,
                isBackendIndexed,
                isNftEnabled,
                dbAccount: a,
              };

              appendAccountInfo(accountInfo);

              compatibleAccountExists = true;
            }
            perf.done({ minDuration: 1 });
          }),
        );

        if (
          !compatibleAccountExists &&
          includingNonExistingAccount &&
          isAllNetwork &&
          !networkUtils.isAllNetwork({ networkId: realNetworkId }) &&
          !accountUtils.isOthersAccount({ accountId })
        ) {
          appendAccountInfo({
            networkId: realNetworkId,
            accountId: '',
            apiAddress: '',
            pub: undefined,
            accountXpub: undefined,
            isNftEnabled,
            isBackendIndexed,
            dbAccount: undefined,
          });
        }
      }),
    );
    defaultLogger.account.allNetworkAccountPerf.consoleLog(
      'process all networks done',
    );

    defaultLogger.account.allNetworkAccountPerf.getAllNetworkAccountsEnd();
    return {
      accountsInfo,
      accountsInfoBackendIndexed,
      accountsInfoBackendNotIndexed,
    };
  }

  @backgroundMethod()
  async buildAllNetworkAccountsForApiParam(
    params: IAllNetworkAccountsParams & { withoutAccountId?: boolean },
  ) {
    const { accountsInfo } =
      await this.backgroundApi.serviceAllNetwork.getAllNetworkAccounts({
        ...params,
        includingNonExistingAccount: true,
      });
    return {
      allNetworkAccounts: accountsInfo.map((acc) => ({
        accountId: params.withoutAccountId ? undefined : acc.accountId,
        networkId: acc.networkId,
        accountAddress: acc.apiAddress,
        accountXpub: acc.accountXpub,
      })),
    };
  }
}

export default ServiceAllNetwork;
