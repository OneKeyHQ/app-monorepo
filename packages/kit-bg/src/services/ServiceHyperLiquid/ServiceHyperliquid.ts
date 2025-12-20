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
  PERPS_NETWORK_ID,
} from '@onekeyhq/shared/src/consts/perp';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import cacheUtils from '@onekeyhq/shared/src/utils/cacheUtils';
import perfUtils from '@onekeyhq/shared/src/utils/debug/perfUtils';
import { hyperLiquidErrorResolver } from '@onekeyhq/shared/src/utils/hyperLiquidErrorResolver';
import perpsUtils from '@onekeyhq/shared/src/utils/perpsUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IApiClientResponse } from '@onekeyhq/shared/types/endpoint';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import {
  XYZ_ASSET_ID_OFFSET,
  XYZ_DEX_PREFIX,
} from '@onekeyhq/shared/types/hyperliquid/perp.constants';
import type {
  IApiRequestError,
  IApiRequestResult,
  IFill,
  IHex,
  IMarginTable,
  IMarginTableMap,
  IPerpsActiveAssetData,
  IPerpsActiveAssetDataRaw,
  IPerpsAssetPosition,
  IPerpsUniverse,
  IUserFillsByTimeParameters,
  IUserFillsParameters,
  IWsActiveAssetCtx,
  IWsAllDexsClearinghouseState,
  IWsWebData2,
} from '@onekeyhq/shared/types/hyperliquid/sdk';
import type { IHyperLiquidSignatureRSV } from '@onekeyhq/shared/types/hyperliquid/webview';

