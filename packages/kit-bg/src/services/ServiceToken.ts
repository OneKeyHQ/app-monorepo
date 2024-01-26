import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
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
  public async fetchTokenDetail(params: IFetchTokenDetailParams) {
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
    tokens: IAccountToken[];
  }) {
    return simpleDb.localTokens.updateTokens({
      [networkId]: tokens,
    });
  }

  @backgroundMethod()
  public async getNativeToken(networkId: string | undefined) {
    if (!networkId) return null;
    const tokensMap = (await simpleDb.localTokens.getRawData())?.data;
    if (tokensMap) {
      const tokens = tokensMap[networkId];
      const nativeToken = tokens?.find((token) => token.isNative);
      if (nativeToken) {
        return nativeToken;
      }
    }
    return null;
  }
}

export default ServiceToken;
