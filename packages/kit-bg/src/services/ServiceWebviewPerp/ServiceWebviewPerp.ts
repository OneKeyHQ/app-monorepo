import axios from 'axios';
import BigNumber from 'bignumber.js';
import { isNumber, isString } from 'lodash';
import pTimeout from 'p-timeout';

import {
  backgroundClass,
  backgroundMethod,
  toastIfError,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  HYPER_LIQUID_CUSTOM_LOCAL_STORAGE_V2_PRESET,
  HYPER_LIQUID_ORIGIN,
} from '@onekeyhq/shared/src/consts/perp';
import { OneKeyError } from '@onekeyhq/shared/src/errors';
import type { IOneKeyError } from '@onekeyhq/shared/src/errors/types/errorTypes';
import thirdpartyLocaleConverter from '@onekeyhq/shared/src/locale/thirdpartyLocaleConverter';
import type { ILocaleSymbol } from '@onekeyhq/shared/src/locale/type';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import cacheUtils from '@onekeyhq/shared/src/utils/cacheUtils';
import { extractHyperLiquidErrorMessage } from '@onekeyhq/shared/src/utils/hyperLiquidErrorResolver';
import type {
  ITokenSearchAliasItem,
  ITokenSearchAliases,
} from '@onekeyhq/shared/src/utils/perpsUtils';
import { promiseAllSettledEnhanced } from '@onekeyhq/shared/src/utils/promiseUtils';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { buildTokenSelectorDappTokenFilterParams } from '@onekeyhq/shared/src/utils/tokenSelectorFilterUtils';
import type {
  IHyperLiquidSignatureRSV,
  IHyperLiquidTypedDataApproveBuilderFee,
  IHyperLiquidUserBuilderFeeStatus,
} from '@onekeyhq/shared/types/hyperliquid';
import type {
  IHyperLiquidErrorLocaleItem,
  IPerpServerBannerConfig,
  IPerpsAssetMetaMap,
} from '@onekeyhq/shared/types/hyperliquid/types';
import type { IFetchAccountTokensResp } from '@onekeyhq/shared/types/token';

import {
  type IPerpsDepositNetwork,
  type IPerpsDepositToken,
  perpsDepositTokensAtom,
  settingsPersistAtom,
} from '../../states/jotai/atoms';
import ServiceBase from '../ServiceBase';
import { logHyperLiquidApiFailure } from '../ServiceHyperLiquid/utils/logHyperLiquidApiFailure';

import {
  buildPerpsDepositTokensByNetwork,
  buildPerpsDepositTokensFromWalletTokenResponses,
  filterPerpsDepositTokensByNetworkWithPositiveFiatValue,
  filterPerpsDepositTokensWithPositiveFiatValue,
  mergePerpsDepositTokensWithServerTokens,
  resolvePerpsDepositSelectedToken,
} from './utils/depositTokenListUtils';

import type { IHyperliquidCustomSettings } from '../../dbs/simple/entity/SimpleDbEntityPerp';
import type {
  IJsBridgeMessagePayload,
  IJsonRpcRequest,
} from '@onekeyfe/cross-inpage-provider-types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export interface IHyperliquidClearinghouseState {
  marginSummary: {
    accountValue: string;
    totalNtlPos: string;
    totalRawUsd: string;
    totalMarginUsed: string;
  };
  withdrawable: string;
  assetPositions: Array<{
    position: {
      coin: string;
      entryPx?: string;
      leverage: {
        type: string;
        value: number;
      };
      liquidationPx?: string;
      marginUsed: string;
      maxLeverage: number;
      positionValue: string;
      returnOnEquity: string;
      szi: string;
      unrealizedPnl: string;
    };
    type: string;
  }>;
  crossMaintenanceMarginUsed: string;
  crossMarginSummary: {
    accountValue: string;
    totalMarginUsed: string;
    totalNtlPos: string;
    totalRawUsd: string;
  };
  time: number;
}

export interface IHyperliquidSubAccount {
  name: string;
  subAccountUser: string;
  clearinghouseState: IHyperliquidClearinghouseState;
  spotState?: {
    balances: Array<{
      coin: string;
      total: string;
      hold: string;
    }>;
  };
}

export interface IHyperliquidUserFunding {
  coin: string;
  fundingRate: string;
  szi: string;
  usd: string;
  time: number;
}

export interface IHyperliquidLedgerUpdate {
  coin?: string;
  delta: string;
  hash: string;
  time: number;
  type: string;
}

export interface IHyperliquidVaultEquity {
  allTime: {
    pnl: string;
    vlm: string;
  };
  day: {
    pnl: string;
    vlm: string;
  };
  totalDeposited: string;
  totalWithdrawn: string;
  vault: string;
  vaultAddress: string;
  withdrawable: string;
}

export type IHyperliquidMaxBuilderFee = number;

export interface IHyperliquidUserFeesDailyVolume {
  date: string;
  userCross: string;
  userAdd: string;
  exchange: string;
}

export interface IHyperliquidUserFeesVipTier {
  ntlCutoff: string;
  cross: string;
  add: string;
  spotCross: string;
  spotAdd: string;
}

export interface IHyperliquidUserFeesStakingDiscountTier {
  bpsOfMaxSupply: string;
  discount: string;
}

