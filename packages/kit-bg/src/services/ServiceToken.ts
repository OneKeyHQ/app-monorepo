import BigNumber from 'bignumber.js';
import { debounce, isNil, uniq, uniqBy } from 'lodash';

import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { USD_CURRENCY_ID } from '@onekeyhq/shared/src/consts/currencyConsts';
import { AGGREGATE_TOKEN_MOCK_NETWORK_ID } from '@onekeyhq/shared/src/consts/networkConsts';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import perfUtils, {
  EPerformanceTimerLogNames,
} from '@onekeyhq/shared/src/utils/debug/perfUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import {
  buildTokenSearchKeywordQueries,
  filterAccountTokenListByLimit,
  getEmptyTokenData,
  getMergedTokenData,
} from '@onekeyhq/shared/src/utils/tokenUtils';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import type {
  IBinancePreOrderParams,
  IBinancePreOrderResponse,
  IBinanceSupportedAssets,
} from '@onekeyhq/shared/types/exchange';
import type {
  IAccountToken,
  IFetchAccountTokensParams,
  IFetchAccountTokensResp,
  IFetchTokenDetailBatchParams,
  IFetchTokenDetailBatchResp,
  IFetchTokenDetailItem,
  IFetchTokenDetailParams,
  ISearchTokensParams,
  IToken,
  ITokenData,
  ITokenFiat,
} from '@onekeyhq/shared/types/token';

import {
  currencyPersistAtom,
  settingsPersistAtom,
} from '../states/jotai/atoms';
import { vaultFactory } from '../vaults/factory';
import { getVaultSettings } from '../vaults/settings';

import ServiceBase from './ServiceBase';

import type { IDBAccount } from '../dbs/local/types';
import type { ISimpleDBLocalTokens } from '../dbs/simple/entity/SimpleDbEntityLocalTokens';
import type { IRiskTokenManagementDBStruct } from '../dbs/simple/entity/SimpleDbEntityRiskTokenManagement';

type IFetchAccountTokensController = {
  controller: AbortController;
  flag?: string;
};