import localDb from '../../dbs/local/localDb';
import {
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
  perpsTradesHistoryDataAtom,
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
import type { IAccountDeriveTypes } from '../../vaults/types';
import type { IHyperliquidMaxBuilderFee } from '../ServiceWebviewPerp';
import type {
  IPerpServerConfigResponse,
  IPerpServerDepositConfig,
} from '../ServiceWebviewPerp/ServiceWebviewPerp';

@backgroundClass()
export default class ServiceHyperliquid extends ServiceBase {
  public builderAddress: IHex = FALLBACK_BUILDER_ADDRESS;

  public maxBuilderFee: number = FALLBACK_MAX_BUILDER_FEE;

  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
    void this.init();
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
    const tokens = depositConfig.map((item) => item.tokens).flat();
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
  async updatePerpConfig({
    referrerConfig,
    customSettings,
    customLocalStorage,
    customLocalStorageV2,
    commonConfig,
    bannerConfig,
    depositTokenConfig,
    hyperLiquidErrorLocales,
  }: IPerpServerConfigResponse) {
    let shouldNotifyToDapp = false;

    // Check configVersion change before updating
    const prevConfig = await this.backgroundApi.simpleDb.perp.getPerpData();
    const prevConfigVersion = prevConfig.configVersion;
    const newConfigVersion = referrerConfig.configVersion;
    const isConfigVersionChanged =
      !isNil(newConfigVersion) && prevConfigVersion !== newConfigVersion;

    // If configVersion changed, remove all agent credentials
    if (isConfigVersionChanged) {
      console.log(
        '[ServiceHyperliquid] configVersion changed:',
        prevConfigVersion,
        '->',
        newConfigVersion,
        ', removing all agent credentials',
      );
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
          perpConfigCommon: {
            ...prev.perpConfigCommon,
            // usePerpWeb: true,
            usePerpWeb: commonConfig?.usePerpWeb,
            disablePerp: commonConfig?.disablePerp,
            disablePerpActionPerp: commonConfig?.disablePerpActionPerp,
            perpBannerConfig: bannerConfig,
            ipDisablePerp: commonConfig?.ipDisablePerp,
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
    const removedCount = await localDb.removeAllHyperLiquidAgentCredentials();
    console.log(
      '[ServiceHyperliquid] Removed',
      removedCount,
      'agent credentials',
    );

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
    await this.updatePerpConfig({
      referrerConfig: resData?.data?.referrerConfig,
      customSettings: resData?.data?.customSettings,
      customLocalStorage: resData?.data?.customLocalStorage,
      customLocalStorageV2: {
        ...HYPER_LIQUID_CUSTOM_LOCAL_STORAGE_V2_PRESET,
        ...resData?.data?.customLocalStorageV2,
      },
      commonConfig: resData?.data?.commonConfig,
      bannerConfig: resData?.data?.bannerConfig,
      depositTokenConfig: resData?.data?.depositTokenConfig,
      hyperLiquidErrorLocales: resData?.data?.hyperLiquidErrorLocales,
    });
    return resData;
  }

  @backgroundMethod()
  async updatePerpsConfigByServerWithCache() {
    return this._updatePerpsConfigByServerWithCache();
  }

  // TODO: Change maxAge back to { hour: 1 } before production release
  _updatePerpsConfigByServerWithCache = cacheUtils.memoizee(
    async () => {
      return this.updatePerpsConfigByServer();
    },
    {
      max: 20,
      maxAge: 0,
      promise: true,
    },
  );

  private _filterFills(fills: IFill[]) {
    return fills.filter(
      (fill) =>
        !fill.coin.startsWith('@') && fill.dir !== 'Sell' && fill.dir !== 'Buy',
    );
  }

  _getUserFillsByTimeMemo = cacheUtils.memoizee(
    async (params: IUserFillsByTimeParameters) => {
      const { infoClient } = hyperLiquidApiClients;
      const fills = await infoClient.userFillsByTime({
        ...params,
        aggregateByTime: true,
      });
      return this._filterFills(fills);
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
    return this._filterFills(fills);
  }

  @backgroundMethod()
  async getUserFillsByTimeWithCache(
    params: IUserFillsByTimeParameters,
  ): Promise<IFill[]> {
    return this._getUserFillsByTimeMemo(params);
  }

  @backgroundMethod()
  async loadTradesHistory(accountAddress: IHex): Promise<IFill[]> {
    const current = await perpsTradesHistoryDataAtom.get();

    if (
      current.isLoaded &&
      current.accountAddress?.toLowerCase() === accountAddress.toLowerCase()
    ) {
      return current.fills;
    }

    const now = Date.now();
    const historyDuration = timerUtils.getTimeDurationMs({ year: 2 });
    const twoYearsAgo = now - historyDuration;

    const fills = await this._getUserFillsByTimeMemo({
      user: accountAddress,
      startTime: twoYearsAgo,
      endTime: now,
      aggregateByTime: true,
    });

    const sorted = [...fills].sort((a, b) => b.time - a.time);

    await perpsTradesHistoryDataAtom.set({
      fills: sorted,
      isLoaded: true,
      latestTime: sorted[0]?.time ?? 0,
      accountAddress: accountAddress.toLowerCase(),
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

    const filtered = this._filterFills(newFills)
      .filter((f) => f.time > current.latestTime)
      .sort((a, b) => b.time - a.time);

    if (filtered.length === 0) {
      return;
    }

    await perpsTradesHistoryDataAtom.set({
      ...current,
      fills: [...filtered, ...current.fills],
      latestTime: Math.max(current.latestTime, filtered[0].time),
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
  async refreshTradingMeta() {
    const { infoClient } = hyperLiquidApiClients;
    // eslint-disable-next-line spellcheck/spell-checker
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
    const map: Partial<{
      [coin: string]: {
        coin: string;
        assetId: number;
        universe: IPerpsUniverse | undefined;
        marginTable: IMarginTable | undefined;
      };
    }> = {};
    coins.forEach((coin) => {
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

    const statePair = data.clearinghouseStates?.[0];
    const clearinghouseState = statePair?.[1];
    if (!clearinghouseState) {
      return;
    }

    const positions = (clearinghouseState?.assetPositions ||
      []) as IPerpsAssetPosition[];
    const totalUnrealizedPnlBN = positions.reduce(
      (sum: BigNumber, position: IPerpsAssetPosition) => {
        const pnl = position.position?.unrealizedPnl;
        return pnl ? sum.plus(pnl) : sum;
      },
      new BigNumber(0),
    );

    await perpsActiveAccountSummaryAtom.set({
      accountAddress: activeAddress as IHex,
      accountValue: clearinghouseState.marginSummary?.accountValue,
      totalMarginUsed: clearinghouseState.marginSummary?.totalMarginUsed,
      crossAccountValue: clearinghouseState.crossMarginSummary?.accountValue,
      crossMaintenanceMarginUsed: clearinghouseState.crossMaintenanceMarginUsed,
      totalNtlPos: clearinghouseState.marginSummary?.totalNtlPos,
      totalRawUsd: clearinghouseState.marginSummary?.totalRawUsd,
      withdrawable: clearinghouseState.withdrawable,
      totalUnrealizedPnl: totalUnrealizedPnlBN.toFixed(),
    });
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
            accountId: indexedAccountId ? undefined : accountId ?? undefined,
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

    await perpsActiveAccountAtom.set(perpsAccount);
    return perpsAccount;
  }

  @backgroundMethod()
  async changeActiveAsset(params: { coin: string }): Promise<{
    universeItems: IPerpsUniverse[];
    selectedUniverse: IPerpsUniverse | undefined;
  }> {
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
    const assetId =
      selectedUniverse?.assetId ??
      dexUniverses?.findIndex(
        (token) => token.name === selectedUniverse?.name,
      ) ??
      -1;
    const selectedMargin = dexMarginTables?.[selectedUniverse?.marginTableId];
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
  async checkPerpsAccountStatus({
    password,
    isEnableTradingTrigger = false,
  }: {
    password?: string;
    isEnableTradingTrigger?: boolean;
  } = {}): Promise<void> {
    const { infoClient } = hyperLiquidApiClients;
    const statusDetails: IPerpsActiveAccountStatusDetails = {
      activatedOk: false,
      agentOk: false,
      referralCodeOk: false,
      builderFeeOk: false,
      internalRebateBoundOk: false,
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

      // TODO reset exchange client if account not exists, or address not exists
      await this.exchangeService.setup({
        userAddress: accountAddress,
        userAccountId: selectedAccount.accountId ?? undefined,
      });

      if (!accountAddress) {
        throw new OneKeyLocalError(
          'Check perps account status ERROR: Account address is required',
        );
      }

      // eslint-disable-next-line no-param-reassign
      password =
        password ||
        (await this.backgroundApi.servicePassword.getCachedPassword());
      if (!password && isEnableTradingTrigger) {
        // eslint-disable-next-line no-param-reassign
        ({ password } =
          await this.backgroundApi.servicePassword.promptPasswordVerify());
      }

      if (password) {
        let isActivated = false;
        if (hyperLiquidCache?.activatedUser?.[accountAddress] === true) {
          isActivated = true;
        }
        if (!isActivated) {
          const userRole = await infoClient.userRole({
            user: accountAddress,
          });
          isActivated = userRole.role !== 'missing';
        }
        if (!isActivated) {
          statusDetails.activatedOk = false;
          // await this.checkBuilderFeeStatus({
          //   accountAddress,
          //   isEnableTradingTrigger,
          //   statusDetails,
          // });
        } else {
          hyperLiquidCache.activatedUser[accountAddress] = true;
          statusDetails.activatedOk = true;

          // Builder fee must be approved before agent setup
          await this.checkBuilderFeeStatus({
            accountAddress,
            isEnableTradingTrigger,
            statusDetails,
          });

          const isRebateBound =
            await this.checkInternalRebateBindingStatusWithCache({
              accountId: selectedAccount.accountId,
              accountAddress,
            });

          // Clear local credentials to force new agent creation for rebate binding
          if (!isRebateBound) {
            await this.clearLocalAgentCredentials({
              userAddress: accountAddress,
            });
            // Binding triggered via reportAgentApprovalToBackend after agent creation
            statusDetails.internalRebateBoundOk = false;
          } else {
            statusDetails.internalRebateBoundOk = true;
          }

          agentCredential = await this.checkAgentStatus({
            accountAddress,
            isEnableTradingTrigger,
            statusDetails,
            password,
          });

          if (agentCredential) {
            // TODO setupMasterWallet, setupAgentWallet
            await this.exchangeService.setup({
              userAddress: accountAddress,
              agentCredential,
            });

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
            statusDetails.internalRebateBoundOk = true;
            statusDetails.referralCodeOk = true;
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
    isEnableTradingTrigger,
    statusDetails,
    password,
  }: {
    accountAddress: IHex;
    isEnableTradingTrigger: boolean;
    statusDetails: IPerpsActiveAccountStatusDetails;
    password: string;
  }) {
    let agentCredential: ICoreHyperLiquidAgentCredential | undefined;
    const extraAgents = await this.fetchExtraAgentsWithCache({
      user: accountAddress,
    });
    if (extraAgents?.length) {
      const now = Date.now();
      const validAgents = (
        await Promise.all(
          extraAgents.map(async (agent) => {
            const credential = await localDb.getHyperLiquidAgentCredential({
              userAddress: accountAddress,
              agentName: agent.name as EHyperLiquidAgentName,
              password,
            });
            if (
              agent.address &&
              agent.validUntil >
                now +
                  timerUtils.getTimeDurationMs({
                    day: 1,
                  }) &&
              credential?.agentAddress?.toLowerCase() ===
                agent.address.toLowerCase()
            ) {
              credential.validUntil = agent.validUntil;
              return credential;
            }
            return null;
          }),
        )
      )
        .filter(Boolean)
        .sort((a, b) => b.validUntil - a.validUntil);
      agentCredential = validAgents?.[0];
    }
    if (!agentCredential && isEnableTradingTrigger) {
      this.fetchExtraAgentsWithCache.clear();
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
        ).sort((a, b) => a.validUntil - b.validUntil)?.[0];
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
            const approveAgentResult = await this.exchangeService.removeAgent({
              agentName: agentNameToRemove,
            });
            console.log('approveAgentResult::', approveAgentResult);
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
                  console.log('Agent removal confirmed:', agentNameToRemove);
                  break;
                }
              } catch (error) {
                console.log('Polling request failed:', error);
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
          agentName: agentNameToApproveWithValidUntil as EHyperLiquidAgentName,
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
          console.log('approveAgentError::', requestError);
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

      console.log('approveAgentResult::', approveAgentResult);
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
            password,
          });
          if (credential) {
            agentCredential = credential;
          }
        }
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
    isEnableTradingTrigger,
    statusDetails,
  }: {
    accountAddress: IHex;
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
      } else if (isEnableTradingTrigger) {
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
        console.log('approveBuilderFeeResult::', approveBuilderFeeResult);
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
    void this.updatePerpsConfigByServerWithCache();
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