export interface IHyperliquidUserFeesResponse {
  dailyUserVlm: IHyperliquidUserFeesDailyVolume[];
  feeSchedule: {
    cross: string;
    add: string;
    spotCross: string;
    spotAdd: string;
    tiers: {
      vip: IHyperliquidUserFeesVipTier[];
      mm?: {
        makerFractionCutoff: string;
        add: string;
      }[];
    };
    referralDiscount?: string;
    stakingDiscountTiers?: IHyperliquidUserFeesStakingDiscountTier[];
  };
  userCrossRate: string;
  userAddRate: string;
  userSpotCrossRate?: string;
  userSpotAddRate?: string;
  activeReferralDiscount?: string;
  activeStakingDiscount?: IHyperliquidUserFeesStakingDiscountTier | null;
  trial?: unknown;
  feeTrialEscrow?: string;
  nextTrialAvailableTimestamp?: number | null;
  stakingLink?: unknown;
}

export interface IHyperliquidApproveBuilderFeeRequest {
  userAddress: string;
  builderAddress: string;
  maxFeeRate: string;
  signature: IHyperLiquidSignatureRSV;
  nonce: number;
  vaultAddress?: string | null;
}

export interface IHyperliquidExchangeResponse {
  status: string;
  response: {
    type: string;
    data?: any;
  };
}

export enum EPerpDefaultTabType {
  Native = 'native',
  Web = 'web',
}
export type { IPerpServerBannerConfig };

export interface IPerpServerDepositConfig {
  network: IPerpsDepositNetwork;
  tokens: IPerpsDepositToken[];
}

export interface IPerpServerDepositTokenByNetworkConfig {
  contractAddress: string;
  name: string;
  symbol: string;
  decimals: number;
  logoURI: string;
  isNative: boolean;
  isDefault?: boolean;
}

export type IPerpServerDepositTokensByNetworkConfig = Record<
  string,
  IPerpServerDepositTokenByNetworkConfig[]
>;

export interface IPerpServerReferrerConfig {
  referrerAddress?: string;
  referrerRate?: number;
  agentTTL?: number;
  referralCode?: string;
  configVersion?: string;
}

export interface IPerpServerCommonConfig {
  usePerpWeb?: boolean;
  disablePerp?: boolean;
  disablePerpActionPerp?: boolean;
  ipDisablePerp?: boolean;
}

export interface IPerpDynamicTab {
  tabId: string;
  name: string;
  tokens: string[];
}

// Re-export types from perpsUtils for backward compatibility
export type { ITokenSearchAliasItem, ITokenSearchAliases };

export interface IPerpServerActivityCard {
  id: string;
  imageUrl?: string;
  iconName?: string;
  title: string;
  subtitle: string;
  url: string;
}

export interface IPerpServerConfigResponse {
  referrerConfig: IPerpServerReferrerConfig;
  customSettings?: IHyperliquidCustomSettings;
  customLocalStorage?: Record<string, any>;
  customLocalStorageV2?: Record<
    string,
    {
      value: any;
      skipIfExists?: boolean;
    }
  >;
  commonConfig?: IPerpServerCommonConfig;
  bannerConfig?: IPerpServerBannerConfig;
  depositTokenConfig?: IPerpServerDepositConfig[];
  depositTokensByNetwork?: IPerpServerDepositTokensByNetworkConfig;
  hyperLiquidErrorLocales?: IHyperLiquidErrorLocaleItem[];
  tokenSearchAliases?: ITokenSearchAliases;
  tokenSelectorTabs?: IPerpDynamicTab[];
  perpsAssetMetaMap?: IPerpsAssetMetaMap;
  activityCards?: IPerpServerActivityCard[];
}

export interface IFetchPerpsDepositTokensFromWalletTokenListParams {
  accountId: string;
  indexedAccountId?: string;
  forceRefresh?: boolean;
}

export interface IFetchPerpsDepositTokensFromWalletTokenListResult {
  ownerKey: string;
  tokens: IPerpsDepositToken[];
  tokensByNetwork: Record<string, IPerpsDepositToken[]>;
  selectedToken?: IPerpsDepositToken;
  isStale?: boolean;
}

interface IPerpsDepositTokenListData {
  ownerKey: string;
  tokens: IPerpsDepositToken[];
  tokensByNetwork: Record<string, IPerpsDepositToken[]>;
}

interface IPerpsDepositTokenListCacheParams {
  ownerKey: string;
  allNetworksAccountId: string;
  ownerIndexId?: string;
  supportedNetworkIds: string[];
}

interface IPerpsDepositTokenListCacheEntry {
  createdAt: number;
  promise: Promise<IPerpsDepositTokenListData>;
}

const PERPS_DEPOSIT_TOKEN_LIST_CACHE_TTL_MS = timerUtils.getTimeDurationMs({
  seconds: 60,
});
const PERPS_DEPOSIT_TOKEN_LIST_COLD_CACHE_MAX_AGE_MS =
  timerUtils.getTimeDurationMs({
    day: 1,
  });

@backgroundClass()
class ServiceWebviewPerp extends ServiceBase {
  private perpsDepositTokenListCache = new Map<
    string,
    IPerpsDepositTokenListCacheEntry
  >();

  private perpsDepositTokenListWriteGenerations = new Map<string, number>();

  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  @backgroundMethod()
  async initializePerpConfig() {
    // TODO init by server api
  }

  private isValidIndexedAccountId(indexedAccountId: string | undefined) {
    if (!indexedAccountId) {
      return false;
    }
    const { walletId, index } = accountUtils.parseIndexedAccountId({
      indexedAccountId,
    });
    return Boolean(walletId) && Number.isFinite(index);
  }

