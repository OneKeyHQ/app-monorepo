import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  IMPL_ALLNETWORKS,
  getEnabledNFTNetworkIds,
} from '@onekeyhq/shared/src/engine/engineConsts';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';

import ServiceBase from '../ServiceBase';

import type { IDBAccount } from '../../dbs/local/types';
import type { IAccountDeriveTypes } from '../../vaults/types';

export type IAllNetworkAccountInfo = {
  accountId: string;
  networkId: string;
  apiAddress: string;
  isNftEnabled: boolean;
  isBackendIndexed: boolean | undefined;
};
export type IAllNetworkAccountsInfoResult = {
  accountsInfo: IAllNetworkAccountInfo[];
  accountsInfoBackendIndexed: IAllNetworkAccountInfo[];
  accountsInfoBackendNotIndexed: IAllNetworkAccountInfo[];
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
  }: {
    networkId: string;
    singleNetworkDeriveType: IAccountDeriveTypes | undefined;
    indexedAccountId: string | undefined;
    othersWalletAccountId: string | undefined;
  }): Promise<IDBAccount[]> {
    const isAllNetwork = networkId && networkUtils.isAllNetwork({ networkId });
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
  async getAllNetworkAccounts(params: {
    networkId: string;
    singleNetworkDeriveType?: IAccountDeriveTypes;
    accountId: string;
    nftEnabledOnly?: boolean;
  }): Promise<IAllNetworkAccountsInfoResult> {
    const { accountId, networkId, singleNetworkDeriveType } = params;
    const account = await this.backgroundApi.serviceAccount.getAccount({
      accountId,
      networkId,
    });
    const dbAccounts = await this.getAllNetworkDbAccounts({
      networkId,
      singleNetworkDeriveType,
      indexedAccountId: account.indexedAccountId,
      othersWalletAccountId: accountId,
    });

    const accountsInfo: Array<IAllNetworkAccountInfo> = [];
    const accountsInfoBackendIndexed: Array<IAllNetworkAccountInfo> = [];
    const accountsInfoBackendNotIndexed: Array<IAllNetworkAccountInfo> = [];

    const { networks: allNetworks } =
      await this.backgroundApi.serviceNetwork.getAllNetworks({
        excludeTestNetwork: true,
      });

    const enableNFTNetworkIds = getEnabledNFTNetworkIds();
    await Promise.all(
      allNetworks.map(async (n) => {
        const { backendIndex: isBackendIndexed } = n;
        const isNftEnabled = enableNFTNetworkIds.includes(n.id);
        await Promise.all(
          dbAccounts.map(async (a) => {
            const isCompatible = accountUtils.isAccountCompatibleWithNetwork({
              account: a,
              networkId: n.id,
            });
            if (isCompatible) {
              const apiAddress =
                await this.backgroundApi.serviceAccount.getAccountAddressForApi(
                  {
                    accountId: a.id,
                    networkId: n.id,
                  },
                );
              const accountInfo: IAllNetworkAccountInfo = {
                accountId: a.id,
                networkId: n.id,
                apiAddress,
                isBackendIndexed,
                isNftEnabled,
              };
              if (!params.nftEnabledOnly || isNftEnabled) {
                accountsInfo.push(accountInfo);
                if (isBackendIndexed) {
                  accountsInfoBackendIndexed.push(accountInfo);
                } else {
                  accountsInfoBackendNotIndexed.push(accountInfo);
                }
              }
            }
          }),
        );
      }),
    );

    return {
      accountsInfo,
      accountsInfoBackendIndexed,
      accountsInfoBackendNotIndexed,
    };
  }
}

export default ServiceAllNetwork;
