import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { getMergedTokenData } from '@onekeyhq/shared/src/utils/tokenUtils';
import type {
  IFetchAccountTokensParams,
  IFetchAccountTokensResp,
  IFetchTokenDetailParams,
  IToken,
  ITokenData,
  ITokenFiat,
} from '@onekeyhq/shared/types/token';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceToken extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  _fetchAccountTokensController: AbortController | null = null;

  @backgroundMethod()
  public async abortFetchAccountTokens() {
    if (this._fetchAccountTokensController) {
      this._fetchAccountTokensController.abort();
      this._fetchAccountTokensController = null;
    }
  }

  @backgroundMethod()
  public async fetchAccountTokens(
    params: IFetchAccountTokensParams & { mergeTokens?: boolean },
  ): Promise<IFetchAccountTokensResp> {
    const { mergeTokens, flag, ...rest } = params;
    const client = await this.getClient();
    const controller = new AbortController();
    this._fetchAccountTokensController = controller;
    const resp = await client.post<{ data: IFetchAccountTokensResp }>(
      `/server-service-wallet/v1/account/token/list?flag=${flag || ''}`,
      rest,
      {
        signal: controller.signal,
      },
    );
    this._fetchAccountTokensController = null;

    let allTokens: ITokenData | undefined;
    if (mergeTokens) {
      const { tokens, riskTokens, smallBalanceTokens } = resp.data.data;
      ({ allTokens } = getMergedTokenData({
        tokens,
        riskTokens,
        smallBalanceTokens,
      }));
    }

    resp.data.data.allTokens = allTokens;
    return resp.data.data;
  }

  @backgroundMethod()
  public async fetchTokensDetails(params: IFetchTokenDetailParams) {
    const client = await this.getClient();
    const resp = await client.post<{
      data: ({
        info: IToken;
      } & ITokenFiat)[];
    }>('/server-service-wallet/v1/account/token/detail', params);

    return resp.data.data;
  }

  @backgroundMethod()
  public async updateLocalTokens({
    networkId,
    tokens,
  }: {
    networkId: string;
    tokens: IToken[];
  }) {
    return this.backgroundApi.simpleDb.localTokens.updateTokens({
      networkId,
      tokens,
    });
  }

  @backgroundMethod()
  public async getNativeToken({ networkId }: { networkId: string }) {
    return this.getToken({ networkId, tokenIdOnNetwork: '' });
  }

  @backgroundMethod()
  public async getToken(params: {
    networkId: string;
    tokenIdOnNetwork: string;
  }) {
    const { networkId, tokenIdOnNetwork } = params;

    const localToken = await this.backgroundApi.simpleDb.localTokens.getToken({
      networkId,
      tokenIdOnNetwork,
    });

    if (localToken) return localToken;

    try {
      const tokensDetails = await this.fetchTokensDetails({
        networkId,
        contractList: [tokenIdOnNetwork],
      });

      const tokenInfo = tokensDetails[0].info;

      void this.updateLocalTokens({
        networkId,
        tokens: [tokenInfo],
      });

      return tokenInfo;
    } catch (error) {
      console.log('fetchTokensDetails ERROR:', error);
    }

    throw new Error('getToken ERROR: token not found.');
  }

  @backgroundMethod()
  public async blockToken({
    networkId,
    tokenId,
  }: {
    networkId: string;
    tokenId: string;
  }) {
    const unblockedTokens =
      await this.backgroundApi.simpleDb.riskyTokens.getUnblockedTokens(
        networkId,
      );

    if (unblockedTokens[tokenId]) {
      return this.backgroundApi.simpleDb.riskyTokens.updateUnblockedTokens({
        networkId,
        removeFromUnBlockedTokens: [tokenId],
      });
    }

    return this.backgroundApi.simpleDb.riskyTokens.updateBlockedTokens({
      networkId,
      addToBlockedTokens: [tokenId],
    });
  }

  @backgroundMethod()
  public async unblockToken({
    networkId,
    tokenId,
  }: {
    networkId: string;
    tokenId: string;
  }) {
    const blockedTokens =
      await this.backgroundApi.simpleDb.riskyTokens.getBlockedTokens(networkId);

    if (blockedTokens[tokenId]) {
      return this.backgroundApi.simpleDb.riskyTokens.updateBlockedTokens({
        networkId,
        removeFromBlockedTokens: [tokenId],
      });
    }

    return this.backgroundApi.simpleDb.riskyTokens.updateUnblockedTokens({
      networkId,
      addToUnBlockedTokens: [tokenId],
    });
  }

  @backgroundMethod()
  public async getBlockedTokens({ networkId }: { networkId: string }) {
    return this.backgroundApi.simpleDb.riskyTokens.getBlockedTokens(networkId);
  }

  @backgroundMethod()
  public async getUnblockedTokens({ networkId }: { networkId: string }) {
    return this.backgroundApi.simpleDb.riskyTokens.getUnblockedTokens(
      networkId,
    );
  }
}

export default ServiceToken;
