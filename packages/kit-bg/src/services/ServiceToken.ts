import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type {
  IAccountToken,
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
  public async updateLocalTokens({ tokens }: { tokens: IAccountToken[] }) {
    return simpleDb.localTokens.updateTokens(tokens);
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
    const localTokenId = accountUtils.buildLocalTokenId({
      networkId,
      tokenIdOnNetwork,
    });
    const localToken = await simpleDb.localTokens.getToken(localTokenId);
    if (localToken) return localToken;

    try {
      const tokenDetails = await this.fetchTokenDetails({
        networkId,
        address: tokenIdOnNetwork,
        isNative: tokenIdOnNetwork === '',
      });

      const tokenInfo = tokenDetails.info;

      const tokenToUpdate = {
        ...tokenInfo,
        '$key': localTokenId,
      };
      void this.updateLocalTokens({
        tokens: [tokenToUpdate],
      });

      return tokenInfo;
    } catch (error) {
      console.log('fetchTokenDetails ERROR:', error);
    }

    throw new Error('getToken ERROR: token not found.');
  }
}

export default ServiceToken;