  private getIndexedAccountIdForAllNetworks({
    accountId,
    indexedAccountId,
  }: {
    accountId: string;
    indexedAccountId: string | undefined;
  }) {
    if (this.isValidIndexedAccountId(indexedAccountId)) {
      return indexedAccountId;
    }

    if (this.isValidIndexedAccountId(accountId)) {
      return accountId;
    }

    const resolvedIndexedAccountId =
      accountUtils.buildAllNetworkIndexedAccountIdFromAccountId({
        accountId,
      });
    return this.isValidIndexedAccountId(resolvedIndexedAccountId)
      ? resolvedIndexedAccountId
      : indexedAccountId;
  }

  private async normalizePerpsDepositAllNetworksOwner({
    accountId,
    indexedAccountId,
  }: IFetchPerpsDepositTokensFromWalletTokenListParams) {
    if (accountUtils.isOthersAccount({ accountId })) {
      return { accountId, indexedAccountId };
    }

    const allNetworksIndexedAccountId = this.getIndexedAccountIdForAllNetworks({
      accountId,
      indexedAccountId,
    });
    if (!allNetworksIndexedAccountId) {
      return { accountId, indexedAccountId };
    }

    const allNetworksAccount =
      await this.backgroundApi.serviceAccount.getMockedAllNetworkAccount({
        indexedAccountId: allNetworksIndexedAccountId,
      });

    return {
      accountId: allNetworksAccount.id,
      indexedAccountId: allNetworksIndexedAccountId,
    };
  }

  private buildPerpsDepositTokenListCacheKey({
    ownerKey,
    supportedNetworkIds,
  }: IPerpsDepositTokenListCacheParams) {
    return `${ownerKey}::${supportedNetworkIds.join(',')}`;
  }

  private getPerpsDepositTokenListWriteGeneration(cacheKey: string) {
    return this.perpsDepositTokenListWriteGenerations.get(cacheKey) ?? 0;
  }

  private bumpPerpsDepositTokenListWriteGeneration(cacheKey: string) {
    const writeGeneration =
      this.getPerpsDepositTokenListWriteGeneration(cacheKey) + 1;
    this.perpsDepositTokenListWriteGenerations.set(cacheKey, writeGeneration);
    return writeGeneration;
  }

  private isPerpsDepositTokenListWriteGenerationCurrent({
    cacheKey,
    writeGeneration,
  }: {
    cacheKey: string;
    writeGeneration: number;
  }) {
    return (
      this.getPerpsDepositTokenListWriteGeneration(cacheKey) === writeGeneration
    );
  }

  private buildPerpsDepositTokenListOwnerKey({
    allNetworksAccountId,
    ownerIndexId,
  }: Pick<
    IPerpsDepositTokenListCacheParams,
    'allNetworksAccountId' | 'ownerIndexId'
  >) {
    return `${allNetworksAccountId}::${ownerIndexId ?? ''}`;
  }

  private async setPerpsDepositTokenListActiveOwner(ownerKey: string) {
    await perpsDepositTokensAtom.set((prev) => {
      if (prev.depositTokenListOwnerKey === ownerKey) {
        return prev;
      }
      const emptyTokensByNetwork = Object.fromEntries(
        Object.keys(prev.tokens).map((networkId) => [networkId, []]),
      );
      return {
        ...prev,
        tokens: emptyTokensByNetwork,
        depositTokenListOwnerKey: ownerKey,
        currentPerpsDepositSelectedToken: undefined,
        depositTokenListRevision: (prev.depositTokenListRevision ?? 0) + 1,
        depositTokenListSource: undefined,
      };
    });
  }

  private getPerpsDepositTokenListDataMemoryCache(
    params: IPerpsDepositTokenListCacheParams,
  ): Promise<IPerpsDepositTokenListData> | undefined {
    const cacheKey = this.buildPerpsDepositTokenListCacheKey(params);
    const cached = this.perpsDepositTokenListCache.get(cacheKey);
    if (
      cached &&
      Date.now() - cached.createdAt < PERPS_DEPOSIT_TOKEN_LIST_CACHE_TTL_MS
    ) {
      return cached.promise;
    }
    return undefined;
  }

