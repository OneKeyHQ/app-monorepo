/* cspell:ignore Fundings */

import BigNumber from 'bignumber.js';
import { ethers } from 'ethersV6';
import { isEqual, isNil, omit } from 'lodash';
import pTimeout from 'p-timeout';

import type { ICoreHyperLiquidAgentCredential } from '@onekeyhq/core/src/types';
import {
  backgroundClass,
  backgroundMethod,
  toastIfError,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import {
  EHyperLiquidAgentName,
  FALLBACK_BUILDER_ADDRESS,
  FALLBACK_MAX_BUILDER_FEE,
  HYPERLIQUID_AGENT_TTL_DEFAULT,
  HYPERLIQUID_REFERRAL_CODE,
  HYPER_LIQUID_CUSTOM_LOCAL_STORAGE_V2_PRESET,
  PERPS_FILTERED_LEDGER_TYPES,
  PERPS_NETWORK_ID,
} from '@onekeyhq/shared/src/consts/perp';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import cacheUtils from '@onekeyhq/shared/src/utils/cacheUtils';
import perfUtils from '@onekeyhq/shared/src/utils/debug/perfUtils';
import { hyperLiquidErrorResolver } from '@onekeyhq/shared/src/utils/hyperLiquidErrorResolver';
import perpsUtils, {
  parseDexCoin,
} from '@onekeyhq/shared/src/utils/perpsUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IApiClientResponse } from '@onekeyhq/shared/types/endpoint';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import { EHyperLiquidAbstractionMode } from '@onekeyhq/shared/types/hyperliquid';
import {
  CACHE_TIME_QUANTIZE_MS,
  SPOT_ASSET_ID_OFFSET,
  XYZ_ASSET_ID_OFFSET,
  XYZ_DEX_PREFIX,
} from '@onekeyhq/shared/types/hyperliquid/perp.constants';
import type {
  IApiRequestError,
  IApiRequestResult,
  IFill,
  IFundingHistoryRecord,
  IHex,
  IMarginTable,
  IMarginTableMap,
  IPerpAnnotation,
  IPerpContractInfo,
  IPerpMarketOverview,
  IPerpPredictedFundingVenue,
  IPerpsActiveAssetData,
  IPerpsActiveAssetDataRaw,
  IPerpsUniverse,
  IRecentTrade,
  ISpotUniverse,
  IUserFillsByTimeParameters,
  IUserFillsParameters,
  IUserNonFundingLedgerUpdate,
  IWsActiveAssetCtx,
  IWsActiveSpotAssetCtx,
  IWsAllDexsClearinghouseState,
  IWsSpotAssetCtxs,
  IWsSpotState,
  IWsWebData2,
} from '@onekeyhq/shared/types/hyperliquid/sdk';
import type { IHyperLiquidSignatureRSV } from '@onekeyhq/shared/types/hyperliquid/webview';

import localDb from '../../dbs/local/localDb';
import {
  perpTokenSelectorTabsAtom,
  perpsAbstractionModeAtom,
  perpsAccountLoadingInfoAtom,
  perpsActiveAccountAtom,
  perpsActiveAccountStatusAtom,
  perpsActiveAccountStatusInfoAtom,
  perpsActiveAccountSummaryAtom,
  perpsActiveAssetAtom,
  perpsActiveAssetCtxAtom,
  perpsActiveAssetDataAtom,
  perpsCommonConfigPersistAtom,
  perpsCustomSettingsAtom,
  perpsDepositNetworksAtom,
  perpsDepositTokensAtom,
  perpsLastUsedLeverageAtom,
  perpsSpotBalancesAtom,
  perpsTradesHistoryDataAtom,
  spotActiveAssetAtom,
  spotActiveAssetCtxAtom,
  spotAssetCtxsMapAtom,
  spotBalancesAtom,
  spotExternalMarketCapsAtom,
  spotPairDisplayMapAtom,
} from '../../states/jotai/atoms';
import ServiceBase from '../ServiceBase';

import { hyperLiquidApiClients } from './hyperLiquidApiClients';
import hyperLiquidCache from './hyperLiquidCache';

import type ServiceHyperliquidExchange from './ServiceHyperliquidExchange';
import type ServiceHyperliquidWallet from './ServiceHyperliquidWallet';
import type { ISimpleDbPerpData } from '../../dbs/simple/entity/SimpleDbEntityPerp';
import type {
  IPerpsAccountLoadingInfo,
  IPerpsActiveAccountAtom,
  IPerpsActiveAccountStatusDetails,
  IPerpsActiveAccountStatusInfoAtom,
  IPerpsActiveAssetCtxAtom,
  IPerpsCommonConfigPersistAtom,
  IPerpsCustomSettings,
  IPerpsDepositNetworksAtom,
  IPerpsDepositToken,
  IPerpsDepositTokensAtom,
} from '../../states/jotai/atoms';
import type {
  ISpotActiveAssetCtxAtom,
  ISpotAssetCtxEntry,
} from '../../states/jotai/atoms/spot';
import type { IAccountDeriveTypes } from '../../vaults/types';
import type { IHyperliquidMaxBuilderFee } from '../ServiceWebviewPerp';
import type {
  IPerpServerConfigResponse,
  IPerpServerDepositConfig,
} from '../ServiceWebviewPerp/ServiceWebviewPerp';

type ILoadTradesHistoryOptions = {
  force?: boolean;
};

function filterSupportedTradeHistoryFills(fills: IFill[]): IFill[] {
  return fills.filter(
    (fill) => !perpsUtils.isPredictionMarketInstrument(fill.coin),
  );
}

@backgroundClass()
export default class ServiceHyperliquid extends ServiceBase {
  public builderAddress: IHex = FALLBACK_BUILDER_ADDRESS;

  public maxBuilderFee: number = FALLBACK_MAX_BUILDER_FEE;

  private activeAssetChangeRequestId = 0;

  @backgroundMethod()
  async cancelPendingActiveAssetChange(): Promise<void> {
    this.activeAssetChangeRequestId += 1;
  }

  // Avoids async atom reads in the hot path — written to atom on a throttled schedule
  private _spotPriceCache: Record<string, ISpotAssetCtxEntry> = {};

  private _spotPriceDirty = false;

  private _spotPriceFlushTimer: ReturnType<typeof setTimeout> | null = null;

  private _fetchSpotExternalMarketCaps = cacheUtils.memoizee(
    async (): Promise<Record<string, string>> => {
      const idToSymbol =
        perpsUtils.SPOT_EXTERNAL_MARKET_CAP_COINGECKO_ID_SYMBOL_MAP;
      const tokens = await this.backgroundApi.serviceMarket.fetchCategory(
        'all',
        Object.keys(idToSymbol),
        false,
      );
      const marketCaps: Record<string, string> = {};
      for (const token of tokens) {
        const symbol = idToSymbol[token.coingeckoId];
        const marketCap = new BigNumber(token.marketCap ?? 0);
        if (symbol && marketCap.isFinite() && marketCap.gt(0)) {
          marketCaps[symbol] = marketCap.toFixed();
        }
      }
      return marketCaps;
    },
    {
      promise: true,
      maxAge: timerUtils.getTimeDurationMs({ hour: 1 }),
    },
  );

  private _flushSpotPrices(map: Record<string, ISpotAssetCtxEntry>) {
    // allMids only sets markPx, spotAssetCtxs sets full entry — merge so neither overwrites the other
    for (const [key, entry] of Object.entries(map)) {
      const existing = this._spotPriceCache[key];
      if (existing) {
        this._spotPriceCache[key] = { ...existing, ...entry };
      } else {
        this._spotPriceCache[key] = entry;
      }
    }
    this._spotPriceDirty = true;

    if (!this._spotPriceFlushTimer) {
      void spotAssetCtxsMapAtom.set({ ...this._spotPriceCache });
      this._spotPriceDirty = false;
      this._spotPriceFlushTimer = setTimeout(() => {
        this._spotPriceFlushTimer = null;
        if (this._spotPriceDirty) {
          void spotAssetCtxsMapAtom.set({ ...this._spotPriceCache });
          this._spotPriceDirty = false;
        }
      }, 1000);
    }
  }

  // Cached in-memory so WS handlers don't need async SimpleDb reads on the hot path
  private _spotMappings: {
    pairToBaseName: Record<string, string>;
    baseNameToAssetId: Record<string, number>;
    baseNameToSzDecimals: Record<string, number>;
    baseNameToPairName: Record<string, string>;
  } = {
    pairToBaseName: {},
    baseNameToAssetId: {},
    baseNameToSzDecimals: {},
    baseNameToPairName: {},
  };

  // OK-53208: survives Perp tab detach/remount; component refs reset on
  // unmount and would otherwise repeat refreshTradingMeta + changeActiveAsset
  // on every modal push.
  private _initialSymbolSelectClaimed = false;

  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
    void this.init();
  }

  @backgroundMethod()
  async tryClaimInitialSymbolSelect(): Promise<boolean> {
    if (this._initialSymbolSelectClaimed) {
      return false;
    }
    this._initialSymbolSelectClaimed = true;
    return true;
  }

  private get exchangeService(): ServiceHyperliquidExchange {
    return this.backgroundApi.serviceHyperliquidExchange;
  }

  private get walletService(): ServiceHyperliquidWallet {
    return this.backgroundApi.serviceHyperliquidWallet;
  }

  private detectDexIndexByCoin(coin: string): number {
    return coin.startsWith(XYZ_DEX_PREFIX) ? 1 : 0;
  }

  private resolveInfoRequestCoin(coin: string) {
    const { dexLabel } = parseDexCoin(coin);
    return {
      apiCoin: coin,
      dex: dexLabel,
    };
  }

  private async getAssetCtxByCoin(coin: string) {
    const { infoClient } = hyperLiquidApiClients;
    const { apiCoin, dex } = this.resolveInfoRequestCoin(coin);
    const [meta, assetCtxs] = dex
      ? await infoClient.metaAndAssetCtxs({ dex })
      : await infoClient.metaAndAssetCtxs();
    const ctxIndex = meta.universe.findIndex((item) => item.name === apiCoin);
    if (ctxIndex < 0) {
      return undefined;
    }
    return assetCtxs[ctxIndex];
  }

  private getAssetIdWithDexPrefix({
    dexIndex,
    index,
  }: {
    dexIndex: number;
    index: number;
  }) {
    if (dexIndex === 1) {
      return XYZ_ASSET_ID_OFFSET + index;
    }
    return index;
  }

  private async init() {
    // Register the locale provider so we can fall back when needed.
    hyperLiquidErrorResolver.setLocaleProvider(async () => {
      const config = await this.backgroundApi.simpleDb.perp.getPerpData();
      return config.hyperliquidErrorLocales;
    });

    void this.backgroundApi.simpleDb.perp
      .getPerpData()
      .then((config) => {
        this.builderAddress = (config.hyperliquidBuilderAddress ||
          FALLBACK_BUILDER_ADDRESS) as IHex;
        this.maxBuilderFee =
          config.hyperliquidMaxBuilderFee || FALLBACK_MAX_BUILDER_FEE;

        // Initialize the error resolver with locale data.
        hyperLiquidErrorResolver.updateLocales(config.hyperliquidErrorLocales);
      })
      .catch((error) => {
        console.error('Failed to load perp config:', error);
      });
  }

  async parseDepositConfig(depositConfig?: IPerpServerDepositConfig[]) {
    if (isNil(depositConfig)) {
      return;
    }
    const networks = depositConfig.map((item) => item.network);
    const tokens = depositConfig.flatMap((item) => item.tokens);
    await perpsDepositNetworksAtom.set((prev): IPerpsDepositNetworksAtom => {
      return {
        ...prev,
        networks,
      };
    });
    const tokensMap: Record<string, IPerpsDepositToken[]> = {};
    networks.forEach((network) => {
      const networkTokens = tokens.filter(
        (token) => token.networkId === network.networkId,
      );
      tokensMap[network.networkId] = networkTokens;
    });
    await perpsDepositTokensAtom.set((prev): IPerpsDepositTokensAtom => {
      return {
        ...prev,
        tokens: tokensMap,
      };
    });
  }

  @backgroundMethod()
  async updatePerpConfig(
    {
      referrerConfig,
      customSettings,
      customLocalStorage,
      customLocalStorageV2,
      commonConfig,
      bannerConfig,
      depositTokenConfig,
      hyperLiquidErrorLocales,
      tokenSearchAliases,
      tokenSelectorTabs,
      perpsAssetMetaMap,
      activityCards,
    }: IPerpServerConfigResponse,
    options?: { fromServerConfig?: boolean },
  ) {
    let shouldNotifyToDapp = false;

    // Check configVersion change before updating
    const prevConfig = await this.backgroundApi.simpleDb.perp.getPerpData();
    const prevConfigVersion = prevConfig.configVersion;
    const newConfigVersion = referrerConfig?.configVersion;
    const isConfigVersionChanged =
      !isNil(newConfigVersion) && prevConfigVersion !== newConfigVersion;

    // If configVersion changed, remove all agent credentials
    if (isConfigVersionChanged) {
      defaultLogger.perp.agentLifeCycle.trackReason({
        reason: 'config_version_changed_reset',
        statusDetails: {
          configVersionOld: prevConfigVersion,
          configVersionNew: newConfigVersion,
        },
      });
      try {
        await this.removeAllAgentCredentialsAndResetStatus();
      } catch (error) {
        // Do not block trading if cleanup fails
        console.error(
          '[ServiceHyperliquid] Failed to remove agent credentials:',
          error,
        );
      }
    }

    await perpsCommonConfigPersistAtom.set(
      (prev): IPerpsCommonConfigPersistAtom => {
        const newVal = perfUtils.buildNewValueIfChanged(prev, {
          ...prev,
          ...(options?.fromServerConfig && { perpConfigLoaded: true }),
          perpConfigCommon: {
            ...prev.perpConfigCommon,
            ...(commonConfig && {
              usePerpWeb: commonConfig.usePerpWeb === true,
              disablePerp: commonConfig.disablePerp === true,
              disablePerpActionPerp:
                commonConfig.disablePerpActionPerp === true,
              ipDisablePerp: commonConfig.ipDisablePerp === true,
            }),
            perpBannerConfig: options?.fromServerConfig
              ? bannerConfig
              : (bannerConfig ?? prev.perpConfigCommon.perpBannerConfig),
            activityCards: options?.fromServerConfig
              ? (activityCards ?? [])
              : (activityCards ?? prev.perpConfigCommon.activityCards),
          },
        });
        return newVal;
      },
    );
    await this.parseDepositConfig(depositTokenConfig);
    await this.backgroundApi.simpleDb.perp.setPerpData(
      (prev): ISimpleDbPerpData => {
        const newConfig: ISimpleDbPerpData = {
          tradingUniverse: prev?.tradingUniverse,
          marginTablesMap: prev?.marginTablesMap,
          ...prev,
          hyperliquidBuilderAddress:
            referrerConfig?.referrerAddress || prev?.hyperliquidBuilderAddress,
          hyperliquidMaxBuilderFee: isNil(referrerConfig?.referrerRate)
            ? prev?.hyperliquidMaxBuilderFee
            : referrerConfig?.referrerRate,
          agentTTL: referrerConfig.agentTTL ?? prev?.agentTTL,
          referralCode: referrerConfig.referralCode || prev?.referralCode,
          configVersion: referrerConfig.configVersion ?? prev?.configVersion,
          hyperliquidCustomSettings:
            customSettings || prev?.hyperliquidCustomSettings,
          hyperliquidCustomLocalStorage:
            customLocalStorage || prev?.hyperliquidCustomLocalStorage,
          hyperliquidCustomLocalStorageV2:
            customLocalStorageV2 || prev?.hyperliquidCustomLocalStorageV2,
          hyperliquidErrorLocales:
            hyperLiquidErrorLocales || prev?.hyperliquidErrorLocales,
          tokenSearchAliases: tokenSearchAliases || prev?.tokenSearchAliases,
          tokenSelectorTabs: tokenSelectorTabs ?? prev?.tokenSelectorTabs,
          perpsAssetMetaMap: perpsAssetMetaMap || prev?.perpsAssetMetaMap,
        };
        if (isEqual(newConfig, prev)) {
          return (
            prev || { tradingUniverse: undefined, marginTablesMap: undefined }
          );
        }
        shouldNotifyToDapp = true;
        return newConfig;
      },
    );

    // Update the error resolver locale data.
    hyperLiquidErrorResolver.updateLocales(hyperLiquidErrorLocales);

    // Update token selector tabs atom
    // Always set to transition from null (not loaded) to a valid state,
    // even when server doesn't return tokenSelectorTabs (undefined → [])
    await perpTokenSelectorTabsAtom.set(tokenSelectorTabs ?? []);

    if (shouldNotifyToDapp) {
      const config = await this.backgroundApi.simpleDb.perp.getPerpData();
      await this.backgroundApi.serviceDApp.notifyHyperliquidPerpConfigChanged({
        hyperliquidBuilderAddress: config.hyperliquidBuilderAddress,
        hyperliquidMaxBuilderFee: config.hyperliquidMaxBuilderFee,
      });
    }
  }

  async removeAllAgentCredentialsAndResetStatus() {
    // Remove all agent credentials from local db
    await localDb.removeAllHyperLiquidAgentCredentials();

    // Clear related caches
    this.fetchExtraAgentsWithCache.clear();
    this.getUserApprovedMaxBuilderFeeWithCache.clear();
    hyperLiquidCache.activatedUser = {};
    hyperLiquidCache.referrerCodeSetDone = {};

    // Dispose exchange client and reset account status
    await this.disposeExchangeClients();
  }

  @backgroundMethod()
  async updatePerpsConfigByServer() {
    const client = await this.getClient(EServiceEndpointEnum.Utility);
    const resp = await client.get<
      IApiClientResponse<IPerpServerConfigResponse>
    >('/utility/v1/perp-config');
    const resData = resp.data;

    if (process.env.NODE_ENV !== 'production') {
      // TODO devSettings ignore server config 11
      // TODO remove
      // resData.data.referrerRate = 65;
    }
    await this.updatePerpConfig(
      {
        referrerConfig: resData?.data?.referrerConfig,
        customSettings: resData?.data?.customSettings,
        customLocalStorage: resData?.data?.customLocalStorage,
        customLocalStorageV2: {
          ...HYPER_LIQUID_CUSTOM_LOCAL_STORAGE_V2_PRESET,
          ...resData?.data?.customLocalStorageV2,
        },
        commonConfig: resData?.data?.commonConfig ?? {},
        bannerConfig: resData?.data?.bannerConfig,
        depositTokenConfig: resData?.data?.depositTokenConfig,
        hyperLiquidErrorLocales: resData?.data?.hyperLiquidErrorLocales,
        tokenSearchAliases: resData?.data?.tokenSearchAliases,
        tokenSelectorTabs: resData?.data?.tokenSelectorTabs,
        perpsAssetMetaMap: resData?.data?.perpsAssetMetaMap,
        activityCards: resData?.data?.activityCards,
      },
      { fromServerConfig: true },
    );
    return resData;
  }

  @backgroundMethod()
  async updatePerpsConfigByServerWithCache() {
    return this._updatePerpsConfigByServerWithCache();
  }

  @backgroundMethod()
  async updatePerpsConfigByServerSilently({
    ignoreCache = false,
  }: { ignoreCache?: boolean } = {}) {
    try {
      return ignoreCache
        ? await this.updatePerpsConfigByServer()
        : await this.updatePerpsConfigByServerWithCache();
    } catch (error) {
      errorToastUtils.toastIfErrorDisable(error);
      console.warn('[ServiceHyperliquid] Failed to update perp config', error);
      return undefined;
    }
  }

  _updatePerpsConfigByServerWithCache = cacheUtils.memoizee(
    async () => {
      return this.updatePerpsConfigByServer();
    },
    {
      max: 20,
      // 10 min: fast enough to propagate server-side perp disable / builder
      // config changes, while still deduping redundant focus-driven fetches.
      maxAge: timerUtils.getTimeDurationMs({ minute: 10 }),
      promise: true,
    },
  );

  @backgroundMethod()
  async getTokenSearchAliases() {
    // Ensure config is loaded (uses memoizee cache)
    void this.updatePerpsConfigByServerSilently();
    const config = await this.backgroundApi.simpleDb.perp.getPerpData();
    return config.tokenSearchAliases;
  }

  @backgroundMethod()
  async getPerpsAssetMetaMap() {
    try {
      await this.updatePerpsConfigByServerWithCache();
    } catch {
      // Use the persisted config if the refresh fails.
    }
    const config = await this.backgroundApi.simpleDb.perp.getPerpData();
    return config.perpsAssetMetaMap;
  }

  private _getFillKey(fill: IFill): string {
    if (typeof fill.tid === 'number') {
      return `tid:${fill.tid}`;
    }
    return `${fill.hash}-${fill.oid}-${fill.time}-${fill.coin}-${fill.side}-${fill.px}-${fill.sz}`;
  }

  private _sortAndDedupeFills(fills: IFill[]): IFill[] {
    const fillMap = new Map<string, IFill>();
    for (const fill of fills) {
      const key = this._getFillKey(fill);
      const existing = fillMap.get(key);
      if (!existing || fill.time >= existing.time) {
        fillMap.set(key, fill);
      }
    }
    return Array.from(fillMap.values()).toSorted(
      (a, b) => b.time - a.time || (b.tid ?? 0) - (a.tid ?? 0),
    );
  }

  _getUserFillsByTimeMemo = cacheUtils.memoizee(
    async (params: IUserFillsByTimeParameters) => {
      const { infoClient } = hyperLiquidApiClients;
      const fills = await infoClient.userFillsByTime({
        ...params,
        aggregateByTime: true,
      });
      return fills;
    },
    {
      max: 1,
      maxAge: timerUtils.getTimeDurationMs({ minute: 1 }),
      promise: true,
    },
  );

  @backgroundMethod()
  async getUserFillsByTime(
    params: IUserFillsByTimeParameters,
  ): Promise<IFill[]> {
    const { infoClient } = hyperLiquidApiClients;
    const fills = await infoClient.userFillsByTime({
      ...params,
      aggregateByTime: true,
    });
    return fills;
  }

  @backgroundMethod()
  async getUserFillsByTimeWithCache(
    params: IUserFillsByTimeParameters,
  ): Promise<IFill[]> {
    return this._getUserFillsByTimeMemo(params);
  }

  @backgroundMethod()
  async loadTradesHistory(
    accountAddress: IHex,
    options: ILoadTradesHistoryOptions = {},
  ): Promise<IFill[]> {
    const normalizedAccountAddress = accountAddress.toLowerCase();
    const current = await perpsTradesHistoryDataAtom.get();
    const isSameAccount =
      current.accountAddress?.toLowerCase() === normalizedAccountAddress;

    if (!options.force && current.isLoaded && isSameAccount) {
      return current.fills;
    }

    if (options.force) {
      this._getUserFillsByTimeMemo.clear();
    }

    // Quantize to 10-second boundary so near-simultaneous callers
    // produce identical memoizee keys and share a single request.
    const now =
      Math.floor(Date.now() / CACHE_TIME_QUANTIZE_MS) * CACHE_TIME_QUANTIZE_MS;
    const historyDuration = timerUtils.getTimeDurationMs({ year: 2 });
    const twoYearsAgo = now - historyDuration;

    const params = {
      user: accountAddress,
      startTime: twoYearsAgo,
      endTime: now,
      aggregateByTime: true,
      // HL caps userFillsByTime at 2000 rows; reverse to keep the latest fills.
      reversed: true,
    };

    const fillsRaw = options.force
      ? await this.getUserFillsByTime(params)
      : await this._getUserFillsByTimeMemo(params);
    const fills = filterSupportedTradeHistoryFills(fillsRaw);

    const activeAccount = await perpsActiveAccountAtom.get();
    if (
      activeAccount?.accountAddress?.toLowerCase() !== normalizedAccountAddress
    ) {
      return this._sortAndDedupeFills(fills);
    }

    // Merge with the latest atom after the request returns so WS appends or
    // concurrent refreshes that landed during the REST call are preserved.
    const latestCurrent = await perpsTradesHistoryDataAtom.get();
    const shouldMergeLatest =
      latestCurrent.accountAddress?.toLowerCase() === normalizedAccountAddress;
    const sorted = this._sortAndDedupeFills(
      shouldMergeLatest ? [...latestCurrent.fills, ...fills] : fills,
    );

    const latestActiveAccount = await perpsActiveAccountAtom.get();
    if (
      latestActiveAccount?.accountAddress?.toLowerCase() !==
      normalizedAccountAddress
    ) {
      return sorted;
    }

    await perpsTradesHistoryDataAtom.set({
      fills: sorted,
      isLoaded: true,
      latestTime: sorted[0]?.time ?? 0,
      accountAddress: normalizedAccountAddress,
    });

    return sorted;
  }

  @backgroundMethod()
  async appendTradesHistory(
    newFills: IFill[],
    userAddress?: string,
  ): Promise<void> {
    const current = await perpsTradesHistoryDataAtom.get();
    if (!current.isLoaded || newFills.length === 0) {
      return;
    }

    if (
      userAddress &&
      current.accountAddress &&
      userAddress.toLowerCase() !== current.accountAddress.toLowerCase()
    ) {
      return;
    }

    const currentFillKeys = new Set(
      current.fills.map((fill) => this._getFillKey(fill)),
    );
    const hasNewFill = newFills.some(
      (fill) => !currentFillKeys.has(this._getFillKey(fill)),
    );
    if (!hasNewFill) {
      return;
    }

    const fills = this._sortAndDedupeFills([
      ...filterSupportedTradeHistoryFills(newFills),
      ...current.fills,
    ]);

    await perpsTradesHistoryDataAtom.set({
      ...current,
      fills,
      latestTime: fills[0]?.time ?? current.latestTime,
    });
  }

  @backgroundMethod()
  async resetTradesHistory(): Promise<void> {
    await perpsTradesHistoryDataAtom.set({
      fills: [],
      isLoaded: false,
      latestTime: 0,
      accountAddress: undefined,
    });
  }

  @backgroundMethod()
  async getUserFills(params: IUserFillsParameters): Promise<IFill[]> {
    const { infoClient } = hyperLiquidApiClients;

    return infoClient.userFills(params);
  }

  @backgroundMethod()
  async getUserNonFundingLedgerUpdates(
    accountAddress: IHex,
  ): Promise<IUserNonFundingLedgerUpdate[]> {
    const { infoClient } = hyperLiquidApiClients;
    const now =
      Math.floor(Date.now() / CACHE_TIME_QUANTIZE_MS) * CACHE_TIME_QUANTIZE_MS;
    const twoYearsAgo = now - timerUtils.getTimeDurationMs({ year: 2 });
    const updates = await infoClient.userNonFundingLedgerUpdates({
      user: accountAddress,
      startTime: twoYearsAgo,
      endTime: now,
    });
    return updates
      .filter((update) => !PERPS_FILTERED_LEDGER_TYPES.has(update.delta.type))
      .toSorted((a, b) => b.time - a.time)
      .slice(0, 200);
  }

  @backgroundMethod()
  async refreshTradingMeta() {
    const { infoClient } = hyperLiquidApiClients;

    // oxlint-disable-next-line @cspell/spellchecker
    let perpMetaMultiDexList = await infoClient.allPerpMetas();
    if (perpMetaMultiDexList?.length) {
      if (perpMetaMultiDexList.length >= 2) {
        perpMetaMultiDexList = perpMetaMultiDexList.slice(0, 2);
      }
      const universes = perpMetaMultiDexList.map((meta, dexIndex) =>
        (meta?.universe || []).map((item, index) => ({
          ...item,
          assetId: this.getAssetIdWithDexPrefix({ dexIndex, index }),
        })),
      );
      const marginTablesMapList = perpMetaMultiDexList.map((meta) =>
        meta?.marginTables?.reduce((acc, item) => {
          acc[item[0]] = item[1];
          return acc;
        }, {} as IMarginTableMap),
      );
      await this.backgroundApi.simpleDb.perp.setTradingUniverse({
        universes,
        marginTablesMapList,
      });
    }
  }

  @backgroundMethod()
  async getTradingUniverse() {
    return this.backgroundApi.simpleDb.perp.getTradingUniverse();
  }

  @backgroundMethod()
  async getSymbolsMetaMap({ coins }: { coins: string[] }) {
    const { universesByDex, marginTablesMapByDex } =
      await this.getTradingUniverse();
    const { universes: spotUniverses } =
      await this.backgroundApi.simpleDb.perp.getSpotMeta();
    const map: Partial<{
      [coin: string]: {
        coin: string;
        assetId: number;
        universe: IPerpsUniverse | undefined;
        marginTable: IMarginTable | undefined;
        isSpot?: boolean;
        spotUniverse?: ISpotUniverse;
      };
    }> = {};
    coins.forEach((coin) => {
      if (perpsUtils.isSpotInstrument(coin)) {
        const spotUni = spotUniverses.find(
          (item: ISpotUniverse) => item.name === coin,
        );
        if (isNil(spotUni?.assetId)) {
          throw new OneKeyLocalError(`Asset id not found for coin: ${coin}`);
        }
        map[coin] = {
          assetId: spotUni.assetId,
          coin,
          universe: undefined,
          marginTable: undefined,
          isSpot: true,
          spotUniverse: spotUni,
        };
        return;
      }
      const dexIndex = this.detectDexIndexByCoin(coin);
      const universes = universesByDex?.[dexIndex];
      const marginTables = marginTablesMapByDex?.[dexIndex];
      const universe = universes?.find((item) => item.name === coin);
      if (isNil(universe?.assetId)) {
        throw new OneKeyLocalError(`Asset id not found for coin: ${coin}`);
      }
      map[coin] = {
        assetId: universe.assetId,
        coin,
        universe,
        marginTable: isNil(universe.marginTableId)
          ? undefined
          : marginTables?.[universe.marginTableId],
      };
    });
    return map;
  }

  @backgroundMethod()
  async getSymbolMeta({ coin }: { coin: string }) {
    const map = await this.getSymbolsMetaMap({ coins: [coin] });
    const meta = map[coin];
    return meta;
  }

  @backgroundMethod()
  async getPerpMarketOverview({
    coin,
  }: {
    coin: string;
  }): Promise<IPerpMarketOverview | undefined> {
    const [symbolMeta, assetCtx] = await Promise.all([
      this.getSymbolMeta({ coin }),
      this.getAssetCtxByCoin(coin),
    ]);

    if (!assetCtx) {
      return undefined;
    }

    const ctx = perpsUtils.formatAssetCtx(assetCtx);
    const openInterestNotionalBN = new BigNumber(
      assetCtx.openInterest || 0,
    ).multipliedBy(assetCtx.markPx || 0);

    return {
      coin,
      assetId: symbolMeta?.assetId,
      ctx,
      premium: assetCtx.premium ?? null,
      dayBaseVolume: assetCtx.dayBaseVlm || '0',
      openInterestNotional: openInterestNotionalBN.isFinite()
        ? openInterestNotionalBN.toFixed()
        : null,
    };
  }

  @backgroundMethod()
  async getPerpContractInfo({
    coin,
  }: {
    coin: string;
  }): Promise<IPerpContractInfo | undefined> {
    const { infoClient } = hyperLiquidApiClients;
    const { apiCoin, dex } = this.resolveInfoRequestCoin(coin);
    const [symbolMeta, perpsAtCap] = await Promise.all([
      this.getSymbolMeta({ coin }),
      (dex
        ? infoClient.perpsAtOpenInterestCap({ dex })
        : infoClient.perpsAtOpenInterestCap()
      ).catch((): string[] => []),
    ]);

    if (!symbolMeta) {
      return undefined;
    }

    return {
      coin,
      assetId: symbolMeta.assetId,
      szDecimals: symbolMeta.universe?.szDecimals,
      maxLeverage: symbolMeta.universe?.maxLeverage,
      marginMode: symbolMeta.universe?.marginMode,
      onlyIsolated: symbolMeta.universe?.onlyIsolated === true,
      marginTable: symbolMeta.marginTable,
      isAtOpenInterestCap:
        perpsAtCap.includes(apiCoin) || perpsAtCap.includes(coin),
    };
  }

  @backgroundMethod()
  async getPerpFundingHistory({
    coin,
    startTime,
    endTime,
  }: {
    coin: string;
    startTime: number;
    endTime?: number;
  }): Promise<IFundingHistoryRecord[]> {
    const { infoClient } = hyperLiquidApiClients;
    const { apiCoin } = this.resolveInfoRequestCoin(coin);
    return infoClient.fundingHistory({
      coin: apiCoin,
      startTime,
      endTime,
    });
  }

  @backgroundMethod()
  async getPerpRecentTrades({
    coin,
  }: {
    coin: string;
  }): Promise<IRecentTrade[]> {
    const { infoClient } = hyperLiquidApiClients;
    const { apiCoin } = this.resolveInfoRequestCoin(coin);
    return infoClient.recentTrades({
      coin: apiCoin,
    });
  }

  @backgroundMethod()
  async getPerpPredictedFundings({
    coin,
  }: {
    coin: string;
  }): Promise<IPerpPredictedFundingVenue[]> {
    const { infoClient } = hyperLiquidApiClients;
    const { apiCoin } = this.resolveInfoRequestCoin(coin);
    const items = await infoClient.predictedFundings();
    const matched = items.find(([asset]) => asset === apiCoin);
    if (!matched) {
      return [];
    }
    return matched[1].map(([exchange, data]) => ({
      exchange,
      fundingRate: data?.fundingRate ?? null,
      nextFundingTime: data?.nextFundingTime ?? null,
      fundingIntervalHours: data?.fundingIntervalHours,
    }));
  }

  @backgroundMethod()
  async getPerpAnnotation({
    coin,
  }: {
    coin: string;
  }): Promise<IPerpAnnotation> {
    const { infoClient } = hyperLiquidApiClients;
    const { apiCoin } = this.resolveInfoRequestCoin(coin);
    return infoClient.perpAnnotation({
      coin: apiCoin,
    });
  }

  async updateActiveAssetCtx(data: IWsActiveAssetCtx | undefined) {
    const activeAsset = await perpsActiveAssetAtom.get();
    if (activeAsset?.coin === data?.coin && data?.coin) {
      await perpsActiveAssetCtxAtom.set(
        (_prev): IPerpsActiveAssetCtxAtom => ({
          coin: data?.coin,
          assetId: activeAsset?.assetId,
          ctx: perpsUtils.formatAssetCtx(data?.ctx),
        }),
      );
    } else {
      const activeAssetCtx = await perpsActiveAssetCtxAtom.get();
      if (activeAssetCtx?.coin !== activeAsset?.coin) {
        await perpsActiveAssetCtxAtom.set(undefined);
      }
    }
  }

  async updateActiveSpotAssetCtx(data: IWsActiveSpotAssetCtx | undefined) {
    const activeSpotAsset = await spotActiveAssetAtom.get();
    if (activeSpotAsset?.coin === data?.coin && data?.coin && data?.ctx) {
      await spotActiveAssetCtxAtom.set(
        (_prev): ISpotActiveAssetCtxAtom => ({
          coin: data.coin,
          assetId: activeSpotAsset?.assetId,
          baseName: activeSpotAsset?.universe?.baseName,
          ctx: perpsUtils.formatSpotAssetCtx(data.ctx),
        }),
      );
    } else {
      const activeSpotAssetCtx = await spotActiveAssetCtxAtom.get();
      if (activeSpotAssetCtx?.coin !== activeSpotAsset?.coin) {
        await spotActiveAssetCtxAtom.set(undefined);
      }
    }
  }

  async updateSpotAssetCtxsMap(data: IWsSpotAssetCtxs) {
    if (!Array.isArray(data) || data.length === 0) return;

    const map: Record<string, ISpotAssetCtxEntry> = {};
    data.forEach((ctx) => {
      if (ctx?.coin && ctx?.markPx) {
        map[ctx.coin] = {
          markPx: ctx.markPx,
          prevDayPx: ctx.prevDayPx,
          dayNtlVlm: ctx.dayNtlVlm,
          circulatingSupply: ctx.circulatingSupply,
          totalSupply: ctx.totalSupply,
        };
      }
    });
    this._flushSpotPrices(map);
  }

  async extractSpotPricesFromAllMids(mids: Record<string, string>) {
    const map: Record<string, ISpotAssetCtxEntry> = {};
    for (const [coin, price] of Object.entries(mids)) {
      if (perpsUtils.isSpotInstrument(coin) && price) {
        map[coin] = { markPx: price };
      }
    }
    if (Object.keys(map).length > 0) {
      this._flushSpotPrices(map);
    }
  }

  async updateActiveAssetData(data: IPerpsActiveAssetDataRaw) {
    const activeAsset = await perpsActiveAssetAtom.get();
    const activeAccount = await perpsActiveAccountAtom.get();
    if (
      data?.user &&
      data?.coin &&
      activeAsset?.coin === data?.coin &&
      activeAccount?.accountAddress?.toLowerCase() === data?.user?.toLowerCase()
    ) {
      await perpsActiveAssetDataAtom.set(
        (_prev): IPerpsActiveAssetData => ({
          ...omit(data, 'user'),
          accountAddress: activeAccount?.accountAddress?.toLowerCase() as IHex,
          coin: data.coin,
          assetId: activeAsset?.assetId,
        }),
      );

      if (data.coin && data.leverage?.value) {
        const lastUsedLeverage = await perpsLastUsedLeverageAtom.get();
        await perpsLastUsedLeverageAtom.set({
          ...lastUsedLeverage,
          [data.coin]: data.leverage.value,
        });
      }
    } else {
      const activeAssetData = await perpsActiveAssetDataAtom.get();
      if (
        activeAssetData?.coin !== activeAsset?.coin ||
        activeAssetData?.accountAddress?.toLowerCase() !==
          activeAccount?.accountAddress?.toLowerCase()
      ) {
        await perpsActiveAssetDataAtom.set(undefined);
      }
    }
  }

  async updateActiveAccountSummary(webData2: IWsWebData2) {
    const activeAccount = await perpsActiveAccountAtom.get();
    if (
      activeAccount?.accountAddress &&
      activeAccount?.accountAddress?.toLowerCase() ===
        webData2?.user?.toLowerCase()
    ) {
      // Note: Deep compare not suitable here due to real-time data requirements
      const positions = webData2.clearinghouseState?.assetPositions || [];
      const totalUnrealizedPnlBN = positions.reduce((sum, position) => {
        const pnl = position.position?.unrealizedPnl;
        return pnl ? sum.plus(pnl) : sum;
      }, new BigNumber(0));

      await perpsActiveAccountSummaryAtom.set({
        accountAddress: activeAccount?.accountAddress?.toLowerCase() as IHex,
        accountValue: webData2.clearinghouseState?.marginSummary?.accountValue,
        totalMarginUsed:
          webData2.clearinghouseState?.marginSummary?.totalMarginUsed,
        crossAccountValue:
          webData2.clearinghouseState?.crossMarginSummary.accountValue,
        crossMaintenanceMarginUsed:
          webData2.clearinghouseState?.crossMaintenanceMarginUsed,
        totalNtlPos: webData2.clearinghouseState?.marginSummary?.totalNtlPos,
        totalRawUsd: webData2.clearinghouseState?.marginSummary?.totalRawUsd,
        withdrawable: webData2.clearinghouseState?.withdrawable,
        totalUnrealizedPnl: totalUnrealizedPnlBN.toFixed(),
      });
    } else {
      const activeAccountSummary = await perpsActiveAccountSummaryAtom.get();
      // TODO PERPS_EMPTY_ADDRESS check
      if (
        activeAccountSummary?.accountAddress?.toLowerCase() !==
        activeAccount?.accountAddress?.toLowerCase()
      ) {
        // TODO set undefined when account address changed
        await perpsActiveAccountSummaryAtom.set(undefined);
      }
    }
  }

  async updateActiveAccountSummaryFromClearinghouseState(
    data: IWsAllDexsClearinghouseState,
  ) {
    const activeAccount = await perpsActiveAccountAtom.get();
    const activeAddress = activeAccount?.accountAddress?.toLowerCase();
    const dataUser = data?.user?.toLowerCase();

    if (!activeAddress || activeAddress !== dataUser) {
      const activeAccountSummary = await perpsActiveAccountSummaryAtom.get();
      if (
        activeAccountSummary?.accountAddress?.toLowerCase() !== activeAddress
      ) {
        await perpsActiveAccountSummaryAtom.set(undefined);
      }
      return;
    }

    const clearinghouseStates = data.clearinghouseStates || [];
    if (clearinghouseStates.length === 0) {
      return;
    }

    // Aggregate all DEXs (HL perps + xyz) using BigNumber
    const aggregated = clearinghouseStates.reduce(
      (acc, [, state]) => {
        if (!state) return acc;

        const { marginSummary, crossMarginSummary, assetPositions } = state;

        // Aggregate margin summary values
        acc.accountValue = acc.accountValue.plus(
          marginSummary?.accountValue || '0',
        );
        acc.totalMarginUsed = acc.totalMarginUsed.plus(
          marginSummary?.totalMarginUsed || '0',
        );
        acc.totalNtlPos = acc.totalNtlPos.plus(
          marginSummary?.totalNtlPos || '0',
        );
        acc.totalRawUsd = acc.totalRawUsd.plus(
          marginSummary?.totalRawUsd || '0',
        );

        // Aggregate cross margin values
        acc.crossAccountValue = acc.crossAccountValue.plus(
          crossMarginSummary?.accountValue || '0',
        );
        acc.crossMaintenanceMarginUsed = acc.crossMaintenanceMarginUsed.plus(
          state.crossMaintenanceMarginUsed || '0',
        );

        // Aggregate withdrawable
        acc.withdrawable = acc.withdrawable.plus(state.withdrawable || '0');

        // Aggregate unrealized PnL from all positions
        const positions = assetPositions || [];
        positions.forEach((position) => {
          const pnl = position.position?.unrealizedPnl;
          if (pnl) {
            acc.totalUnrealizedPnl = acc.totalUnrealizedPnl.plus(pnl);
          }
        });

        return acc;
      },
      {
        accountValue: new BigNumber(0),
        totalMarginUsed: new BigNumber(0),
        crossAccountValue: new BigNumber(0),
        crossMaintenanceMarginUsed: new BigNumber(0),
        totalNtlPos: new BigNumber(0),
        totalRawUsd: new BigNumber(0),
        withdrawable: new BigNumber(0),
        totalUnrealizedPnl: new BigNumber(0),
      },
    );

    await perpsActiveAccountSummaryAtom.set({
      accountAddress: activeAddress as IHex,
      accountValue: aggregated.accountValue.toFixed(),
      totalMarginUsed: aggregated.totalMarginUsed.toFixed(),
      crossAccountValue: aggregated.crossAccountValue.toFixed(),
      crossMaintenanceMarginUsed:
        aggregated.crossMaintenanceMarginUsed.toFixed(),
      totalNtlPos: aggregated.totalNtlPos.toFixed(),
      totalRawUsd: aggregated.totalRawUsd.toFixed(),
      withdrawable: aggregated.withdrawable.toFixed(),
      totalUnrealizedPnl: aggregated.totalUnrealizedPnl.toFixed(),
    });
  }

  async updateSpotBalances(spotStateData: IWsSpotState) {
    const activeAccount = await perpsActiveAccountAtom.get();
    const activeAddress = activeAccount?.accountAddress?.toLowerCase();
    const dataUser = spotStateData?.user?.toLowerCase();

    // Active-account alignment: only process data for current account
    if (!activeAddress || activeAddress !== dataUser) return;

    const balances = spotStateData?.spotState?.balances || [];

    await spotBalancesAtom.set({ balances, isLoaded: true });

    // Calculate total USD value from spot balances
    // Price lookup: USDC (token=0) → 1:1, others → allMids.mids[coin] (perp mid price by token name)
    // Note: allMids["HYPE"]=36.20 is the correct USD price
    //       allMids["@N"] is a spot universe pair index, NOT token index — do NOT use
    const mids = hyperLiquidCache.allMids?.mids;
    const hasNonUsdcTokens = balances.some(
      (b) => b.token !== 0 && parseFloat(b.total) > 0,
    );
    const midsReady = mids && Object.keys(mids).length > 0;

    // Don't write spotTotalUsd if allMids hasn't loaded yet and we have non-USDC tokens
    // This prevents briefly showing an artificially low value
    if (hasNonUsdcTokens && !midsReady) {
      await perpsSpotBalancesAtom.set({
        accountAddress: activeAddress as IHex,
        balances: balances.map((b) => ({
          coin: b.coin,
          token: b.token,
          total: b.total,
          hold: b.hold,
          entryNtl: b.entryNtl,
        })),
        spotTotalUsd: undefined, // triggers isLoading in computed atom
      });
      return;
    }

    let totalUsd = new BigNumber(0);
    for (const balance of balances) {
      const amount = new BigNumber(balance.total);
      if (amount.isZero()) {
        // skip zero balances
      } else if (balance.token === 0) {
        // USDC — quote currency, 1:1 USD
        totalUsd = totalUsd.plus(amount);
      } else {
        // Use token name to look up perp mid price (e.g., "HYPE" → 36.20)
        const midPrice = mids?.[balance.coin];
        if (midPrice) {
          totalUsd = totalUsd.plus(amount.multipliedBy(midPrice));
        }
      }
    }

    await perpsSpotBalancesAtom.set({
      accountAddress: activeAddress as IHex,
      balances: balances.map((b) => ({
        coin: b.coin,
        token: b.token,
        total: b.total,
        hold: b.hold,
        entryNtl: b.entryNtl,
      })),
      spotTotalUsd: totalUsd.toFixed(),
    });
  }

  // Re-calculate spotTotalUsd from cached balances when allMids becomes available
  async recalculateSpotTotalUsd() {
    const spotData = await perpsSpotBalancesAtom.get();
    if (!spotData?.balances?.length || spotData.spotTotalUsd !== undefined)
      return;

    const activeAccount = await perpsActiveAccountAtom.get();
    const activeAddress = activeAccount?.accountAddress?.toLowerCase();
    if (!activeAddress || activeAddress !== spotData.accountAddress) return;

    const mids = hyperLiquidCache.allMids?.mids;
    if (!mids || Object.keys(mids).length === 0) return;

    const { balances } = spotData;
    let totalUsd = new BigNumber(0);
    for (const balance of balances) {
      const amount = new BigNumber(balance.total);
      if (amount.isZero()) {
        // skip zero balances
      } else if (balance.token === 0) {
        totalUsd = totalUsd.plus(amount);
      } else {
        const midPrice = mids[balance.coin];
        if (midPrice) {
          totalUsd = totalUsd.plus(amount.multipliedBy(midPrice));
        }
      }
    }

    const computed = totalUsd.toFixed();
    // Functional updater: only write if spotTotalUsd is still undefined
    // (avoids overwriting fresher data from a concurrent SPOT_STATE event)
    await perpsSpotBalancesAtom.set((prev) => {
      if (!prev || prev.spotTotalUsd !== undefined) return prev;
      return { ...prev, spotTotalUsd: computed };
    });
  }

  private _rebuildSpotMappings(universes: ISpotUniverse[]) {
    const pairToBaseName: Record<string, string> = {};
    const baseNameToAssetId: Record<string, number> = {};
    const baseNameToSzDecimals: Record<string, number> = {};
    const baseNameToPairName: Record<string, string> = {};

    for (const u of universes) {
      pairToBaseName[u.name] = u.baseName;
      baseNameToAssetId[u.baseName] = u.assetId;
      baseNameToSzDecimals[u.baseName] = u.baseSzDecimals;
      baseNameToPairName[u.baseName] = u.name;
    }

    this._spotMappings = {
      pairToBaseName,
      baseNameToAssetId,
      baseNameToSzDecimals,
      baseNameToPairName,
    };

    // UI needs synchronous @N → display name resolution (no async SimpleDb lookup)
    const displayMap: Record<string, string> = {};
    for (const u of universes) {
      displayMap[u.name] = perpsUtils.getSpotTokenDisplayName(u.baseName);
    }
    void spotPairDisplayMapAtom.set(displayMap);
  }

  // Service may restart without refreshSpotMeta — rebuild from SimpleDb on first access
  private async _ensureSpotMappings() {
    if (Object.keys(this._spotMappings.pairToBaseName).length > 0) return;
    const { universes } = await this.backgroundApi.simpleDb.perp.getSpotMeta();
    if (universes.length > 0) {
      this._rebuildSpotMappings(universes);
    }
  }

  @backgroundMethod()
  async getSpotAssetId(tokenName: string): Promise<number | undefined> {
    await this._ensureSpotMappings();
    return this._spotMappings.baseNameToAssetId[tokenName];
  }

  @backgroundMethod()
  async getSpotSzDecimals(tokenName: string): Promise<number | undefined> {
    await this._ensureSpotMappings();
    return this._spotMappings.baseNameToSzDecimals[tokenName];
  }

  @backgroundMethod()
  async getSpotPairName(tokenName: string): Promise<string | undefined> {
    await this._ensureSpotMappings();
    return this._spotMappings.baseNameToPairName[tokenName];
  }

  @backgroundMethod()
  async getSpotMeta() {
    return this.backgroundApi.simpleDb.perp.getSpotMeta();
  }

  @backgroundMethod()
  async refreshSpotExternalMarketCaps() {
    try {
      const marketCaps = await this._fetchSpotExternalMarketCaps();
      await spotExternalMarketCapsAtom.set(marketCaps);
      return marketCaps;
    } catch (error) {
      defaultLogger.app.error.log(
        `Failed to refresh spot external market caps: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return spotExternalMarketCapsAtom.get();
    }
  }

  @backgroundMethod()
  async refreshSpotMeta() {
    const { infoClient } = hyperLiquidApiClients;
    const result = await infoClient.spotMetaAndAssetCtxs();
    const meta = result[0];
    if (meta?.tokens && meta?.universe) {
      const tokens = meta.tokens;
      const universes: ISpotUniverse[] = meta.universe.map((item) => {
        const baseTokenIdx = item.tokens[0];
        const quoteTokenIdx = item.tokens[1];
        const baseToken = tokens[baseTokenIdx];
        const quoteToken = tokens[quoteTokenIdx];
        const baseName = baseToken?.name ?? '';
        const quoteName = quoteToken?.name ?? 'USDC';
        return {
          ...item,
          assetId: SPOT_ASSET_ID_OFFSET + item.index,
          baseName,
          quoteName,
          displayName: perpsUtils.getSpotTokenDisplayName(baseName),
          baseSzDecimals: baseToken?.szDecimals ?? 0,
        };
      });
      await this.backgroundApi.simpleDb.perp.setSpotMeta({
        tokens,
        universes,
      });
      this._rebuildSpotMappings(universes);
    }
    // Reuse the assetCtxs from this REST call so the first spot view doesn't
    // wait 2-3s for the WS SPOT_ASSET_CTXS message and flash a skeleton.
    const assetCtxs = result[1];
    if (Array.isArray(assetCtxs) && assetCtxs.length > 0) {
      void this.updateSpotAssetCtxsMap(assetCtxs);
    }
    void this.refreshSpotExternalMarketCaps();
  }

  hideSelectAccountLoadingTimer: ReturnType<typeof setTimeout> | undefined;

  @backgroundMethod()
  async changeActivePerpsAccount(params: {
    accountId: string | null;
    walletId: string | null;
    indexedAccountId: string | null;
    deriveType: IAccountDeriveTypes;
  }) {
    const { indexedAccountId, accountId, deriveType } = params;

    const perpsAccount: IPerpsActiveAccountAtom = {
      indexedAccountId: indexedAccountId || null,
      accountId: null,
      accountAddress: null,
      deriveType: deriveType || 'default',
    };

    try {
      clearTimeout(this.hideSelectAccountLoadingTimer);
      await perpsAccountLoadingInfoAtom.set(
        (prev): IPerpsAccountLoadingInfo => ({
          ...prev,
          selectAccountLoading: true,
        }),
      );

      if (indexedAccountId || accountId) {
        // Check if Bitcoin Only firmware for hardware wallets
        // Perp trading requires EVM support, so Bitcoin Only firmware is not supported
        const isBtcOnlyFirmware =
          await this.backgroundApi.serviceAccount.isBtcOnlyFirmwareByWalletId({
            walletId: params.walletId || '',
          });

        // If Bitcoin Only firmware, mark account as unsupported by clearing indexedAccountId
        if (isBtcOnlyFirmware) {
          perpsAccount.indexedAccountId = null;
          perpsAccount.accountId = null;
          perpsAccount.accountAddress = null;
        } else {
          const ethNetworkId = PERPS_NETWORK_ID;
          const getNetworkAccountParams = {
            indexedAccountId: indexedAccountId ?? undefined,
            accountId: indexedAccountId ? undefined : (accountId ?? undefined),
            networkId: ethNetworkId,
            deriveType: deriveType || 'default',
          };
          const account =
            await this.backgroundApi.serviceAccount.getNetworkAccount(
              getNetworkAccountParams,
            );
          perpsAccount.accountAddress =
            (account.address?.toLowerCase() as IHex) || null;
          if (perpsAccount.accountAddress) {
            perpsAccount.accountId = account.id || null;
          }
          void this.backgroundApi.serviceAccount.saveAccountAddresses({
            account,
            networkId: ethNetworkId,
          });
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      clearTimeout(this.hideSelectAccountLoadingTimer);
      this.hideSelectAccountLoadingTimer = setTimeout(async () => {
        await perpsAccountLoadingInfoAtom.set(
          (prev): IPerpsAccountLoadingInfo => ({
            ...prev,
            selectAccountLoading: false,
          }),
        );
      }, 300);
    }

    await perpsAbstractionModeAtom.set(undefined);
    await perpsSpotBalancesAtom.set(undefined);
    // Also reset the UI-facing spot balances atom so stale balances from
    // the previous account don't flash before the new SPOT_STATE arrives.
    await spotBalancesAtom.set({ balances: [], isLoaded: false });
    await perpsActiveAccountAtom.set(perpsAccount);
    return perpsAccount;
  }

  @backgroundMethod()
  async changeActiveAsset(params: { coin: string }): Promise<{
    universeItems: IPerpsUniverse[];
    selectedUniverse: IPerpsUniverse | undefined;
  }> {
    const requestId = (this.activeAssetChangeRequestId += 1);
    const oldActiveAsset = await perpsActiveAssetAtom.get();
    const oldCoin = oldActiveAsset?.coin;
    const newCoin = params.coin;
    const { universesByDex, marginTablesMapByDex } =
      await this.getTradingUniverse();

    const targetDexIndex = this.detectDexIndexByCoin(newCoin);
    const dexUniverses: IPerpsUniverse[] | undefined =
      universesByDex?.[targetDexIndex];
    const dexMarginTables: IMarginTableMap | undefined =
      marginTablesMapByDex?.[targetDexIndex];

    if (dexUniverses?.length === 0) {
      return {
        universeItems: [],
        selectedUniverse: oldActiveAsset?.universe,
      };
    }

    const selectedUniverse: IPerpsUniverse | undefined =
      dexUniverses?.find((item) => item.name === newCoin) || dexUniverses?.[0];
    if (requestId !== this.activeAssetChangeRequestId) {
      return {
        universeItems: dexUniverses || [],
        selectedUniverse: oldActiveAsset?.universe,
      };
    }

    const assetId =
      selectedUniverse?.assetId ??
      dexUniverses?.findIndex(
        (token) => token.name === selectedUniverse?.name,
      ) ??
      -1;
    const selectedMargin = dexMarginTables?.[selectedUniverse?.marginTableId];
    if (requestId !== this.activeAssetChangeRequestId) {
      return {
        universeItems: dexUniverses || [],
        selectedUniverse: oldActiveAsset?.universe,
      };
    }

    await perpsActiveAssetAtom.set({
      coin: selectedUniverse?.name || newCoin || '',
      assetId,
      universe: selectedUniverse,
      margin: selectedMargin,
    });
    if (oldCoin !== newCoin) {
      await perpsActiveAssetCtxAtom.set(undefined);
    }
    return {
      universeItems: dexUniverses || [],
      selectedUniverse,
    };
  }

  @backgroundMethod()
  async setPerpsCustomSettings(settings: IPerpsCustomSettings) {
    await perpsCustomSettingsAtom.set(settings);
  }

  @backgroundMethod()
  @toastIfError()
  async enableTrading() {
    await this.checkPerpsAccountStatus({
      isEnableTradingTrigger: true,
    });
    const status = await perpsActiveAccountStatusAtom.get();
    return status;
  }

  hideEnableTradingLoadingTimer: ReturnType<typeof setTimeout> | undefined;

  @backgroundMethod()
  async fetchUserAbstraction(userAddress: IHex): Promise<string | undefined> {
    // Active-account alignment check
    const activeAccount = await perpsActiveAccountAtom.get();
    if (
      activeAccount?.accountAddress?.toLowerCase() !== userAddress.toLowerCase()
    ) {
      return undefined;
    }

    const { infoClient } = hyperLiquidApiClients;
    try {
      const mode = await infoClient.userAbstraction({ user: userAddress });

      // Re-check alignment after async call
      const currentAccount = await perpsActiveAccountAtom.get();
      if (
        currentAccount?.accountAddress?.toLowerCase() !==
        userAddress.toLowerCase()
      ) {
        return undefined;
      }

      await this.backgroundApi.simpleDb.perp.setUserAbstractionMode(
        userAddress,
        mode,
      );
      await perpsAbstractionModeAtom.set({
        accountAddress: userAddress.toLowerCase() as IHex,
        mode: mode as EHyperLiquidAbstractionMode,
      });
      return mode;
    } catch {
      // Fallback to SimpleDb cached value — need alignment checks around every await
      const preDbAccount = await perpsActiveAccountAtom.get();
      if (
        preDbAccount?.accountAddress?.toLowerCase() !==
        userAddress.toLowerCase()
      ) {
        return undefined;
      }
      const cached =
        await this.backgroundApi.simpleDb.perp.getUserAbstractionMode(
          userAddress,
        );
      // Post-async alignment: user could have switched during SimpleDb read
      const postDbAccount = await perpsActiveAccountAtom.get();
      if (
        postDbAccount?.accountAddress?.toLowerCase() !==
        userAddress.toLowerCase()
      ) {
        return undefined;
      }
      if (cached) {
        await perpsAbstractionModeAtom.set({
          accountAddress: userAddress.toLowerCase() as IHex,
          mode: cached as EHyperLiquidAbstractionMode,
        });
        return cached;
      }
      return undefined; // NOT "default" — unknown is unknown
    }
  }

  @backgroundMethod()
  async checkPerpsAccountStatus({
    isEnableTradingTrigger = false,
  }: {
    isEnableTradingTrigger?: boolean;
  } = {}): Promise<void> {
    const { infoClient } = hyperLiquidApiClients;
    const statusDetails: IPerpsActiveAccountStatusDetails = {
      activatedOk: false,
      agentOk: false,
      referralCodeOk: false,
      builderFeeOk: false,
      internalRebateBoundOk: false,
      abstractionOk: false,
    };
    let status: IPerpsActiveAccountStatusInfoAtom | undefined;

    const selectedAccount = await perpsActiveAccountAtom.get();
    const accountAddress = selectedAccount.accountAddress?.toLowerCase() as
      | IHex
      | undefined;
    let agentCredential: ICoreHyperLiquidAgentCredential | undefined;

    try {
      clearTimeout(this.hideEnableTradingLoadingTimer);
      await perpsAccountLoadingInfoAtom.set(
        (prev): IPerpsAccountLoadingInfo => ({
          ...prev,
          enableTradingLoading: true,
        }),
      );

      if (!accountAddress) {
        throw new OneKeyLocalError(
          'Check perps account status ERROR: Account address is required',
        );
      }

      // Run exchange client setup and activation check in parallel —
      // setup is local-only, userRole uses the info client (independent).
      let isActivated = false;
      if (hyperLiquidCache?.activatedUser?.[accountAddress] === true) {
        isActivated = true;
      }
      const [, userRoleResult] = await Promise.all([
        this.exchangeService.setup({
          userAddress: accountAddress,
          userAccountId: selectedAccount.accountId ?? undefined,
        }),
        !isActivated
          ? infoClient.userRole({ user: accountAddress })
          : Promise.resolve(null),
      ]);
      if (!isActivated && userRoleResult) {
        isActivated = userRoleResult.role !== 'missing';
      }
      if (!isActivated) {
        statusDetails.activatedOk = false;
        defaultLogger.perp.agentLifeCycle.trackReason({
          reason: 'account_not_activated',
          accountAddress,
          accountId: selectedAccount.accountId,
          isEnableTradingTrigger,
          statusDetails: { ...statusDetails },
        });
        // await this.checkBuilderFeeStatus({
        //   accountAddress,
        //   isEnableTradingTrigger,
        //   statusDetails,
        // });
      } else {
        hyperLiquidCache.activatedUser[accountAddress] = true;
        statusDetails.activatedOk = true;

        // Read abstraction mode early (no signing needed)
        // So account value displays correctly before enable trading
        void this.fetchUserAbstraction(accountAddress);

        // Builder fee check and rebate binding check are independent — run in parallel.
        // Both must complete before checkAgentStatus (builder fee must be approved,
        // and credentials may be cleared based on rebate result).
        const [, isRebateBound] = await Promise.all([
          this.checkBuilderFeeStatus({
            accountAddress,
            accountId: selectedAccount.accountId,
            isEnableTradingTrigger,
            statusDetails,
          }),
          this.checkInternalRebateBindingStatusWithCache({
            accountId: selectedAccount.accountId,
            accountAddress,
          }),
        ]);

        // Clear local credentials to force new agent creation for rebate binding
        if (!isRebateBound) {
          await this.clearLocalAgentCredentials({
            userAddress: accountAddress,
          });
          // Binding triggered via reportAgentApprovalToBackend after agent creation
          statusDetails.internalRebateBoundOk = false;
          defaultLogger.perp.agentLifeCycle.trackReason({
            reason: 'internal_rebate_not_bound',
            accountAddress,
            accountId: selectedAccount.accountId,
            isEnableTradingTrigger,
            statusDetails: { ...statusDetails },
          });
        } else {
          statusDetails.internalRebateBoundOk = true;
        }

        agentCredential = await this.checkAgentStatus({
          accountAddress,
          accountId: selectedAccount.accountId,
          isEnableTradingTrigger,
          statusDetails,
        });

        if (agentCredential) {
          // TODO setupMasterWallet, setupAgentWallet
          await this.exchangeService.setup({
            userAddress: accountAddress,
            agentCredential,
          });

          statusDetails.internalRebateBoundOk = true;
          statusDetails.referralCodeOk = true;

          // Check abstraction mode — requires user wallet signature
          // Placed after referralCodeOk so a signature rejection doesn't block other status
          const currentMode = await this.fetchUserAbstraction(accountAddress);
          const isAbstractionCorrect =
            currentMode === EHyperLiquidAbstractionMode.UNIFIED_ACCOUNT ||
            currentMode === EHyperLiquidAbstractionMode.PORTFOLIO_MARGIN;
          if (isAbstractionCorrect) {
            statusDetails.abstractionOk = true;
          } else if (isEnableTradingTrigger && selectedAccount.accountId) {
            // Only set abstraction when user explicitly clicks Enable Trading
            // User wallet signature required — will prompt user
            await this.exchangeService.setAbstractionWithUserWallet({
              userAccountId: selectedAccount.accountId,
              userAddress: accountAddress,
              abstraction: 'unifiedAccount',
            });
            const verifiedMode =
              await this.fetchUserAbstraction(accountAddress);
            statusDetails.abstractionOk =
              verifiedMode === EHyperLiquidAbstractionMode.UNIFIED_ACCOUNT ||
              verifiedMode === EHyperLiquidAbstractionMode.PORTFOLIO_MARGIN;
          }
        }
      }
    } finally {
      status = {
        accountAddress: accountAddress || null,
        details: statusDetails,
      };
      await perpsActiveAccountStatusInfoAtom.set(status);

      clearTimeout(this.hideEnableTradingLoadingTimer);
      this.hideEnableTradingLoadingTimer = setTimeout(async () => {
        await perpsAccountLoadingInfoAtom.set(
          (prev): IPerpsAccountLoadingInfo => ({
            ...prev,
            enableTradingLoading: false,
          }),
        );
      }, 0);
    }

    // Deferred: bind referral code after loading resolves.
    // Non-blocking, non-critical — avoids bandwidth contention during critical path.
    if (agentCredential) {
      void (async () => {
        const cacheKey = [
          agentCredential.userAddress.toLowerCase(),
          agentCredential.agentAddress.toLowerCase(),
          agentCredential.agentName,
        ].join('-');
        if (!hyperLiquidCache?.referrerCodeSetDone?.[cacheKey]) {
          const { referralCode } =
            await this.backgroundApi.simpleDb.perp.getPerpData();
          try {
            // referrer code can be approved by agent
            await this.exchangeService.setReferrerCode({
              code: referralCode || HYPERLIQUID_REFERRAL_CODE,
            });
          } finally {
            hyperLiquidCache.referrerCodeSetDone[cacheKey] = true;
          }
        }
      })();
    }
  }

  fetchExtraAgentsWithCache = cacheUtils.memoizee(
    async ({ user }: { user: IHex }) => {
      const { infoClient } = hyperLiquidApiClients;
      return infoClient.extraAgents({
        user,
      });
    },
    {
      max: 20,
      maxAge: timerUtils.getTimeDurationMs({ minute: 2 }),
      promise: true,
    },
  );

  private async clearLocalAgentCredentials({
    userAddress,
  }: {
    userAddress: string;
  }) {
    try {
      const allCredentials = await localDb.getAllHyperLiquidAgentCredentials();
      const credentialsToDelete = allCredentials.filter((credential) =>
        credential.id.toLowerCase().includes(userAddress.toLowerCase()),
      );

      if (credentialsToDelete.length > 0) {
        await localDb.removeCredentials({ credentials: credentialsToDelete });
        this.fetchExtraAgentsWithCache.clear();
        this.checkInternalRebateBindingStatusWithCache.clear();
      }
    } catch (error) {
      console.error('[clearLocalAgentCredentials] Error:', error);
    }
  }

  private async checkAgentStatus({
    accountAddress,
    accountId,
    isEnableTradingTrigger,
    statusDetails,
  }: {
    accountAddress: IHex;
    accountId: string | null;
    isEnableTradingTrigger: boolean;
    statusDetails: IPerpsActiveAccountStatusDetails;
  }) {
    let agentCredential: ICoreHyperLiquidAgentCredential | undefined;
    const extraAgents = await this.fetchExtraAgentsWithCache({
      user: accountAddress,
    });
    const now = Date.now();
    const validThreshold =
      now +
      timerUtils.getTimeDurationMs({
        day: 1,
      });
    if (!extraAgents?.length) {
      defaultLogger.perp.agentLifeCycle.trackReason({
        reason: 'agent_not_found',
        accountAddress,
        accountId,
        isEnableTradingTrigger,
        statusDetails: {
          ...statusDetails,
          stage: 'extra_agents_empty',
        },
      });
    }
    if (extraAgents?.length) {
      const validAgents = (
        await Promise.all(
          extraAgents.map(async (agent) => {
            const credential = await localDb.getHyperLiquidAgentCredential({
              userAddress: accountAddress,
              agentName: agent.name as EHyperLiquidAgentName,
            });
            if (!agent.address) {
              defaultLogger.perp.agentLifeCycle.trackReason({
                reason: 'agent_not_found',
                accountAddress,
                accountId,
                isEnableTradingTrigger,
                statusDetails: {
                  ...statusDetails,
                  agentName: agent.name,
                  stage: 'agent_address_missing',
                },
              });
              return null;
            }
            if (agent.validUntil <= validThreshold) {
              defaultLogger.perp.agentLifeCycle.trackReason({
                reason: 'agent_near_expiry',
                accountAddress,
                accountId,
                isEnableTradingTrigger,
                statusDetails: {
                  ...statusDetails,
                  agentName: agent.name,
                  agentAddress: agent.address,
                  validUntil: agent.validUntil,
                },
              });
              return null;
            }
            if (!credential) {
              defaultLogger.perp.agentLifeCycle.trackReason({
                reason: 'agent_credential_missing',
                accountAddress,
                accountId,
                isEnableTradingTrigger,
                statusDetails: {
                  ...statusDetails,
                  agentName: agent.name,
                  agentAddress: agent.address,
                  validUntil: agent.validUntil,
                },
              });
              return null;
            }
            if (
              credential.agentAddress?.toLowerCase() !==
              agent.address.toLowerCase()
            ) {
              defaultLogger.perp.agentLifeCycle.trackReason({
                reason: 'agent_address_mismatch',
                accountAddress,
                accountId,
                isEnableTradingTrigger,
                statusDetails: {
                  ...statusDetails,
                  agentName: agent.name,
                  chainAgentAddress: agent.address,
                  localAgentAddress: credential.agentAddress,
                  validUntil: agent.validUntil,
                },
              });
              return null;
            }
            credential.validUntil = agent.validUntil;
            return credential;
          }),
        )
      )
        .filter(Boolean)
        .toSorted((a, b) => b.validUntil - a.validUntil);
      agentCredential = validAgents?.[0];
      if (!agentCredential) {
        defaultLogger.perp.agentLifeCycle.trackReason({
          reason: 'agent_not_found',
          accountAddress,
          accountId,
          isEnableTradingTrigger,
          statusDetails: {
            ...statusDetails,
            extraAgentsCount: extraAgents.length,
            stage: 'no_valid_agent_credential',
          },
        });
      }
    }
    if (!agentCredential && isEnableTradingTrigger) {
      this.fetchExtraAgentsWithCache.clear();
      try {
        const privateKeyBytes = crypto.getRandomValues(new Uint8Array(32));
        const privateKeyHex = bufferUtils.bytesToHex(privateKeyBytes);
        const agentAddress = new ethers.Wallet(privateKeyHex).address as IHex;

        const onekeyAgentNames = [
          EHyperLiquidAgentName.OneKeyAgent1,
          EHyperLiquidAgentName.OneKeyAgent2,
          EHyperLiquidAgentName.OneKeyAgent3,
        ];
        let agentNameToApprove: EHyperLiquidAgentName | undefined;
        if (extraAgents.length === 3) {
          const nonOneKeyAgents = extraAgents.filter(
            (agent) =>
              !onekeyAgentNames.includes(agent.name as EHyperLiquidAgentName),
          );
          const agentToRemove = (
            nonOneKeyAgents.length ? nonOneKeyAgents : extraAgents
          ).toSorted((a, b) => a.validUntil - b.validUntil)?.[0];
          const agentNameToRemove = agentToRemove?.name as
            | EHyperLiquidAgentName
            | undefined;
          if (agentToRemove) {
            if (
              agentNameToRemove &&
              onekeyAgentNames.includes(agentNameToRemove)
            ) {
              agentNameToApprove = agentNameToRemove;
            } else {
              const approveAgentResult = await this.exchangeService.removeAgent(
                {
                  agentName: agentNameToRemove,
                },
              );
              defaultLogger.perp.agentLifeCycle.trackReason({
                reason: 'agent_removed_for_slot_recovery',
                accountAddress,
                accountId,
                isEnableTradingTrigger,
                statusDetails: {
                  ...statusDetails,
                  agentName: agentNameToRemove,
                  removeResultStatus: approveAgentResult?.status,
                },
              });
              await timerUtils.wait(4000);

              // Poll to verify agent removal instead of fixed delay
              const pollStartTime = Date.now();
              const pollTimeoutMs = 10_000; // 10 seconds total polling timeout
              const requestTimeoutMs = 3000; // 3 seconds per request timeout
              const { infoClient } = hyperLiquidApiClients;

              while (Date.now() - pollStartTime < pollTimeoutMs) {
                try {
                  const currentExtraAgents = await pTimeout(
                    infoClient.extraAgents({
                      user: accountAddress,
                    }),
                    {
                      milliseconds: requestTimeoutMs,
                    },
                  );

                  // Check if the agent was successfully removed
                  if (
                    !currentExtraAgents.some(
                      (agent) => agent.name === agentNameToRemove,
                    )
                  ) {
                    break;
                  }
                } catch (error) {
                  console.error('Polling request failed:', error);
                }

                // Wait 500ms before next poll attempt
                await timerUtils.wait(500);
              }
            }
          }
        }
        if (!agentNameToApprove) {
          for (const agentName of onekeyAgentNames) {
            if (!extraAgents.some((agent) => agent.name === agentName)) {
              agentNameToApprove = agentName;
              break;
            }
          }
        }
        if (!agentNameToApprove) {
          agentNameToApprove = EHyperLiquidAgentName.OneKeyAgent1;
        }

        const { agentTTL = HYPERLIQUID_AGENT_TTL_DEFAULT } =
          await this.backgroundApi.simpleDb.perp.getPerpData();

        const validUntil = Date.now() + agentTTL;
        // {name} valid_until 1765710491688
        const agentNameToApproveWithValidUntil = `${agentNameToApprove} valid_until ${validUntil}`;
        const approveAgentFn = () =>
          this.exchangeService.approveAgent({
            agent: agentAddress,
            agentName:
              agentNameToApproveWithValidUntil as EHyperLiquidAgentName,
            // agentName: EHyperLiquidAgentName.Official,
            authorize: true,
          });
        let retryTimes = 5;
        let approveAgentResult: IApiRequestResult | undefined;
        while (retryTimes >= 0) {
          try {
            retryTimes -= 1;
            approveAgentResult = await approveAgentFn();
            const approveOk =
              approveAgentResult &&
              typeof approveAgentResult === 'object' &&
              'status' in approveAgentResult &&
              (approveAgentResult as { status?: string }).status === 'ok';
            const approveDefaultResponse =
              approveAgentResult &&
              typeof approveAgentResult === 'object' &&
              'response' in approveAgentResult &&
              (approveAgentResult as { response?: { type?: string } }).response
                ?.type === 'default';
            if (approveOk && approveDefaultResponse) {
              break;
            }
          } catch (error) {
            const requestError = error as IApiRequestError | undefined;
            const errorResponse = (
              requestError as {
                response?: { status?: string; response?: string };
              }
            )?.response;
            if (
              errorResponse?.status === 'err' &&
              errorResponse?.response === 'User has pending agent removal'
            ) {
              if (retryTimes <= 0) {
                throw error;
              }
            } else {
              throw error;
            }
          }
          await timerUtils.wait(500);
        }

        if (
          approveAgentResult &&
          approveAgentResult.status === 'ok' &&
          approveAgentResult.response.type === 'default'
        ) {
          const encodedPrivateKey =
            await this.backgroundApi.servicePassword.encodeSensitiveText({
              text: privateKeyHex,
            });

          const { credentialId } =
            await this.backgroundApi.serviceAccount.addOrUpdateHyperLiquidAgentCredential(
              {
                userAddress: accountAddress,
                agentAddress,
                agentName: agentNameToApprove as EHyperLiquidAgentName,
                privateKey: encodedPrivateKey,
                validUntil,
              },
            );

          if (credentialId) {
            const credential = await localDb.getHyperLiquidAgentCredential({
              userAddress: accountAddress,
              agentName: agentNameToApprove as EHyperLiquidAgentName,
            });
            if (credential) {
              agentCredential = credential;
            }
          }
          if (agentCredential) {
            defaultLogger.perp.agentLifeCycle.trackReason({
              reason: 'agent_create_success',
              accountAddress,
              accountId,
              isEnableTradingTrigger,
              statusDetails: {
                ...statusDetails,
                agentName: agentNameToApprove,
                agentAddress,
                validUntil,
              },
            });
          } else {
            defaultLogger.perp.agentLifeCycle.trackReason({
              reason: 'agent_credential_missing',
              accountAddress,
              accountId,
              isEnableTradingTrigger,
              statusDetails: {
                ...statusDetails,
                agentName: agentNameToApprove,
                agentAddress,
                validUntil,
                stage: 'created_but_local_credential_missing',
              },
            });
          }
        } else {
          defaultLogger.perp.agentLifeCycle.trackReason({
            reason: 'agent_create_failed',
            accountAddress,
            accountId,
            isEnableTradingTrigger,
            statusDetails: {
              ...statusDetails,
              errorMessage: 'approve_agent_not_ok',
              approveResultStatus: approveAgentResult?.status,
            },
          });
        }
      } catch (error) {
        defaultLogger.perp.agentLifeCycle.trackReason({
          reason: 'agent_create_failed',
          accountAddress,
          accountId,
          isEnableTradingTrigger,
          statusDetails: {
            ...statusDetails,
            errorMessage:
              error instanceof Error ? error.message : String(error),
          },
        });
        throw error;
      }
    }
    if (agentCredential) {
      statusDetails.agentOk = true;
    }
    return agentCredential;
  }

  private async getRebateBindingReferenceInfo({
    accountId,
    signerAddress,
  }: {
    accountId: string | null;
    signerAddress: string;
  }): Promise<{
    walletId: string;
    referenceAddress: string;
    referenceNetworkId: string;
  } | null> {
    if (!accountId) {
      return null;
    }

    const walletId = accountUtils.getWalletIdFromAccountId({ accountId });

    if (
      !accountUtils.isHdWallet({ walletId }) &&
      !accountUtils.isHwWallet({ walletId })
    ) {
      return null;
    }

    let wallet;
    try {
      wallet = await this.backgroundApi.serviceAccount.getWallet({
        walletId,
      });
      if (accountUtils.isHwHiddenWallet({ wallet })) {
        return null;
      }
    } catch {
      return null;
    }

    const referenceNetworkId = getNetworkIdsMap().arbitrum;
    const referenceAddress = wallet.firstEvmAddress || signerAddress;

    return { walletId, referenceAddress, referenceNetworkId };
  }

  checkInternalRebateBindingStatusWithCache = cacheUtils.memoizee(
    async ({
      accountId,
      accountAddress,
    }: {
      accountId: string | null;
      accountAddress: IHex;
    }) => {
      return this.checkInternalRebateBindingStatus({
        accountId,
        accountAddress,
      });
    },
    {
      max: 20,
      maxAge: timerUtils.getTimeDurationMs({ minute: 1 }),
      promise: true,
    },
  );

  private async checkInternalRebateBindingStatus({
    accountId,
    accountAddress,
  }: {
    accountId: string | null;
    accountAddress: IHex;
  }): Promise<boolean> {
    const refInfo = await this.getRebateBindingReferenceInfo({
      accountId,
      signerAddress: accountAddress,
    });

    if (!refInfo) {
      return true;
    }

    const { referenceAddress, referenceNetworkId } = refInfo;
    const isFirstAccount =
      referenceAddress.toLowerCase() === accountAddress.toLowerCase();

    try {
      // First account: skip binding check
      if (isFirstAccount) {
        return true;
      }

      // Non-first account: batch check both current and first account binding status
      const batchResult =
        await this.backgroundApi.serviceReferralCode.batchCheckWalletsBoundReferralCode(
          [
            { address: accountAddress, networkId: referenceNetworkId },
            { address: referenceAddress, networkId: referenceNetworkId },
          ],
        );

      const currentAccountKey = `${referenceNetworkId}:${accountAddress}`;
      const firstAccountKey = `${referenceNetworkId}:${referenceAddress}`;
      const isCurrentAccountBound = batchResult[currentAccountKey] ?? false;
      const isFirstAccountBound = batchResult[firstAccountKey] ?? false;

      if (isCurrentAccountBound) {
        return true;
      }

      if (isFirstAccountBound) {
        // First account is bound, current account needs binding too
        return false;
      }

      // First account is not bound, skip binding for current account
      return true;
    } catch (error) {
      console.error(
        '[checkInternalRebateBindingStatus] Failed to check binding status',
        error,
      );
      return true;
    }
  }

  private async checkBuilderFeeStatus({
    accountAddress,
    accountId,
    isEnableTradingTrigger,
    statusDetails,
  }: {
    accountAddress: IHex;
    accountId: string | null;
    isEnableTradingTrigger: boolean;
    statusDetails: IPerpsActiveAccountStatusDetails;
  }) {
    const { expectBuilderAddress, expectMaxBuilderFee } =
      await this.getBuilderFeeConfig();

    if (expectBuilderAddress) {
      const maxBuilderFee = await this.getUserApprovedMaxBuilderFeeWithCache({
        userAddress: accountAddress,
        builderAddress: expectBuilderAddress,
      });
      if (maxBuilderFee === expectMaxBuilderFee) {
        statusDetails.builderFeeOk = true;
      } else {
        defaultLogger.perp.agentLifeCycle.trackReason({
          reason: 'builder_fee_not_approved',
          accountAddress,
          accountId,
          isEnableTradingTrigger,
          statusDetails: {
            ...statusDetails,
            expectBuilderAddress,
            expectMaxBuilderFee,
            currentMaxBuilderFee: maxBuilderFee,
          },
        });
      }
      if (maxBuilderFee !== expectMaxBuilderFee && isEnableTradingTrigger) {
        this.getUserApprovedMaxBuilderFeeWithCache.clear();
        const approveBuilderFeeResult =
          await this.exchangeService.approveBuilderFee({
            builder: expectBuilderAddress as IHex,
            maxFeeRate: `${new BigNumber(expectMaxBuilderFee)
              .div(1000)
              .toFixed()}%`,
          });
        if (
          approveBuilderFeeResult.status === 'ok' &&
          approveBuilderFeeResult.response.type === 'default'
        ) {
          statusDetails.builderFeeOk = true;
        }
      }
    }
  }

  async getUserApprovedMaxBuilderFee({
    userAddress,
    builderAddress,
  }: {
    userAddress: string;
    builderAddress: string;
  }): Promise<IHyperliquidMaxBuilderFee> {
    const { infoClient } = hyperLiquidApiClients;
    return infoClient.maxBuilderFee({
      user: userAddress.toLowerCase() as IHex,
      builder: builderAddress.toLowerCase() as IHex,
    });
  }

  getUserApprovedMaxBuilderFeeWithCache = cacheUtils.memoizee(
    async ({
      userAddress,
      builderAddress,
    }: {
      userAddress: string;
      builderAddress: string;
    }) => {
      return this.getUserApprovedMaxBuilderFee({ userAddress, builderAddress });
    },
    {
      max: 20,
      maxAge: timerUtils.getTimeDurationMs({ minute: 10 }),
      promise: true,
    },
  );

  async reportAgentApprovalToBackend(signatureInfo: {
    action: {
      type: string;
      signatureChainId: string;
      hyperliquidChain: string;
      agentAddress: string;
      agentName: string;
      nonce: number;
    };
    signature: IHyperLiquidSignatureRSV;
    nonce: number;
    signerAddress: string;
    accountId?: string;
  }) {
    try {
      const selectedAccount = await perpsActiveAccountAtom.get();
      const accountId = signatureInfo.accountId || selectedAccount.accountId;

      const refInfo = await this.getRebateBindingReferenceInfo({
        accountId,
        signerAddress: signatureInfo.signerAddress,
      });

      if (!refInfo) {
        return;
      }

      await this.backgroundApi.serviceReferralCode.bindPerpsWallet({
        action: signatureInfo.action,
        nonce: signatureInfo.nonce,
        signature: signatureInfo.signature,
        referenceAddress: refInfo.referenceAddress,
        signerAddress: signatureInfo.signerAddress,
      });

      // Clear cache after successful binding
      this.checkInternalRebateBindingStatusWithCache.clear();
    } catch (error) {
      console.error('[reportAgentApprovalToBackend] Error:', error);
    }
  }

  @backgroundMethod()
  async notifyHyperliquidAccountBind({
    signerAddress,
    action,
    nonce,
    signature,
  }: {
    signerAddress: string;
    action: {
      type: string;
      signatureChainId: string;
      hyperliquidChain: string;
      agentAddress: string;
      agentName: string;
      nonce: number;
    };
    nonce: number;
    signature: IHyperLiquidSignatureRSV;
  }) {
    if (!signerAddress) {
      return;
    }
    try {
      // Get account info from current active perps account
      let accountId: string | undefined;
      let accountName: string | undefined;
      const activeAccount = await perpsActiveAccountAtom.get();
      if (activeAccount?.accountId) {
        accountId = activeAccount.accountId;
        const walletId = accountUtils.getWalletIdFromAccountId({
          accountId: activeAccount.accountId,
        });
        const [wallet, account] = await Promise.all([
          this.backgroundApi.serviceAccount.getWallet({ walletId }),
          this.backgroundApi.serviceAccount.getDBAccount({
            accountId: activeAccount.accountId,
          }),
        ]);
        if (wallet?.name && account?.name) {
          accountName = `${wallet.name} / ${account.name}`;
        } else if (account?.name) {
          accountName = account.name;
        }
      }

      const { serviceNotification } = this.backgroundApi;
      if (serviceNotification?.notifyHyperliquidAccountBind) {
        await serviceNotification.notifyHyperliquidAccountBind({
          signerAddress,
          action,
          nonce,
          signature,
          accountId,
          accountName,
        });
      }
    } catch (error) {
      console.error(
        '[ServiceHyperliquid] Failed to notify hyperliquid account bind:',
        error,
      );
    }
  }

  async getBuilderFeeConfig() {
    void this.updatePerpsConfigByServerSilently();
    let {
      hyperliquidBuilderAddress: expectBuilderAddress,
      hyperliquidMaxBuilderFee: expectMaxBuilderFee,
    } = await this.backgroundApi.simpleDb.perp.getPerpData();
    if (!expectMaxBuilderFee || expectMaxBuilderFee < 0) {
      expectMaxBuilderFee = 0;
    }
    if (!expectBuilderAddress) {
      expectBuilderAddress = '';
    }
    return {
      expectBuilderAddress: expectBuilderAddress.toLowerCase(),
      expectMaxBuilderFee,
    };
  }

  async dispose(): Promise<void> {
    // Cleanup resources if needed
  }

  @backgroundMethod()
  async disposeExchangeClients() {
    await this.exchangeService.dispose();
    await perpsActiveAccountStatusInfoAtom.set(
      (_prev): IPerpsActiveAccountStatusInfoAtom => ({
        accountAddress: null,
        details: {
          activatedOk: false,
          agentOk: false,
          builderFeeOk: false,
          referralCodeOk: false,
          internalRebateBoundOk: false,
          abstractionOk: false,
        },
      }),
    );
  }

  @backgroundMethod()
  async getTradingviewDisplayPriceScale(
    symbol: string,
  ): Promise<number | undefined> {
    return this.backgroundApi.simpleDb.perp.getTradingviewDisplayPriceScale(
      symbol,
    );
  }

  @backgroundMethod()
  async getTradingviewMidPrice(symbol: string): Promise<string | undefined> {
    if (!symbol) {
      return undefined;
    }

    const cachedMid = hyperLiquidCache.allMids?.mids?.[symbol];
    if (cachedMid) {
      return cachedMid;
    }
    if (
      hyperLiquidCache.allMids &&
      Date.now() - hyperLiquidCache.allMidsUpdatedAt <
        timerUtils.getTimeDurationMs({ seconds: 1 })
    ) {
      return undefined;
    }

    try {
      const { infoClient } = hyperLiquidApiClients;
      const allMids = await infoClient.allMids();
      hyperLiquidCache.allMids = {
        mids: allMids,
      };
      const mid = allMids[symbol];
      return typeof mid === 'string' ? mid : undefined;
    } catch (error) {
      console.error(
        '[ServiceHyperliquid] Failed to load tradingview mid price:',
        error,
      );
      return undefined;
    }
  }

  @backgroundMethod()
  async getPortfolioHistory({ address }: { address: string }) {
    const { infoClient } = hyperLiquidApiClients;
    return infoClient.portfolio({ user: address as IHex });
  }

  @backgroundMethod()
  async getPortfolioNetDeposits({
    address,
    startTime,
  }: {
    address: string;
    startTime: number;
  }) {
    const { infoClient } = hyperLiquidApiClients;
    return infoClient.userNonFundingLedgerUpdates({
      user: address as IHex,
      startTime,
    });
  }

  @backgroundMethod()
  async setTradingviewDisplayPriceScale({
    symbol,
    priceScale,
  }: {
    symbol: string;
    priceScale: number;
  }) {
    if (!symbol || priceScale === undefined || priceScale === null) {
      return;
    }
    const priceScaleBN = new BigNumber(priceScale);
    if (
      priceScaleBN.isNaN() ||
      priceScaleBN.isNegative() ||
      !priceScaleBN.isInteger()
    ) {
      return;
    }
    await this.backgroundApi.simpleDb.perp.updateTradingviewDisplayPriceScale({
      symbol,
      priceScale,
    });
  }
}
