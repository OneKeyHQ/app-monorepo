import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import type {
  IAccountToken,
  IFetchTokenDetailItem,
} from '@onekeyhq/shared/types/token';

import ServiceBase from './ServiceBase';

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
  public async hideToken({ token }: { token: IAccountToken }) {
    return this.backgroundApi.simpleDb.customTokens.hideToken({ token });
  }

  @backgroundMethod()
  public async getCustomTokens({
    accountId,
    networkId,
  }: {
    accountId: string;
    networkId: string;
  }) {
    return this.backgroundApi.simpleDb.customTokens.getCustomTokens({
      accountId,
      networkId,
    });
  }

  @backgroundMethod()
  public async getHiddenTokens({
    accountId,
    networkId,
  }: {
    accountId: string;
    networkId: string;
  }) {
    return this.backgroundApi.simpleDb.customTokens.getHiddenTokens({
      accountId,
      networkId,
    });
  }

  @backgroundMethod()
  async searchTokenByKeywords({
    walletId,
    networkId,
    keywords,
  }: {
    walletId: string;
    networkId: string;
    keywords: string;
  }) {
    if (!keywords) {
      return [];
    }
    return this._searchTokens({
      walletId,
      networkId,
      searchParams: { keywords },
    });
  }

  @backgroundMethod()
  async searchTokenByContractAddress({
    walletId,
    networkId,
    contractAddress,
  }: {
    walletId: string;
    networkId: string;
    contractAddress: string;
  }) {
    if (!contractAddress) {
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
    searchParams: { keywords?: string; contractList?: string[] };
  }) {
    const client = await this.getClient(EServiceEndpointEnum.Wallet);
    const response = await client.post<{ data: IFetchTokenDetailItem[] }>(
      '/wallet/v1/account/token/search',
      {
        networkId,
        ...searchParams,
      },
      {
        headers:
          await this.backgroundApi.serviceAccountProfile._getWalletTypeHeader({
            walletId,
          }),
      },
    );
    return response.data.data ?? [];
  }
}

export default ServiceCustomToken;
