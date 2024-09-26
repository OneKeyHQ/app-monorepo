import { keyBy, uniqBy } from 'lodash';

import { NotImplemented } from '@onekeyhq/shared/src/errors';
import { JsonRPCRequest } from '@onekeyhq/shared/src/request/JsonRPCRequest';
import type {
  IAccountToken,
  IFetchTokenListApiParams,
  IFetchTokenListParams,
  IFetchTokenListResponse,
} from '@onekeyhq/shared/types/token';

import { parseTokenItem } from './utils';

type IFiatAmount = string;
type IAmountUnit = string;
type IAmount = string;
type IFloat = number;
type IAddress = string;
type IInteger = number;

interface IPriceItem {
  price: IFiatAmount;
  price24h: IFloat;
}

interface ITokenInfo {
  name?: string;
  symbol?: string;
  address: IAddress;
  sendAddress?: IAddress;
  decimals: IInteger;
  totalSupply?: IAmountUnit;
  logoURI?: string;
  isNative: boolean;
  riskLevel?: number | null;
  uniqueKey?: string;
  adaName?: string;
  networkId?: string;
}

export interface ITokenItemWithInfo extends IPriceItem {
  info?: ITokenInfo;
}

export interface IAccountTokenItemWithInfo extends ITokenItemWithInfo {
  fiatValue: IFiatAmount;
  balance: IAmountUnit;
  balanceParsed: IAmount;
  frozenBalance?: string;
  frozenBalanceParsed?: string;
  frozenBalanceFiatValue?: IFiatAmount;
  availableBalance?: string;
  availableBalanceParsed?: string;
  availableBalanceFiatValue?: IFiatAmount;
}

export interface IListTokenQuery {
  networkId: string;
  contractList?: string[];
  keywords?: string;
  tokenRiskLevels?: number[];
  limit?: number;
  onlyPricedSymbol?: boolean;
}

class BaseApiProvider {
  public client: JsonRPCRequest;

  public networkId = '';

  public nativeTokenAddress = '';

  constructor(
    public option: {
      url: string;
    },
  ) {
    this.client = new JsonRPCRequest(option.url);
  }

  public normalizeAddress(address: string) {
    return address.toLowerCase();
  }

  public async getNativeToken() {
    // const [token]: ITokenItemWithInfo = await this.getChainTokensFromDB({
    //   networkId: this.networkId,
    //   contractList: [this.nativeTokenAddress],
    // });
    return {
      info: {
        name: 'Core',
        symbol: 'Core',
        address: this.nativeTokenAddress,
        sendAddress: undefined,
        logoURI: '',
        totalSupply: undefined,
        isNative: true,
        decimals: 18,
        riskLevel: 1,
        uniqueKey: this.nativeTokenAddress,
        networkId: this.networkId,
      },
      price: undefined,
      price24h: undefined,
      balance: undefined,
      balanceParsed: undefined,
      fiatValue: undefined,
    };
  }

  async listAccountToken(
    params: IFetchTokenListParams,
  ): Promise<IFetchTokenListResponse> {
    console.log('=====> args: ', params);
    const arg = params.requestApiParams;
    const hiddenTokenSet = new Set(arg.hiddenTokens ?? []);

    // wallet -> onchain
    arg.accountAddress = this.normalizeAddress(arg.accountAddress);
    arg.contractList =
      arg.contractList?.map((n) => this.normalizeAddress(n)) ?? [];

    const reply = await this.listAccountTokenWithBalance(
      params.requestApiParams,
    );
    console.log('=====>REPLY: ', reply);
    return {} as IFetchTokenListResponse;
  }

  listAccountTokenWithBalance(params: IFetchTokenListApiParams) {
    const accountTokens = this.listAccountTokenFromThirdParty(params);
    return accountTokens;
  }

  async listAccountTokenFromThirdParty(params: IFetchTokenListApiParams) {
    const rpcAccountTokens = await this.listAccountTokenFromRpc(params);
    const tokens = uniqBy(rpcAccountTokens, (t) => t?.info?.address).filter(
      Boolean,
    );

    console.log('===> listAccountTokenFromThirdParty tokens: ', tokens);
    const chainTokens = await this.getChainTokens(
      {
        networkId: this.networkId,
        contractList: tokens.map((r) => r.info?.address).filter(Boolean),
      },
      keyBy(
        rpcAccountTokens.filter(Boolean),
        (t: IAccountTokenItemWithInfo) => t?.info?.address,
      ) as Record<string, IAccountTokenItemWithInfo>,
    );

    console.log(
      'listAccountTokenFromThirdParty: ======>>>>>> tokens: ',
      tokens,
    );
    // fill with db token meta
    const chainTokensMap = keyBy(
      chainTokens,
      (t: IAccountTokenItemWithInfo) => t?.info?.address as string,
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
    params: IFetchTokenListApiParams,
  ): Promise<IAccountTokenItemWithInfo[]> {
    throw new NotImplemented();
  }

  public async getChainTokens(
    params: IListTokenQuery,
    extraTokensMap?: Record<string, ITokenItemWithInfo>,
  ): Promise<IAccountTokenItemWithInfo[]> {
    const { contractList = [], keywords } = params;
    if (keywords === 'string') {
      console.log('search token case');
      throw new NotImplemented();
    }
    console.log('getChainTokens: ======>>>>>> getChainTokensFromDB: ', params);
    let tokens = await this.getChainTokensFromDB(params);
    tokens = tokens.map((t, i) => {
      if (t) {
        return t;
      }
      return (extraTokensMap?.[contractList[i]] ??
        null) as IAccountTokenItemWithInfo;
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
      // TODO: save token to db
      // this.fillInfoToChainRpcTokens({
      //   networkId: params.networkId,
      //   chainTokens,
      // });
    }

    const chainTokensMap = keyBy(
      chainTokens,
      (t: IAccountTokenItemWithInfo) => t?.info?.address,
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
    }) as IAccountTokenItemWithInfo[];
  }

  async getChainTokensFromDB(
    params: IListTokenQuery,
  ): Promise<IAccountTokenItemWithInfo[]> {
    const { contractList = [] } = params;
    const res = [] as IAccountTokenItemWithInfo[];
    const tokensMap = keyBy(
      res,
      (r: IAccountTokenItemWithInfo) => r.info?.address,
    );

    return contractList.map((c) => {
      const token = tokensMap[c];
      if (!token) {
        return null;
      }
      return parseTokenItem(token);
    }) as IAccountTokenItemWithInfo[];
  }

  async getChainTokensFromRpc(
    params: IListTokenQuery,
  ): Promise<IAccountTokenItemWithInfo[]> {
    throw new NotImplemented();
  }
}

export { BaseApiProvider };
