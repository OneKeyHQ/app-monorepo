import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import type {
  IAccountToken,
  IFetchAccountTokensForDeepRefreshResp,
  IFetchAccountTokensParams,
  IFetchAccountTokensResp,
  IFetchTokenDetailParams,
  ITokenFiat,
} from '@onekeyhq/shared/types/token';

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
  public async fetchAccountTokensForDeepRefresh(
    params: IFetchAccountTokensParams & { accountId: string },
  ): Promise<IFetchAccountTokensForDeepRefreshResp> {
    const { accountId, networkId } = params;
    const resp = await this.fetchAccountTokens(params);
    const tokens = resp.data;
    const { next } = resp;
    const keys: string[] = [];
    const map: {
      [key: string]: ITokenFiat;
    } = {};
    tokens.forEach((token) => {
      const key = `${networkId}__${accountId}__${token.info.address}__${token.info.name}`;
      token.$key = key;
      keys.push(key);
      map[key] = {
        price: token.price,
        price24h: token.price24h,
        balance: token.balance,
        balanceParsed: token.balanceParsed,
        fiatValue: token.fiatValue,
      };
    });
    return {
      tokens,
      keys,
      map,
      next,
    };
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
}

export default ServiceToken;
