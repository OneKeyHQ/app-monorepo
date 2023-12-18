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
  IFetchTokenDetailResp,
  ITokenFiat,
} from '@onekeyhq/shared/types/token';

import { getBaseEndpoint } from '../endpoints';

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
    const endpoint = await getBaseEndpoint();
    const client = await this.getClient();
    try {
      const resp = await client.post<{ data: IFetchAccountTokensResp }>(
        `${endpoint}/v5/account/token/list`,
        params,
      );
      return resp.data.data;
    } catch (e) {
      console.log(e);
      return {
        data: [],
        page: 1,
        pageSize: 20,
        total: 0,
      };
    }
  }

  @backgroundMethod()
  public async fetchAccountTokensForDeepRefresh(
    params: IFetchAccountTokensParams & { accountId: string },
  ): Promise<IFetchAccountTokensForDeepRefreshResp> {
    const { accountId, networkId } = params;
    const resp = await this.fetchAccountTokens(params);
    const tokens = resp.data;
    const { total, page, pageSize } = resp;
    const keys: string[] = [];
    const map: {
      [key: string]: ITokenFiat;
    } = {};
    tokens.forEach((token) => {
      const key = `${networkId}__${accountId}__${token.address}__${token.name}`;
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
      total,
      page,
      pageSize,
    };
  }

  @backgroundMethod()
  public async fetchTokenDetail(params: IFetchTokenDetailParams) {
    const endpoint = await getBaseEndpoint();
    const client = await this.getClient();
    const resp = await client.get<{ data: IAccountToken }>(
      `${endpoint}/v5/account/token/detail`,
      { params },
    );
    return resp.data.data;
  }
}

export default ServiceToken;
