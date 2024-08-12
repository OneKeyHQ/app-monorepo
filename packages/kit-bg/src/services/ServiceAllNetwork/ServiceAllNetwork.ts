import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  IMPL_ALLNETWORKS,
  IMPL_EVM,
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
  includingNotEqualGlobalDeriveTypeAccount?: boolean;
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
      includingNotEqualGlobalDeriveTypeAccount,
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
              apiAddress =
                await this.backgroundApi.serviceAccount.getAccountAddressForApi(
                  {
                    accountId: a.id,
                    networkId: realNetworkId,
                  },
                );
              accountXpub =
                await this.backgroundApi.serviceAccount.getAccountXpub({
                  accountId: a.id,
                  networkId: realNetworkId,
                });
              const accountInfo: IAllNetworkAccountInfo = {
                networkId: realNetworkId,
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
          !networkUtils.isAllNetwork({ networkId: realNetworkId }) &&
          !accountUtils.isOthersAccount({ accountId })
        ) {
          appendAccountInfo({
            networkId: realNetworkId,
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
