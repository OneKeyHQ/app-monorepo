/* eslint-disable @typescript-eslint/no-unused-vars */

import BigNumber from 'bignumber.js';
import { md5 } from 'js-md5';
import { forEach, isEmpty, isNaN, keyBy, omit, orderBy, uniqBy } from 'lodash';

import type { IBackgroundApi } from '@onekeyhq/kit-bg/src/apis/IBackgroundApi';
import { NotImplemented, OneKeyError } from '@onekeyhq/shared/src/errors';
import { JsonRPCRequest } from '@onekeyhq/shared/src/request/JsonRPCRequest';
import type {
  IFetchAccountDetailsResp,
  IFetchServerAccountDetailsParams,
  IFetchServerAccountDetailsResponse,
  IServerFetchNonceResponse,
  IServerGetAccountNetWorthResponse,
} from '@onekeyhq/shared/types/address';
import type {
  IEstimateGasParams,
  IServerEstimateFeeResponse,
  IServerGasFeeParams,
  IServerGasFeeResponse,
  IServerGasLimitParams,
  IServerGasLimitResponse,
  IServerGasPriceParams,
  IServerGasPriceResponse,
} from '@onekeyhq/shared/types/fee';
import {
  EOnChainHistoryTxStatus,
  EOnChainHistoryTxType,
} from '@onekeyhq/shared/types/history';
import type {
  IFetchAccountHistoryResp,
  IFetchHistoryTxDetailsResp,
  IOnChainHistoryTx,
  IServerFetchAccountHistoryDetailParams,
  IServerFetchAccountHistoryDetailResp,
} from '@onekeyhq/shared/types/history';
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