  private async fetchPerpsDepositTokenListDataUncached({
    ownerKey,
    allNetworksAccountId,
    ownerIndexId,
    supportedNetworkIds,
  }: IPerpsDepositTokenListCacheParams): Promise<IPerpsDepositTokenListData> {
    if (!supportedNetworkIds.length) {
      return {
        ownerKey,
        tokens: [],
        tokensByNetwork: {},
      };
    }

    const walletTokenFilterParams = buildTokenSelectorDappTokenFilterParams({
      lpToken: false,
    });
    const requestFactories = supportedNetworkIds.map(
      (networkId) => async () => {
        const defaultDeriveType =
          await this.backgroundApi.serviceNetwork.getGlobalDeriveTypeOfNetwork({
            networkId,
          });
        const networkAccount =
          await this.backgroundApi.serviceAccount.getNetworkAccount({
            accountId: ownerIndexId ? undefined : allNetworksAccountId,
            indexedAccountId: ownerIndexId,
            networkId,
            deriveType: defaultDeriveType ?? 'default',
          });

        return this.backgroundApi.serviceToken.fetchAccountTokens({
          accountId: networkAccount.id,
          networkId,
          indexedAccountId: ownerIndexId,
          flag: 'perps-deposit-token-list',
          mergeTokens: true,
          saveToLocal: false,
          hideSmallBalanceTokens: true,
          hideRiskTokens: true,
          ...walletTokenFilterParams,
        });
      },
    );

    const settledResponses = await promiseAllSettledEnhanced(requestFactories, {
      continueOnError: true,
      concurrency: 3,
    });
    const responses = settledResponses.filter(
      (response): response is IFetchAccountTokensResp => Boolean(response),
    );
    const { networks } =
      await this.backgroundApi.serviceNetwork.getNetworksByIds({
        networkIds: supportedNetworkIds,
      });
    const networkLogoURIByNetworkId = Object.fromEntries(
      networks.map((network: { id: string; logoURI?: string }) => [
        network.id,
        network.logoURI,
      ]),
    );
    const tokens = buildPerpsDepositTokensFromWalletTokenResponses({
      responses,
      networkLogoURIByNetworkId,
    });
    const walletTokensByNetwork = buildPerpsDepositTokensByNetwork(tokens);
    const tokensByNetwork = supportedNetworkIds.reduce<
      Record<string, IPerpsDepositToken[]>
    >((memo, networkId) => {
      memo[networkId] = walletTokensByNetwork[networkId] ?? [];
      return memo;
    }, {});
    return {
      ownerKey,
      tokens,
      tokensByNetwork,
    };
  }

  private fetchPerpsDepositTokenListDataCached(
    params: IPerpsDepositTokenListCacheParams,
    options: {
      cacheKey: string;
      writeGeneration: number;
    },
  ): Promise<IPerpsDepositTokenListData> {
    const cacheKey = this.buildPerpsDepositTokenListCacheKey(params);
    const now = Date.now();
    const cached = this.getPerpsDepositTokenListDataMemoryCache(params);

    if (cached) {
      return cached;
    }

    const promise = this.fetchPerpsDepositTokenListDataUncached(params)
      .then((data) => {
        if (
          this.isPerpsDepositTokenListWriteGenerationCurrent({
            cacheKey: options.cacheKey,
            writeGeneration: options.writeGeneration,
          })
        ) {
          void this.backgroundApi.simpleDb.perp.setPerpsDepositTokenListCache({
            cacheKey,
            ownerKey: data.ownerKey,
            tokens: data.tokens,
            tokensByNetwork: data.tokensByNetwork,
          });
        }
        return data;
      })
      .catch((error: unknown) => {
        const current = this.perpsDepositTokenListCache.get(cacheKey);
        if (current?.promise === promise) {
          this.perpsDepositTokenListCache.delete(cacheKey);
        }
        throw error;
      });
    this.perpsDepositTokenListCache.set(cacheKey, {
      createdAt: now,
      promise,
    });
    return promise;
  }

  private async updatePerpsDepositTokenListAtom(
    { ownerKey, tokens, tokensByNetwork }: IPerpsDepositTokenListData,
    options?: {
      cacheKey: string;
      writeGeneration: number;
    },
  ) {
    let selectedToken: IPerpsDepositToken | undefined;
    let isStale = false;
    let mergedTokens = tokens;
    let mergedTokensByNetwork = tokensByNetwork;

    if (
      options &&
      !this.isPerpsDepositTokenListWriteGenerationCurrent(options)
    ) {
      return {
        tokens: mergedTokens,
        tokensByNetwork: mergedTokensByNetwork,
        selectedToken,
        isStale: true,
      };
    }

    await perpsDepositTokensAtom.set((prev) => {
      if (prev.depositTokenListOwnerKey !== ownerKey) {
        isStale = true;
        return prev;
      }
      mergedTokens = mergePerpsDepositTokensWithServerTokens({
        walletTokens: tokens,
        serverTokens: prev.serverTokens,
      });
      const groupedTokens = buildPerpsDepositTokensByNetwork(mergedTokens);
      mergedTokensByNetwork = Object.fromEntries(
        Array.from(
          new Set([
            ...Object.keys(tokensByNetwork),
            ...Object.keys(groupedTokens),
          ]),
        ).map((networkId) => [networkId, groupedTokens[networkId] ?? []]),
      );
      selectedToken = resolvePerpsDepositSelectedToken({
        tokens: mergedTokens,
        currentToken: prev.currentPerpsDepositSelectedToken,
        defaultTokens: prev.defaultTokens,
        preserveCurrentToken: prev.depositTokenListSource === 'walletBalance',
      });
      return {
        ...prev,
        tokens: mergedTokensByNetwork,
        currentPerpsDepositSelectedToken: selectedToken,
        depositTokenListOwnerKey: ownerKey,
        depositTokenListRevision: (prev.depositTokenListRevision ?? 0) + 1,
        depositTokenListSource: 'walletBalance',
      };
    });

    return {
      tokens: mergedTokens,
      tokensByNetwork: mergedTokensByNetwork,
      selectedToken,
      isStale,
    };
  }

  private refreshPerpsDepositTokenListDataInBackground(
    params: IPerpsDepositTokenListCacheParams,
    options: {
      cacheKey: string;
      writeGeneration: number;
    },
  ) {
    void this.fetchPerpsDepositTokenListDataCached(params, options)
      .then((data) => this.updatePerpsDepositTokenListAtom(data, options))
      .catch((error: unknown) => {
        console.error(
          '[ServiceWebviewPerp] Failed to refresh perps deposit tokens:',
          error,
        );
      });
  }

