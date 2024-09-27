/* eslint-disable @typescript-eslint/no-unused-vars */

import BigNumber from 'bignumber.js';
import { md5 } from 'js-md5';
import { isEmpty, isNaN, keyBy, omit, orderBy, uniqBy } from 'lodash';

import type { IBackgroundApi } from '@onekeyhq/kit-bg/src/apis/IBackgroundApi';
import { NotImplemented } from '@onekeyhq/shared/src/errors';
import { JsonRPCRequest } from '@onekeyhq/shared/src/request/JsonRPCRequest';
import type {
  IFetchServerTokenDetailParams,
  IFetchServerTokenDetailResponse,
  IFetchServerTokenListApiParams,
  IFetchServerTokenListParams,
  IFetchServerTokenListResponse,
  IServerAccountTokenItem,
  IServerTokenItemWithInfo,
  IServerTokenListQuery,
} from '@onekeyhq/shared/types/serverToken';
import type {
  IAccountToken,
  IFetchTokenDetailItem,
  ITokenData,
  ITokenFiat,
} from '@onekeyhq/shared/types/token';

import { parseTokenItem } from './utils';

class BaseApiProvider {
  backgroundApi: IBackgroundApi;

  public client: JsonRPCRequest;

  public networkId = '';

  public nativeTokenAddress = '';

  constructor(
    public option: {
      url: string;
      networkId: string;
      backgroundApi: IBackgroundApi;
    },
  ) {
    this.backgroundApi = option.backgroundApi;
    this.client = new JsonRPCRequest(option.url);
    this.networkId = option.networkId;
  }

  public normalizeAddress(address: string) {
    return address.toLowerCase();
  }

  public async getNativeToken(): Promise<IServerAccountTokenItem> {
    const [token] = await this.getChainTokensFromDB({
      networkId: this.networkId,
      contractList: [this.nativeTokenAddress],
    });
    if (!token) {
      throw new Error('getNativeToken failed');
    }
    if (!token?.info?.decimals) {
      throw new Error('getNativeToken decimals failed');
    }
    return {
      info: {
        name: token?.info?.name,
        symbol: token?.info?.symbol,
        address: this.nativeTokenAddress,
        sendAddress: undefined,
        logoURI: '',
        totalSupply: undefined,
        isNative: true,
        decimals: token?.info?.decimals,
        riskLevel: 1,
        uniqueKey: this.nativeTokenAddress,
        networkId: this.networkId,
      },
      price: '',
      price24h: 0,
      balance: '',
      balanceParsed: '',
      fiatValue: '',
    };
  }

  async listAccountToken(
    params: IFetchServerTokenListParams,
  ): Promise<IFetchServerTokenListResponse> {
    console.log('=====> args: ', params);
    const arg = params.requestApiParams;
    const hiddenTokenSet = new Set(arg.hiddenTokens ?? []);

    arg.accountAddress = this.normalizeAddress(arg.accountAddress);
    arg.contractList =
      arg.contractList?.map((n) => this.normalizeAddress(n)) ?? [];

    const reply = await this.listAccountTokenWithBalance(
      params.requestApiParams,
    );
    console.log('=====>REPLY: ', reply);
    const sortedAccountTokenArray = orderBy(
      reply,
      [(item) => item.info?.isNative, (item) => +(item.fiatValue ?? 0)],
      ['desc', 'desc'],
    ).filter((n) => !hiddenTokenSet.has(n.info?.address ?? ''));

    const tokenArray: IServerAccountTokenItem[] = [];
    const smallTokenArray: IServerAccountTokenItem[] = [];
    const riskTokenArray: IServerAccountTokenItem[] = [];

    sortedAccountTokenArray.reverse().forEach((accountToken) => {
      tokenArray.unshift(accountToken);
    });

    const tokens = this.__parseAccountTokenArray(arg, tokenArray);
    const riskTokens = this.__parseAccountTokenArray(arg, riskTokenArray);
    const smallBalanceTokens = this.__parseAccountTokenArray(
      arg,
      smallTokenArray,
    );

    return {
      data: {
        data: {
          tokens,
          riskTokens,
          smallBalanceTokens,
        },
      },
    };
  }

  __parseAccountTokenArray(
    { networkId, xpub, accountAddress }: IFetchServerTokenListApiParams,
    accountTokenArray: IServerAccountTokenItem[],
  ): ITokenData {
    let fiatValue = BigNumber(0);
    const map: Record<string, ITokenFiat> = {};
    const data: IAccountToken[] = [];

    accountTokenArray.forEach((accountToken) => {
      if (!isNaN(Number(accountToken.fiatValue))) {
        fiatValue = fiatValue.plus(accountToken.fiatValue);
      }
      const key = `${networkId}_${xpub ?? accountAddress}_${
        accountToken.info?.uniqueKey ?? accountToken?.info?.address ?? ''
      }`;

      map[key] = {
        price: 0,
        price24h: 0,
        balance: accountToken.balance,
        balanceParsed: accountToken.balanceParsed,
        fiatValue: '',
      };

      data.push({
        $key: key,
        ...omit(accountToken?.info, 'uniqueKey'),
      } as IAccountToken);
    });

    return {
      map,
      data: orderBy(
        data,
        [
          // @ts-expect-error
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return
          (item) => map?.[item.$key]?.order ?? 9999,
          (item) => item.isNative,
          (item) => +(map?.[item.$key]?.fiatValue ?? 0),
        ],
        ['asc', 'desc', 'desc'],
      ),
      keys: md5(
        `${networkId}__${isEmpty(map) ? '' : Object.keys(map).join(',')}`,
      ),
      fiatValue: undefined,
    };
  }

