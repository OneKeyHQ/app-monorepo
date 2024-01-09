import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import type {
  IAccountToken,
  IFetchAccountTokensParams,
  IFetchAccountTokensResp,
  IFetchTokenDetailParams,
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
    params: IFetchAccountTokensParams,
  ): Promise<IFetchAccountTokensResp> {
    const client = await this.getClient();
    const resp = await client.post<{ data: IFetchAccountTokensResp }>(
      '/wallet/v1/account/token/list',
      params,
    );
    return resp.data.data;
  }

  @backgroundMethod()
  public async fetchTokenDetail(params: IFetchTokenDetailParams) {
    const client = await this.getClient();
    const resp = await client.get<{ data: IAccountToken }>(
      '/wallet/v1/account/token/detail',
      { params },
    );
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
  public async getNativeToken(networkId: string) {
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