  @backgroundMethod()
  async fetchPerpsDepositTokensFromWalletTokenList({
    accountId,
    indexedAccountId,
    forceRefresh,
  }: IFetchPerpsDepositTokensFromWalletTokenListParams): Promise<IFetchPerpsDepositTokensFromWalletTokenListResult> {
    const { accountId: allNetworksAccountId, indexedAccountId: ownerIndexId } =
      await this.normalizePerpsDepositAllNetworksOwner({
        accountId,
        indexedAccountId,
      });
    const ownerKey = this.buildPerpsDepositTokenListOwnerKey({
      allNetworksAccountId,
      ownerIndexId,
    });
    const currentDepositTokens = await perpsDepositTokensAtom.get();
    const supportedNetworkIds = Object.keys(
      currentDepositTokens.tokens,
    ).toSorted();
    const cacheParams = {
      ownerKey,
      allNetworksAccountId,
      ownerIndexId,
      supportedNetworkIds,
    };
    await this.setPerpsDepositTokenListActiveOwner(ownerKey);

    const cacheKey = this.buildPerpsDepositTokenListCacheKey(cacheParams);
    let writeGeneration =
      this.getPerpsDepositTokenListWriteGeneration(cacheKey);
    if (forceRefresh) {
      writeGeneration = this.bumpPerpsDepositTokenListWriteGeneration(cacheKey);
      this.perpsDepositTokenListCache.delete(cacheKey);
      const writeOptions = { cacheKey, writeGeneration };
      const data = await this.fetchPerpsDepositTokenListDataCached(
        cacheParams,
        writeOptions,
      );
      const updateResult = await this.updatePerpsDepositTokenListAtom(
        data,
        writeOptions,
      );
      return {
        ...data,
        ...updateResult,
      };
    }

    const memoryCache =
      this.getPerpsDepositTokenListDataMemoryCache(cacheParams);
    if (memoryCache) {
      const writeOptions = { cacheKey, writeGeneration };
      const data = await memoryCache;
      const updateResult = await this.updatePerpsDepositTokenListAtom(
        data,
        writeOptions,
      );
      return {
        ...data,
        ...updateResult,
      };
    }

    const coldCache =
      await this.backgroundApi.simpleDb.perp.getPerpsDepositTokenListCache({
        cacheKey,
        maxAgeMs: PERPS_DEPOSIT_TOKEN_LIST_COLD_CACHE_MAX_AGE_MS,
      });

    if (coldCache) {
      const data = {
        ownerKey: coldCache.ownerKey ?? ownerKey,
        tokens: filterPerpsDepositTokensWithPositiveFiatValue(coldCache.tokens),
        tokensByNetwork: filterPerpsDepositTokensByNetworkWithPositiveFiatValue(
          coldCache.tokensByNetwork,
        ),
      };
      const updateResult = await this.updatePerpsDepositTokenListAtom(data, {
        cacheKey,
        writeGeneration,
      });
      this.refreshPerpsDepositTokenListDataInBackground(cacheParams, {
        cacheKey,
        writeGeneration,
      });
      return {
        ...data,
        ...updateResult,
      };
    }

    const writeOptions = { cacheKey, writeGeneration };
    const data = await this.fetchPerpsDepositTokenListDataCached(
      cacheParams,
      writeOptions,
    );
    const updateResult = await this.updatePerpsDepositTokenListAtom(
      data,
      writeOptions,
    );

    return {
      ...data,
      ...updateResult,
    };
  }

  private resolveHyperliquidRequestAction(
    endpoint: string,
    body: Record<string, unknown>,
  ) {
    if (typeof body.type === 'string') {
      return body.type;
    }
    const { action } = body;
    if (
      isRecord(action) &&
      'type' in action &&
      typeof action.type === 'string'
    ) {
      return action.type;
    }
    return endpoint;
  }