@backgroundClass()
class ServiceToken extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
    // Drop memoized token info / unblocked / blocked / exchange-supported
    // assets caches under critical memory pressure. These cumulatively
    // pin sizeable token-metadata structures that are cheap to refetch.
    appEventBus.on(EAppEventBusNames.MemoryPressureWarning, (event) => {
      if (event.level !== 'critical') return;
      this.fetchTokenInfoOnlyMemo.clear();
      this.getUnblockedTokensMemo.clear();
      this.getBlockedTokensMemo.clear();
      void this._getBinanceSupportedAssetsMemo.clear();
    });
  }

  _fetchAccountTokensControllers: IFetchAccountTokensController[] = [];

  _searchTokensControllers: AbortController[] = [];

  @backgroundMethod()
  public async abortSearchTokens() {
    this._searchTokensControllers.forEach((controller) => controller.abort());
    this._searchTokensControllers = [];
  }

  @backgroundMethod()
  public async abortFetchAccountTokens(options?: { excludedFlags?: string[] }) {
    const excludedFlags = options?.excludedFlags ?? [];
    const nextControllers: IFetchAccountTokensController[] = [];

    this._fetchAccountTokensControllers.forEach((item) => {
      if (item.flag && excludedFlags.includes(item.flag)) {
        nextControllers.push(item);
        return;
      }
      item.controller.abort();
    });
    this._fetchAccountTokensControllers = nextControllers;
  }

  private removeFetchAccountTokensController(controller: AbortController) {
    this._fetchAccountTokensControllers =
      this._fetchAccountTokensControllers.filter(
        (item) => item.controller !== controller,
      );
  }

  localAccountTokensCache: {
    tokenList: Record<string, IAccountToken[]>;
    smallBalanceTokenList: Record<string, IAccountToken[]>;
    riskyTokenList: Record<string, IAccountToken[]>;
    tokenListValue: Record<string, string>;
    tokenListMap: Record<string, Record<string, ITokenFiat>>;
    tokenListCurrency: Record<string, string>;
  } = {
    tokenList: {},
    smallBalanceTokenList: {},
    riskyTokenList: {},
    tokenListValue: {},
    tokenListMap: {},
    tokenListCurrency: {},
  };

  // Returns `null` when the rate is missing or unusable so callers can skip
  // conversion and tag entries with the source currency instead — the cache
  // would otherwise be tagged 'usd' but hold values in the request currency.
  private async resolveCurrencyRate(
    currency: string,
  ): Promise<BigNumber | null> {
    if (currency === USD_CURRENCY_ID) return new BigNumber(1);
    const { currencyMap } = await currencyPersistAtom.get();
    const rateItem = currencyMap[currency];
    if (!rateItem) return null;
    const rate = new BigNumber(rateItem.value);
    if (!rate.isFinite() || rate.isZero()) return null;
    return rate;
  }

  // price24h is a percentage and is left untouched.
  private convertFiatToCurrency(
    fiat: ITokenFiat,
    rate: BigNumber,
    targetCurrency: string,
  ): void {
    if (!rate.eq(1)) {
      if (fiat.fiatValue) {
        fiat.fiatValue = new BigNumber(fiat.fiatValue).div(rate).toFixed();
      }
      if (fiat.frozenBalanceFiatValue) {
        fiat.frozenBalanceFiatValue = new BigNumber(fiat.frozenBalanceFiatValue)
          .div(rate)
          .toFixed();
      }
      if (fiat.totalBalanceFiatValue) {
        fiat.totalBalanceFiatValue = new BigNumber(fiat.totalBalanceFiatValue)
          .div(rate)
          .toFixed();
      }
      // `price` is typed as number but the API can deliver it as a numeric
      // string, so a `typeof === 'number'` guard silently skips it — leaving
      // price in the request currency while the render layer still converts
      // USD -> display currency, double-applying the rate (CNY price ends up
      // ~rate^2 off). Guard on truthiness like the fiat fields above.
      if (fiat.price) {
        const priceBn = new BigNumber(fiat.price);
        if (priceBn.isFinite()) {
          fiat.price = priceBn.div(rate).toNumber();
        }
      }
    }
    fiat.currency = targetCurrency;
  }

  // Returns the currency the response was actually normalized to. When the
  // rate for `requestCurrency` is missing/invalid, values stay in the source
  // currency — callers MUST use the return value as the cache tag, otherwise
  // the cache claims USD basis while holding non-USD values.
  private async normalizeTokensRespToUsd(
    data: IFetchAccountTokensResp,
    requestCurrency: string,
  ): Promise<string> {
    const rate = await this.resolveCurrencyRate(requestCurrency);
    const resolvedCurrency = rate ? USD_CURRENCY_ID : requestCurrency;
    const effectiveRate = rate ?? new BigNumber(1);

    const visitFiat = (fiat: ITokenFiat): void =>
      this.convertFiatToCurrency(fiat, effectiveRate, resolvedCurrency);
    const visitTokenData = (td: ITokenData | undefined): void => {
      if (!td) return;
      Object.values(td.map ?? {}).forEach(visitFiat);
      if (!effectiveRate.eq(1) && td.fiatValue) {
        td.fiatValue = new BigNumber(td.fiatValue).div(effectiveRate).toFixed();
      }
      td.currency = resolvedCurrency;
    };

    visitTokenData(data.tokens);
    visitTokenData(data.smallBalanceTokens);
    visitTokenData(data.riskTokens);
    visitTokenData(data.allTokens);
    if (data.aggregateTokenMap) {
      Object.values(data.aggregateTokenMap).forEach(visitFiat);
    }
    return resolvedCurrency;
  }

  @backgroundMethod()
  public async fetchAccountTokens(
    params: IFetchAccountTokensParams & {
      mergeTokens?: boolean;
      dbAccount?: IDBAccount;
    },
  ): Promise<IFetchAccountTokensResp> {
    const {
      mergeTokens,
      flag,
      accountId,
      indexedAccountId,
      dbAccount,
      isAllNetworks,
      isManualRefresh,
      allNetworksAccountId,
      allNetworksNetworkId,
      saveToLocal,
      saveToLocalLimit = 50,
      customTokensRawData,
      blockedTokensRawData,
      unblockedTokensRawData,
      ...rest
    } = params;
    const { networkId } = rest;

    const isUrlAccount = accountUtils.isUrlAccountFn({ accountId });

    const currentNetworkId = isUrlAccount
      ? this._currentUrlNetworkId
      : this._currentNetworkId;

    const currentAccountId = isUrlAccount
      ? this._currentUrlAccountId
      : this._currentAccountId;

    if (isAllNetworks && currentNetworkId !== getNetworkIdsMap().onekeyall)
      return {
        ...getEmptyTokenData(),
        networkId: currentNetworkId,
      };

    const accountParams = {
      accountId,
      networkId,
      dbAccount,
      customTokensRawData,
    };
    const [xpub, accountAddress] = await Promise.all([
      this.backgroundApi.serviceAccount.getAccountXpub(accountParams),
      this.backgroundApi.serviceAccount.getAccountAddressForApi(accountParams),
    ]);
    if (!accountAddress && !xpub) {
      console.log(
        `fetchAccountTokens ERROR: accountAddress and xpub are both empty`,
      );
      defaultLogger.token.request.fetchAccountTokenAccountAddressAndXpubBothEmpty(
        { params, accountAddress, xpub },
      );
      return getEmptyTokenData();
    }

    const accountXpubOrAddress =
      await this.backgroundApi.serviceAccount.buildAccountXpubOrAddress({
        getAccountXpubFn: async () => xpub,
        getAccountAddressFn: async () => accountAddress,
      });

    /* eslint-disable prefer-const */
    let [
      customTokens,
      hiddenTokens,
      unblockedTokens,
      blockedTokens,
      vaultSettings,
      network,
      aggregateHiddenTokens,
      aggregateCustomTokens,
      allAggregateTokenInfo,
    ] = await Promise.all([
      this.backgroundApi.serviceCustomToken.getCustomTokens({
        ...accountParams,
        accountXpubOrAddress,
      }),
      this.backgroundApi.serviceCustomToken.getHiddenTokens({
        ...accountParams,
        accountXpubOrAddress,
      }),
      this.backgroundApi.serviceToken.getUnblockedTokens({
        networkId,
        unblockedTokensRawData,
      }),
      this.backgroundApi.serviceToken.getBlockedTokens({
        networkId,
        blockedTokensRawData,
      }),
      this.backgroundApi.serviceNetwork.getVaultSettings({ networkId }),
      this.backgroundApi.serviceNetwork.getNetworkSafe({ networkId }),
      // get aggregate hidden tokens
      this.backgroundApi.serviceCustomToken.getHiddenTokens({
        accountId: indexedAccountId ?? accountId ?? '',
        accountXpubOrAddress: indexedAccountId ?? accountId,
        networkId: AGGREGATE_TOKEN_MOCK_NETWORK_ID,
        customTokensRawData,
      }),
      // get aggregate custom tokens
      this.backgroundApi.serviceCustomToken.getCustomTokens({
        accountId: indexedAccountId ?? accountId ?? '',
        accountXpubOrAddress: indexedAccountId ?? accountId,
        networkId: AGGREGATE_TOKEN_MOCK_NETWORK_ID,
        customTokensRawData,
      }),
      this.backgroundApi.serviceToken.getAllAggregateTokenInfo(),
    ]);
    /* eslint-enable prefer-const */

    if (aggregateCustomTokens?.length > 0) {
      aggregateCustomTokens.forEach((t) => {
        if (allAggregateTokenInfo.allAggregateTokenMap[t.$key]) {
          // @ts-ignore
          customTokens = [
            ...customTokens,
            ...allAggregateTokenInfo.allAggregateTokenMap[t.$key].tokens.filter(
              (token) => token.networkId === networkId,
            ),
          ];
        }
      });
    }

    if (aggregateHiddenTokens?.length > 0) {
      aggregateHiddenTokens.forEach((t) => {
        if (allAggregateTokenInfo.allAggregateTokenMap[t.$key]) {
          // @ts-ignore
          hiddenTokens = [
            ...hiddenTokens,
            ...allAggregateTokenInfo.allAggregateTokenMap[t.$key].tokens.filter(
              (token) => token.networkId === networkId,
            ),
          ];
        }
      });
    }

    rest.contractList = uniq([
      ...(rest.contractList ?? []),
      ...customTokens.map((t) => t.address),
    ]);

    rest.hiddenTokens = uniq(hiddenTokens.map((t) => t.address));

    rest.unblockedTokens = unblockedTokens;
    rest.blockedTokens = blockedTokens;

    // const client = await this.getClient(EServiceEndpointEnum.Wallet);
    const controller = new AbortController();
    this._fetchAccountTokensControllers.push({
      controller,
      flag,
    });
    // const resp = await client.post<{
    //   data: IFetchAccountTokensResp;
    // }>(
    //   `/wallet/v1/account/token/list?flag=${flag || ''}`,
    //   {
    //     ...rest,
    //     accountAddress,
    //     xpub,
    //     isAllNetwork: isAllNetworks,
    //     isForceRefresh: isManualRefresh,
    //   },
    //   {
    //     signal: controller.signal,
    //     headers:
    //       await this.backgroundApi.serviceAccountProfile._getWalletTypeHeader({
    //         accountId,
    //       }),
    //   },
    // );
    const vault = await vaultFactory.getVault({
      accountId,
      networkId,
    });
    const requestCurrency =
      (await settingsPersistAtom.get())?.currencyInfo?.id ?? USD_CURRENCY_ID;

    const resp = await (async () => {
      try {
        return await vault.fetchTokenList({
          accountId,
          requestApiParams: {
            ...rest,
            accountAddress,
            xpub,
            isAllNetwork: isAllNetworks,
            isForceRefresh: isManualRefresh,
          },
          flag,
          signal: controller.signal,
          // Pin the server pricing currency at capture time — the axios
          // interceptor would otherwise re-read settings.currencyInfo.id at send
          // time, and a mid-flight currency switch would tag the cache wrongly.
          requestCurrency,
        });
      } finally {
        this.removeFetchAccountTokensController(controller);
      }
    })();

    const resolvedCurrency = await this.normalizeTokensRespToUsd(
      resp.data.data,
      requestCurrency,
    );

    let allTokens: ITokenData | undefined;

    resp.data.data.tokens.data = resp.data.data.tokens.data.map((token) => {
      return {
        ...this.mergeTokenMetadataWithCustomDataSync({
          token,
          customTokens,
          networkId,
        }),
        accountId,
        networkId,
        networkName: network?.name,
        mergeAssets: vaultSettings.mergeDeriveAssetsEnabled,
      };
    });

    resp.data.data.riskTokens.data = resp.data.data.riskTokens.data.map(
      (token) => ({
        ...this.mergeTokenMetadataWithCustomDataSync({
          token,
          customTokens,
          networkId,
        }),
        accountId,
        networkId,
        networkName: network?.name,
        mergeAssets: vaultSettings.mergeDeriveAssetsEnabled,
      }),
    );

    resp.data.data.smallBalanceTokens.data =
      resp.data.data.smallBalanceTokens.data.map((token) => {
        return {
          ...this.mergeTokenMetadataWithCustomDataSync({
            token,
            customTokens,
            networkId,
          }),
          accountId,
          networkId,
          networkName: network?.name,
          mergeAssets: vaultSettings.mergeDeriveAssetsEnabled,
        };
      });

    if (mergeTokens) {
      const { tokens, riskTokens, smallBalanceTokens } = resp.data.data as any;
      ({ allTokens } = getMergedTokenData({
        tokens,
        riskTokens,
        smallBalanceTokens,
      }));
      if (allTokens) {
        allTokens.data = allTokens.data.map((token) => ({
          ...token,
          accountId,
          networkId,
          networkName: network?.name,
          mergeAssets: vaultSettings.mergeDeriveAssetsEnabled,
        }));
        allTokens.currency = resolvedCurrency;
      }
      resp.data.data.allTokens = allTokens;
    }

    if (saveToLocal) {
      let tokenListValue = new BigNumber(0);
      tokenListValue = tokenListValue
        .plus(resp.data.data.tokens.fiatValue ?? '0')
        .plus(resp.data.data.smallBalanceTokens.fiatValue ?? '0');

      const {
        filteredTokenList,
        filteredSmallBalanceTokenList,
        filteredRiskyTokenList,
        filteredTokenListMap,
      } = filterAccountTokenListByLimit({
        tokenList: resp.data.data.tokens.data,
        smallBalanceTokenList: resp.data.data.smallBalanceTokens.data,
        riskyTokenList: resp.data.data.riskTokens.data,
        limit: saveToLocalLimit,
        tokenListMap: {
          ...resp.data.data.tokens.map,
          ...resp.data.data.smallBalanceTokens.map,
          ...resp.data.data.riskTokens.map,
        },
      });

      if (isAllNetworks) {
        const key = accountUtils.buildAccountLocalAssetsKey({
          networkId,
          accountAddress,
          xpub,
        });

        this.localAccountTokensCache.tokenList[key] = filteredTokenList;
        this.localAccountTokensCache.smallBalanceTokenList[key] =
          filteredSmallBalanceTokenList;
        this.localAccountTokensCache.riskyTokenList[key] =
          filteredRiskyTokenList;
        this.localAccountTokensCache.tokenListValue[key] =
          tokenListValue.toFixed();
        this.localAccountTokensCache.tokenListMap[key] = filteredTokenListMap;
        this.localAccountTokensCache.tokenListCurrency[key] = resolvedCurrency;

        await this._updateAccountLocalTokensDebounced();
      } else {
        await this.updateAccountLocalTokens({
          dbAccount,
          accountId,
          networkId,
          tokenList: filteredTokenList,
          smallBalanceTokenList: filteredSmallBalanceTokenList,
          riskyTokenList: filteredRiskyTokenList,
          tokenListValue: tokenListValue.toFixed(),
          tokenListMap: filteredTokenListMap,
          currency: resolvedCurrency,
        });
      }
    }
    resp.data.data.isSameAllNetworksAccountData = !!(
      allNetworksAccountId &&
      allNetworksNetworkId &&
      allNetworksAccountId === currentAccountId &&
      allNetworksNetworkId === currentNetworkId
    );

    resp.data.data.accountId = accountId;
    resp.data.data.networkId = networkId;

    return resp.data.data;
  }

  @backgroundMethod()
  async mergeTokenMetadataWithCustomData<T extends IToken>(params: {
    token: T;
    customTokens: IAccountToken[];
    networkId: string;
  }): Promise<T> {
    return Promise.resolve(this.mergeTokenMetadataWithCustomDataSync(params));
  }

  /**
   * Batched variant: callers that need to merge metadata across a whole
   * token list (e.g. `useTokenManagement`) MUST use this instead of N
   * parallel `mergeTokenMetadataWithCustomData` calls. The single-item
   * bridge method is a `Promise.resolve()` wrap around a sync function —
   * each call pays the full BgTransport round-trip cost (one
   * dispatchRemoteRequest + one handleResponse + one JSON.parse on the main
   * runtime) for zero real async work, which is exactly the N+1 pattern
   * that shows up as 808 mergeTokenMetadataWithCustomData calls in the
   * OK-perp/swap freeze trace. Batching collapses it to 1 bridge call.
   */
  @backgroundMethod()
  async mergeTokenMetadataWithCustomDataBatch<T extends IToken>(params: {
    tokens: T[];
    customTokens: IAccountToken[];
    networkId: string;
  }): Promise<T[]> {
    const { tokens, customTokens, networkId } = params;
    return tokens.map((token) =>
      this.mergeTokenMetadataWithCustomDataSync({
        token,
        customTokens,
        networkId,
      }),
    );
  }

  private mergeTokenMetadataWithCustomDataSync<T extends IToken>({
    token,
    customTokens,
    networkId,
  }: {
    token: T;
    customTokens: IAccountToken[];
    networkId: string;
  }): T {
    if (!token.symbol || !token.name) {
      const customToken = customTokens.find(
        (t) =>
          t.address?.toLowerCase() === token.address?.toLowerCase() &&
          t.networkId === networkId,
      );
      if (customToken) {
        return {
          ...token,
          symbol: token.symbol || customToken.symbol,
          name: token.name || customToken.name,
        };
      }
    }
    return token;
  }

  _updateAccountLocalTokensDebounced = debounce(
    async () => {
      await this.backgroundApi.simpleDb.localTokens.updateAccountTokenListByCache(
        this.localAccountTokensCache,
      );
      this.localAccountTokensCache = {
        tokenList: {},
        smallBalanceTokenList: {},
        riskyTokenList: {},
        tokenListValue: {},
        tokenListMap: {},
        tokenListCurrency: {},
      };
    },
    3000,
    {
      leading: false,
      trailing: true,
    },
  );

  @backgroundMethod()
  public async fetchTokensDetails(
    params: IFetchTokenDetailParams,
  ): Promise<IFetchTokenDetailItem[]> {
    const {
      accountId,
      networkId,
      contractList,
      withCheckInscription,
      withFrozenBalance,
    } = params;

    const [accountAddress, xpub] = await Promise.all([
      this.backgroundApi.serviceAccount.getAccountAddressForApi({
        accountId,
        networkId,
      }),
      this.backgroundApi.serviceAccount.getAccountXpub({
        accountId,
        networkId,
      }),
    ]);

    if (!accountAddress && !xpub) {
      console.log(
        `fetchTokensDetails ERROR: accountAddress and xpub are both empty`,
      );
      defaultLogger.token.request.fetchTokensDetailsAccountAddressAndXpubBothEmpty(
        { params, accountAddress, xpub },
      );
      return [];
    }

    const vault = await vaultFactory.getVault({
      accountId,
      networkId,
    });
    const requestCurrency =
      (await settingsPersistAtom.get())?.currencyInfo?.id ?? USD_CURRENCY_ID;

    const resp = await vault.fetchTokenDetails({
      accountId,
      networkId,
      accountAddress,
      xpub,
      contractList,
      withCheckInscription,
      withFrozenBalance,
      requestCurrency,
    });

    if (resp.data.data?.length) {
      const rate = await this.resolveCurrencyRate(requestCurrency);
      const resolvedCurrency = rate ? USD_CURRENCY_ID : requestCurrency;
      const effectiveRate = rate ?? new BigNumber(1);
      for (const item of resp.data.data) {
        this.convertFiatToCurrency(item, effectiveRate, resolvedCurrency);
      }
    }

    return vault.fillTokensDetails({
      tokensDetails: resp.data.data,
    });
  }

  @backgroundMethod()
  public async fetchTokensDetailsBatch(
    params: IFetchTokenDetailBatchParams,
  ): Promise<IFetchTokenDetailBatchResp> {
    const { accountId, networkId, contractList, queries } = params;

    if (!queries.length) {
      return [];
    }

    const client = await this.getClient(EServiceEndpointEnum.Wallet);
    const resp = await client.post<{
      data: IFetchTokenDetailBatchResp;
    }>(
      '/wallet/v1/account/token/search-batch',
      {
        networkId,
        contractList,
        queries,
      },
      {
        headers:
          await this.backgroundApi.serviceAccountProfile._getWalletTypeHeader({
            accountId,
          }),
      },
    );

    const result = resp.data.data ?? [];

    return result.map((item) => ({
      ...item,
      tokens: item.tokens.map((token) => ({
        ...token,
        info: {
          ...token.info,
          networkId,
        },
      })),
    }));
  }

  @backgroundMethod()
  public async fetchTokenInfoOnly(params: {
    networkId: string;
    tokenAddress: string;
  }) {
    return this.fetchTokenInfoOnlyMemo(params);
  }

  fetchTokenInfoOnlyMemo = memoizee(
    async (params: { networkId: string; tokenAddress: string }) => {
      const { networkId, tokenAddress } = params;
      const vault = await vaultFactory.getChainOnlyVault({ networkId });
      const resp = await vault.fetchTokenDetails({
        networkId,
        contractList: [tokenAddress],
      });
      return resp.data.data[0];
    },
    {
      promise: true,
      primitive: true,
      maxAge: timerUtils.getTimeDurationMs({ minute: 3 }),
      max: 10,
    },
  );

  @backgroundMethod()
  public async searchTokens(params: ISearchTokensParams) {
    const { accountId, networkId, contractList, keywords } = params;
    const controller = new AbortController();
    this._searchTokensControllers.push(controller);
    const vault = await vaultFactory.getChainOnlyVault({ networkId });
    const keywordQueries = buildTokenSearchKeywordQueries(keywords);
    const queries = keywordQueries.length ? keywordQueries : [keywords];
    const settledResponses = await Promise.allSettled(
      queries.map((queryKeywords) =>
        vault.fetchTokenDetails({
          accountId,
          networkId,
          contractList,
          keywords: queryKeywords,
          signal: controller.signal,
        }),
      ),
    );

    const fulfilledResponses = settledResponses.flatMap((settled) =>
      settled.status === 'fulfilled' ? [settled.value] : [],
    );

    // Surface an error only when every query failed (e.g. all aborted by
    // abortSearchTokens). A single fallback-query failure — such as the
    // `eth -> ether` alias query timing out — must not discard the primary
    // query's hits.
    if (fulfilledResponses.length === 0) {
      const firstRejected = settledResponses.find(
        (settled): settled is PromiseRejectedResult =>
          settled.status === 'rejected',
      );
      if (firstRejected) {
        throw firstRejected.reason;
      }
    }

    return uniqBy(
      fulfilledResponses.flatMap((resp) => resp.data.data),
      (item) =>
        `${item.info.networkId ?? ''}_${
          item.info.uniqueKey ?? item.info.address
        }`,
    ).map((item) => ({
      ...item.info,
      $key: item.info.uniqueKey ?? item.info.address,
    }));
  }

  @backgroundMethod()
  public async updateLocalTokens({
    networkId,
    tokens,
  }: {
    networkId: string;
    tokens: IToken[];
  }) {
    return this.backgroundApi.simpleDb.localTokens.updateTokens({
      networkId,
      tokens,
    });
  }

  @backgroundMethod()
  public async clearLocalTokens() {
    return this.backgroundApi.simpleDb.localTokens.clearTokens();
  }

  @backgroundMethod()
  public async getNativeTokenAddress({ networkId }: { networkId: string }) {
    const vaultSettings = await getVaultSettings({ networkId });
    let tokenAddress = vaultSettings.networkInfo[networkId]?.nativeTokenAddress;
    if (typeof tokenAddress === 'string') {
      return tokenAddress;
    }
    tokenAddress = vaultSettings.networkInfo.default.nativeTokenAddress;
    if (typeof tokenAddress === 'string') {
      return tokenAddress;
    }
    return '';
  }

  @backgroundMethod()
  public async getNativeToken({
    accountId,
    networkId,
    tokenIdOnNetwork,
    tokenInfoOnly,
  }: {
    networkId: string;
    accountId: string;
    tokenIdOnNetwork?: string;
    tokenInfoOnly?: boolean;
  }) {
    let tokenAddress = tokenIdOnNetwork;

    if (networkUtils.isAllNetwork({ networkId })) {
      return null;
    }

    if (isNil(tokenAddress)) {
      tokenAddress = await this.getNativeTokenAddress({ networkId });
    }

    return this.getToken({
      accountId,
      networkId,
      tokenIdOnNetwork: tokenAddress ?? '',
      tokenInfoOnly,
    });
  }

  @backgroundMethod()
  public async getToken(params: {
    accountId: string;
    networkId: string;
    tokenIdOnNetwork: string;
    tokenInfoOnly?: boolean;
  }) {
    const { accountId, networkId, tokenIdOnNetwork, tokenInfoOnly } = params;
    const localToken = await this.backgroundApi.simpleDb.localTokens.getToken({
      networkId,
      tokenIdOnNetwork,
    });

    if (localToken) {
      if (!localToken.symbol || !localToken.name) {
        const customTokens =
          await this.backgroundApi.serviceCustomToken.getCustomTokens({
            accountId,
            networkId,
          });
        return this.mergeTokenMetadataWithCustomData({
          token: localToken,
          customTokens,
          networkId,
        });
      }
      return localToken;
    }

    if (localToken) return localToken;

    try {
      let tokensDetails: IFetchTokenDetailItem[] = [];

      if (accountId === '' || tokenInfoOnly) {
        tokensDetails = [
          await this.fetchTokenInfoOnly({
            networkId,
            tokenAddress: tokenIdOnNetwork,
          }),
        ];
      } else {
        tokensDetails = await this.fetchTokensDetails({
          accountId,
          networkId,
          contractList: [tokenIdOnNetwork],
        });
      }

      let tokenInfo = tokensDetails[0].info;

      if (!tokenInfo.symbol || !tokenInfo.name) {
        const customTokens =
          await this.backgroundApi.serviceCustomToken.getCustomTokens({
            accountId,
            networkId,
          });

        tokenInfo = this.mergeTokenMetadataWithCustomDataSync({
          token: tokenInfo,
          customTokens,
          networkId,
        });
      }

      void this.updateLocalTokens({
        networkId,
        tokens: [tokenInfo],
      });

      return tokenInfo;
    } catch (error) {
      console.log('fetchTokensDetails ERROR:', error);
    }

    return null;
  }

  @backgroundMethod()
  public async updateAccountLocalTokens(params: {
    dbAccount?: IDBAccount;
    accountId: string;
    networkId: string;
    tokenList: IAccountToken[];
    smallBalanceTokenList: IAccountToken[];
    riskyTokenList: IAccountToken[];
    tokenListMap: Record<string, ITokenFiat>;
    tokenListValue: string;
    currency: string;
  }) {
    const {
      dbAccount,
      accountId,
      networkId,
      tokenList,
      smallBalanceTokenList,
      riskyTokenList,
      tokenListMap,
      tokenListValue,
      currency,
    } = params;
    const [xpub, accountAddress] = await Promise.all([
      this.backgroundApi.serviceAccount.getAccountXpub({
        dbAccount,
        accountId,
        networkId,
      }),
      this.backgroundApi.serviceAccount.getAccountAddressForApi({
        dbAccount,
        accountId,
        networkId,
      }),
    ]);

    await this.backgroundApi.simpleDb.localTokens.updateAccountTokenList({
      networkId,
      accountAddress,
      xpub,
      tokenList,
      smallBalanceTokenList,
      riskyTokenList,
      tokenListMap,
      tokenListValue,
      currency,
    });
  }

  @backgroundMethod()
  public async getAccountLocalTokens(params: {
    accountId: string;
    networkId: string;
    accountAddress?: string;
    xpub?: string;
    simpleDbLocalTokensRawData?: ISimpleDBLocalTokens;
  }) {
    const perf = perfUtils.createPerf({
      name: EPerformanceTimerLogNames.allNetwork__getAccountLocalTokens,
    });

    const { accountId, networkId, simpleDbLocalTokensRawData } = params;

    let accountAddress: string | undefined;
    let xpub: string | undefined;

    if (params.accountAddress || params.xpub) {
      accountAddress = params.accountAddress;
      xpub = params.xpub;
    } else {
      perf.markStart('getAccountXpubAndAddress');
      [xpub, accountAddress] = await Promise.all([
        this.backgroundApi.serviceAccount.getAccountXpub({
          accountId,
          networkId,
        }),
        this.backgroundApi.serviceAccount.getAccountAddressForApi({
          accountId,
          networkId,
        }),
      ]);
      perf.markEnd('getAccountXpubAndAddress');
    }

    perf.markStart('getAccountTokenList', {
      accountAddress,
      networkId,
      rawDataExist: !!simpleDbLocalTokensRawData,
    });
    const localTokens =
      await this.backgroundApi.simpleDb.localTokens.getAccountTokenList({
        networkId,
        accountAddress,
        xpub,
        simpleDbLocalTokensRawData,
      });
    perf.markEnd('getAccountTokenList');

    let tokenList = localTokens.tokenList;
    let smallBalanceTokenList = localTokens.smallBalanceTokenList;
    let riskyTokenList = localTokens.riskyTokenList;

    if (
      (tokenList[0]?.accountId && tokenList[0]?.accountId !== accountId) ||
      (smallBalanceTokenList[0]?.accountId &&
        smallBalanceTokenList[0]?.accountId !== accountId) ||
      (riskyTokenList[0]?.accountId &&
        riskyTokenList[0]?.accountId !== accountId)
    ) {
      perf.markStart('mapAccountTokenList');
      tokenList = tokenList.map((token) => ({
        ...token,
        accountId,
        networkId,
      }));

      smallBalanceTokenList = smallBalanceTokenList.map((token) => ({
        ...token,
        accountId,
        networkId,
      }));

      riskyTokenList = riskyTokenList.map((token) => ({
        ...token,
        accountId,
        networkId,
      }));
      perf.markEnd('mapAccountTokenList');
    }

    // Pre-migration entries have no currency tag; assume the user's current
    // display currency so <Currency> renders them as a no-op until the next
    // fetch overwrites them with USD-normalized data.
    let resolvedCurrency = localTokens.currency;
    if (!resolvedCurrency && localTokens.hasCache) {
      resolvedCurrency =
        (await settingsPersistAtom.get())?.currencyInfo?.id ?? USD_CURRENCY_ID;
    }

    // Decorate ITokenFiat entries with the resolved currency tag so UI
    // callers can pass it to <Currency sourceCurrency=...> without having to
    // thread the outer tag through every component. Skip the rebuild when
    // every entry already carries a tag — `convertFiatToCurrency` writes one
    // on the fetch path, so the post-migration steady state is no-op here.
    const rawTokenListMap = localTokens.tokenListMap;
    let tokenListMap = rawTokenListMap;
    if (resolvedCurrency) {
      const entries = Object.entries(rawTokenListMap);
      const needsRebuild = entries.some(([, fiat]) => !fiat.currency);
      if (needsRebuild) {
        tokenListMap = Object.fromEntries(
          entries.map(([k, fiat]) => [
            k,
            { ...fiat, currency: fiat.currency ?? resolvedCurrency },
          ]),
        );
      }
    }

    // Hoist legacy (non-USD) cache to USD basis before returning, so callers
    // that merge results from multiple (account, network) pairs can rely on a
    // single basis. Without this, an All Networks batch may contain entries
    // tagged 'usd' (post-migration) alongside entries tagged in the user's
    // display currency (pre-migration), and downstream sums would silently
    // mix bases.
    let tokenListValue = localTokens.tokenListValue;
    if (resolvedCurrency && resolvedCurrency !== USD_CURRENCY_ID) {
      const rate = await this.resolveCurrencyRate(resolvedCurrency);
      if (rate && !rate.eq(1)) {
        tokenListMap = Object.fromEntries(
          Object.entries(tokenListMap).map(([k, fiat]) => {
            const next: ITokenFiat = { ...fiat };
            this.convertFiatToCurrency(next, rate, USD_CURRENCY_ID);
            return [k, next];
          }),
        );
        if (tokenListValue) {
          tokenListValue = new BigNumber(tokenListValue).div(rate).toFixed();
        }
        resolvedCurrency = USD_CURRENCY_ID;
      }
    }

    perf.done();
    return {
      ...localTokens,
      tokenList,
      smallBalanceTokenList,
      riskyTokenList,
      tokenListMap,
      tokenListValue,
      currency: resolvedCurrency,
      hasCache: localTokens.hasCache,
      accountId,
      networkId,
    };
  }

  @backgroundMethod()
  public async getRiskTokenManagementRawData() {
    return this.backgroundApi.simpleDb.riskTokenManagement.getRawData();
  }

  @backgroundMethod()
  public async getCustomTokensRawData() {
    return this.backgroundApi.simpleDb.customTokens.getRawData();
  }

  getUnblockedTokensMemo = memoizee(
    async ({ networkId }: { networkId: string }) => {
      return this.backgroundApi.simpleDb.riskTokenManagement.getUnblockedTokens(
        {
          networkId,
        },
      );
    },
    {
      promise: true,
      primitive: true,
      max: 50,
      maxAge: timerUtils.getTimeDurationMs({ minute: 1 }),
    },
  );

  getBlockedTokensMemo = memoizee(
    async ({ networkId }: { networkId: string }) => {
      return this.backgroundApi.simpleDb.riskTokenManagement.getBlockedTokens({
        networkId,
      });
    },
    {
      promise: true,
      primitive: true,
      max: 50,
      maxAge: timerUtils.getTimeDurationMs({ minute: 1 }),
    },
  );

  @backgroundMethod()
  public async clearRiskTokensManagementCache() {
    this.getUnblockedTokensMemo.clear();
    this.getBlockedTokensMemo.clear();
  }

  @backgroundMethod()
  public async getUnblockedTokensMap({
    networkId,
    unblockedTokensRawData,
  }: {
    networkId: string;
    unblockedTokensRawData?: IRiskTokenManagementDBStruct['unblockedTokens'];
  }) {
    if (unblockedTokensRawData) {
      return {
        [networkId]: unblockedTokensRawData[networkId] ?? {},
      };
    }

    return this.getUnblockedTokensMemo({ networkId });
  }

  @backgroundMethod()
  public async getBlockedTokensMap({
    networkId,
    blockedTokensRawData,
  }: {
    networkId: string;
    blockedTokensRawData?: IRiskTokenManagementDBStruct['blockedTokens'];
  }) {
    if (blockedTokensRawData) {
      return {
        [networkId]: blockedTokensRawData[networkId] ?? {},
      };
    }

    return this.getBlockedTokensMemo({ networkId });
  }

  @backgroundMethod()
  public async getBlockedTokens({
    networkId,
    blockedTokensRawData,
  }: {
    networkId: string;
    blockedTokensRawData?: IRiskTokenManagementDBStruct['blockedTokens'];
  }) {
    const blockedTokensMap = await this.getBlockedTokensMap({
      networkId,
      blockedTokensRawData,
    });
    const blockedTokensMapByNetworkId = blockedTokensMap[networkId] ?? {};
    return Object.keys(blockedTokensMapByNetworkId).filter(
      (tokenAddress) => blockedTokensMapByNetworkId[tokenAddress],
    );
  }

  @backgroundMethod()
  public async getUnblockedTokens({
    networkId,
    unblockedTokensRawData,
  }: {
    networkId: string;
    unblockedTokensRawData?: IRiskTokenManagementDBStruct['unblockedTokens'];
  }) {
    const unblockedTokensMap = await this.getUnblockedTokensMap({
      networkId,
      unblockedTokensRawData,
    });
    const unblockedTokensMapByNetworkId = unblockedTokensMap[networkId] ?? {};
    return Object.keys(unblockedTokensMapByNetworkId).filter(
      (tokenAddress) => unblockedTokensMapByNetworkId[tokenAddress],
    );
  }

  @backgroundMethod()
  public async updateRiskTokensState({
    blockedTokens,
    unblockedTokens,
  }: {
    blockedTokens: IRiskTokenManagementDBStruct['blockedTokens'];
    unblockedTokens: IRiskTokenManagementDBStruct['unblockedTokens'];
  }) {
    return this.backgroundApi.simpleDb.riskTokenManagement.updateRiskTokensState(
      {
        blockedTokens,
        unblockedTokens,
      },
    );
  }

  @backgroundMethod()
  public async getHomeDefaultTokenMap() {
    return this.backgroundApi.simpleDb.aggregateToken.getHomeDefaultTokenMap();
  }

  @backgroundMethod()
  public async getAggregateTokenSymbolMap() {
    return this.backgroundApi.simpleDb.aggregateToken.getAggregateTokenSymbolMap();
  }

  @backgroundMethod()
  public async getAggregateTokenConfigMap() {
    return this.backgroundApi.simpleDb.aggregateToken.getAggregateTokenConfigMap();
  }

  @backgroundMethod()
  public async updateLocalAggregateTokenMap({
    networkId,
    accountId,
    aggregateTokenMap,
  }: {
    networkId: string;
    accountId: string;
    aggregateTokenMap: Record<string, Record<string, ITokenFiat>>;
  }) {
    return this.backgroundApi.simpleDb.aggregateToken.updateAggregateTokenMap({
      networkId,
      accountId,
      aggregateTokenMap,
    });
  }

  @backgroundMethod()
  public async getLocalAggregateTokenMap({
    networkId,
    accountId,
  }: {
    networkId: string;
    accountId: string;
  }) {
    return this.backgroundApi.simpleDb.aggregateToken.getAggregateTokenMap({
      networkId,
      accountId,
    });
  }

  @backgroundMethod()
  public async getLocalAggregateTokenListMap({
    networkId,
    accountId,
  }: {
    networkId: string;
    accountId: string;
  }) {
    return this.backgroundApi.simpleDb.aggregateToken.getAggregateTokenListMap({
      networkId,
      accountId,
    });
  }

  @backgroundMethod()
  public async updateLocalAggregateTokenListMap({
    accountId,
    networkId,
    aggregateTokenListMap,
  }: {
    accountId: string;
    networkId: string;
    aggregateTokenListMap: Record<
      string,
      {
        tokens: IAccountToken[];
      }
    >;
  }) {
    return this.backgroundApi.simpleDb.aggregateToken.updateAggregateTokenListMap(
      {
        accountId,
        networkId,
        aggregateTokenListMap,
      },
    );
  }

  @backgroundMethod()
  public async getAllAggregateTokenInfo() {
    const rawData =
      await this.backgroundApi.simpleDb.aggregateToken.getRawData();
    return {
      allAggregateTokenMap: rawData?.allAggregateTokenMap ?? {},
      allAggregateTokens: rawData?.allAggregateTokens ?? [],
    };
  }

  @backgroundMethod()
  public async updateLastActiveTabNameInTokenDetails({
    accountId,
    aggregateTokenId,
    lastActiveTabName,
  }: {
    accountId: string;
    aggregateTokenId: string;
    lastActiveTabName: string;
  }) {
    return this.backgroundApi.simpleDb.aggregateToken.updateLastActiveTabNameInTokenDetails(
      {
        accountId,
        aggregateTokenId,
        lastActiveTabName,
      },
    );
  }

  @backgroundMethod()
  public async getLastActiveTabNameInTokenDetails({
    accountId,
    aggregateTokenId,
  }: {
    accountId: string;
    aggregateTokenId: string;
  }) {
    return this.backgroundApi.simpleDb.aggregateToken.getLastActiveTabNameInTokenDetails(
      {
        accountId,
        aggregateTokenId,
      },
    );
  }

  @backgroundMethod()
  public async clearLastActiveTabNameData() {
    return this.backgroundApi.simpleDb.aggregateToken.clearLastActiveTabNameData();
  }

  // ---- Binance Connect ----

  @backgroundMethod()
  public async getBinanceSupportedAssets(): Promise<IBinanceSupportedAssets> {
    return this._getBinanceSupportedAssetsMemo();
  }

  _getBinanceSupportedAssetsMemo = memoizee(
    async (): Promise<IBinanceSupportedAssets> => {
      const client = await this.getClient(EServiceEndpointEnum.Wallet);
      const resp = await client.get<{ data: IBinanceSupportedAssets }>(
        '/wallet/v1/exchange/binance/supported-assets',
      );
      return resp.data.data;
    },
    {
      promise: true,
      maxAge: timerUtils.getTimeDurationMs({ minute: 10 }),
    },
  );

  @backgroundMethod()
  public async createBinancePreOrder(
    params: IBinancePreOrderParams,
  ): Promise<IBinancePreOrderResponse> {
    const client = await this.getClient(EServiceEndpointEnum.Wallet);
    const resp = await client.post<{ data: IBinancePreOrderResponse }>(
      '/wallet/v1/exchange/binance/pre-order',
      params,
    );
    return resp.data.data;
  }
}

export default ServiceToken;
