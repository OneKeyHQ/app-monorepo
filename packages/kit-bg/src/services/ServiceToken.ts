import { keyBy } from 'lodash';

import { getTimeDurationMs } from '@onekeyhq/kit/src/utils/helper';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
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
    return simpleDb.localTokens.updateTokens(keyBy(tokens, '$key'));
  }

  @backgroundMethod()
  public async ensureTokenInDB({
    networkId,
    tokenIdOnNetwork,
  }: {
    networkId: string;
    tokenIdOnNetwork: string;
  }) {
    const token = await this.getToken({ networkId, tokenIdOnNetwork });

    if (token) {
      const localTokenId = `${networkId}__${tokenIdOnNetwork}`;
      const tokenToUpdate = {
        ...token,
        '$key': localTokenId,
      };
      void this.updateLocalTokens({
        tokens: [tokenToUpdate],
      });
    }
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
    try {
      return {
        ...(await this._getTokenMemo(params)),
      };
    } catch (error) {
      return Promise.resolve(undefined);
    }
  }

  _getTokenMemo = memoizee(
    async ({
      networkId,
      tokenIdOnNetwork,
    }: {
      networkId: string;
      tokenIdOnNetwork: string;
    }) => {
      const tokenMap = (await simpleDb.localTokens.getRawData())?.data;
      const localTokenId = `${networkId}__${tokenIdOnNetwork}`;
      if (tokenMap) {
        const token = tokenMap[localTokenId];
        if (token) {
          return token;
        }
      }

      try {
        const tokenDetails = await this.fetchTokenDetails({
          networkId,
          address: tokenIdOnNetwork,
          isNative: tokenIdOnNetwork === '',
        });
        return tokenDetails.info;
      } catch (error) {
        console.log('fetchTokenDetails ERROR:', error);
      }

      throw new Error('getToken ERROR: token not found.');
    },
    {
      promise: true,
      primitive: true,
      max: 100,
      maxAge: getTimeDurationMs({ minute: 5 }),
    },
  );
}

export default ServiceToken;
