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
  networkId: string;
  accountId: string;
  apiAddress: string;
  accountXpub: string | undefined;
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
  async getAllNetworkAccounts(
    params: IAllNetworkAccountsParams,
  ): Promise<IAllNetworkAccountsInfoResult> {
    const {
      accountId,
      networkId,
      deriveType: singleNetworkDeriveType,
      includingNonExistingAccount,
    } = params;

    const isAllNetwork = networkUtils.isAllNetwork({ networkId });

    // single network account or all network mocked account
    const networkAccount = await this.backgroundApi.serviceAccount.getAccount({
      accountId,
      networkId,
    });

    const dbAccounts = await this.getAllNetworkDbAccounts({
      networkId,
      singleNetworkDeriveType,
      indexedAccountId: networkAccount.indexedAccountId,
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
            const isCompatible = accountUtils.isAccountCompatibleWithNetwork({
              account: a,
              networkId: n.id,
            });
            const isMatched = isAllNetwork ? isCompatible : networkId === n.id;
            let apiAddress = '';
            let accountXpub: string | undefined;
            if (isMatched) {
              apiAddress =
                await this.backgroundApi.serviceAccount.getAccountAddressForApi(
                  {
                    accountId: a.id,
                    networkId: n.id,
                  },
                );
              accountXpub =
                await this.backgroundApi.serviceAccount.getAccountXpub({
                  accountId: a.id,
                  networkId: n.id,
                });
              const accountInfo: IAllNetworkAccountInfo = {
                networkId: n.id,
                accountId: a.id,
                apiAddress,
                accountXpub,
                isBackendIndexed,
                isNftEnabled,
              };
              appendAccountInfo(accountInfo);
              compatibleAccountExists = true;
            }
          }),
        );

        if (
          !compatibleAccountExists &&
          includingNonExistingAccount &&
          isAllNetwork &&
          !networkUtils.isAllNetwork({ networkId: n.id }) &&
          !accountUtils.isOthersAccount({ accountId })
        ) {
          appendAccountInfo({
            networkId: n.id,
            accountId: '',
            apiAddress: '',
            accountXpub: undefined,
            isNftEnabled,
            isBackendIndexed,
          });
        }
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