  listAccountTokenWithBalance(params: IFetchServerTokenListApiParams) {
    const accountTokens = this.listAccountTokenFromThirdParty(params);
    return accountTokens;
  }

  async listAccountTokenFromThirdParty(params: IFetchServerTokenListApiParams) {
    const rpcAccountTokens = await this.listAccountTokenFromRpc(params);
    const tokens = uniqBy(rpcAccountTokens, (t) => t?.info?.address).filter(
      Boolean,
    );

    const chainTokens = await this.getChainTokens(
      {
        networkId: this.networkId,
        contractList: tokens.map((r) => r.info?.address).filter(Boolean),
      },
      keyBy(
        rpcAccountTokens.filter(Boolean),
        (t: IServerAccountTokenItem) => t?.info?.address,
      ) as Record<string, IServerAccountTokenItem>,
    );

    // fill with db token meta
    const chainTokensMap = keyBy(
      chainTokens,
      (t: IServerAccountTokenItem) => t?.info?.address as string,
    );

    return tokens.map((t) => {
      if (t.info?.address === undefined || t.info?.address === null) {
        return t;
      }
      const token = chainTokensMap[t.info?.address];
      if (token) {
        t.info.logoURI = token.info?.logoURI || t.info?.logoURI;
        t.info.name = token.info?.name;
        t.info.symbol = token.info?.symbol;
        t.price = token.price ?? t.price;
        t.price24h = token.price24h;
        if (t.info && typeof token.info?.decimals === 'number') {
          t.info.decimals = token.info.decimals;
        }
      }

      return t;
    });
  }

  listAccountTokenFromRpc(
    _params: IFetchServerTokenListApiParams,
  ): Promise<IServerAccountTokenItem[]> {
    throw new NotImplemented();
  }

  public async getChainTokens(
    params: IServerTokenListQuery,
    extraTokensMap?: Record<string, IServerTokenItemWithInfo>,
  ): Promise<IServerAccountTokenItem[]> {
    const { contractList = [], keywords } = params;
    if (keywords === 'string') {
      console.log('search token case');
      throw new NotImplemented();
    }
    console.log('getChainTokens: ======>>>>>> getChainTokensFromDB: ', params);
    let tokens = await this.getChainTokensFromDB(params);
    console.log(
      'getChainTokens: ======>>>>>> getChainTokensFromDB Result: ',
      tokens,
    );
    tokens = tokens.map((t, i) => {
      if (t) {
        return t;
      }
      return (extraTokensMap?.[contractList[i]] ??
        null) as IServerAccountTokenItem;
    });
    const missedTokenContracts = contractList.filter((_, i) => !tokens[i]);

    if (!missedTokenContracts?.length) {
      return tokens;
    }
    console.log(
      'getChainTokens: ======>>>>>> missedTokenContracts: ',
      missedTokenContracts,
    );

    const chainTokens = await this.getChainTokensFromRpc({
      ...params,
      contractList: missedTokenContracts,
    });

    if (chainTokens?.length) {
      // this.fillInfoToChainRpcTokens({
      //   networkId: params.networkId,
      //   chainTokens,
      // });
    }

    const chainTokensMap = keyBy(
      chainTokens,
      (t: IServerAccountTokenItem) => t?.info?.address,
    );
    return tokens.map((t, i) => {
      if (t) {
        return t;
      }
      const token = chainTokensMap[contractList[i]];
      if (token) {
        return token;
      }
      return null;
    }) as IServerAccountTokenItem[];
  }

  async getChainTokensFromDB(
    params: IServerTokenListQuery,
  ): Promise<IServerAccountTokenItem[]> {
    const { contractList = [], networkId } = params;
    const res = await this.backgroundApi.simpleDb.localTokens.getTokens({
      networkId,
      tokenIdOnNetworkList: contractList,
    });
    const tokensMap = keyBy(res, (r) => r.address);

    return contractList.map((c) => {
      const token = tokensMap[c];
      if (!token) {
        return null;
      }
      return parseTokenItem(token);
    }) as IServerAccountTokenItem[];
  }

  async getChainTokensFromRpc(
    params: IServerTokenListQuery,
  ): Promise<IServerAccountTokenItem[]> {
    throw new NotImplemented();
  }

  async queryAccountToken(
    params: IFetchServerTokenDetailParams,
  ): Promise<IFetchServerTokenDetailResponse> {
    let reply: IServerAccountTokenItem[] = [];
    const hasAccount = params.accountAddress || params.xpub;
    if (hasAccount && params.contractList.length) {
      reply = await this.listAccountTokenWithBalance({
        networkId: params.networkId,
        accountAddress: params.accountAddress,
        xpub: params.xpub,
        contractList: params.contractList,
      });
    } else {
      reply = [];
    }

    const result = reply
      .map((t) => {
        if (!t) {
          return null;
        }
        t.price = '0';
        t.fiatValue = '0';
        t.availableBalanceFiatValue = '0';
        t.frozenBalanceFiatValue = '0';
        return t;
      })
      .filter(Boolean);

    return {
      data: {
        data: result as unknown as IFetchTokenDetailItem[],
      },
    };
  }
}

export { BaseApiProvider };
