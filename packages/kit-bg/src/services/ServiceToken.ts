import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import type {
  IFetchAccountTokensParams,
  IFetchAccountTokensResp,
  IFetchTokenDetailParams,
  IToken,
  ITokenFiat,
} from '@onekeyhq/shared/types/token';

import simpleDb from '../dbs/simple/simpleDb';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceToken extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  @backgroundMethod()
  public async fetchAccountTokens(
    params: IFetchAccountTokensParams & { mergeTokens?: boolean },
  ): Promise<IFetchAccountTokensResp> {
    const { mergeTokens, ...rest } = params;
    const client = await this.getClient();
    const resp = await client.post<{ data: IFetchAccountTokensResp }>(
      '/wallet/v1/account/token/list',
      rest,
    );

    if (mergeTokens) {
      const { tokens, riskTokens, smallBalanceTokens } = resp.data.data;
      const mergedTokens = [
        ...tokens.data,
        ...smallBalanceTokens.data,
        ...riskTokens.data,
      ];

      const mergedKeys = `${tokens.keys}_${smallBalanceTokens.keys}_${riskTokens.keys}`;

      const mergedTokenMap = {
        ...tokens.map,
        ...smallBalanceTokens.map,
        ...riskTokens.map,
      };

      return {
        tokens: {
          data: mergedTokens,
          keys: mergedKeys,
          map: mergedTokenMap,
        },
        riskTokens: {
          data: [],
          keys: '',
          map: {},
        },
        smallBalanceTokens: {
          data: [],
          keys: '',
          map: {},
        },
      };
    }

    return resp.data.data;
  }

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
    return simpleDb.localTokens.updateTokens({
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

    const localToken = await simpleDb.localTokens.getToken({
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
