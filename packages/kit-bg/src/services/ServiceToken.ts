import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import {
  getEmptyTokenData,
  getMergedTokenData,
} from '@onekeyhq/shared/src/utils/tokenUtils';
import type {
  IFetchAccountTokensParams,
  IFetchAccountTokensResp,
  IFetchTokenDetailParams,
  IToken,
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
    const { mergeTokens, ...rest } = params;
    const client = await this.getClient();
    const controller = new AbortController();
    this._fetchAccountTokensController = controller;
    const resp = await client.post<{ data: IFetchAccountTokensResp }>(
      '/wallet/v1/account/token/list',
      rest,
      {
        signal: controller.signal,
      },
    );
    this._fetchAccountTokensController = null;
    if (mergeTokens) {
      const { tokens, riskTokens, smallBalanceTokens } = resp.data.data;
      return getMergedTokenData({ tokens, riskTokens, smallBalanceTokens });
    }

    return resp.data.data;
  }

  @backgroundMethod()
  public async fetchAccountTokensWithMemo(
    params: IFetchAccountTokensParams & { mergeTokens?: boolean },
  ) {
    try {
      const tokens = await this._fetchAccountTokensWithMemo(params);
      return tokens;
    } catch {
      return getEmptyTokenData();
    }
  }

  _fetchAccountTokensWithMemo = memoizee(
    async (params: IFetchAccountTokensParams & { mergeTokens?: boolean }) =>
      this.fetchAccountTokens(params),
    {
      promise: true,
      primitive: true,
      max: 1,
      maxAge: timerUtils.getTimeDurationMs({ minute: 5 }),
    },
  );

  @backgroundMethod()
  public async fetchTokensDetails(params: IFetchTokenDetailParams) {
    const client = await this.getClient();
    const resp = await client.post<{
      data: ({
        info: IToken;
      } & ITokenFiat)[];
    }>('/wallet/v1/account/token/detail', params);

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
}

export default ServiceToken;