import { parseTokenItem, safeNumberString } from './utils';

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

  public async validateTokenAddress(params: {
    networkId: string;
    address: string;
  }): Promise<string> {
    throw new NotImplemented();
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

  /*= ==============================
   *        /get-account
   *============================== */
  async getAccount(
    params: IFetchServerAccountDetailsParams,
  ): Promise<IFetchServerAccountDetailsResponse> {
    const res: IFetchAccountDetailsResp = {
      address: params.accountAddress,
      netWorth: undefined,
      balance: undefined,
      balanceParsed: undefined,
      isContract: undefined,
      nonce: undefined,
      utxoList: undefined,
    };
    const stages: {
      stage: string;
      value: () => Promise<any>;
      condition: boolean;
    }[] = [
      {
        stage: 'getAccountNetworth',
        value: () =>
          this.getAccountNetWorth(params).then((n) => {
            res.netWorth = n.netWorth;
            res.balance = n.balance;
            res.balanceParsed = n.balanceParsed;
          }),
        condition: !!params.withNetWorth,
      },
      {
        stage: 'getNonce',
        value: () =>
          this.getNonce(params).then((n) => {
            res.nonce = n.nonce;
            res.accountNumber = n.accountNumber;
          }),
        condition: !!params.withNonce,
      },
    ];
    await Promise.all(
      stages.map(async (n) => {
        if (n.condition) {
          return n.value();
        }
        return Promise.resolve();
      }),
    );

    return {
      data: {
        data: res,
      },
    };
  }

  protected async getAccountNetWorth(
    params: IFetchServerAccountDetailsParams,
  ): Promise<IServerGetAccountNetWorthResponse> {
    const res = await this.listAccountTokenWithBalance({
      networkId: params.networkId,
      accountAddress: params.accountAddress,
      xpub: params.xpub,
      contractList: [this.nativeTokenAddress],
    });

    let netWorth = new BigNumber(0);
    let nativeToken: IServerAccountTokenItem | undefined;

    for (const t of res) {
      if (t) {
        if (t.info?.isNative) {
          nativeToken = t;
        }
        netWorth = netWorth.plus(t.fiatValue ?? 0);
      }
    }

    if (!nativeToken) {
      return {
        netWorth: undefined,
        balance: undefined,
        balanceParsed: undefined,
      };
    }

    return {
      netWorth: safeNumberString(netWorth.toFixed()),
      balance: new BigNumber(nativeToken?.balance ?? '0').toString(),
      balanceParsed: new BigNumber(
        nativeToken?.balanceParsed ?? '0',
      ).toString(),
    };
  }

  protected async getNonce(
    params: IFetchServerAccountDetailsParams,
  ): Promise<IServerFetchNonceResponse> {
    return {
      nonce: undefined,
    };
  }

  /*= ==============================
   *        /token/list
   *        /token/search
   *============================== */
  async listAccountToken(
    params: IFetchServerTokenListParams,
  ): Promise<IFetchServerTokenListResponse> {
    const arg = params.requestApiParams;
    const hiddenTokenSet = new Set(arg.hiddenTokens ?? []);

    arg.accountAddress = this.normalizeAddress(arg.accountAddress);
    arg.contractList =
      arg.contractList?.map((n) => this.normalizeAddress(n)) ?? [];

    const reply = await this.listAccountTokenWithBalance(
      params.requestApiParams,
    );
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
        fiatValue: '0',
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
        `${networkId}__${
          isEmpty(map) ? '' : Object.keys(map).join(',')
        }__${JSON.stringify(data)}`,
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

    return tokens
      .filter((t) => {
        if (params.onlyReturnSpecificTokens) {
          if (t.info?.address === undefined || t.info?.address === null) {
            return false;
          }
          return params.contractList?.includes(t.info.address);
        }
        return true;
      })
      .map((t) => {
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
    if (typeof keywords === 'string') {
      return this.searchChainTokens(params);
    }
    let tokens = await this.getChainTokensFromDB(params);
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

  async searchChainTokens(
    params: IServerTokenListQuery,
  ): Promise<IServerAccountTokenItem[]> {
    const { keywords } = params;
    if (!keywords) {
      return [];
    }
    const dbTokens = await this.searchChainTokensFromDB(params);
    if (
      dbTokens?.find(
        (t) =>
          keywords?.localeCompare(t?.info?.address ?? '', undefined, {
            sensitivity: 'base',
          }) === 0,
      )
    ) {
      return dbTokens;
    }
    const rpcTokenInfo = await this.searchChainTokensFromRpc(params);
    if (rpcTokenInfo?.length) {
      dbTokens.push(...rpcTokenInfo);
    }
    return dbTokens;
  }

  async searchChainTokensFromDB(
    params: IServerTokenListQuery,
  ): Promise<IServerAccountTokenItem[]> {
    const { keywords } = params;
    if (!keywords) {
      return [];
    }
    const res = await this.backgroundApi.simpleDb.localTokens.searchTokens({
      keywords,
    });
    return res.map((r) => parseTokenItem(r) as IServerAccountTokenItem);
  }

  public async searchChainTokensFromRpc(
    params: IServerTokenListQuery,
  ): Promise<IServerAccountTokenItem[]> {
    const { keywords } = params;
    if (!keywords) {
      return [];
    }
    const tokenAddress = await this.validateTokenAddress({
      networkId: params.networkId,
      address: keywords,
    }).catch(() => null);
    if (!tokenAddress) {
      return [];
    }
    const rpcTokenInfo = await this.getChainTokensFromRpc({
      networkId: params.networkId,
      contractList: [tokenAddress],
    });
    if (!rpcTokenInfo?.[0]?.info) {
      return [];
    }
    return rpcTokenInfo;
  }

  async queryAccountToken(
    params: IFetchServerTokenDetailParams,
  ): Promise<IFetchServerTokenDetailResponse> {
    let reply: IServerAccountTokenItem[] = [];
    const contractList = params.contractList?.map((n) =>
      this.normalizeAddress(n),
    );
    const hasAccount = params.accountAddress || params.xpub;
    if (hasAccount && params.contractList?.length) {
      reply = await this.listAccountTokenWithBalance({
        networkId: params.networkId,
        accountAddress: params.accountAddress ?? '',
        xpub: params.xpub,
        contractList,
        onlyReturnSpecificTokens: true,
      });
    } else {
      reply = await this.getChainTokens({
        networkId: params.networkId,
        contractList,
        keywords: params.keywords,
      });
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

  /*= ===============================
   *        /estimate-fee
   *============================== */
  async estimateFee(
    params: IEstimateGasParams,
  ): Promise<IServerEstimateFeeResponse> {
    if (typeof params.encodedTx === 'object') {
      if (
        'from' in params.encodedTx &&
        typeof params.encodedTx.from === 'string'
      ) {
        params.encodedTx.from = this.normalizeAddress(params.encodedTx.from);
      }
      if ('to' in params.encodedTx && typeof params.encodedTx.to === 'string') {
        params.encodedTx.to = this.normalizeAddress(params.encodedTx.to);
      }
    }
    const estimateFeeInfo = await this.estimateFeeFromRpc(params);
    return {
      data: {
        data: {
          ...estimateFeeInfo,
          nativeTokenPrice: {
            price: 0,
            price24h: 0,
          },
        },
      },
    };
  }

  async getGasPrice(
    params: IServerGasPriceParams,
  ): Promise<IServerGasPriceResponse> {
    throw new NotImplemented();
  }

  async getGasFee(params: IServerGasFeeParams): Promise<IServerGasFeeResponse> {
    throw new NotImplemented();
  }

  async getGasLimit(
    params: IServerGasLimitParams,
  ): Promise<IServerGasLimitResponse> {
    throw new NotImplemented();
  }

  async estimateFeeFromRpc(
    params: IEstimateGasParams,
  ): Promise<IServerEstimateFeeResponse['data']['data']> {
    throw new NotImplemented();
  }

  /*= ==============================
   *        /history/detail
   *============================== */
  async getAccountHistoryDetail(
    params: IServerFetchAccountHistoryDetailParams,
  ): Promise<IServerFetchAccountHistoryDetailResp> {
    try {
      if (params.accountAddress) {
        params.accountAddress = this.normalizeAddress(params.accountAddress);
      }
      const reply = await this.getHistoryDetailOnChain(params);

      // XXX: transfer FiatAmount by currencyValue
      // XXX: change object item by ref not a good way !!!
      forEach(reply.tokens, (tokenRef) => {
        tokenRef.price = '0';
      });

      reply.data.gasFeeFiatValue = '0';

      const res = this.normalizeHistoryTxActionLabels(params.networkId, {
        ...reply,
        data: [reply.data],
      });

      return {
        data: {
          data: {
            data: res.data[0],
            nfts: {},
            tokens: res.tokens,
          },
        },
      };
    } catch {
      // always fallback to pending
      return {
        data: {
          data: {
            // @ts-expect-error
            data: {
              tx: params.txid,
              status: EOnChainHistoryTxStatus.Pending,
            },
          },
        },
      };
    }
  }

  async getHistoryDetailOnChain(
    params: IServerFetchAccountHistoryDetailParams,
  ): Promise<IFetchHistoryTxDetailsResp> {
    const history: IFetchHistoryTxDetailsResp =
      await this.getHistoryDetailFromThirdParty(params);
    const data = history.data;
    if (!data) {
      throw new OneKeyError(
        `[ProviderBasic.getHistoryDetail] Transaction not found: ${params.txid}`,
      );
    }

    const transfers = data.sends?.concat(data.receives ?? []) ?? [];

    if (transfers?.length === 1) {
      if (!data.from) {
        data.from = transfers[0].from;
      }
      if (!data.to) {
        data.to = transfers[0].to;
      }
    }

    return history;
  }

  async getHistoryDetailFromThirdParty(
    params: IServerFetchAccountHistoryDetailParams,
  ): Promise<IFetchHistoryTxDetailsResp> {
    throw new NotImplemented();
  }

  // Since the label field is not used in the transaction history details page, we don't apply i18n to it for now
  private normalizeHistoryTxActionLabels(
    networkId: string,
    res: IFetchAccountHistoryResp,
  ) {
    const isNoFromToInTransfersChain = false;
    res.data = res.data.map((n) => {
      const originLabel = n.label;
      if (n.tokenActive) {
        n.label = 'Active';
      } else if (n.tokenApprove) {
        if (new BigNumber(n.tokenApprove?.amount).isLessThanOrEqualTo(0)) {
          const token = res.tokens?.[n.tokenApprove?.key];
          const nft = res.nfts?.[n.tokenApprove?.key];
          n.label = `Revoke {symbol} allowance`;
        } else {
          n.label = 'Approve';
        }
      } else if (
        n.sends?.length &&
        !n.receives?.length &&
        (isNoFromToInTransfersChain || n.sends.every((i) => i.to))
      ) {
        n.label = 'Send';
      } else if (
        n.receives?.length &&
        !n.sends?.length &&
        (isNoFromToInTransfersChain || n.receives.every((i) => i.from))
      ) {
        n.label = 'Receive';
      } else if (n.label === EOnChainHistoryTxType.Send) {
        n.label = 'Send';
      } else if (n.label === EOnChainHistoryTxType.Receive) {
        n.label = 'Receive';
      } else {
        n.label = 'Contract Interaction';
        const functionName = n.contractCall?.functionName ?? originLabel;
        if (functionName) {
          n.label += ` (${functionName})`;
        }
      }
      return n;
    });
    return res;
  }
}

export { BaseApiProvider };
