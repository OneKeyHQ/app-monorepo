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
      return getMergedTokenData({ tokens, riskTokens, smallBalanceTokens });
    }

    return resp.data.data;
  }

  @backgroundMethod()
  public async fetchTokenDetails(params: IFetchTokenDetailParams) {
    const client = await this.getClient();
    const resp = await client.get<{
      data: {
        info: IToken;
      } & ITokenFiat;
    }>('/wallet/v1/account/token/detail', { params });
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
      const tokenDetails = await this.fetchTokenDetails({
        networkId,
        address: tokenIdOnNetwork,
        isNative: tokenIdOnNetwork === '',
      });

      const tokenInfo = tokenDetails.info;

      void this.updateLocalTokens({
        networkId,
        tokens: [tokenInfo],
      });

      return tokenInfo;
    } catch (error) {
      console.log('fetchTokenDetails ERROR:', error);
    }

    throw new Error('getToken ERROR: token not found.');
  }
}

export default ServiceToken;
