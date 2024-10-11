import {
  backgroundClass,
  backgroundMethod,
  toastIfError,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import type {
  IAccountToken,
  IFetchTokenDetailItem,
} from '@onekeyhq/shared/types/token';

import { vaultFactory } from '../vaults/factory';

import ServiceBase from './ServiceBase';

import type { IAllNetworkAccountsParamsForApi } from './ServiceAllNetwork/ServiceAllNetwork';

@backgroundClass()
class ServiceCustomToken extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  @backgroundMethod()
  public async addCustomToken({ token }: { token: IAccountToken }) {
    return this.backgroundApi.simpleDb.customTokens.addCustomToken({ token });
  }

  @backgroundMethod()
  public async addCustomTokenBatch({ tokens }: { tokens: IAccountToken[] }) {
    return this.backgroundApi.simpleDb.customTokens.addCustomTokensBatch({
      tokens,
    });
  }

  @backgroundMethod()
  public async hideToken({ token }: { token: IAccountToken }) {
    return this.backgroundApi.simpleDb.customTokens.hideToken({ token });
  }

  @backgroundMethod()
  public async getCustomTokens({
    accountId,
    networkId,
    allNetworkAccountId,
  }: {
    accountId: string;
    networkId: string;
    allNetworkAccountId?: string;
  }) {
    return this.backgroundApi.simpleDb.customTokens.getCustomTokens({
      accountId,
      networkId,
      allNetworkAccountId,
    });
  }

  @backgroundMethod()
  public async getHiddenTokens({
    accountId,
    networkId,
    allNetworkAccountId,
  }: {
    accountId: string;
    networkId: string;
    allNetworkAccountId?: string;
  }) {
    return this.backgroundApi.simpleDb.customTokens.getHiddenTokens({
      accountId,
      networkId,
      allNetworkAccountId,
    });
  }

  @backgroundMethod()
  async searchTokenByKeywords({
    walletId,
    accountId,
    networkId,
    keywords,
  }: {
    walletId: string;
    accountId: string;
    networkId: string;
    keywords: string;
  }) {
    if (!keywords) {
      return [];
    }
    let allNetworkAccounts: IAllNetworkAccountsParamsForApi[] | undefined;
    if (networkUtils.isAllNetwork({ networkId })) {
      const { allNetworkAccounts: allNetworkAccountsWithAccountId } =
        await this.backgroundApi.serviceAllNetwork.buildAllNetworkAccountsForApiParam(
          {
            accountId,
            networkId,
          },
        );
      allNetworkAccounts = allNetworkAccountsWithAccountId.map((i) => ({
        networkId: i.networkId,
        accountAddress: i.accountAddress,
        xpub: i.accountXpub,
      }));
    }
    return this._searchTokens({
      walletId,
      networkId,
      searchParams: { keywords, allNetworkAccounts },
    });
  }

  @backgroundMethod()
  async searchTokenByContractAddress({
    walletId,
    networkId,
    contractAddress,
    isNative,
  }: {
    walletId: string;
    networkId: string;
    contractAddress: string;
    isNative: boolean;
  }) {
    if (!contractAddress && !isNative) {
      return [];
    }
    return this._searchTokens({
      walletId,
      networkId,
      searchParams: { contractList: [contractAddress] },
    });
  }

  @backgroundMethod()
  async _searchTokens({
    walletId,
    networkId,
    searchParams,
  }: {
    walletId: string;
    networkId: string;
    searchParams: {
      keywords?: string;
      contractList?: string[];
      allNetworkAccounts?: IAllNetworkAccountsParamsForApi[];
    };
  }) {
    const vault = await vaultFactory.getChainOnlyVault({ networkId });
    const response = await vault.fetchTokenDetails({
      walletId,
      networkId,
      ...searchParams,
    });
    return response.data.data ?? [];
  }

  @backgroundMethod()
  @toastIfError()
  async activateToken({
    accountId,
    networkId,
    token,
  }: {
    accountId: string;
    networkId: string;
    token: IAccountToken;
  }): Promise<boolean> {
    const vaultSetting =
      await this.backgroundApi.serviceNetwork.getVaultSettings({ networkId });
    if (!vaultSetting.activateTokenRequired) return true;
    const vault = await vaultFactory.getVault({
      accountId,
      networkId,
    });
    return vault.activateToken({
      token,
    });
  }
}

export default ServiceCustomToken;