  private async hyperliquidRequestBase<T>(
    endpoint: string,
    body: Record<string, unknown>,
  ): Promise<T> {
    const logEndpoint = endpoint === 'exchange' ? 'exchange' : 'info';
    const action = this.resolveHyperliquidRequestAction(endpoint, body);
    try {
      const response = await axios.post<T>(
        `https://api.hyperliquid.xyz/${endpoint}`,
        body,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
      const responseDataWithError = response.data as {
        response: string | object;
        status: 'err' | 'ok';
      };
      // response: "Must deposit before performing actions. User: 0x00"
      // status: "err"
      if (responseDataWithError?.status === 'err') {
        const errorMessage: string =
          typeof responseDataWithError.response === 'string'
            ? responseDataWithError.response
            : stringUtils.stableStringify(responseDataWithError.response);
        const err = new OneKeyError(errorMessage);
        await logHyperLiquidApiFailure({
          endpoint: logEndpoint,
          action,
          request: body,
          response: responseDataWithError,
          error: err,
          extra: { source: 'ServiceWebviewPerp' },
        });
        throw err;
      }
      return response.data;
    } catch (error) {
      if (error && axios.isAxiosError(error)) {
        await logHyperLiquidApiFailure({
          endpoint: logEndpoint,
          action,
          request: body,
          error,
          extra: { source: 'ServiceWebviewPerp' },
        });
        const extractedMessage = extractHyperLiquidErrorMessage(error);
        if (extractedMessage && extractedMessage !== error.message) {
          throw new OneKeyError(extractedMessage);
        }

        const errorMessage = `Hyperliquid API error 8712: ${[
          error?.name,
          error?.code,
          error?.message,
          error?.response?.status,
          error?.response?.statusText,
          isString(error?.response?.data) ? error?.response?.data : undefined,
        ]
          .filter(Boolean)
          .join(',')}`;

        throw new OneKeyError(errorMessage);
      }
      const e = error as IOneKeyError | undefined;
      if (e instanceof OneKeyError) {
        throw e;
      }
      await logHyperLiquidApiFailure({
        endpoint: logEndpoint,
        action,
        request: body,
        error,
        extra: { source: 'ServiceWebviewPerp' },
      });
      throw new OneKeyError(
        `Hyperliquid API error 6632: ${[
          e?.name,
          e?.code,
          e?.message,
          e?.className,
        ]
          .filter(Boolean)
          .join(',')}`,
      );
    }
  }

  private async hyperliquidInfoRequest<T>(
    body: Record<string, unknown>,
  ): Promise<T> {
    return this.hyperliquidRequestBase<T>('info', body);
  }

  private async hyperliquidExchangeRequest<T>(
    body: Record<string, unknown>,
  ): Promise<T> {
    return this.hyperliquidRequestBase<T>('exchange', body);
  }

  @backgroundMethod()
  async getClearinghouseState({
    userAddress,
  }: {
    userAddress: string;
  }): Promise<IHyperliquidClearinghouseState> {
    return this.hyperliquidInfoRequest<IHyperliquidClearinghouseState>({
      type: 'clearinghouseState',
      user: userAddress.toLowerCase(),
    });
  }

  @backgroundMethod()
  async getSubAccounts({
    userAddress,
  }: {
    userAddress: string;
  }): Promise<IHyperliquidSubAccount[]> {
    return this.hyperliquidInfoRequest<IHyperliquidSubAccount[]>({
      type: 'subAccounts',
      user: userAddress.toLowerCase(),
    });
  }

  @backgroundMethod()
  async getUserFunding({
    userAddress,
    startTime,
    endTime,
  }: {
    userAddress: string;
    startTime: number;
    endTime?: number;
  }): Promise<IHyperliquidUserFunding[]> {
    const requestBody: Record<string, any> = {
      type: 'userFunding',
      user: userAddress.toLowerCase(),
      startTime,
    };

    if (endTime !== undefined) {
      requestBody.endTime = endTime;
    }

    return this.hyperliquidInfoRequest<IHyperliquidUserFunding[]>(requestBody);
  }

  @backgroundMethod()
  async getUserNonFundingLedgerUpdates({
    userAddress,
    startTime,
    endTime,
  }: {
    userAddress: string;
    startTime: number;
    endTime?: number;
  }): Promise<IHyperliquidLedgerUpdate[]> {
    const requestBody: Record<string, any> = {
      type: 'userNonFundingLedgerUpdates',
      user: userAddress.toLowerCase(),
      startTime,
    };

    if (endTime !== undefined) {
      requestBody.endTime = endTime;
    }

    return this.hyperliquidInfoRequest<IHyperliquidLedgerUpdate[]>(requestBody);
  }

  @backgroundMethod()
  async getUserVaultEquities({
    userAddress,
  }: {
    userAddress: string;
  }): Promise<IHyperliquidVaultEquity[]> {
    return this.hyperliquidInfoRequest<IHyperliquidVaultEquity[]>({
      type: 'userVaultEquities',
      user: userAddress.toLowerCase(),
    });
  }

  @backgroundMethod()
  async getUserApprovedMaxBuilderFee({
    userAddress,
    builderAddress,
  }: {
    userAddress: string;
    builderAddress: string;
  }): Promise<IHyperliquidMaxBuilderFee> {
    return this.hyperliquidInfoRequest<IHyperliquidMaxBuilderFee>({
      type: 'maxBuilderFee',
      user: userAddress.toLowerCase(),
      builder: builderAddress.toLowerCase(),
    });
  }

  @backgroundMethod()
  async getUserFees({
    userAddress,
  }: {
    userAddress: string;
  }): Promise<IHyperliquidUserFeesResponse> {
    return this.hyperliquidInfoRequest<IHyperliquidUserFeesResponse>({
      type: 'userFees',
      user: userAddress.toLowerCase(),
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
      maxAge: timerUtils.getTimeDurationMs({ hour: 1 }),
      promise: true,
    },
  );

  clearUserApprovedMaxBuilderCache() {
    this.getUserApprovedMaxBuilderFeeWithCache.clear();
  }

  @backgroundMethod()
  async getAccountBalance({ userAddress }: { userAddress: string }): Promise<{
    accountValue: string;
    withdrawable: string;
    totalMarginUsed: string;
    totalNtlPos: string;
  }> {
    const clearinghouse = await this.getClearinghouseState({ userAddress });
    return {
      accountValue: clearinghouse.marginSummary.accountValue,
      withdrawable: clearinghouse.withdrawable,
      totalMarginUsed: clearinghouse.marginSummary.totalMarginUsed,
      totalNtlPos: clearinghouse.marginSummary.totalNtlPos,
    };
  }

  @backgroundMethod()
  async getOpenPositions({
    userAddress,
  }: {
    userAddress: string;
  }): Promise<IHyperliquidClearinghouseState['assetPositions']> {
    const clearinghouse = await this.getClearinghouseState({ userAddress });
    return clearinghouse.assetPositions.filter(
      (position) => parseFloat(position.position.szi) !== 0,
    );
  }

  @backgroundMethod()
  async getAccountSummary({ userAddress }: { userAddress: string }): Promise<{
    balance: {
      accountValue: string;
      withdrawable: string;
      totalMarginUsed: string;
      totalNtlPos: string;
    };
    openPositions: IHyperliquidClearinghouseState['assetPositions'];
    subAccounts: IHyperliquidSubAccount[];
  }> {
    const [balance, openPositions, subAccounts] = await Promise.all([
      this.getAccountBalance({ userAddress }),
      this.getOpenPositions({ userAddress }),
      this.getSubAccounts({ userAddress }),
    ]);

    return {
      balance,
      openPositions,
      subAccounts,
    };
  }

  @backgroundMethod()
  async createApproveBuilderFeePayload({
    builderAddress,
    maxFeeRate,
    chainId,
  }: {
    builderAddress: string;
    maxFeeRate: string;
    chainId: string; // 0xa4b1 Arbitrum hex chainId
  }): Promise<{
    apiPayload: Record<string, any>;
    typedData: IHyperLiquidTypedDataApproveBuilderFee;
  }> {
    const nonce = Date.now();
    // Create EIP-712 typed data for signing
    const typedData: IHyperLiquidTypedDataApproveBuilderFee = {
      domain: {
        name: 'HyperliquidSignTransaction',
        version: '1',
        chainId: new BigNumber(chainId).toNumber(), // 42161
        verifyingContract: '0x0000000000000000000000000000000000000000',
      },
      message: {
        maxFeeRate,
        builder: builderAddress?.toLowerCase(),
        nonce,
        hyperliquidChain: 'Mainnet', // TODO testnet support
        signatureChainId: chainId,
        type: 'approveBuilderFee', // TODO type is only to api
      },
      primaryType: 'HyperliquidTransaction:ApproveBuilderFee',
      types: {
        EIP712Domain: [
          { name: 'name', type: 'string' },
          { name: 'version', type: 'string' },
          { name: 'chainId', type: 'uint256' },
          { name: 'verifyingContract', type: 'address' },
        ],
        'HyperliquidTransaction:ApproveBuilderFee': [
          { name: 'hyperliquidChain', type: 'string' },
          { name: 'maxFeeRate', type: 'string' },
          { name: 'builder', type: 'address' },
          { name: 'nonce', type: 'uint64' },
        ],
      },
    };

    const apiPayload = {
      action: typedData.message,
      nonce,
      signature: null,
      vaultAddress: null,
    };

    return {
      apiPayload,
      typedData,
    };
  }

  parseSignatureToRSV(signature: string): IHyperLiquidSignatureRSV {
    // Remove 0x prefix if present
    const cleanSig = signature.replace(/^0x/, '');

    // Extract r, s, v components
    const r = `0x${cleanSig.slice(0, 64)}`;
    const s = `0x${cleanSig.slice(64, 128)}`;
    const v = parseInt(cleanSig.slice(128, 130), 16);

    return { r, s, v };
  }

  async callEthereumProviderMethod<T>(data: IJsonRpcRequest) {
    const resp = await this.backgroundApi.handleProviderMethods<T>({
      scope: 'ethereum',
      origin: HYPER_LIQUID_ORIGIN,
      data,
    });
    return resp;
  }

  @backgroundMethod()
  @toastIfError()
  async approveBuilderFeeIfRequired({
    request: _request,
    userAddress,
    chainId,
    skipApproveAction,
  }: {
    request: IJsBridgeMessagePayload;
    userAddress: string;

    // oxlint-disable-next-line @cspell/spellchecker
    chainId: string; // 0xa4b1 Arbitrum hex chainId
    skipApproveAction?: boolean;
  }): Promise<IHyperLiquidUserBuilderFeeStatus> {
    const status = await this.getUserBuilderFeeStatus({
      userAddress,
    });
    if (
      !skipApproveAction &&
      status.expectBuilderAddress &&
      isNumber(status.expectMaxBuilderFee) &&
      status.expectMaxBuilderFee >= 0 &&
      !status.isApprovedDone &&
      status.canSetBuilderFee
    ) {
      this.clearUserApprovedMaxBuilderCache();
      const { apiPayload, typedData } =
        await this.createApproveBuilderFeePayload({
          builderAddress: status.expectBuilderAddress,
          // expectMaxBuilderFee is 13, but we need to convert it to a string like 0.013%
          maxFeeRate: `${new BigNumber(status.expectMaxBuilderFee)
            .div(1000)
            .toFixed(3)}%`,
          chainId,
        });
      const resp = await this.callEthereumProviderMethod<string>({
        method: 'eth_signTypedData_v4',
        params: [userAddress, stringUtils.stableStringify(typedData)],
      });
      const signature = resp.result;
      const rsv = this.parseSignatureToRSV(signature);
      apiPayload.signature = rsv;
      try {
        const p =
          this.hyperliquidExchangeRequest<IHyperliquidExchangeResponse>(
            apiPayload,
          );
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const response = await pTimeout(p, {
          milliseconds: 5000,
        });
        return status;
      } catch (_e) {
        return { ...status, expectBuilderAddress: '', expectMaxBuilderFee: 0 };
      }
    }
    return status;
  }

  @backgroundMethod()
  async connectToDapp() {
    const resp = await this.callEthereumProviderMethod<string[]>({
      method: 'eth_requestAccounts',
      params: [],
    });
    return resp.result as string[];
  }

  @backgroundMethod()
  async disconnectFromDapp() {
    await this.backgroundApi.serviceDApp.disconnectWebsite({
      origin: HYPER_LIQUID_ORIGIN,
      storageType: 'injectedProvider',
      entry: 'Browser',
    });
  }

  isLocaleUpdatedByDappDone = false;

  @backgroundMethod()
  async getBuilderFeeConfig() {
    void this.backgroundApi.serviceHyperliquid.updatePerpsConfigByServerSilently();
    // try {
    //   const p = this.updateBuilderFeeConfigByServer();
    //   await pTimeout(p, {
    //     milliseconds: 1000,
    //   });
    // } catch (error) {
    //   console.error(error);
    // }
    const shouldModifyPlaceOrderPayload = true;

    /* eslint-disable prefer-const */
    let {
      hyperliquidCustomSettings,
      hyperliquidCustomLocalStorage,
      hyperliquidCustomLocalStorageV2,
      hyperliquidBuilderAddress: expectBuilderAddress,
      hyperliquidMaxBuilderFee: expectMaxBuilderFee,
    } = await this.backgroundApi.simpleDb.perp.getPerpData();
    /* eslint-enable prefer-const */
    if (!expectMaxBuilderFee || expectMaxBuilderFee < 0) {
      expectMaxBuilderFee = 0;
    }
    if (!expectBuilderAddress) {
      expectBuilderAddress = '';
    }
    let locale: ILocaleSymbol | undefined;
    let storedLocale: ILocaleSymbol | undefined;
    let localeStr = '';
    if (!this.isLocaleUpdatedByDappDone) {
      ({ locale: storedLocale } = await settingsPersistAtom.get());
      locale = await this.backgroundApi.serviceSetting.getCurrentLocale();
      if (locale) {
        localeStr =
          thirdpartyLocaleConverter.toHyperLiquidWebDappLocale(locale);
      }
      this.isLocaleUpdatedByDappDone = true;
    }
    const customLocalStorage: Record<string, any> = {
      'hyperliquid.coin_selector.tab': `"perps"`, // "perps", "all", "spot"
      ...hyperliquidCustomLocalStorage,
    };
    if (localeStr) {
      // hyperliquid.locale-setting: "zh-CN"
      customLocalStorage['hyperliquid.locale-setting'] = `"${localeStr}"`;
    }
    return {
      locale: localeStr,
      storedLocale,
      customLocalStorage,
      customLocalStorageV2: {
        ...HYPER_LIQUID_CUSTOM_LOCAL_STORAGE_V2_PRESET,
        ...hyperliquidCustomLocalStorageV2,
      },
      expectBuilderAddress,
      expectMaxBuilderFee,
      shouldModifyPlaceOrderPayload,
      customSettings: hyperliquidCustomSettings,
    };
  }

  async getUserBuilderFeeStatus({
    userAddress,
  }: {
    userAddress: string;
  }): Promise<IHyperLiquidUserBuilderFeeStatus> {
    const {
      expectBuilderAddress,
      expectMaxBuilderFee,
      shouldModifyPlaceOrderPayload,
    } = await this.getBuilderFeeConfig();
    let currentMaxBuilderFee: number | null = null;
    let isApprovedDone = false;
    let canSetBuilderFee = false;
    let accountValue: string | null = null;
    // let isGetApprovedMaxBuilderFeeTimeout = false;

    if (expectBuilderAddress) {
      try {
        const p = this.getUserApprovedMaxBuilderFeeWithCache({
          userAddress,
          builderAddress: expectBuilderAddress,
        });
        currentMaxBuilderFee = await pTimeout(p, {
          milliseconds: 8000,
        });
        // const shouldModifyPlaceOrderPayload = false;
        if (currentMaxBuilderFee === expectMaxBuilderFee) {
          isApprovedDone = true;
          canSetBuilderFee = true;
          accountValue = null;
        }
      } catch (error) {
        console.error('getUserApprovedMaxBuilderFeeWithCache ERROR: ', error);
      }
    }

    if (!isApprovedDone) {
      try {
        const p = this.getAccountBalance({
          userAddress,
        });

        ({ accountValue } = await pTimeout(p, {
          milliseconds: 5000,
        }));

        // TODO new address value check
        canSetBuilderFee = Number(accountValue) >= 0;
      } catch (error) {
        console.error('getAccountBalance ERROR: ', error);
      }
    }

    return {
      isApprovedDone,
      canSetBuilderFee,
      currentMaxBuilderFee,
      expectMaxBuilderFee: canSetBuilderFee ? expectMaxBuilderFee : 0,
      expectBuilderAddress: canSetBuilderFee ? expectBuilderAddress : '',
      accountValue,
      shouldModifyPlaceOrderPayload,
    };
  }

  lastExtPerpTab: chrome.tabs.Tab | undefined;

  @backgroundMethod()
  async openExtPerpTab() {
    if (platformEnv.isExtension) {
      // this.lastExtPerpTab = await extUtils.openUrlInTab(
      //   HYPER_LIQUID_WEBVIEW_TRADE_URL,
      //   {
      //     tabId: this.lastExtPerpTab?.id,
      //   },
      // );
      this.lastExtPerpTab =
        await this.backgroundApi.serviceApp.openExtensionExpandTab({
          // routes: [ERootRoutes.Main, ETabRoutes.Perp], // not working for extension
          path: '/perps',
        });
    }
  }
}

export default ServiceWebviewPerp;
