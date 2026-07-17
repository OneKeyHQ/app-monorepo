import { useRef } from 'react';

import BigNumber from 'bignumber.js';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ESwapDirection } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/SwapPanel/hooks/useTradeType';
import type { useSwapAddressInfo } from '@onekeyhq/kit/src/views/Swap/hooks/useSwapAccount';
import { buildSwapDefaultSelectedTokensForNetwork } from '@onekeyhq/kit/src/views/Swap/utils/swapColdStartTokenCacheUtils';
import {
  removeSwapNoConnectWalletAlerts,
  shouldShowSwapAccountUnsupportedAlert,
} from '@onekeyhq/kit/src/views/Swap/utils/swapNoWalletWarningGuard';
import { buildSwapRateDifference } from '@onekeyhq/kit/src/views/Swap/utils/swapRateDifferenceUtils';
import {
  isUSMarketStatusStockTokenSource,
  shouldCheckSwapWarningUSMarketClosed,
} from '@onekeyhq/kit/src/views/Swap/utils/usMarketStatusUtils';
import { moveNetworkToFirst } from '@onekeyhq/kit/src/views/Swap/utils/utils';
import {
  currencyPersistAtom,
  settingsAtom,
  settingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { USD_CURRENCY_ID } from '@onekeyhq/shared/src/consts/currencyConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IEventSourceMessageEvent } from '@onekeyhq/shared/src/eventSource';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { memoFn } from '@onekeyhq/shared/src/utils/cacheUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import { equalsIgnoreCase } from '@onekeyhq/shared/src/utils/stringUtils';
import { getVisibleSwapTabSwitchType } from '@onekeyhq/shared/src/utils/swapTypeUtils';
import {
  buildSwapAllNetworkTokenListCacheKey,
  isTokenSelectorDappTokenFilterSupportedNetworkBase,
} from '@onekeyhq/shared/src/utils/tokenSelectorFilterUtils';
import {
  checkWrappedTokenPair,
  equalTokenNoCaseSensitive,
} from '@onekeyhq/shared/src/utils/tokenUtils';
import {
  getSwapBridgeDefaultToToken,
  swapDefaultSetTokens,
  swapTokenCatchMapMaxCount,
} from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type {
  IFetchQuoteResult,
  IFetchQuotesParams,
  IFetchSwapQuoteParams,
  IFetchTokensParams,
  ISwapAlertActionData,
  ISwapAlertState,
  ISwapNetwork,
  ISwapPreSwapData,
  ISwapQuoteEvent,
  ISwapQuoteEventAutoSlippage,
  ISwapQuoteEventError,
  ISwapQuoteEventInfo,
  ISwapQuoteEventQuoteResult,
  ISwapQuoteSessionEventV2,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';
import {
  EProtocolOfExchange,
  ESwapAlertActionType,
  ESwapAlertLevel,
  ESwapDirectionType,
  ESwapFetchCancelCause,
  ESwapLimitOrderMarketPriceUpdateInterval,
  ESwapProTradeType,
  ESwapQuoteKind,
  ESwapSlippageSegmentKey,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';

import { ContextJotaiActionsBase } from '../../utils/ContextJotaiActionsBase';

import {
  type ISwapQuoteEventErrorState,
  SWAP_PRO_POSITIONS_CACHE_MAX_OWNERS,
  buildSwapProPositionsOwnerKey,
  contextAtomMethod,
  limitOrderMarketPriceAtom,
  rateDifferenceAtom,
  swapAlertsAtom,
  swapAllNetworkActionLockAtom,
  swapAllNetworkTokenListMapAtom,
  swapAmountInputTabSessionAtom,
  swapAutoSlippageSuggestedValueAtom,
  swapBuildTxFetchingAtom,
  swapFromTokenAmountAtom,
  swapInitialSelectedTokensSyncedAtom,
  swapLastNonLimitSelectedTokensAtom,
  swapLimitExpirationTimeAtom,
  swapLimitPartiallyFillAtom,
  swapLimitPriceUseRateAtom,
  swapManualSelectQuoteProvidersAtom,
  swapNetworks,
  swapNetworksIncludeAllNetworkAtom,
  swapProDirectionAtom,
  swapProInputAmountAtom,
  swapProPositionsCacheAtom,
  swapProPositionsRequestStateAtom,
  swapProSelectTokenAtom,
  swapProSellToTokenAtom,
  swapProSliderValueAtom,
  swapProSupportNetworksTokenListAtom,
  swapProSupportNetworksTokenListLoadingAtom,
  swapProTokenDetailWebsocketAtom,
  swapProTokenMarketDetailInfoAtom,
  swapProTokenMarketDetailInfoLoadingAtom,
  swapProTokenMarketDetailPerpsInfoAtom,
  swapProTradeTypeAtom,
  swapProUseSelectBuyTokenAtom,
  swapQuoteActionLockAtom,
  swapQuoteCommittedStateAtom,
  swapQuoteCurrentEventListAtom,
  swapQuoteCurrentEventProviderKeysAtom,
  swapQuoteCurrentEventReceivedCountAtom,
  swapQuoteCurrentSelectAtom,
  swapQuoteEventCompletedAtom,
  swapQuoteEventErrorAtom,
  swapQuoteEventTotalCountAtom,
  swapQuoteFetchingAtom,
  swapQuoteIntervalCountAtom,
  swapQuoteListAtom,
  swapQuoteSessionStateAtom,
  swapQuoteStreamingCurrentSelectAtom,
  swapSelectFromTokenAtom,
  swapSelectToTokenAtom,
  swapSelectTokenDetailFetchingAtom,
  swapSelectedFromTokenBalanceAtom,
  swapSelectedToTokenBalanceAtom,
  swapSelectedTokensColdStartContextAtom,
  swapShouldRefreshQuoteAtom,
  swapSilenceQuoteLoading,
  swapSpeedQuoteFetchingAtom,
  swapSpeedQuoteResultAtom,
  swapSpeedQuoteSessionStateAtom,
  swapStockExecutionTokenSyncIdAtom,
  swapStockExecutionTokensAtom,
  swapStockSelectedFromTokenBalanceAtom,
  swapStockSelectedTokenAtom,
  swapToTokenAmountAtom,
  swapTokenDetailRequestStateAtom,
  swapTokenFetchingAtom,
  swapTokenMapAtom,
  swapTokenMetadataAtom,
  swapTypeSwitchAtom,
} from './atoms';
import {
  ESwapQuoteCommitPhase,
  reduceSwapQuoteCommittedState,
} from './quoteCommittedState';
import {
  SWAP_INCOGNITO_QUOTE_PROVIDER_COUNT_CAP,
  buildSwapQuoteProviderKey,
  getSwapQuoteEventProgressTotalCount,
  getSwapQuoteProgressState,
  hasSwapZeroProviderQuoteEvent,
  isSwapQuoteActionable,
  isSwapQuoteEventFetching,
} from './quoteProgress';
import {
  type ISwapQuoteLimitSemanticSettings,
  buildSwapQuoteLimitSemanticSettings,
  buildSwapQuoteLimitSemanticSettingsKey,
} from './quoteSemanticIntent';
import {
  acceptSwapQuoteSessionEvent,
  applySwapQuoteSessionStartResult,
  buildSwapQuoteDisplayIntentFingerprint,
  invalidateSwapQuoteSession,
  parseSwapQuoteEventDataSafe,
  prepareSwapQuoteSession,
} from './quoteSessionV2';
import {
  buildSwapSpeedQuoteCancelParams,
  invalidateSwapSpeedQuoteSession,
  isCurrentSwapSpeedQuoteResult,
  prepareSwapSpeedQuoteSession,
  settleSwapSpeedQuoteSession,
} from './speedQuoteSessionV2';
import {
  buildSwapTokenDetailRequestKey,
  isCurrentSwapTokenDetailRequest,
  startSwapTokenDetailRequest,
} from './tokenDetailRequest';

function isQuoteResultSelectedTokenPair({
  quoteResult,
  fromToken,
  toToken,
}: {
  quoteResult?: IFetchQuoteResult;
  fromToken?: ISwapToken;
  toToken?: ISwapToken;
}) {
  return Boolean(
    quoteResult &&
    fromToken &&
    toToken &&
    equalTokenNoCaseSensitive({
      token1: quoteResult.fromTokenInfo,
      token2: fromToken,
    }) &&
    equalTokenNoCaseSensitive({
      token1: quoteResult.toTokenInfo,
      token2: toToken,
    }),
  );
}

function isStockProtocol(protocol?: string) {
  return (
    protocol === ESwapTabSwitchType.STOCK ||
    protocol === EProtocolOfExchange.STOCK
  );
}

function isSameSwapAmountValue({
  currentAmount,
  eventAmount,
}: {
  currentAmount?: string;
  eventAmount?: string;
}) {
  if (eventAmount === undefined) {
    return true;
  }
  const normalizedCurrentAmount = currentAmount ?? '';
  if (!eventAmount && !normalizedCurrentAmount) {
    return true;
  }
  const eventAmountBN = new BigNumber(eventAmount);
  const currentAmountBN = new BigNumber(normalizedCurrentAmount);
  if (
    eventAmountBN.isFinite() &&
    !eventAmountBN.isNaN() &&
    currentAmountBN.isFinite() &&
    !currentAmountBN.isNaN()
  ) {
    return eventAmountBN.eq(currentAmountBN);
  }
  return eventAmount === normalizedCurrentAmount;
}

function isQuoteEventErrorSelectedTokenPair({
  fromTokenAmount,
  quoteEventError,
  fromToken,
  toToken,
}: {
  fromTokenAmount?: string;
  quoteEventError?: ISwapQuoteEventErrorState;
  fromToken?: ISwapToken;
  toToken?: ISwapToken;
}) {
  return Boolean(
    quoteEventError &&
    fromToken &&
    toToken &&
    equalTokenNoCaseSensitive({
      token1: quoteEventError.fromToken,
      token2: fromToken,
    }) &&
    equalTokenNoCaseSensitive({
      token1: quoteEventError.toToken,
      token2: toToken,
    }) &&
    (!quoteEventError.isStock ||
      isSameSwapAmountValue({
        currentAmount: fromTokenAmount,
        eventAmount: quoteEventError.fromTokenAmount,
      })),
  );
}

function isCurrentStockQuoteEventParams({
  currentSwapType,
  fromToken,
  fromTokenAmount,
  params,
  toToken,
  tokenPairs,
}: {
  currentSwapType: ESwapTabSwitchType;
  fromToken?: ISwapToken;
  fromTokenAmount?: string;
  params: IFetchQuotesParams;
  toToken?: ISwapToken;
  tokenPairs: { fromToken: ISwapToken; toToken: ISwapToken };
}) {
  if (!isStockProtocol(params.protocol)) {
    return true;
  }
  const isSameTokenPair =
    equalTokenNoCaseSensitive({
      token1: tokenPairs.fromToken,
      token2: fromToken,
    }) &&
    equalTokenNoCaseSensitive({
      token1: tokenPairs.toToken,
      token2: toToken,
    });
  const isSameFromAmount = isSameSwapAmountValue({
    currentAmount: fromTokenAmount,
    eventAmount: params.fromTokenAmount,
  });
  return (
    currentSwapType === ESwapTabSwitchType.STOCK &&
    isSameTokenPair &&
    isSameFromAmount
  );
}

function isStockExecutionTokensReady({
  currentSyncId,
  executionTokens,
  fromToken,
  toToken,
}: {
  currentSyncId: number;
  executionTokens?: {
    syncId: number;
    fromToken: ISwapToken;
    toToken: ISwapToken;
  };
  fromToken?: ISwapToken;
  toToken?: ISwapToken;
}) {
  return Boolean(
    executionTokens &&
    executionTokens.syncId === currentSyncId &&
    equalTokenNoCaseSensitive({
      token1: executionTokens.fromToken,
      token2: fromToken,
    }) &&
    equalTokenNoCaseSensitive({
      token1: executionTokens.toToken,
      token2: toToken,
    }),
  );
}

function hasLimitDefaultTokenPair(networkId?: string) {
  const defaultTokenSet = networkId
    ? swapDefaultSetTokens[networkId]
    : undefined;

  return Boolean(
    defaultTokenSet?.limitFromToken && defaultTokenSet?.limitToToken,
  );
}

function getLimitDefaultNetworkId({
  allowStaticFallback,
  preferredNetworkId,
  swapSupportNetworks,
}: {
  allowStaticFallback?: boolean;
  preferredNetworkId?: string;
  swapSupportNetworks: ISwapNetwork[];
}) {
  if (
    preferredNetworkId &&
    hasLimitDefaultTokenPair(preferredNetworkId) &&
    (allowStaticFallback ||
      swapSupportNetworks.some((net) => net.networkId === preferredNetworkId))
  ) {
    return preferredNetworkId;
  }

  const runtimeLimitDefaultNetworkId = swapSupportNetworks.find((net) =>
    hasLimitDefaultTokenPair(net.networkId),
  )?.networkId;
  if (runtimeLimitDefaultNetworkId) {
    return runtimeLimitDefaultNetworkId;
  }

  if (allowStaticFallback) {
    return Object.keys(swapDefaultSetTokens).find(hasLimitDefaultTokenPair);
  }

  return undefined;
}

class ContentJotaiActionsSwap extends ContextJotaiActionsBase {
  private quoteInterval: ReturnType<typeof setTimeout> | undefined;

  private stockTokenCheckCache = new Map<string, Promise<boolean>>();

  private usMarketStatusCache:
    | {
        expiresAt: number;
        promise: ReturnType<
          typeof backgroundApiProxy.serviceSwap.fetchCheckUSMarketStatus
        >;
      }
    | undefined;

  private limitOrderMarketPriceInterval:
    | ReturnType<typeof setTimeout>
    | undefined;

  private limitOrderMarketPriceRequestId = 0;

  /**
   * Execute promises in batches with concurrency control to prevent overwhelming the system
   * This fixes iOS app hangs when fetching token lists for multiple networks simultaneously
   * @param tasks - Array of promise-returning functions to execute
   * @param concurrency - Maximum number of concurrent promises (default: 3)
   * @returns Array of settled results
   */
  private async executeBatched<T>(
    tasks: Array<() => Promise<T>>,
    concurrency = 3,
  ): Promise<Array<PromiseSettledResult<T>>> {
    const results: Array<PromiseSettledResult<T>> = [];

    for (let i = 0; i < tasks.length; i += concurrency) {
      const batch = tasks.slice(i, i + concurrency);
      const batchResults = await Promise.allSettled(
        batch.map((task) => task()),
      );
      results.push(...batchResults);
    }

    return results;
  }

  // Set swap pro select token with persistence
  // If token is provided: set to atom and save to db
  // If token is not provided: load from db, if db is empty, use defaultToken
  setSwapProSelectToken = contextAtomMethod(
    async (get, set, token?: ISwapToken, defaultToken?: ISwapToken) => {
      // Remove realtime properties before saving to db
      const getTokenForStorage = (t: ISwapToken): ISwapToken => {
        const {
          balanceParsed,
          price,
          fiatValue,
          reservationValue,
          accountAddress,
          ...rest
        } = t;
        return rest;
      };

      if (token) {
        set(swapProSelectTokenAtom(), token);
        await backgroundApiProxy.simpleDb.swapProSelectToken.setSwapProSelectToken(
          getTokenForStorage(token),
        );
      } else {
        const savedToken =
          await backgroundApiProxy.simpleDb.swapProSelectToken.getSwapProSelectToken();
        if (savedToken) {
          set(swapProSelectTokenAtom(), savedToken);
        } else if (defaultToken) {
          set(swapProSelectTokenAtom(), defaultToken);
          await backgroundApiProxy.simpleDb.swapProSelectToken.setSwapProSelectToken(
            getTokenForStorage(defaultToken),
          );
        }
      }
    },
  );

  syncNetworksSort = contextAtomMethod(async (get, set, netWorkId: string) => {
    if (!netWorkId) return;
    const networks = get(swapNetworks());
    const sortNetworks = moveNetworkToFirst(networks, netWorkId);
    set(swapNetworks(), sortNetworks);
    await backgroundApiProxy.simpleDb.swapNetworksSort.setRawData({
      data: sortNetworks,
    });
  });

  cleanManualSelectQuoteProviders = contextAtomMethod((get, set) => {
    set(swapManualSelectQuoteProvidersAtom(), undefined);
  });

  reconcileManualSelectQuoteProviders = contextAtomMethod((get, set) => {
    const selectionIntent = get(swapManualSelectQuoteProvidersAtom());
    if (selectionIntent?.type !== 'manual-provider') {
      return;
    }

    const currentEventProviderKeys = get(
      swapQuoteCurrentEventProviderKeysAtom(),
    );
    const quoteEventTotalCount = get(swapQuoteEventTotalCountAtom());
    const selectedProviderKey = buildSwapQuoteProviderKey(selectionIntent);
    const hasActionableSelectedProvider = get(
      swapQuoteCurrentEventListAtom(),
    ).some(
      (quote) =>
        buildSwapQuoteProviderKey(quote) === selectedProviderKey &&
        isSwapQuoteActionable(quote),
    );
    if (
      quoteEventTotalCount.count === 0 ||
      !currentEventProviderKeys.includes(selectedProviderKey) ||
      !hasActionableSelectedProvider
    ) {
      set(swapManualSelectQuoteProvidersAtom(), undefined);
    }
  });

  catchSwapTokensMap = contextAtomMethod(
    async (get, set, key: string, tokens: ISwapToken[]) => {
      const swapTokenMap = get(swapTokenMapAtom());
      const swapNetworksList = get(swapNetworks());
      const catchTokens = swapTokenMap.tokenCatch?.[key];
      const dateNow = Date.now();
      let catchCount = 0;
      const newTokens = tokens.map((token) => {
        const network = swapNetworksList.find(
          (n) => n.networkId === token.networkId,
        );
        if (network) {
          token.networkLogoURI = network.logoURI;
        }
        return token;
      });
      if (swapTokenMap.tokenCatch && catchTokens?.data) {
        // have catch
        if (JSON.stringify(catchTokens.data) !== JSON.stringify(newTokens)) {
          // catch data not equal
          const newTokenCatch = { ...swapTokenMap.tokenCatch };
          newTokenCatch[key] = {
            data: newTokens,
            updatedAt: dateNow,
          };
          swapTokenMap.tokenCatch = { ...newTokenCatch };
        }
        catchCount = Object.keys(swapTokenMap.tokenCatch).length;
      } else {
        // no catch
        swapTokenMap.tokenCatch = {
          ...swapTokenMap.tokenCatch,
          [key]: { data: newTokens, updatedAt: dateNow },
        };
        catchCount = Object.keys(swapTokenMap.tokenCatch).length;
      }
      if (swapTokenMap.tokenCatch && catchCount > swapTokenCatchMapMaxCount) {
        // clean old catch
        const oldUpdatedAtKey = Object.entries(swapTokenMap.tokenCatch).reduce(
          (min, [mapKey, obj]) =>
            obj.updatedAt < (swapTokenMap.tokenCatch?.[min]?.updatedAt ?? 0)
              ? mapKey
              : min,
          Object.keys(swapTokenMap.tokenCatch)[0],
        );
        if (oldUpdatedAtKey) {
          delete swapTokenMap.tokenCatch[oldUpdatedAtKey];
        }
      }
      set(swapTokenMapAtom(), { ...swapTokenMap, updatedAt: dateNow });
    },
  );

  needChangeToken = ({
    token,
    toToken,
    swapTypeSwitchValue,
  }: {
    token: ISwapToken;
    swapTypeSwitchValue: ESwapTabSwitchType;
    toToken?: ISwapToken;
  }) => {
    if (
      token.networkId !== toToken?.networkId &&
      swapTypeSwitchValue === ESwapTabSwitchType.LIMIT
    ) {
      const defaultTokenSet = swapDefaultSetTokens[token.networkId];
      if (defaultTokenSet?.limitToToken && defaultTokenSet?.limitFromToken) {
        if (
          equalTokenNoCaseSensitive({
            token1: defaultTokenSet?.limitToToken,
            token2: token,
          }) &&
          !equalTokenNoCaseSensitive({
            token1: defaultTokenSet?.limitFromToken,
            token2: token,
          })
        ) {
          return defaultTokenSet?.limitFromToken;
        }
        return defaultTokenSet?.limitToToken;
      }
      return undefined;
    }
    if (
      token.networkId !== toToken?.networkId &&
      swapTypeSwitchValue === ESwapTabSwitchType.SWAP
    ) {
      if (!toToken) {
        const defaultTokenSet = swapDefaultSetTokens[token.networkId];
        if (
          token.isNative &&
          defaultTokenSet?.toToken &&
          !defaultTokenSet?.toToken?.isNative
        ) {
          return defaultTokenSet?.toToken;
        }
        if (
          !token.isNative &&
          defaultTokenSet?.fromToken &&
          defaultTokenSet?.fromToken?.isNative
        ) {
          return defaultTokenSet?.fromToken;
        }
      }
      return null;
    }
    if (
      swapTypeSwitchValue === ESwapTabSwitchType.BRIDGE &&
      (token.networkId === toToken?.networkId || !toToken)
    ) {
      return getSwapBridgeDefaultToToken(token);
    }

    return null;
  };

  resetSwapTokenData = contextAtomMethod(async (get, set, type) => {
    if (type === ESwapDirectionType.FROM) {
      set(swapSelectFromTokenAtom(), undefined);
      set(swapSelectedFromTokenBalanceAtom(), '');
    } else {
      set(swapSelectToTokenAtom(), undefined);
      set(swapSelectedToTokenBalanceAtom(), '');
    }
    set(swapStockExecutionTokensAtom(), undefined);
    set(swapQuoteListAtom(), []);
    set(rateDifferenceAtom(), undefined);
  });

  selectFromToken = contextAtomMethod(
    async (
      get,
      set,
      token: ISwapToken,
      disableCheckToToken?: boolean,
      skipCleanManualSelectQuoteProviders?: boolean,
      skipCheckEqualToken?: boolean,
    ) => {
      const toToken = get(swapSelectToTokenAtom());
      if (
        !skipCheckEqualToken &&
        equalTokenNoCaseSensitive({
          token1: toToken,
          token2: token,
        })
      ) {
        return;
      }
      const swapTypeSwitchValue = get(swapTypeSwitchAtom());
      if (!skipCleanManualSelectQuoteProviders) {
        this.cleanManualSelectQuoteProviders.call(set);
      }
      await this.syncNetworksSort.call(set, token.networkId);
      const needChangeToToken = this.needChangeToken({
        token,
        swapTypeSwitchValue,
        toToken,
      });
      if (needChangeToToken !== null && !disableCheckToToken) {
        set(swapSelectFromTokenAtom(), token);
        set(swapSelectToTokenAtom(), needChangeToToken);
      } else {
        set(swapSelectFromTokenAtom(), token);
      }
    },
  );

  selectToToken = contextAtomMethod(
    async (
      get,
      set,
      token: ISwapToken,
      skipCleanManualSelectQuoteProviders?: boolean,
      skipCheckEqualToken?: boolean,
    ) => {
      if (!skipCleanManualSelectQuoteProviders) {
        this.cleanManualSelectQuoteProviders.call(set);
      }
      const fromToken = get(swapSelectFromTokenAtom());
      if (
        !skipCheckEqualToken &&
        equalTokenNoCaseSensitive({
          token1: fromToken,
          token2: token,
        })
      ) {
        return;
      }
      await this.syncNetworksSort.call(set, token.networkId);
      set(swapSelectToTokenAtom(), token);
    },
  );

  selectStockExecutionTokens = contextAtomMethod(
    async (
      get,
      set,
      {
        fromToken,
        toToken,
        syncId,
      }: {
        fromToken?: ISwapToken;
        toToken?: ISwapToken;
        syncId: number;
      },
    ) => {
      set(swapStockExecutionTokenSyncIdAtom(), syncId);
      if (fromToken) {
        set(swapSelectFromTokenAtom(), fromToken);
      }
      if (toToken) {
        set(swapSelectToTokenAtom(), toToken);
      }
      let stockSelectedToken: ISwapToken | undefined;
      if (fromToken?.isStock) {
        stockSelectedToken = fromToken;
      } else if (toToken?.isStock) {
        stockSelectedToken = toToken;
      }
      if (stockSelectedToken) {
        set(swapStockSelectedTokenAtom(), stockSelectedToken);
      }
      if (fromToken && toToken) {
        set(swapStockExecutionTokensAtom(), {
          syncId,
          fromToken,
          toToken,
        });
      } else {
        set(swapStockExecutionTokensAtom(), undefined);
      }

      const networkIds = Array.from(
        new Set(
          [fromToken?.networkId, toToken?.networkId].filter(
            (networkId): networkId is string => !!networkId,
          ),
        ),
      );
      for (const networkId of networkIds) {
        await this.syncNetworksSort.call(set, networkId);
        if (get(swapStockExecutionTokenSyncIdAtom()) !== syncId) {
          return;
        }
      }
    },
  );

  alternationToken = contextAtomMethod((get, set) => {
    const fromToken = get(swapSelectFromTokenAtom());
    const toToken = get(swapSelectToTokenAtom());
    if (!fromToken && !toToken) {
      return;
    }
    set(swapSelectFromTokenAtom(), toToken);
    set(swapSelectToTokenAtom(), fromToken);
    this.cleanManualSelectQuoteProviders.call(set);
  });

  tokenListFetchAction = contextAtomMethod(
    async (get, set, params: IFetchTokensParams) => {
      try {
        if (!params.networkId) return;
        set(swapTokenFetchingAtom(), true);
        const protocol = get(swapTypeSwitchAtom());
        const result = await backgroundApiProxy.serviceSwap.fetchSwapTokens({
          ...params,
          protocol,
        });
        if (result.length > 0) {
          await this.catchSwapTokensMap.call(
            set,
            JSON.stringify(params),
            result,
          );
        }
        set(swapTokenFetchingAtom(), false);
      } catch (e: any) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (e?.cause !== ESwapFetchCancelCause.SWAP_TOKENS_CANCEL) {
          set(swapTokenFetchingAtom(), false);
        }
      }
    },
  );

  quoteEventHandler = contextAtomMethod(
    (
      get,
      set,
      event: {
        event: ISwapQuoteEvent;
        type: 'done' | 'close' | 'error' | 'message' | 'open';
        params: IFetchQuotesParams;
        tokenPairs: { fromToken: ISwapToken; toToken: ISwapToken };
        accountId?: string;
        skipTransportCancel?: boolean;
      },
    ) => {
      if (
        !isCurrentStockQuoteEventParams({
          currentSwapType: get(swapTypeSwitchAtom()),
          fromToken: get(swapSelectFromTokenAtom()),
          fromTokenAmount: get(swapFromTokenAmountAtom()).value,
          params: event.params,
          toToken: get(swapSelectToTokenAtom()),
          tokenPairs: event.tokenPairs,
        })
      ) {
        return;
      }
      switch (event.type) {
        case 'open': {
          break;
        }
        case 'message': {
          const { data } = event.event as IEventSourceMessageEvent;
          if (data) {
            const dataJson = parseSwapQuoteEventDataSafe(data);
            if (!dataJson) {
              break;
            }
            const errorData = dataJson as ISwapQuoteEventError;
            if (errorData?.errorMessage) {
              const isStockQuoteEventError =
                Boolean(errorData.isStock) ||
                isStockProtocol(event.params.protocol);
              const errorAlert: ISwapAlertState = {
                message: errorData.errorMessage,
                alertLevel: ESwapAlertLevel.ERROR,
              };
              set(swapQuoteListAtom(), []);
              set(swapQuoteCurrentEventProviderKeysAtom(), []);
              set(swapQuoteCurrentEventReceivedCountAtom(), 0);
              set(swapQuoteEventCompletedAtom(), true);
              set(swapQuoteEventTotalCountAtom(), {
                eventId: errorData.eventId,
                count: 0,
              });
              set(swapQuoteFetchingAtom(), false);
              set(swapQuoteEventErrorAtom(), {
                message: errorData.errorMessage,
                fromToken: event.tokenPairs.fromToken,
                toToken: event.tokenPairs.toToken,
                fromTokenAmount: event.params.fromTokenAmount,
                isStock: isStockQuoteEventError,
                isMarketOpen: errorData.isMarketOpen,
                eventId: errorData.eventId,
              });
              set(swapAlertsAtom(), {
                states: isStockQuoteEventError ? [] : [errorAlert],
                quoteId: '',
              });
              this.reconcileManualSelectQuoteProviders.call(set);
              const activeSession = get(
                swapQuoteSessionStateAtom(),
              ).activeSession;
              if (activeSession) {
                set(swapQuoteCommittedStateAtom(), (state) =>
                  reduceSwapQuoteCommittedState(state, {
                    type: 'requestFailed',
                    intentFingerprint: activeSession.fingerprint,
                    requestId: activeSession.requestId,
                  }),
                );
              }
              set(swapQuoteActionLockAtom(), (v) => ({
                ...v,
                actionLock: false,
              }));
              if (!event.skipTransportCancel) {
                this.closeQuoteEvent.call(set);
              }
              break;
            }
            const autoSlippageData = dataJson as ISwapQuoteEventAutoSlippage;
            if (autoSlippageData?.autoSuggestedSlippage) {
              const {
                autoSuggestedSlippage,
                eventId,
                fromNetworkId,
                fromTokenAddress,
                toNetworkId,
                toTokenAddress,
              } = autoSlippageData;
              const quoteResult = get(swapQuoteListAtom());
              const quoteUpdateSlippage = quoteResult.map((quotRes) => {
                if (
                  equalTokenNoCaseSensitive({
                    token1: quotRes.fromTokenInfo,
                    token2: {
                      networkId: fromNetworkId,
                      contractAddress: fromTokenAddress,
                    },
                  }) &&
                  equalTokenNoCaseSensitive({
                    token1: quotRes.toTokenInfo,
                    token2: {
                      networkId: toNetworkId,
                      contractAddress: toTokenAddress,
                    },
                  }) &&
                  quotRes.eventId === eventId &&
                  !quotRes.autoSuggestedSlippage
                ) {
                  return {
                    ...quotRes,
                    autoSuggestedSlippage,
                  };
                }
                return quotRes;
              });
              set(swapQuoteListAtom(), [...quoteUpdateSlippage]);
              set(swapAutoSlippageSuggestedValueAtom(), {
                value: autoSuggestedSlippage,
                from: `${fromNetworkId}-${fromTokenAddress}`,
                to: `${toNetworkId}-${toTokenAddress}`,
                eventId,
              });
            } else if (
              (dataJson as ISwapQuoteEventInfo).totalQuoteCount ||
              (dataJson as ISwapQuoteEventInfo).totalQuoteCount === 0
            ) {
              const { totalQuoteCount, eventId } =
                dataJson as ISwapQuoteEventInfo;
              const quoteEventError = get(swapQuoteEventErrorAtom());
              const quoteEventTotalCount = get(swapQuoteEventTotalCountAtom());
              const shouldResetCurrentEventProgress =
                quoteEventTotalCount.eventId !== eventId;
              if (shouldResetCurrentEventProgress) {
                set(swapQuoteCurrentEventProviderKeysAtom(), []);
                set(swapQuoteCurrentEventReceivedCountAtom(), 0);
              }
              set(swapQuoteEventTotalCountAtom(), {
                eventId,
                count: totalQuoteCount,
                totalQuoteCountReceived: true,
              });
              const currentEventProviderKeys = get(
                swapQuoteCurrentEventProviderKeysAtom(),
              );
              set(
                swapQuoteCurrentEventReceivedCountAtom(),
                Math.min(totalQuoteCount, currentEventProviderKeys.length),
              );
              const isZeroProviderQuoteEvent = hasSwapZeroProviderQuoteEvent({
                quoteEventTotalCount: {
                  eventId,
                  count: totalQuoteCount,
                },
              });
              if (totalQuoteCount === 0) {
                set(swapQuoteListAtom(), []);
              }
              if (quoteEventError || isZeroProviderQuoteEvent) {
                this.reconcileManualSelectQuoteProviders.call(set);
                const activeSession = get(
                  swapQuoteSessionStateAtom(),
                ).activeSession;
                if (activeSession) {
                  if (quoteEventError) {
                    set(swapQuoteCommittedStateAtom(), (state) =>
                      reduceSwapQuoteCommittedState(state, {
                        type: 'requestFailed',
                        intentFingerprint: activeSession.fingerprint,
                        requestId: activeSession.requestId,
                      }),
                    );
                  } else {
                    set(swapQuoteCommittedStateAtom(), (state) =>
                      reduceSwapQuoteCommittedState(state, {
                        type: 'requestSettled',
                        intentFingerprint: activeSession.fingerprint,
                        requestId: activeSession.requestId,
                        quotes: [],
                      }),
                    );
                  }
                }
                set(swapQuoteEventCompletedAtom(), true);
                set(swapQuoteFetchingAtom(), false);
                set(swapQuoteActionLockAtom(), (v) => ({
                  ...v,
                  actionLock: false,
                }));
                if (!event.skipTransportCancel) {
                  this.closeQuoteEvent.call(set);
                }
                break;
              }
              set(swapQuoteEventCompletedAtom(), false);
            } else {
              const quoteResultData = dataJson as ISwapQuoteEventQuoteResult;
              const swapAutoSlippageSuggestedValue = get(
                swapAutoSlippageSuggestedValueAtom(),
              );
              const quoteEventTotalCount = get(swapQuoteEventTotalCountAtom());
              const quoteResultEventId = quoteResultData.data?.[0]?.eventId;
              const shouldSeedQuoteEventFromResult =
                Boolean(quoteResultEventId) && !quoteEventTotalCount.eventId;
              const activeQuoteEventTotalCount =
                shouldSeedQuoteEventFromResult && quoteResultEventId
                  ? {
                      eventId: quoteResultEventId,
                      count: quoteResultData.data.length,
                      totalQuoteCountReceived: false,
                    }
                  : quoteEventTotalCount;
              if (shouldSeedQuoteEventFromResult && quoteResultEventId) {
                set(swapQuoteEventTotalCountAtom(), activeQuoteEventTotalCount);
              }
              if (
                quoteResultData.data?.length &&
                activeQuoteEventTotalCount.eventId === quoteResultEventId
              ) {
                const shouldNormalizeQuoteInputAmount = isStockProtocol(
                  event.params.protocol,
                );
                const quoteResults = quoteResultData.data.map((quote) =>
                  shouldNormalizeQuoteInputAmount &&
                  !quote.fromAmount &&
                  event.params.fromTokenAmount
                    ? {
                        ...quote,
                        fromAmount: event.params.fromTokenAmount,
                      }
                    : quote,
                );
                const quoteResultsUpdateSlippage = quoteResults.map((quote) => {
                  if (
                    `${quote.fromTokenInfo.networkId}-${quote.fromTokenInfo.contractAddress}` ===
                      swapAutoSlippageSuggestedValue?.from &&
                    `${quote.toTokenInfo.networkId}-${quote.toTokenInfo.contractAddress}` ===
                      swapAutoSlippageSuggestedValue?.to &&
                    quote.eventId === swapAutoSlippageSuggestedValue?.eventId &&
                    swapAutoSlippageSuggestedValue.value &&
                    !quote.autoSuggestedSlippage
                  ) {
                    return {
                      ...quote,
                      autoSuggestedSlippage:
                        swapAutoSlippageSuggestedValue.value,
                    };
                  }
                  return quote;
                });
                const currentQuoteList = get(swapQuoteListAtom());
                let newQuoteList = currentQuoteList.map((oldQuoteRes) => {
                  const newUpdateQuoteRes = quoteResultsUpdateSlippage.find(
                    (quote) =>
                      quote.info.provider === oldQuoteRes.info.provider &&
                      quote.info.providerName === oldQuoteRes.info.providerName,
                  );
                  if (newUpdateQuoteRes) {
                    return newUpdateQuoteRes;
                  }
                  return oldQuoteRes;
                });
                const newAddQuoteRes = quoteResultsUpdateSlippage.filter(
                  (quote) =>
                    !currentQuoteList.find(
                      (oldQuoteRes) =>
                        quote.info.provider === oldQuoteRes.info.provider &&
                        quote.info.providerName ===
                          oldQuoteRes.info.providerName,
                    ),
                );
                newQuoteList = [...newQuoteList, ...newAddQuoteRes]
                  .filter((quote) => !!quote.info.provider)
                  ?.filter(
                    (q) =>
                      equalTokenNoCaseSensitive({
                        token1: q.fromTokenInfo,
                        token2: event.tokenPairs.fromToken,
                      }) &&
                      equalTokenNoCaseSensitive({
                        token1: q.toTokenInfo,
                        token2: event.tokenPairs.toToken,
                      }) &&
                      q.protocol === event.params.protocol,
                  )
                  ?.filter(
                    (q) =>
                      activeQuoteEventTotalCount.eventId &&
                      q.eventId &&
                      activeQuoteEventTotalCount.eventId === q.eventId,
                  );
                set(swapQuoteListAtom(), [...newQuoteList]);
                const currentEventProviderKeys = [
                  ...new Set(
                    newQuoteList.map((quote) =>
                      buildSwapQuoteProviderKey(quote),
                    ),
                  ),
                ];
                set(
                  swapQuoteCurrentEventProviderKeysAtom(),
                  currentEventProviderKeys,
                );
                set(
                  swapQuoteCurrentEventReceivedCountAtom(),
                  Math.min(
                    activeQuoteEventTotalCount.count,
                    currentEventProviderKeys.length,
                  ),
                );
                const activeSession = get(
                  swapQuoteSessionStateAtom(),
                ).activeSession;
                if (activeSession) {
                  const promoteStreamingBest =
                    get(swapTypeSwitchAtom()) === ESwapTabSwitchType.SWAP;
                  const manualSelection = get(
                    swapManualSelectQuoteProvidersAtom(),
                  );
                  set(swapQuoteCommittedStateAtom(), (state) =>
                    reduceSwapQuoteCommittedState(state, {
                      type: 'candidatesUpdated',
                      intentFingerprint: activeSession.fingerprint,
                      requestId: activeSession.requestId,
                      quotes: newQuoteList,
                      promoteStreamingBest,
                      selectedQuote:
                        !promoteStreamingBest ||
                        manualSelection?.type === 'manual-provider'
                          ? undefined
                          : get(swapQuoteStreamingCurrentSelectAtom()),
                    }),
                  );
                }
                const committedState = get(swapQuoteCommittedStateAtom());
                const selectedQuote = get(swapQuoteCurrentSelectAtom());
                if (
                  committedState.phase === ESwapQuoteCommitPhase.Requesting &&
                  committedState.intentFingerprint ===
                    activeSession?.fingerprint &&
                  committedState.requestId === activeSession?.requestId &&
                  isSwapQuoteActionable(selectedQuote) &&
                  get(swapTypeSwitchAtom()) === ESwapTabSwitchType.SWAP &&
                  selectedQuote?.eventId === activeQuoteEventTotalCount.eventId
                ) {
                  // `swapQuoteFetching` covers request startup. Provider-round
                  // progress is tracked separately by quoteEventFetching, so a
                  // slow provider must not keep the main quote in loading once
                  // the active request has an actionable candidate.
                  set(swapQuoteFetchingAtom(), false);
                }
              }
              if (!get(swapQuoteSessionStateAtom()).activeSession) {
                set(swapQuoteFetchingAtom(), false);
              }
            }
          }
          break;
        }
        case 'done': {
          this.reconcileManualSelectQuoteProviders.call(set);
          const activeSession = get(swapQuoteSessionStateAtom()).activeSession;
          if (activeSession) {
            const selectedQuote = get(swapQuoteStreamingCurrentSelectAtom());
            set(swapQuoteCommittedStateAtom(), (state) =>
              reduceSwapQuoteCommittedState(state, {
                type: 'requestSettled',
                intentFingerprint: activeSession.fingerprint,
                requestId: activeSession.requestId,
                quotes: get(swapQuoteCurrentEventListAtom()),
                selectedQuote,
              }),
            );
          }
          set(swapQuoteEventCompletedAtom(), true);
          set(swapQuoteActionLockAtom(), (v) => ({ ...v, actionLock: false }));
          set(swapQuoteFetchingAtom(), false);
          if (!event.skipTransportCancel) {
            this.closeQuoteEvent.call(set);
          }
          break;
        }
        case 'error': {
          this.reconcileManualSelectQuoteProviders.call(set);
          const activeSession = get(swapQuoteSessionStateAtom()).activeSession;
          if (activeSession) {
            set(swapQuoteCommittedStateAtom(), (state) =>
              reduceSwapQuoteCommittedState(state, {
                type: 'requestFailed',
                intentFingerprint: activeSession.fingerprint,
                requestId: activeSession.requestId,
              }),
            );
          }
          set(swapQuoteEventCompletedAtom(), true);
          set(swapQuoteFetchingAtom(), false);
          set(swapQuoteActionLockAtom(), (v) => ({ ...v, actionLock: false }));
          if (!event.skipTransportCancel) {
            this.closeQuoteEvent.call(set);
          }
          break;
        }
        case 'close': {
          const activeSession = get(swapQuoteSessionStateAtom()).activeSession;
          if (activeSession) {
            set(swapQuoteCommittedStateAtom(), (state) =>
              reduceSwapQuoteCommittedState(state, {
                type: 'requestFailed',
                intentFingerprint: activeSession.fingerprint,
                requestId: activeSession.requestId,
              }),
            );
          }
          set(swapQuoteEventCompletedAtom(), true);
          set(swapQuoteFetchingAtom(), false);
          set(swapQuoteActionLockAtom(), (v) => ({ ...v, actionLock: false }));
          break;
        }
        default:
      }
    },
  );

  quoteEventHandlerV2 = contextAtomMethod(
    (get, set, event: ISwapQuoteSessionEventV2) => {
      const transition = acceptSwapQuoteSessionEvent({
        state: get(swapQuoteSessionStateAtom()),
        event,
      });
      if (!transition.accepted) {
        return;
      }
      set(swapQuoteSessionStateAtom(), transition.state);

      const commonPayload = {
        params: event.params,
        tokenPairs: event.tokenPairs,
        accountId: event.accountId,
      };
      switch (event.kind) {
        case 'open':
          this.quoteEventHandler.call(set, {
            ...commonPayload,
            type: 'open',
            event: { type: 'open' },
          });
          break;
        case 'message':
          this.quoteEventHandler.call(set, {
            ...commonPayload,
            type: 'message',
            event: {
              type: 'message',
              data: event.data,
              lastEventId: event.lastEventId,
              url: '',
            },
          });
          break;
        case 'done':
          this.quoteEventHandler.call(set, {
            ...commonPayload,
            type: 'done',
            event: { type: 'done' },
            skipTransportCancel: true,
          });
          break;
        case 'transportError':
          this.quoteEventHandler.call(set, {
            ...commonPayload,
            type: 'error',
            event: {
              type: 'error',
              message: event.error.message ?? 'Swap quote transport error',
              xhrState: event.error.xhrState ?? 0,
              xhrStatus: event.error.xhrStatus ?? 0,
            },
            skipTransportCancel: true,
          });
          break;
        case 'cancelled':
          this.quoteEventHandler.call(set, {
            ...commonPayload,
            type: 'close',
            event: { type: 'close' },
            skipTransportCancel: true,
          });
          break;
        default:
          break;
      }
    },
  );

  runQuoteEvent = contextAtomMethod(
    async (
      get,
      set,
      fromToken: ISwapToken,
      toToken: ISwapToken,
      slippagePercentage: number,
      autoSlippage?: boolean,
      address?: string,
      accountId?: string,
      blockNumber?: number,
      kind?: ESwapQuoteKind,
      fromTokenAmount?: string,
      toTokenAmount?: string,
      receivingAddress?: string,
      incognito?: boolean,
      expectedIntentRevision?: number,
      limitSettings?: ISwapQuoteLimitSemanticSettings,
    ) => {
      const protocol = get(swapTypeSwitchAtom());
      const { swapIncognitoMode } = await settingsAtom.get();
      if (
        expectedIntentRevision === undefined ||
        get(swapQuoteSessionStateAtom()).intentRevision !==
          expectedIntentRevision
      ) {
        return;
      }
      const incognitoEnabled =
        protocol === ESwapTabSwitchType.LIMIT ||
        protocol === ESwapTabSwitchType.STOCK
          ? false
          : (incognito ?? swapIncognitoMode);
      if (get(swapShouldRefreshQuoteAtom())) {
        this.cleanQuoteInterval();
        set(swapQuoteActionLockAtom(), (v) => ({ ...v, actionLock: false }));
        return;
      }
      const request: IFetchSwapQuoteParams = {
        fromToken,
        toToken,
        fromTokenAmount,
        userAddress: address,
        slippagePercentage,
        autoSlippage,
        blockNumber,
        accountId,
        kind,
        toTokenAmount,
        protocol,
        receivingAddress,
        incognito: incognitoEnabled,
        ...(limitSettings
          ? {
              expirationTime: limitSettings.expirationTime,
              limitPartiallyFillable: limitSettings.limitPartiallyFillable,
              userMarketPriceRate: limitSettings.userMarketPriceRate,
            }
          : {}),
      };
      const currentSessionState = get(swapQuoteSessionStateAtom());
      if (currentSessionState.intentRevision !== expectedIntentRevision) {
        return;
      }
      const preparedSessionState = prepareSwapQuoteSession({
        state: currentSessionState,
        request,
        intentRevision: expectedIntentRevision,
      });
      const activeSession = preparedSessionState.activeSession;
      if (!activeSession) {
        return;
      }
      const committedState = get(swapQuoteCommittedStateAtom());
      const displayIntentFingerprint =
        buildSwapQuoteDisplayIntentFingerprint(request);
      const manualSelection = get(swapManualSelectQuoteProvidersAtom());
      const preferredDisplayQuote =
        manualSelection?.type === 'manual-provider'
          ? committedState.settledQuotes.find(
              (quote) =>
                buildSwapQuoteProviderKey(quote) ===
                  buildSwapQuoteProviderKey(manualSelection) &&
                isSwapQuoteActionable(quote),
            )
          : undefined;
      set(swapQuoteSessionStateAtom(), preparedSessionState);
      set(swapQuoteCommittedStateAtom(), (state) =>
        reduceSwapQuoteCommittedState(state, {
          type: 'requestStarted',
          intentFingerprint: activeSession.fingerprint,
          displayIntentFingerprint,
          requestId: activeSession.requestId,
          preferredDisplayQuote,
        }),
      );
      set(swapQuoteEventErrorAtom(), undefined);
      set(swapQuoteFetchingAtom(), true);
      set(swapQuoteEventCompletedAtom(), false);

      try {
        await backgroundApiProxy.serviceSwap.closeApproving();
        if (
          get(swapQuoteSessionStateAtom()).activeSession?.requestId !==
          activeSession.requestId
        ) {
          return;
        }
        const startResult =
          await backgroundApiProxy.serviceSwap.fetchQuotesEventsV2({
            session: activeSession,
            request,
          });
        const transition = applySwapQuoteSessionStartResult({
          state: get(swapQuoteSessionStateAtom()),
          result: startResult,
        });
        if (!transition.accepted) {
          return;
        }
        set(swapQuoteSessionStateAtom(), transition.state);
        if (!startResult.accepted) {
          set(swapQuoteCommittedStateAtom(), (state) =>
            reduceSwapQuoteCommittedState(state, {
              type: 'requestFailed',
              intentFingerprint: activeSession.fingerprint,
              requestId: activeSession.requestId,
            }),
          );
          set(swapQuoteFetchingAtom(), false);
          set(swapQuoteEventCompletedAtom(), true);
          set(swapQuoteActionLockAtom(), (value) => ({
            ...value,
            actionLock: false,
          }));
        }
      } catch (error) {
        const latestSessionState = get(swapQuoteSessionStateAtom());
        if (
          latestSessionState.activeSession?.requestId ===
          activeSession.requestId
        ) {
          set(swapQuoteSessionStateAtom(), {
            ...latestSessionState,
            phase: 'error',
          });
          set(swapQuoteCommittedStateAtom(), (state) =>
            reduceSwapQuoteCommittedState(state, {
              type: 'requestFailed',
              intentFingerprint: activeSession.fingerprint,
              requestId: activeSession.requestId,
            }),
          );
          set(swapQuoteEventErrorAtom(), {
            message:
              error instanceof Error && error.message
                ? error.message
                : 'Swap quote request failed',
            fromToken,
            toToken,
            fromTokenAmount,
            isStock: isStockProtocol(protocol),
          });
          set(swapQuoteFetchingAtom(), false);
          set(swapQuoteEventCompletedAtom(), true);
          set(swapQuoteActionLockAtom(), (value) => ({
            ...value,
            actionLock: false,
          }));
        }
      }
    },
  );

  resetQuoteAction = contextAtomMethod(async (get, set) => {
    const fromToken = get(swapSelectFromTokenAtom());
    const toToken = get(swapSelectToTokenAtom());
    const fromTokenAmount = get(swapFromTokenAmountAtom());
    const toTokenAmount = get(swapToTokenAmountAtom());
    const swapTypeSwitch = get(swapTypeSwitchAtom());
    const quoteSessionState = get(swapQuoteSessionStateAtom());
    const activeQuoteSession = quoteSessionState.activeSession;
    set(
      swapQuoteSessionStateAtom(),
      invalidateSwapQuoteSession(quoteSessionState),
    );
    if (activeQuoteSession) {
      void backgroundApiProxy.serviceSwap.cancelFetchQuoteEventsV2({
        surfaceId: activeQuoteSession.surfaceId,
        requestId: activeQuoteSession.requestId,
      });
    }
    set(swapQuoteFetchingAtom(), false);
    set(swapQuoteEventErrorAtom(), undefined);
    set(swapQuoteCurrentEventProviderKeysAtom(), []);
    set(swapQuoteCurrentEventReceivedCountAtom(), 0);
    set(swapQuoteEventCompletedAtom(), false);
    set(swapQuoteEventTotalCountAtom(), {
      count: 0,
    });
    set(swapQuoteListAtom(), []);
    set(swapQuoteCommittedStateAtom(), (state) =>
      reduceSwapQuoteCommittedState(state, { type: 'reset' }),
    );
    set(swapManualSelectQuoteProvidersAtom(), undefined);
    set(rateDifferenceAtom(), undefined);
    set(swapQuoteActionLockAtom(), (v) => ({ ...v, actionLock: false }));
    if (swapTypeSwitch === ESwapTabSwitchType.STOCK) {
      set(swapAlertsAtom(), {
        quoteId: '',
        states: [],
      });
    }
    if (!fromToken) {
      set(swapFromTokenAmountAtom(), { value: '', isInput: false });
    }
    if (!toToken) {
      set(swapToTokenAmountAtom(), { value: '', isInput: false });
    }
    if (!fromTokenAmount.value && fromTokenAmount.isInput) {
      set(swapToTokenAmountAtom(), { value: '', isInput: false });
    } else if (!toTokenAmount.value && toTokenAmount.isInput) {
      set(swapFromTokenAmountAtom(), { value: '', isInput: false });
    }
  });

  invalidateQuoteIntent = contextAtomMethod(
    (get, set, { isPending }: { isPending: boolean }) => {
      const sessionState = get(swapQuoteSessionStateAtom());
      const activeSession = sessionState.activeSession;
      set(
        swapQuoteSessionStateAtom(),
        invalidateSwapQuoteSession(sessionState),
      );
      set(swapQuoteCommittedStateAtom(), (state) =>
        reduceSwapQuoteCommittedState(state, { type: 'reset' }),
      );
      set(swapQuoteListAtom(), []);
      set(swapQuoteCurrentEventProviderKeysAtom(), []);
      set(swapQuoteCurrentEventReceivedCountAtom(), 0);
      set(swapQuoteEventTotalCountAtom(), { count: 0 });
      set(swapQuoteEventCompletedAtom(), false);
      set(swapQuoteEventErrorAtom(), undefined);
      set(swapQuoteFetchingAtom(), isPending);
      set(swapQuoteActionLockAtom(), (value) => ({
        ...value,
        actionLock: false,
      }));
      if (activeSession) {
        void backgroundApiProxy.serviceSwap.cancelFetchQuoteEventsV2({
          surfaceId: activeSession.surfaceId,
          requestId: activeSession.requestId,
        });
      }
    },
  );

  quoteAction = contextAtomMethod(
    async (
      get,
      set,
      slippageItem: { key: ESwapSlippageSegmentKey; value: number },
      address?: string,
      accountId?: string,
      blockNumber?: number,
      unResetCount?: boolean,
      kind?: ESwapQuoteKind,
      reQuote?: boolean,
      receivingAddress?: string,
      incognito?: boolean,
    ) => {
      let fromToken = get(swapSelectFromTokenAtom());
      let toToken = get(swapSelectToTokenAtom());
      const fromTokenAmount = get(swapFromTokenAmountAtom());
      const swapTabSwitchType = get(swapTypeSwitchAtom());
      const toTokenAmount = get(swapToTokenAmountAtom());
      const swapProTradeType = get(swapProTradeTypeAtom());
      const swapProDirection = get(swapProDirectionAtom());
      set(swapQuoteEventErrorAtom(), undefined);
      if (
        swapTabSwitchType === ESwapTabSwitchType.LIMIT &&
        swapProTradeType === ESwapProTradeType.MARKET &&
        platformEnv.isNative
      ) {
        void this.resetQuoteAction.call(set);
        return;
      }
      if (
        swapProTradeType === ESwapProTradeType.LIMIT &&
        swapTabSwitchType === ESwapTabSwitchType.LIMIT
      ) {
        if (swapProDirection === ESwapDirection.BUY) {
          fromToken = get(swapProUseSelectBuyTokenAtom());
          toToken = get(swapProSelectTokenAtom());
        } else {
          fromToken = get(swapProSelectTokenAtom());
          toToken = get(swapProSellToTokenAtom());
        }
      }
      const fromTokenAmountNumber = Number(fromTokenAmount.value);
      const toTokenAmountNumber = Number(toTokenAmount.value);
      let quoteKind = kind;
      if (reQuote) {
        if (
          kind === ESwapQuoteKind.SELL &&
          !Number.isNaN(toTokenAmountNumber) &&
          toTokenAmountNumber > 0 &&
          (fromTokenAmountNumber === 0 || Number.isNaN(fromTokenAmountNumber))
        ) {
          quoteKind = ESwapQuoteKind.BUY;
        } else if (
          kind === ESwapQuoteKind.BUY &&
          !Number.isNaN(fromTokenAmountNumber) &&
          fromTokenAmountNumber > 0 &&
          (toTokenAmountNumber === 0 || Number.isNaN(toTokenAmountNumber))
        ) {
          quoteKind = ESwapQuoteKind.SELL;
        }
      }
      const hasValidQuoteInput =
        fromToken &&
        toToken &&
        ((quoteKind === ESwapQuoteKind.SELL &&
          !Number.isNaN(fromTokenAmountNumber) &&
          fromTokenAmountNumber > 0) ||
          (quoteKind === ESwapQuoteKind.BUY &&
            !Number.isNaN(toTokenAmountNumber) &&
            toTokenAmountNumber > 0));
      const limitSettings = buildSwapQuoteLimitSemanticSettings({
        expirationTime: get(swapLimitExpirationTimeAtom()).value,
        fromToken,
        limitPartiallyFillable: get(swapLimitPartiallyFillAtom()).value,
        limitPriceUseRate: get(swapLimitPriceUseRateAtom()),
        protocol: swapTabSwitchType,
        toToken,
      });
      const limitSettingsKey =
        buildSwapQuoteLimitSemanticSettingsKey(limitSettings);

      this.cleanQuoteInterval();
      this.closeQuoteEvent.call(set);
      const expectedIntentRevision = get(
        swapQuoteSessionStateAtom(),
      ).intentRevision;
      if (!unResetCount) {
        set(swapQuoteIntervalCountAtom(), 0);
      }
      set(swapQuoteCurrentEventProviderKeysAtom(), []);
      set(swapQuoteCurrentEventReceivedCountAtom(), 0);
      set(swapQuoteEventCompletedAtom(), false);
      set(swapQuoteEventTotalCountAtom(), { count: 0 });
      set(swapBuildTxFetchingAtom(), false);
      set(swapShouldRefreshQuoteAtom(), false);

      if (!hasValidQuoteInput || !fromToken || !toToken) {
        void this.resetQuoteAction.call(set);
        return;
      }
      if (
        swapTabSwitchType === ESwapTabSwitchType.STOCK &&
        !isStockExecutionTokensReady({
          currentSyncId: get(swapStockExecutionTokenSyncIdAtom()),
          executionTokens: get(swapStockExecutionTokensAtom()),
          fromToken,
          toToken,
        })
      ) {
        void this.resetQuoteAction.call(set);
        return;
      }

      // check limit zero
      set(swapQuoteActionLockAtom(), (v) => ({
        ...v,
        type: swapTabSwitchType,
        actionLock: true,
        fromToken,
        toToken,
        fromTokenAmount: fromTokenAmount.value,
        toTokenAmount: toTokenAmount.value,
        kind: quoteKind,
        accountId,
        address,
        receivingAddress,
        limitSettingsKey,
      }));
      set(swapQuoteFetchingAtom(), true);
      void this.runQuoteEvent.call(
        set,
        fromToken,
        toToken,
        slippageItem.value,
        slippageItem.key === ESwapSlippageSegmentKey.AUTO,
        address,
        accountId,
        blockNumber,
        quoteKind,
        fromTokenAmount.value,
        toTokenAmount.value,
        receivingAddress,
        incognito,
        expectedIntentRevision,
        limitSettings,
      );
    },
  );

  runSpeedQuote = contextAtomMethod(
    async (
      get,
      set,
      fromToken: ISwapToken,
      toToken: ISwapToken,
      slippagePercentage: number,
      autoSlippage?: boolean,
      address?: string,
      accountId?: string,
      kind?: ESwapQuoteKind,
      fromTokenAmount?: string,
      toTokenAmount?: string,
      receivingAddress?: string,
    ) => {
      const request: IFetchSwapQuoteParams = {
        fromToken,
        toToken,
        fromTokenAmount,
        toTokenAmount,
        kind,
        userAddress: address,
        slippagePercentage,
        autoSlippage,
        receivingAddress,
        accountId,
        protocol: ESwapTabSwitchType.SWAP,
      };
      const preparedSessionState = prepareSwapSpeedQuoteSession(
        get(swapSpeedQuoteSessionStateAtom()),
      );
      const activeSession = preparedSessionState.activeSession;
      if (!activeSession) {
        return;
      }
      set(swapSpeedQuoteSessionStateAtom(), preparedSessionState);
      try {
        set(swapSpeedQuoteFetchingAtom(), true);
        set(swapSpeedQuoteResultAtom(), undefined);
        const result =
          await backgroundApiProxy.serviceSwap.fetchSpeedSwapQuoteV2({
            session: activeSession,
            request,
          });
        const currentSessionState = get(swapSpeedQuoteSessionStateAtom());
        if (
          !isCurrentSwapSpeedQuoteResult({
            state: currentSessionState,
            result,
          })
        ) {
          return;
        }
        set(
          swapSpeedQuoteSessionStateAtom(),
          settleSwapSpeedQuoteSession({
            state: currentSessionState,
            session: activeSession,
          }),
        );
        if (!result.accepted) {
          set(swapSpeedQuoteFetchingAtom(), false);
          return;
        }
        const res = result.quotes;
        if (res.length > 0) {
          const quoteResult = res[0];
          const quoteResultFromAmount = quoteResult.fromAmount;
          const fromTokenCurrentAmount = get(swapProInputAmountAtom());
          if (
            !quoteResult.errorMessage &&
            quoteResultFromAmount !== fromTokenCurrentAmount
          ) {
            set(swapSpeedQuoteFetchingAtom(), false);
            return;
          }
          set(swapSpeedQuoteResultAtom(), quoteResult);
        }
        set(swapSpeedQuoteFetchingAtom(), false);
      } catch {
        const currentSessionState = get(swapSpeedQuoteSessionStateAtom());
        if (
          currentSessionState.activeSession?.requestId !==
          activeSession.requestId
        ) {
          return;
        }
        set(
          swapSpeedQuoteSessionStateAtom(),
          settleSwapSpeedQuoteSession({
            state: currentSessionState,
            session: activeSession,
          }),
        );
        set(swapSpeedQuoteFetchingAtom(), false);
      }
    },
  );

  quoteSpeedAction = contextAtomMethod(
    async (
      get,
      set,
      slippageItem: { key: ESwapSlippageSegmentKey; value: number },
      address?: string,
      accountId?: string,
      receivingAddress?: string,
    ) => {
      const selectedToken = get(swapProSelectTokenAtom());
      const buySelectToken = get(swapProUseSelectBuyTokenAtom());
      const sellSelectToken = get(swapProSellToTokenAtom());
      const swapProDirection = get(swapProDirectionAtom());
      const fromTokenAmount = get(swapProInputAmountAtom());
      const fromToken =
        swapProDirection === ESwapDirection.BUY
          ? buySelectToken
          : selectedToken;
      const toToken =
        swapProDirection === ESwapDirection.BUY
          ? selectedToken
          : sellSelectToken;
      if (!fromToken || !toToken || fromToken.networkId !== toToken.networkId) {
        this.cancelSpeedQuote.call(set);
        set(swapSpeedQuoteFetchingAtom(), false);
        set(swapSpeedQuoteResultAtom(), undefined);
        return;
      }
      void this.runSpeedQuote.call(
        set,
        fromToken,
        toToken,
        slippageItem.value,
        slippageItem.key === ESwapSlippageSegmentKey.AUTO,
        address,
        accountId,
        ESwapQuoteKind.SELL,
        fromTokenAmount,
        undefined,
        receivingAddress,
      );
    },
  );

  cleanQuoteInterval = () => {
    if (this.quoteInterval) {
      clearTimeout(this.quoteInterval);
      this.quoteInterval = undefined;
    }
  };

  closeQuoteEvent = contextAtomMethod((get, set) => {
    const sessionState = get(swapQuoteSessionStateAtom());
    const activeSession = sessionState.activeSession;
    const committedState = get(swapQuoteCommittedStateAtom());
    if (
      activeSession &&
      committedState.phase === ESwapQuoteCommitPhase.Requesting
    ) {
      set(swapQuoteCommittedStateAtom(), (state) =>
        reduceSwapQuoteCommittedState(state, {
          type: 'requestFailed',
          intentFingerprint: activeSession.fingerprint,
          requestId: activeSession.requestId,
        }),
      );
    }
    set(swapQuoteSessionStateAtom(), invalidateSwapQuoteSession(sessionState));
    set(swapQuoteFetchingAtom(), false);
    set(swapQuoteEventCompletedAtom(), true);
    set(swapQuoteActionLockAtom(), (value) => ({
      ...value,
      actionLock: false,
    }));
    if (activeSession) {
      void backgroundApiProxy.serviceSwap.cancelFetchQuoteEventsV2({
        surfaceId: activeSession.surfaceId,
        requestId: activeSession.requestId,
      });
    }
  });

  cancelSpeedQuote = contextAtomMethod((get, set) => {
    const sessionState = get(swapSpeedQuoteSessionStateAtom());
    const activeSession = sessionState.activeSession;
    set(
      swapSpeedQuoteSessionStateAtom(),
      invalidateSwapSpeedQuoteSession(sessionState),
    );
    if (activeSession) {
      void backgroundApiProxy.serviceSwap.cancelFetchSpeedSwapQuoteV2(
        buildSwapSpeedQuoteCancelParams(activeSession),
      );
    }
  });

  cleanSpeedQuote = contextAtomMethod(async (get, set) => {
    set(swapSpeedQuoteFetchingAtom(), false);
    set(swapSpeedQuoteResultAtom(), undefined);
  });

  cleanLimitOrderMarketPriceInterval = () => {
    this.limitOrderMarketPriceRequestId += 1;
    if (this.limitOrderMarketPriceInterval) {
      clearInterval(this.limitOrderMarketPriceInterval);
      this.limitOrderMarketPriceInterval = undefined;
    }
  };

  checkAddressNeedCreate = (
    swapSupportAllNetworks: ISwapNetwork[],
    fromToken: ISwapToken,
    addressInfo: ReturnType<typeof useSwapAddressInfo>,
    directionType: ESwapDirectionType,
  ) => {
    const netInfo = swapSupportAllNetworks.find(
      (net) => net.networkId === fromToken.networkId,
    );
    const isAllNetwork = networkUtils.isAllNetwork({
      networkId: addressInfo.accountInfo?.network?.id,
    });
    const networkId = isAllNetwork
      ? fromToken.networkId
      : addressInfo.accountInfo?.network?.id;
    const walletId = addressInfo.accountInfo?.wallet?.id;
    const indexedAccountId = addressInfo.accountInfo?.indexedAccount?.id;
    const deriveType = addressInfo.accountInfo?.deriveType;
    const account = {
      walletId,
      indexedAccountId,
      deriveType,
      networkId,
    };
    const key =
      networkId && walletId && (deriveType || indexedAccountId)
        ? [networkId, deriveType, walletId, indexedAccountId].join('-')
        : Math.random().toString();
    return {
      icon: 'WalletCryptoOutline',
      // eslint-disable-next-line onekey/no-app-locale-main-thread
      title: appLocale.intl.formatMessage(
        {
          id: ETranslations.swap_page_no_address,
        },
        { network: netInfo?.name ?? '' },
      ),
      // eslint-disable-next-line onekey/no-app-locale-main-thread
      message: appLocale.intl.formatMessage({
        id: ETranslations.swap_page_create_to_enable_network,
      }),
      alertLevel: ESwapAlertLevel.INFO,
      action: {
        actionType: ESwapAlertActionType.CREATE_ADDRESS,
        // eslint-disable-next-line onekey/no-app-locale-main-thread
        actionLabel: appLocale.intl.formatMessage({
          id: ETranslations.global_create,
        }),
        directionType,
        actionData: {
          num: 0,
          key,
          account,
        } as ISwapAlertActionData,
      },
    } as ISwapAlertState;
  };

  checkAccountNetworkNotSupportedAlert = async ({
    addressInfo,
    activeNetworkId,
  }: {
    addressInfo?: ReturnType<typeof useSwapAddressInfo>;
    activeNetworkId: string;
  }) => {
    if (!addressInfo) {
      return undefined;
    }

    const walletId = addressInfo.accountInfo?.wallet?.id;
    const accountId = addressInfo.accountInfo?.account?.id;

    const accountNetworkNotSupported =
      await backgroundApiProxy.serviceAccount.checkAccountNetworkNotSupported({
        walletId,
        accountId,
        activeNetworkId,
      });
    if (accountNetworkNotSupported) {
      return {
        // eslint-disable-next-line onekey/no-app-locale-main-thread
        message: appLocale.intl.formatMessage({
          id: ETranslations.swap_page_alert_account_does_not_support_swap,
        }),
        alertLevel: ESwapAlertLevel.ERROR,
      };
    }
    return undefined;
  };

  private async checkSwapTokenIsStock(token?: ISwapToken) {
    if (!token?.networkId) {
      return false;
    }

    const cacheKey = `${token.networkId}:${token.contractAddress}`;
    const cached = this.stockTokenCheckCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const checkPromise = backgroundApiProxy.serviceMarketV2
      .fetchMarketTokenDetailByTokenAddress(
        token.contractAddress,
        token.networkId,
        {
          autoHandleError: false,
        },
      )
      .then((tokenDetail) => {
        if (tokenDetail?.code !== 0 || !tokenDetail?.data?.token) {
          throw new OneKeyLocalError(
            `Market token detail is not available: ${tokenDetail?.code ?? 'empty'}`,
          );
        }
        return isUSMarketStatusStockTokenSource(
          tokenDetail.data.token.stock?.source,
        );
      })
      .catch((error) => {
        defaultLogger.swap.stockTokenCheck.stockTokenCheckUnavailable({
          cacheKey,
          networkId: token.networkId,
          tokenSymbol: token.symbol,
          errorMessage: error instanceof Error ? error.message : String(error),
        });
        this.stockTokenCheckCache.delete(cacheKey);
        return false;
      });
    this.stockTokenCheckCache.set(cacheKey, checkPromise);
    return checkPromise;
  }

  private async fetchCheckUSMarketStatus() {
    const now = Date.now();
    if (this.usMarketStatusCache && this.usMarketStatusCache.expiresAt > now) {
      return this.usMarketStatusCache.promise;
    }

    const promise = backgroundApiProxy.serviceSwap
      .fetchCheckUSMarketStatus()
      .then((marketStatus) => {
        if (!marketStatus || marketStatus.unavailable) {
          this.usMarketStatusCache = undefined;
        }
        return marketStatus;
      })
      .catch(() => {
        this.usMarketStatusCache = undefined;
        return {
          open: false,
          session: 'CLOSED' as const,
          reason: 'market-status-unavailable',
          unavailable: true,
        };
      });
    this.usMarketStatusCache = {
      expiresAt: now + 30_000,
      promise,
    };
    return promise;
  }

  private async checkSwapPairUSMarketClosed({
    fromToken,
    toToken,
  }: {
    fromToken?: ISwapToken;
    toToken?: ISwapToken;
  }) {
    const [fromTokenIsStock, toTokenIsStock] = await Promise.all([
      this.checkSwapTokenIsStock(fromToken),
      this.checkSwapTokenIsStock(toToken),
    ]);

    if (!fromTokenIsStock && !toTokenIsStock) {
      return false;
    }

    const marketStatus = await this.fetchCheckUSMarketStatus();
    return marketStatus?.open === false && marketStatus.unavailable !== true;
  }

  private getUSMarketClosedAlert(): ISwapAlertState & { message: string } {
    return {
      // eslint-disable-next-line onekey/no-app-locale-main-thread
      message: appLocale.intl.formatMessage({
        id: ETranslations.dexmarket_stock_status_closed_error,
      }),
      alertLevel: ESwapAlertLevel.ERROR,
    };
  }

  checkSwapWarning = contextAtomMethod(
    async (
      get,
      set,
      swapFromAddressInfo: ReturnType<typeof useSwapAddressInfo>,
      swapToAddressInfo: ReturnType<typeof useSwapAddressInfo>,
      options?: {
        allowNoConnectWallet?: boolean;
      },
    ) => {
      const fromToken = get(swapSelectFromTokenAtom());
      const toToken = get(swapSelectToTokenAtom());
      const networks = get(swapNetworks());
      const swapSupportAllNetworks = get(swapNetworksIncludeAllNetworkAtom());
      const quoteResult =
        get(swapQuoteCurrentSelectAtom()) ??
        get(swapQuoteStreamingCurrentSelectAtom());
      const tokenMetadata = get(swapTokenMetadataAtom());
      const quoteLoading =
        get(swapQuoteFetchingAtom()) || get(swapSilenceQuoteLoading());
      const quoteEventTotalCount = get(swapQuoteEventTotalCountAtom());
      const quoteEventCompleted = get(swapQuoteEventCompletedAtom());
      const quoteEventError = get(swapQuoteEventErrorAtom());
      const currentEventReceivedCount = get(
        swapQuoteCurrentEventReceivedCountAtom(),
      );
      const { swapIncognitoMode } = await settingsAtom.get();
      const swapTypeSwitch = get(swapTypeSwitchAtom());
      const quoteEventProgressTotalCount = getSwapQuoteEventProgressTotalCount({
        quoteEventTotalCount,
        maxQuoteCount:
          swapIncognitoMode &&
          swapTypeSwitch !== ESwapTabSwitchType.LIMIT &&
          swapTypeSwitch !== ESwapTabSwitchType.STOCK
            ? SWAP_INCOGNITO_QUOTE_PROVIDER_COUNT_CAP
            : undefined,
      });
      const quoteEventFetching = isSwapQuoteEventFetching({
        quoteEventTotalCount: quoteEventProgressTotalCount,
        currentEventReceivedCount,
        quoteEventCompleted,
      });
      const { isWaitingActionableQuote } = getSwapQuoteProgressState({
        quoteLoading,
        quoteEventFetching,
        quoteCurrentSelect: quoteResult,
        quoteEventTotalCount: quoteEventProgressTotalCount,
        quoteEventCompleted,
        quoteEventError,
      });
      const fromTokenAmount = get(swapFromTokenAmountAtom());
      let alertsRes: ISwapAlertState[] = [];
      const isCurrentQuoteResult = isQuoteResultSelectedTokenPair({
        quoteResult,
        fromToken,
        toToken,
      });
      const isCurrentQuoteEventError = isQuoteEventErrorSelectedTokenPair({
        quoteEventError,
        fromTokenAmount: fromTokenAmount.value,
        fromToken,
        toToken,
      });
      if (
        quoteEventError &&
        (isCurrentQuoteResult || isCurrentQuoteEventError)
      ) {
        if (!quoteEventError.isStock) {
          alertsRes = [
            {
              message: quoteEventError.message,
              alertLevel: ESwapAlertLevel.ERROR,
            },
          ];
        }
      } else if (quoteEventError) {
        set(swapQuoteEventErrorAtom(), undefined);
      }
      const isLatestStockWarningCheck = () => {
        if (swapTypeSwitch !== ESwapTabSwitchType.STOCK) {
          return true;
        }
        const latestFromToken = get(swapSelectFromTokenAtom());
        const latestToToken = get(swapSelectToTokenAtom());
        const latestFromTokenAmount = get(swapFromTokenAmountAtom());
        const latestSwapTypeSwitch = get(swapTypeSwitchAtom());
        const isLatestStockQuoteResult =
          !quoteResult ||
          (isQuoteResultSelectedTokenPair({
            quoteResult,
            fromToken: latestFromToken,
            toToken: latestToToken,
          }) &&
            isSameSwapAmountValue({
              currentAmount: latestFromTokenAmount.value,
              eventAmount: quoteResult.fromAmount,
            }));
        const isLatestStockQuoteEventError =
          !quoteEventError ||
          isQuoteEventErrorSelectedTokenPair({
            quoteEventError,
            fromTokenAmount: latestFromTokenAmount.value,
            fromToken: latestFromToken,
            toToken: latestToToken,
          });
        return (
          latestSwapTypeSwitch === ESwapTabSwitchType.STOCK &&
          isLatestStockQuoteResult &&
          isLatestStockQuoteEventError
        );
      };
      let rateDifferenceRes: ISwapPreSwapData['rateDifference'];
      // current quote result  current token  not match
      if (quoteResult && fromToken && toToken && !isCurrentQuoteResult) {
        set(swapAlertsAtom(), {
          states: alertsRes,
          quoteId: '',
        });
        set(rateDifferenceAtom(), rateDifferenceRes);
        return;
      }

      if (
        !networks.length ||
        !swapFromAddressInfo.accountInfo?.ready ||
        (isWaitingActionableQuote && !isSwapQuoteActionable(quoteResult))
      ) {
        if (alertsRes.length) {
          set(swapAlertsAtom(), {
            states: alertsRes,
            quoteId: '',
          });
        } else {
          const alerts = get(swapAlertsAtom());
          const nextAlerts = removeSwapNoConnectWalletAlerts(alerts.states);
          if (nextAlerts.length !== alerts.states.length) {
            set(swapAlertsAtom(), {
              states: nextAlerts,
              quoteId: alerts.quoteId,
            });
          }
        }
        return;
      }
      const hasFromAccountWallet = Boolean(
        swapFromAddressInfo.accountInfo?.wallet,
      );
      const hasFromAccount = Boolean(swapFromAddressInfo.accountInfo?.account);
      // check account
      if (
        !hasFromAccountWallet ||
        (!hasFromAccount && options?.allowNoConnectWallet)
      ) {
        if (!options?.allowNoConnectWallet) {
          const alerts = get(swapAlertsAtom());
          set(swapAlertsAtom(), {
            states: removeSwapNoConnectWalletAlerts(alerts.states),
            quoteId: alerts.quoteId,
          });
          return;
        }
        // Set noConnectWallet flag without showing alert message
        set(swapAlertsAtom(), {
          states: [...alertsRes, { noConnectWallet: true }],
          quoteId: quoteResult?.quoteId ?? '',
        });
        return;
      }
      if (
        shouldCheckSwapWarningUSMarketClosed({
          alerts: alertsRes,
          swapTypeSwitch,
          fromToken,
          toToken,
          accountReady: swapFromAddressInfo.accountInfo?.ready,
          isWaitingActionableQuote,
          hasFromAccountWallet: Boolean(
            swapFromAddressInfo.accountInfo?.wallet,
          ),
        })
      ) {
        const isUSMarketClosed = await this.checkSwapPairUSMarketClosed({
          fromToken,
          toToken,
        });
        const latestFromToken = get(swapSelectFromTokenAtom());
        const latestToToken = get(swapSelectToTokenAtom());
        const latestSwapTypeSwitch = get(swapTypeSwitchAtom());
        const isSameTokenPair =
          equalTokenNoCaseSensitive({
            token1: latestFromToken,
            token2: fromToken,
          }) &&
          equalTokenNoCaseSensitive({
            token1: latestToToken,
            token2: toToken,
          });
        if (!isSameTokenPair || latestSwapTypeSwitch !== swapTypeSwitch) {
          return;
        }
        if (isUSMarketClosed) {
          alertsRes = [this.getUSMarketClosedAlert()];
        }
      }
      if (!isLatestStockWarningCheck()) {
        return;
      }
      // eslint-disable-next-line onekey/no-app-locale-main-thread
      const notSupportSwapMessage = appLocale.intl.formatMessage({
        id: ETranslations.swap_page_alert_account_does_not_support_swap,
      });
      if (
        shouldShowSwapAccountUnsupportedAlert({
          hasFromToken: Boolean(fromToken),
          fromAddress: swapFromAddressInfo.address,
          walletId: swapFromAddressInfo.accountInfo?.wallet?.id,
          accountId: swapFromAddressInfo.accountInfo?.account?.id,
        })
      ) {
        alertsRes = [
          ...alertsRes,
          {
            message: notSupportSwapMessage,
            alertLevel: ESwapAlertLevel.ERROR,
          },
        ];
      }

      if (
        fromToken &&
        swapFromAddressInfo.accountInfo?.wallet?.id &&
        alertsRes.every((item) => item.message !== notSupportSwapMessage)
      ) {
        const needCheck =
          !swapFromAddressInfo.address ||
          accountUtils.isHwWallet({
            walletId: swapFromAddressInfo.accountInfo?.wallet?.id,
          });

        if (needCheck) {
          const accountNetworkNotSupportedAlert =
            await this.checkAccountNetworkNotSupportedAlert({
              addressInfo: swapFromAddressInfo,
              activeNetworkId: fromToken.networkId,
            });
          if (accountNetworkNotSupportedAlert) {
            alertsRes = [...alertsRes, accountNetworkNotSupportedAlert];
            set(swapAlertsAtom(), {
              states: alertsRes,
              quoteId: quoteResult?.quoteId ?? '',
            });
            return;
          }
        }
      }
      if (
        toToken &&
        !swapToAddressInfo.address &&
        swapToAddressInfo.accountInfo?.wallet?.id &&
        alertsRes.every((item) => item.message !== notSupportSwapMessage)
      ) {
        const accountNetworkNotSupportedAlert =
          await this.checkAccountNetworkNotSupportedAlert({
            addressInfo: swapToAddressInfo,
            activeNetworkId: toToken.networkId,
          });
        if (accountNetworkNotSupportedAlert) {
          alertsRes = [...alertsRes, accountNetworkNotSupportedAlert];
          set(swapAlertsAtom(), {
            states: alertsRes,
            quoteId: quoteResult?.quoteId ?? '',
          });
          return;
        }
      }

      // check from address
      if (
        fromToken &&
        swapFromAddressInfo.isAddressInfoReady &&
        !swapFromAddressInfo.address &&
        (accountUtils.isHdWallet({
          walletId: swapFromAddressInfo.accountInfo?.wallet?.id,
        }) ||
          accountUtils.isHwWallet({
            walletId: swapFromAddressInfo.accountInfo?.wallet?.id,
          }) ||
          accountUtils.isQrWallet({
            walletId: swapFromAddressInfo.accountInfo?.wallet?.id,
          }))
      ) {
        const alertAction: ISwapAlertState = this.checkAddressNeedCreate(
          swapSupportAllNetworks,
          fromToken,
          swapFromAddressInfo,
          ESwapDirectionType.FROM,
        );
        alertsRes = [...alertsRes, alertAction];
      }
      // check to address
      if (
        toToken &&
        swapToAddressInfo.isAddressInfoReady &&
        !swapToAddressInfo.address &&
        (accountUtils.isHdWallet({
          walletId: swapToAddressInfo.accountInfo?.wallet?.id,
        }) ||
          accountUtils.isHwWallet({
            walletId: swapToAddressInfo.accountInfo?.wallet?.id,
          }) ||
          accountUtils.isQrWallet({
            walletId: swapToAddressInfo.accountInfo?.wallet?.id,
          }))
      ) {
        if (!(fromToken && fromToken.networkId === toToken.networkId)) {
          const alertAction = this.checkAddressNeedCreate(
            swapSupportAllNetworks,
            toToken,
            swapToAddressInfo,
            ESwapDirectionType.TO,
          );
          alertsRes = [...alertsRes, alertAction];
        }
      }

      const limitPriceUseRate = get(swapLimitPriceUseRateAtom());
      // market rate check
      if (
        fromToken?.price &&
        toToken?.price &&
        (quoteResult?.instantRate ||
          (limitPriceUseRate?.rate &&
            quoteResult?.protocol === EProtocolOfExchange.LIMIT))
      ) {
        let instantRate = quoteResult?.instantRate;
        if (
          quoteResult?.protocol === EProtocolOfExchange.LIMIT &&
          limitPriceUseRate.rate
        ) {
          instantRate = limitPriceUseRate.rate;
        }
        const [{ currencyMap }, { currencyInfo }] = await Promise.all([
          currencyPersistAtom.get(),
          settingsPersistAtom.get(),
        ]);
        rateDifferenceRes = buildSwapRateDifference({
          fromTokenPrice: fromToken.price,
          toTokenPrice: toToken.price,
          fromTokenCurrency: fromToken.currency,
          toTokenCurrency: toToken.currency,
          defaultTokenCurrency: currencyInfo.id,
          currencyMap,
          instantRate,
        });
      }

      const fromTokenAmountBN = new BigNumber(fromTokenAmount.value);
      const shouldUseStockLimitAlert =
        swapTypeSwitch === ESwapTabSwitchType.STOCK ||
        quoteResult?.protocol === EProtocolOfExchange.STOCK;
      // check min max amount
      if (quoteResult && quoteResult.limit?.min && !shouldUseStockLimitAlert) {
        const minAmountBN = new BigNumber(quoteResult.limit.min);
        if (fromTokenAmountBN.lt(minAmountBN)) {
          alertsRes = [
            ...alertsRes,
            {
              // eslint-disable-next-line onekey/no-app-locale-main-thread
              message: appLocale.intl.formatMessage(
                {
                  id: ETranslations.swap_page_alert_minimum_amount,
                },
                {
                  number: minAmountBN.toFixed(),
                  symbol: fromToken?.symbol ?? 'unknown',
                },
              ),
              alertLevel: ESwapAlertLevel.ERROR,
              inputShowError: true,
            },
          ];
        }
      }
      if (quoteResult && quoteResult.limit?.max && !shouldUseStockLimitAlert) {
        const maxAmountBN = new BigNumber(quoteResult.limit.max);
        if (fromTokenAmountBN.gt(maxAmountBN)) {
          alertsRes = [
            ...alertsRes,
            {
              // eslint-disable-next-line onekey/no-app-locale-main-thread
              message: appLocale.intl.formatMessage(
                {
                  id: ETranslations.swap_page_alert_maximum_amount,
                },
                {
                  number: maxAmountBN.toFixed(),
                  symbol: fromToken?.symbol ?? 'unknown',
                },
              ),
              alertLevel: ESwapAlertLevel.ERROR,
              inputShowError: true,
            },
          ];
        }
      }

      // check other fee
      const otherFeeInfo = quoteResult?.fee?.otherFeeInfos;
      if (otherFeeInfo?.length) {
        otherFeeInfo.forEach((item) => {
          const tokenAmountBN = new BigNumber(item.amount ?? 0);
          if (tokenAmountBN.gt(0)) {
            alertsRes = [
              ...alertsRes,
              {
                icon: 'HandCoinsOutline',
                // eslint-disable-next-line onekey/no-app-locale-main-thread
                title: appLocale.intl.formatMessage(
                  {
                    id: ETranslations.swap_page_alert_require_native_token_title,
                  },
                  {
                    n: numberFormat(tokenAmountBN.toFixed(), {
                      formatter: 'balance',
                    }),
                    token: item.token?.symbol ?? '',
                  },
                ),
                alertLevel: ESwapAlertLevel.WARNING,
                // eslint-disable-next-line onekey/no-app-locale-main-thread
                message: appLocale.intl.formatMessage({
                  id: ETranslations.swap_page_alert_require_native_token_content,
                }),
              },
            ];
          }
        });
      }

      if (tokenMetadata?.swapTokenMetadata) {
        const { buyToken, sellToken } = tokenMetadata.swapTokenMetadata;
        const buyTokenBuyTaxBN = new BigNumber(
          buyToken?.buyTaxBps ? buyToken?.buyTaxBps : 0,
        );
        const buyTokenSellTaxBN = new BigNumber(
          buyToken?.sellTaxBps ? buyToken?.sellTaxBps : 0,
        );
        const sellTokenBuyTaxBN = new BigNumber(
          sellToken?.buyTaxBps ? sellToken?.buyTaxBps : 0,
        );
        const sellTokenSellTaxBN = new BigNumber(
          sellToken?.sellTaxBps ? sellToken?.sellTaxBps : 0,
        );
        if (buyTokenBuyTaxBN.gt(0) || buyTokenSellTaxBN.gt(0)) {
          // eslint-disable-next-line onekey/no-app-locale-main-thread
          const actionLabel = appLocale.intl.formatMessage({
            id: buyTokenSellTaxBN.gt(buyTokenBuyTaxBN)
              ? ETranslations.swap_page_alert_tax_detected_sell
              : ETranslations.swap_page_alert_tax_detected_buy,
          });

          const showTax = BigNumber.maximum(
            buyTokenSellTaxBN,
            buyTokenBuyTaxBN,
          );
          alertsRes = [
            ...alertsRes,
            {
              icon: 'HandCoinsOutline',
              // eslint-disable-next-line onekey/no-app-locale-main-thread
              title: appLocale.intl.formatMessage(
                {
                  id: ETranslations.swap_page_alert_tax_detected_title,
                },
                {
                  percentage: `${showTax.dividedBy(100).toNumber()}%`,
                  token: toToken?.symbol ?? '',
                  action: actionLabel,
                },
              ),
              // eslint-disable-next-line onekey/no-app-locale-main-thread
              message: appLocale.intl.formatMessage({
                id: ETranslations.swap_page_alert_tax_detected,
              }),
              alertLevel: ESwapAlertLevel.INFO,
            },
          ];
        }
        if (sellTokenBuyTaxBN.gt(0) || sellTokenSellTaxBN.gt(0)) {
          // eslint-disable-next-line onekey/no-app-locale-main-thread
          const actionLabel = appLocale.intl.formatMessage({
            id: sellTokenSellTaxBN.gt(sellTokenBuyTaxBN)
              ? ETranslations.swap_page_alert_tax_detected_sell
              : ETranslations.swap_page_alert_tax_detected_buy,
          });
          const showTax = BigNumber.maximum(
            sellTokenBuyTaxBN,
            sellTokenSellTaxBN,
          );
          alertsRes = [
            ...alertsRes,
            {
              icon: 'HandCoinsOutline',
              // eslint-disable-next-line onekey/no-app-locale-main-thread
              title: appLocale.intl.formatMessage(
                {
                  id: ETranslations.swap_page_alert_tax_detected_title,
                },
                {
                  percentage: `${showTax.dividedBy(100).toNumber()}%`,
                  token: fromToken?.symbol ?? '',
                  action: actionLabel,
                },
              ),
              // eslint-disable-next-line onekey/no-app-locale-main-thread
              message: appLocale.intl.formatMessage({
                id: ETranslations.swap_page_alert_tax_detected,
              }),
              alertLevel: ESwapAlertLevel.INFO,
            },
          ];
        }
      }

      // check limit native should wrapped
      if (quoteResult?.shouldWrappedToken) {
        alertsRes = [
          ...alertsRes,
          {
            icon: 'ErrorSolid',
            // eslint-disable-next-line onekey/no-app-locale-main-thread
            title: appLocale.intl.formatMessage(
              {
                id: ETranslations.Limit_native_token_no_sell,
              },
              {
                token: quoteResult.fromTokenInfo.symbol,
              },
            ),
            alertLevel: ESwapAlertLevel.INFO,
            action: {
              actionType: ESwapAlertActionType.LIMIT_NATIVE_WRAPPED,
              actionData: {
                wrappedToken: quoteResult?.shouldWrappedToken,
              },
            },
          },
        ];
      }

      if (!isLatestStockWarningCheck()) {
        return;
      }

      set(swapAlertsAtom(), {
        states: alertsRes,
        quoteId: quoteResult?.quoteId ?? '',
      });
      set(rateDifferenceAtom(), rateDifferenceRes);
    },
  );

  loadSwapSelectTokenDetail = contextAtomMethod(
    async (
      get,
      set,
      type: ESwapDirectionType,
      swapAddressInfo: ReturnType<typeof useSwapAddressInfo>,
      fetchBalance?: boolean,
      swapTargetAddressInfo?: ReturnType<typeof useSwapAddressInfo>,
    ) => {
      const token =
        type === ESwapDirectionType.FROM
          ? get(swapSelectFromTokenAtom())
          : get(swapSelectToTokenAtom());
      const ownerAccountInfo =
        swapAddressInfo.accountInfo ?? swapAddressInfo.activeAccount;
      const targetAccountInfo =
        swapTargetAddressInfo?.accountInfo ??
        swapTargetAddressInfo?.activeAccount;
      const requestKey = buildSwapTokenDetailRequestKey({
        direction: type,
        token,
        walletId: ownerAccountInfo?.wallet?.id,
        indexedAccountId: ownerAccountInfo?.indexedAccount?.id,
        accountId: ownerAccountInfo?.account?.id,
        dbAccountId: ownerAccountInfo?.dbAccount?.id,
        deriveType: ownerAccountInfo?.deriveType,
        accountAddress:
          swapAddressInfo.address ??
          ownerAccountInfo?.account?.addressDetail?.address,
        resolvedNetworkId:
          type === ESwapDirectionType.TO
            ? token?.networkId
            : (swapAddressInfo.networkId ?? token?.networkId),
        targetWalletId:
          type === ESwapDirectionType.TO
            ? targetAccountInfo?.wallet?.id
            : undefined,
        targetIndexedAccountId:
          type === ESwapDirectionType.TO
            ? targetAccountInfo?.indexedAccount?.id
            : undefined,
        targetAccountId:
          type === ESwapDirectionType.TO
            ? targetAccountInfo?.account?.id
            : undefined,
        targetDbAccountId:
          type === ESwapDirectionType.TO
            ? targetAccountInfo?.dbAccount?.id
            : undefined,
        targetDeriveType:
          type === ESwapDirectionType.TO
            ? targetAccountInfo?.deriveType
            : undefined,
        targetAccountAddress:
          type === ESwapDirectionType.TO
            ? (swapTargetAddressInfo?.address ??
              targetAccountInfo?.account?.addressDetail?.address)
            : undefined,
        targetNetworkId:
          type === ESwapDirectionType.TO
            ? (swapTargetAddressInfo?.networkId ?? token?.networkId)
            : undefined,
        targetAddressInfoReady:
          type === ESwapDirectionType.TO
            ? swapTargetAddressInfo?.isAddressInfoReady
            : undefined,
      });
      const requestStart = startSwapTokenDetailRequest({
        direction: type,
        key: requestKey,
        state: get(swapTokenDetailRequestStateAtom()),
      });
      const requestIdentity = requestStart.identity;
      const existingBalance =
        type === ESwapDirectionType.FROM
          ? get(swapSelectedFromTokenBalanceAtom())
          : get(swapSelectedToTokenBalanceAtom());
      const canPreserveCommittedBalance =
        requestStart.isSameResource && Boolean(existingBalance);
      // Clear a different owner's value before publishing the new owner key.
      // This prevents any render from observing "new owner + old balance".
      if (!requestStart.isSameResource) {
        if (type === ESwapDirectionType.FROM) {
          set(swapSelectedFromTokenBalanceAtom(), '');
        } else {
          set(swapSelectedToTokenBalanceAtom(), '');
        }
      }
      set(swapTokenDetailRequestStateAtom(), requestStart.state);

      const isCurrentRequest = () =>
        isCurrentSwapTokenDetailRequest({
          direction: type,
          identity: requestIdentity,
          state: get(swapTokenDetailRequestStateAtom()),
        });
      const setBalance = (balance: string) => {
        if (!isCurrentRequest()) {
          return;
        }
        if (type === ESwapDirectionType.FROM) {
          set(swapSelectedFromTokenBalanceAtom(), balance);
        } else {
          set(swapSelectedToTokenBalanceAtom(), balance);
        }
      };

      set(swapSelectTokenDetailFetchingAtom(), (pre) => ({
        ...pre,
        [type]: true,
      }));

      let accountAddress: string | undefined;
      let accountNetworkId: string | undefined;
      let accountId: string | undefined;
      let balanceDisplay: string | undefined;
      let shouldWriteBalance = false;

      try {
        if (type === ESwapDirectionType.TO) {
          // Fetching the TO balance reuses the FROM account owner on the TO
          // network. The request identity is registered before either await.
          if (
            token?.networkId &&
            !networkUtils.isAllNetwork({ networkId: token.networkId })
          ) {
            try {
              const accountDeriveType =
                await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork(
                  {
                    networkId: token.networkId,
                  },
                );
              if (!isCurrentRequest()) {
                return;
              }
              const toAccountInfos =
                await backgroundApiProxy.serviceAccount.getNetworkAccount({
                  deriveType: accountDeriveType ?? 'default',
                  indexedAccountId: ownerAccountInfo?.indexedAccount?.id,
                  accountId: ownerAccountInfo?.indexedAccount?.id
                    ? undefined
                    : (ownerAccountInfo?.account?.id ?? ''),
                  dbAccount: ownerAccountInfo?.dbAccount,
                  networkId: token.networkId,
                });
              if (!isCurrentRequest()) {
                return;
              }
              if (toAccountInfos) {
                accountAddress = toAccountInfos.addressDetail?.address;
                accountNetworkId = toAccountInfos.addressDetail?.networkId;
                accountId = toAccountInfos.id;
              }
            } catch (e) {
              if (!isCurrentRequest()) {
                return;
              }
              console.error('swap_toToken_getNetworkAccountError--', e);
            }
          }
        } else {
          accountAddress = swapAddressInfo.address;
          accountNetworkId = swapAddressInfo.networkId;
          accountId = ownerAccountInfo?.account?.id;
        }

        if (
          (token &&
            accountAddress &&
            accountNetworkId &&
            accountNetworkId === token.networkId) ||
          (!token?.price && token)
        ) {
          if (
            token.accountAddress === accountAddress &&
            accountNetworkId === token.networkId &&
            token.balanceParsed &&
            !fetchBalance
          ) {
            const balanceParsedBN = new BigNumber(token.balanceParsed);
            balanceDisplay = balanceParsedBN.isNaN()
              ? '0.0'
              : balanceParsedBN.toFixed();
            shouldWriteBalance = true;
          } else {
            try {
              const detailInfo =
                await backgroundApiProxy.serviceSwap.fetchSwapTokenDetails({
                  networkId: token.networkId,
                  accountAddress,
                  accountId,
                  contractAddress: token.contractAddress,
                  direction: type,
                  currency: USD_CURRENCY_ID,
                });
              if (!isCurrentRequest()) {
                return;
              }
              if (detailInfo?.[0]) {
                const balanceParsedBN = new BigNumber(
                  detailInfo[0].balanceParsed ?? 0,
                );
                balanceDisplay = balanceParsedBN.isNaN()
                  ? '0.0'
                  : balanceParsedBN.toFixed();
                shouldWriteBalance = true;
                const condition: {
                  price?: string;
                  fiatValue?: string;
                  balanceParsed?: string;
                  reservationValue?: string;
                  logoURI?: string;
                  currency?: string;
                } = {};
                if (detailInfo[0].price) {
                  condition.price = detailInfo[0].price;
                }
                if (detailInfo[0].fiatValue) {
                  condition.fiatValue = detailInfo[0].fiatValue;
                }
                if (condition.price || condition.fiatValue) {
                  condition.currency = USD_CURRENCY_ID;
                }
                if (detailInfo[0].balanceParsed) {
                  condition.balanceParsed = detailInfo[0].balanceParsed;
                }
                if (detailInfo[0].reservationValue) {
                  condition.reservationValue = detailInfo[0].reservationValue;
                }
                if (detailInfo[0].logoURI) {
                  condition.logoURI = detailInfo[0].logoURI;
                }
                const newToken =
                  type === ESwapDirectionType.FROM
                    ? get(swapSelectFromTokenAtom())
                    : get(swapSelectToTokenAtom());
                if (
                  isCurrentRequest() &&
                  equalTokenNoCaseSensitive({
                    token1: newToken,
                    token2: token,
                  })
                ) {
                  if (type === ESwapDirectionType.FROM) {
                    set(swapSelectFromTokenAtom(), (pre) => {
                      if (pre) {
                        return {
                          ...pre,
                          ...condition,
                          accountAddress,
                        };
                      }
                    });
                  } else {
                    set(swapSelectToTokenAtom(), (pre) => {
                      if (pre) {
                        return {
                          ...pre,
                          ...condition,
                          accountAddress,
                        };
                      }
                    });
                  }
                }
              }
            } catch (e: any) {
              if (!isCurrentRequest()) {
                return;
              }
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
              if (e?.cause !== ESwapFetchCancelCause.SWAP_TOKENS_CANCEL) {
                // A same-owner refresh failure must not blank a valid balance.
                if (!canPreserveCommittedBalance) {
                  balanceDisplay = '0.0';
                  shouldWriteBalance = true;
                }
              }
            }
          }
        }

        if (!isCurrentRequest()) {
          return;
        }
        // The background service intentionally normalizes token-detail errors
        // to an empty list. Resolve a new owner to the same zero fallback used
        // by thrown fetch failures so the UI cannot remain on a skeleton
        // forever. A same-owner refresh only preserves a balance that was
        // already committed before this request started.
        if (!shouldWriteBalance && !canPreserveCommittedBalance) {
          balanceDisplay = '0.0';
          shouldWriteBalance = true;
        }
        if (!shouldWriteBalance) {
          return;
        }
        const newToken =
          type === ESwapDirectionType.FROM
            ? get(swapSelectFromTokenAtom())
            : get(swapSelectToTokenAtom());
        if (
          equalTokenNoCaseSensitive({ token1: newToken, token2: token }) ||
          (!token && !newToken)
        ) {
          setBalance(balanceDisplay ?? '');
        }
      } finally {
        // An older request must not clear the loading state owned by a newer one.
        if (isCurrentRequest()) {
          set(swapSelectTokenDetailFetchingAtom(), (pre) => ({
            ...pre,
            [type]: false,
          }));
        }
      }
    },
  );

  updateAllNetworkTokenList = contextAtomMethod(
    async (
      get,
      set,
      accountNetworkId: string,
      accountId?: string,
      accountAddress?: string,
      isFirstFetch?: boolean,
      allNetAccountId?: string,
      lpToken?: boolean,
      currency?: string,
    ) => {
      const protocol = get(swapTypeSwitchAtom());
      const shouldFetchOnlyAccountTokens = !isStockProtocol(protocol);
      const result = await backgroundApiProxy.serviceSwap.fetchSwapTokens({
        networkId: accountNetworkId,
        accountNetworkId,
        accountAddress,
        accountId,
        onlyAccountTokens: shouldFetchOnlyAccountTokens,
        isAllNetworkFetchAccountTokens: true,
        protocol,
        lpToken,
        currency,
      });
      if (result?.length) {
        if (isFirstFetch && allNetAccountId) {
          set(swapAllNetworkTokenListMapAtom(), (v) => {
            const oldTokens = v[allNetAccountId] ?? [];
            const newTokens =
              result.filter(
                (t) =>
                  !oldTokens?.find((tk) =>
                    equalTokenNoCaseSensitive({
                      token1: tk,
                      token2: t,
                    }),
                  ),
              ) ?? [];
            const needUpdateTokens =
              result.filter(
                (t) =>
                  !newTokens.find((tk) =>
                    equalTokenNoCaseSensitive({
                      token1: tk,
                      token2: t,
                    }),
                  ),
              ) ?? [];
            const filterTokens =
              oldTokens?.filter(
                (tk) =>
                  !needUpdateTokens.find((t) =>
                    equalTokenNoCaseSensitive({
                      token1: tk,
                      token2: t,
                    }),
                  ),
              ) ?? [];
            return {
              ...v,
              [allNetAccountId]: [
                ...filterTokens,
                ...needUpdateTokens,
                ...newTokens,
              ],
            };
          });
        } else {
          return result;
        }
      }
    },
  );

  swapLoadAllNetworkTokenList = contextAtomMethod(
    async (
      get,
      set,
      indexedAccountId?: string,
      otherWalletTypeAccountId?: string,
      lpToken?: boolean,
      currency?: string,
    ) => {
      const swapAllNetworkActionLock = get(swapAllNetworkActionLockAtom());
      const swapTypeSwitchValue = get(swapTypeSwitchAtom());
      const swapSupportNetworks = get(swapNetworks());
      let currentTypeSupportNetworks = swapSupportNetworks.filter(
        (item) => item.supportLimit,
      );
      if (
        swapTypeSwitchValue === ESwapTabSwitchType.SWAP ||
        swapTypeSwitchValue === ESwapTabSwitchType.BRIDGE
      ) {
        currentTypeSupportNetworks = swapSupportNetworks;
      } else if (swapTypeSwitchValue === ESwapTabSwitchType.STOCK) {
        currentTypeSupportNetworks = swapSupportNetworks.filter(
          (item) => item.supportStock,
        );
      }
      const tokenListSupportNetworks = lpToken
        ? currentTypeSupportNetworks.filter(
            isTokenSelectorDappTokenFilterSupportedNetworkBase,
          )
        : currentTypeSupportNetworks;
      const { accountIdKey, swapSupportAccounts } =
        await backgroundApiProxy.serviceSwap.getSupportSwapAllAccounts({
          indexedAccountId,
          otherWalletTypeAccountId,
          swapSupportNetworks: tokenListSupportNetworks,
        });
      const tokenListCacheKey = buildSwapAllNetworkTokenListCacheKey({
        accountId: accountIdKey,
        lpToken,
        currency,
        protocol: swapTypeSwitchValue,
      });
      if (swapAllNetworkActionLock[tokenListCacheKey]) {
        return;
      }
      if (swapSupportAccounts.length > 0) {
        set(swapAllNetworkActionLockAtom(), (v) => ({
          ...v,
          [tokenListCacheKey]: true,
        }));
        const currentSwapAllNetworkTokenList = get(
          swapAllNetworkTokenListMapAtom(),
        )[tokenListCacheKey];
        const accountAddressList = swapSupportAccounts
          .filter((item) => item.apiAddress)
          .filter(
            (item) => !networkUtils.isAllNetwork({ networkId: item.networkId }),
          );

        // Create tasks as functions to delay execution until batched
        const tasks = accountAddressList.map((networkDataString) => {
          const {
            apiAddress,
            networkId: accountNetworkId,
            accountId,
          } = networkDataString;
          return () =>
            this.updateAllNetworkTokenList.call(
              set,
              accountNetworkId,
              accountId,
              apiAddress,
              !currentSwapAllNetworkTokenList,
              tokenListCacheKey,
              lpToken,
              currency,
            );
        });

        try {
          // Execute requests in batches of 3 to prevent UI thread blocking
          const results = await this.executeBatched(tasks, 3);

          if (!currentSwapAllNetworkTokenList) {
            set(swapAllNetworkTokenListMapAtom(), (v) => {
              if (v[tokenListCacheKey] !== undefined) {
                return v;
              }
              return {
                ...v,
                [tokenListCacheKey]: [],
              };
            });
          } else {
            // Subsequent fetches: collect results and update atom
            const allTokensResult = results
              .filter((r) => r.status === 'fulfilled' && r.value)
              // eslint-disable-next-line @typescript-eslint/no-unsafe-return
              .map((r) => (r as PromiseFulfilledResult<any>).value)
              .filter(Boolean)
              .flat();
            set(swapAllNetworkTokenListMapAtom(), (v) => ({
              ...v,
              [tokenListCacheKey]: allTokensResult,
            }));
          }
        } finally {
          set(swapAllNetworkActionLockAtom(), (v) => ({
            ...v,
            [tokenListCacheKey]: false,
          }));
        }
      } else {
        set(swapAllNetworkTokenListMapAtom(), (v) => ({
          ...v,
          [tokenListCacheKey]: [],
        }));
      }
    },
  );

  swapProLoadSupportNetworksTokenList = contextAtomMethod(
    async (
      get,
      set,
      supportNetworks: ISwapNetwork[],
      indexedAccountId?: string,
      otherWalletTypeAccountId?: string,
    ) => {
      const positionNetworkIdsKey = supportNetworks
        .map((item) => item.networkId)
        .filter(Boolean)
        .toSorted()
        .join(',');
      const positionOwnerKey = buildSwapProPositionsOwnerKey({
        accountId: indexedAccountId ?? otherWalletTypeAccountId,
        networkIdsKey: positionNetworkIdsKey,
      });
      const previousRequestState = get(swapProPositionsRequestStateAtom());
      const requestId = previousRequestState.requestId + 1;
      const isLatestRequest = () => {
        const currentRequestState = get(swapProPositionsRequestStateAtom());
        return (
          currentRequestState.requestId === requestId &&
          currentRequestState.ownerKey === positionOwnerKey
        );
      };
      set(swapProPositionsRequestStateAtom(), {
        ownerKey: positionOwnerKey,
        requestId,
        status: 'loading',
      });
      set(swapProSupportNetworksTokenListLoadingAtom(), true);
      const cachedPositionEntry = positionOwnerKey
        ? get(swapProPositionsCacheAtom()).byOwner[positionOwnerKey]
        : undefined;
      // Never leave another account/network owner's live list visible while
      // this owner is loading. An exact cache entry is the only safe fallback.
      set(
        swapProSupportNetworksTokenListAtom(),
        cachedPositionEntry?.tokens ?? [],
      );
      const updatePositionsCache = (tokens: ISwapToken[]) => {
        if (!positionOwnerKey || !positionNetworkIdsKey) {
          return;
        }
        set(swapProPositionsCacheAtom(), (prev) => {
          const updatedAt = Date.now();
          const byOwner = {
            ...prev.byOwner,
            [positionOwnerKey]: {
              ...prev.byOwner[positionOwnerKey],
              ownerKey: positionOwnerKey,
              networkIdsKey: positionNetworkIdsKey,
              tokens,
              updatedAt,
            },
          };
          const entries = Object.entries(byOwner)
            .toSorted(([, a], [, b]) => b.updatedAt - a.updatedAt)
            .slice(0, SWAP_PRO_POSITIONS_CACHE_MAX_OWNERS);
          return {
            byOwner: Object.fromEntries(entries),
          };
        });
      };
      try {
        const {
          swapSupportAccounts: swapProSupportAccounts,
          supportAccountsFetchFailed,
        } = await backgroundApiProxy.serviceSwap.getSupportSwapAllAccounts({
          indexedAccountId,
          otherWalletTypeAccountId,
          swapSupportNetworks: supportNetworks,
        });
        if (supportAccountsFetchFailed) {
          if (isLatestRequest()) {
            set(swapProPositionsRequestStateAtom(), {
              ownerKey: positionOwnerKey,
              requestId,
              status: 'error',
            });
          }
          return;
        }
        let sortedResult: ISwapToken[] = [];
        if (swapProSupportAccounts.length > 0) {
          const accountAddressList = swapProSupportAccounts
            .filter((item) => item.apiAddress)
            .filter(
              (item) =>
                !networkUtils.isAllNetwork({ networkId: item.networkId }),
            );

          // Create tasks as functions to delay execution until batched
          const tasks = accountAddressList.map((networkDataString) => {
            const {
              apiAddress,
              networkId: accountNetworkId,
              accountId,
            } = networkDataString;
            return () =>
              backgroundApiProxy.serviceSwap.fetchSwapTokens({
                networkId: accountNetworkId,
                accountNetworkId,
                accountAddress: apiAddress,
                accountId,
                onlyAccountTokens: true,
                isAllNetworkFetchAccountTokens: true,
                protocol: ESwapTabSwitchType.SWAP,
                throwOnError: true,
              });
          });

          // Execute requests in batches of 3 to prevent UI thread blocking
          const results = await this.executeBatched(tasks, 3);
          if (results.some((result) => result.status === 'rejected')) {
            throw new OneKeyLocalError(
              'Failed to load the complete Swap Pro positions list',
            );
          }

          // Only commit a complete cross-network snapshot. A partial list can
          // otherwise make real positions disappear until the next refresh.
          sortedResult = results
            .flatMap((result) =>
              result.status === 'fulfilled' ? result.value : [],
            )
            .toSorted((a, b) => {
              return new BigNumber(b.fiatValue ?? '0').comparedTo(
                new BigNumber(a.fiatValue ?? '0'),
              );
            });
        }
        if (!isLatestRequest()) {
          return;
        }
        set(swapProSupportNetworksTokenListAtom(), sortedResult);
        updatePositionsCache(sortedResult);
        set(swapProPositionsRequestStateAtom(), {
          ownerKey: positionOwnerKey,
          requestId,
          status: 'settled',
        });
      } catch {
        if (isLatestRequest()) {
          set(swapProPositionsRequestStateAtom(), {
            ownerKey: positionOwnerKey,
            requestId,
            status: 'error',
          });
        }
      } finally {
        if (isLatestRequest()) {
          set(swapProSupportNetworksTokenListLoadingAtom(), false);
        }
      }
    },
  );

  swapTypeSwitchAction = contextAtomMethod(
    async (
      get,
      set,
      type: ESwapTabSwitchType,
      swapAccountNetworkId?: string,
    ) => {
      const oldType = get(swapTypeSwitchAtom());
      const normalizedType = getVisibleSwapTabSwitchType(type) ?? type;
      const oldVisibleType = getVisibleSwapTabSwitchType(oldType) ?? oldType;
      const isVisibleTabChange = oldVisibleType !== normalizedType;
      const isCrossingStockBoundary =
        (oldType === ESwapTabSwitchType.STOCK) !==
        (normalizedType === ESwapTabSwitchType.STOCK);
      if (isVisibleTabChange) {
        // All top-level Swap tabs share the amount atoms. Revoke the previous
        // draft synchronously before publishing the next visible tab. Internal
        // BRIDGE/SWAP protocol normalization remains in the same visible tab.
        set(swapFromTokenAmountAtom(), { value: '', isInput: false });
        set(swapToTokenAmountAtom(), { value: '', isInput: false });
        set(swapProInputAmountAtom(), '');
        set(swapProSliderValueAtom(), 0);
        set(swapAmountInputTabSessionAtom(), (sessionId) => sessionId + 1);
        const speedQuoteSessionState = get(swapSpeedQuoteSessionStateAtom());
        const activeSpeedQuoteSession = speedQuoteSessionState.activeSession;
        set(
          swapSpeedQuoteSessionStateAtom(),
          invalidateSwapSpeedQuoteSession(speedQuoteSessionState),
        );
        set(swapSpeedQuoteFetchingAtom(), false);
        set(swapSpeedQuoteResultAtom(), undefined);
        if (activeSpeedQuoteSession) {
          void backgroundApiProxy.serviceSwap.cancelFetchSpeedSwapQuoteV2(
            buildSwapSpeedQuoteCancelParams(activeSpeedQuoteSession),
          );
        }
      }
      if (isCrossingStockBoundary) {
        // The active balance is surface-owned. The ordinary Swap balance stays
        // cached behind swapActiveSelectedFromTokenBalanceAtom so returning
        // from Stock does not introduce another loading flash.
        set(swapSelectedToTokenBalanceAtom(), '');
        set(swapStockSelectedFromTokenBalanceAtom(), '');
        if (normalizedType === ESwapTabSwitchType.LIMIT) {
          set(swapSelectedFromTokenBalanceAtom(), '');
        }
      }
      if (oldType !== normalizedType) {
        const quoteSessionState = get(swapQuoteSessionStateAtom());
        const activeQuoteSession = quoteSessionState.activeSession;
        set(
          swapQuoteSessionStateAtom(),
          invalidateSwapQuoteSession(quoteSessionState),
        );
        set(swapQuoteCommittedStateAtom(), (state) =>
          reduceSwapQuoteCommittedState(state, { type: 'reset' }),
        );
        set(swapQuoteFetchingAtom(), false);
        set(swapQuoteEventErrorAtom(), undefined);
        set(swapQuoteActionLockAtom(), { actionLock: false });
        if (activeQuoteSession) {
          void backgroundApiProxy.serviceSwap.cancelFetchQuoteEventsV2({
            surfaceId: activeQuoteSession.surfaceId,
            requestId: activeQuoteSession.requestId,
          });
        }
      }
      let currentFromToken = get(swapSelectFromTokenAtom());
      let currentToToken = get(swapSelectToTokenAtom());
      if (
        oldType !== ESwapTabSwitchType.STOCK &&
        oldType !== ESwapTabSwitchType.LIMIT &&
        normalizedType === ESwapTabSwitchType.STOCK
      ) {
        set(
          swapLastNonLimitSelectedTokensAtom(),
          currentFromToken || currentToToken
            ? {
                sourceSwapType: oldVisibleType,
                fromToken: currentFromToken,
                toToken: currentToToken,
              }
            : undefined,
        );
      }
      const isSwitchingFromStockToNonStock =
        oldType === ESwapTabSwitchType.STOCK &&
        normalizedType !== ESwapTabSwitchType.STOCK;
      let stockExitDefaultTokens:
        | ReturnType<typeof buildSwapDefaultSelectedTokensForNetwork>
        | undefined;
      if (isSwitchingFromStockToNonStock) {
        const lastNonLimitSelectedTokens = get(
          swapLastNonLimitSelectedTokensAtom(),
        );
        const supportsToken = (token?: ISwapToken) =>
          !token ||
          get(swapNetworks()).some((net) => {
            if (net.networkId !== token.networkId) {
              return false;
            }
            if (normalizedType === ESwapTabSwitchType.LIMIT) {
              return net.supportLimit;
            }
            return net.supportSingleSwap || net.supportCrossChainSwap;
          });
        const shouldRestoreLastNonLimitSelectedTokens =
          normalizedType !== ESwapTabSwitchType.LIMIT &&
          lastNonLimitSelectedTokens &&
          (!lastNonLimitSelectedTokens.sourceSwapType ||
            lastNonLimitSelectedTokens.sourceSwapType === normalizedType) &&
          (lastNonLimitSelectedTokens.fromToken ||
            lastNonLimitSelectedTokens.toToken) &&
          supportsToken(lastNonLimitSelectedTokens.fromToken) &&
          supportsToken(lastNonLimitSelectedTokens.toToken);
        if (shouldRestoreLastNonLimitSelectedTokens) {
          currentFromToken = lastNonLimitSelectedTokens.fromToken;
          currentToToken = lastNonLimitSelectedTokens.toToken;
        } else {
          const defaultNetworkId =
            normalizedType === ESwapTabSwitchType.LIMIT
              ? getLimitDefaultNetworkId({
                  allowStaticFallback: true,
                  preferredNetworkId: swapAccountNetworkId,
                  swapSupportNetworks: get(swapNetworks()),
                })
              : (swapAccountNetworkId ??
                currentFromToken?.networkId ??
                currentToToken?.networkId);
          stockExitDefaultTokens = buildSwapDefaultSelectedTokensForNetwork({
            networkId: defaultNetworkId,
            swapType: normalizedType,
          });
          currentFromToken = stockExitDefaultTokens?.fromToken;
          currentToToken = stockExitDefaultTokens?.toToken;
        }
        set(swapSelectFromTokenAtom(), currentFromToken);
        set(swapSelectToTokenAtom(), currentToToken);
        set(swapSelectedTokensColdStartContextAtom(), undefined);
        set(swapInitialSelectedTokensSyncedAtom(), false);
      }
      if (
        !isSwitchingFromStockToNonStock &&
        oldType !== ESwapTabSwitchType.LIMIT &&
        normalizedType === ESwapTabSwitchType.LIMIT &&
        (currentFromToken || currentToToken)
      ) {
        set(swapLastNonLimitSelectedTokensAtom(), {
          sourceSwapType: oldType,
          fromToken: currentFromToken,
          toToken: currentToToken,
        });
      }
      // OK-49718: Clear quote list when switching type to prevent showing stale data
      set(swapQuoteListAtom(), []);
      set(swapQuoteCurrentEventProviderKeysAtom(), []);
      set(swapQuoteCurrentEventReceivedCountAtom(), 0);
      set(swapQuoteEventCompletedAtom(), false);
      set(swapQuoteEventTotalCountAtom(), { count: 0 });
      set(swapTypeSwitchAtom(), normalizedType);
      if (platformEnv.isNative && normalizedType === ESwapTabSwitchType.LIMIT) {
        return;
      }
      if (
        oldType === ESwapTabSwitchType.LIMIT &&
        normalizedType !== ESwapTabSwitchType.LIMIT
      ) {
        const lastNonLimitSelectedTokens = get(
          swapLastNonLimitSelectedTokensAtom(),
        );
        const shouldRestoreLastNonLimitSelectedTokens =
          lastNonLimitSelectedTokens &&
          (!lastNonLimitSelectedTokens.sourceSwapType ||
            lastNonLimitSelectedTokens.sourceSwapType === normalizedType);
        const swapSupportNetworks = get(swapNetworksIncludeAllNetworkAtom());
        const isFromTokenSupported =
          !lastNonLimitSelectedTokens?.fromToken ||
          swapSupportNetworks.some(
            (net) =>
              net.networkId === lastNonLimitSelectedTokens.fromToken?.networkId,
          );
        const isToTokenSupported =
          !lastNonLimitSelectedTokens?.toToken ||
          swapSupportNetworks.some(
            (net) =>
              net.networkId === lastNonLimitSelectedTokens.toToken?.networkId,
          );
        if (
          shouldRestoreLastNonLimitSelectedTokens &&
          (lastNonLimitSelectedTokens.fromToken ||
            lastNonLimitSelectedTokens.toToken) &&
          isFromTokenSupported &&
          isToTokenSupported
        ) {
          this.cleanManualSelectQuoteProviders.call(set);
          set(swapSelectFromTokenAtom(), lastNonLimitSelectedTokens.fromToken);
          set(swapSelectToTokenAtom(), lastNonLimitSelectedTokens.toToken);
          const sortNetworkId =
            lastNonLimitSelectedTokens.fromToken?.networkId ??
            lastNonLimitSelectedTokens.toToken?.networkId;
          if (sortNetworkId) {
            void this.syncNetworksSort.call(set, sortNetworkId);
          }
          return;
        }
      }
      const fromTokenAmount = get(swapFromTokenAmountAtom());
      const fromTokenAmountBN = new BigNumber(fromTokenAmount.value);
      if (
        normalizedType === ESwapTabSwitchType.LIMIT &&
        !fromTokenAmountBN.isNaN() &&
        !fromTokenAmountBN.isZero()
      ) {
        set(swapFromTokenAmountAtom(), (o) => ({ ...o, isInput: true }));
      }
      this.cleanManualSelectQuoteProviders.call(set);
      const swapSupportNetworks = get(swapNetworksIncludeAllNetworkAtom());
      let fromToken = get(swapSelectFromTokenAtom());
      let toToken = get(swapSelectToTokenAtom());
      const isStockExitDefaultToken = (token?: ISwapToken) =>
        Boolean(
          token &&
          stockExitDefaultTokens &&
          (equalTokenNoCaseSensitive({
            token1: token,
            token2: stockExitDefaultTokens.fromToken,
          }) ||
            equalTokenNoCaseSensitive({
              token1: token,
              token2: stockExitDefaultTokens.toToken,
            })),
        );
      const defaultNetworkId =
        normalizedType === ESwapTabSwitchType.LIMIT
          ? getLimitDefaultNetworkId({
              preferredNetworkId: swapAccountNetworkId,
              swapSupportNetworks,
            })
          : swapAccountNetworkId;
      const fromNetworkDefault = swapDefaultSetTokens[defaultNetworkId ?? ''];
      if (
        fromToken &&
        !isStockExitDefaultToken(fromToken) &&
        !swapSupportNetworks.some(
          (net) => net.networkId === fromToken?.networkId,
        )
      ) {
        void this.resetSwapTokenData.call(set, ESwapDirectionType.FROM);
        fromToken = undefined;
      }
      if (
        toToken &&
        !isStockExitDefaultToken(toToken) &&
        !swapSupportNetworks.some((net) => net.networkId === toToken?.networkId)
      ) {
        void this.resetSwapTokenData.call(set, ESwapDirectionType.TO);
        toToken = undefined;
      }
      if (
        defaultNetworkId &&
        swapSupportNetworks.some((net) => net.networkId === defaultNetworkId)
      ) {
        if (normalizedType === ESwapTabSwitchType.SWAP) {
          if (
            !fromToken &&
            fromNetworkDefault?.fromToken?.isNative &&
            !toToken?.isNative
          ) {
            set(swapSelectFromTokenAtom(), fromNetworkDefault?.fromToken);
            fromToken = fromNetworkDefault.fromToken;
          }
          if (fromToken && !toToken) {
            const needChangeToToken = this.needChangeToken({
              token: fromToken,
              toToken,
              swapTypeSwitchValue: normalizedType,
            });
            if (needChangeToToken) {
              set(swapSelectToTokenAtom(), needChangeToToken);
              void this.syncNetworksSort.call(set, needChangeToToken.networkId);
            }
          }
        } else if (normalizedType === ESwapTabSwitchType.LIMIT) {
          if (
            !fromToken &&
            fromNetworkDefault?.limitFromToken &&
            !equalTokenNoCaseSensitive({
              token1: fromNetworkDefault?.limitFromToken,
              token2: toToken,
            })
          ) {
            set(swapSelectFromTokenAtom(), fromNetworkDefault?.limitFromToken);
            fromToken = fromNetworkDefault.limitFromToken;
          }
          if (
            !toToken &&
            fromNetworkDefault?.limitToToken &&
            !equalTokenNoCaseSensitive({
              token1: fromNetworkDefault?.limitToToken,
              token2: fromToken,
            })
          ) {
            set(swapSelectToTokenAtom(), fromNetworkDefault?.limitToToken);
            toToken = fromNetworkDefault.limitToToken;
            if (fromNetworkDefault?.limitToToken?.networkId) {
              void this.syncNetworksSort.call(
                set,
                fromNetworkDefault?.limitToToken?.networkId,
              );
            }
          }
          // limit only support single network
          if (toToken?.networkId !== fromToken?.networkId) {
            if (fromNetworkDefault?.limitToToken) {
              if (
                !fromToken ||
                !equalsIgnoreCase(
                  fromToken?.contractAddress,
                  fromNetworkDefault?.limitToToken?.contractAddress,
                )
              ) {
                set(swapSelectToTokenAtom(), fromNetworkDefault?.limitToToken);
                toToken = fromNetworkDefault.limitToToken;
                if (fromNetworkDefault?.limitToToken?.networkId) {
                  void this.syncNetworksSort.call(
                    set,
                    fromNetworkDefault?.limitToToken?.networkId,
                  );
                }
              } else if (
                fromToken &&
                !equalsIgnoreCase(
                  fromToken?.contractAddress,
                  fromNetworkDefault?.limitFromToken?.contractAddress,
                )
              ) {
                set(
                  swapSelectToTokenAtom(),
                  fromNetworkDefault?.limitFromToken,
                );
                toToken = fromNetworkDefault.limitFromToken;
                if (fromNetworkDefault?.limitFromToken?.networkId) {
                  void this.syncNetworksSort.call(
                    set,
                    fromNetworkDefault?.limitFromToken?.networkId,
                  );
                }
              }
            } else {
              void this.resetSwapTokenData.call(set, ESwapDirectionType.TO);
            }
          }
          const fromLimitTokenDefault = fromNetworkDefault?.limitFromToken;
          if (
            fromToken &&
            fromToken.isNative &&
            !equalTokenNoCaseSensitive({
              token1: toToken,
              token2: fromLimitTokenDefault,
            })
          ) {
            set(swapSelectFromTokenAtom(), fromLimitTokenDefault);
            fromToken = fromLimitTokenDefault;
          }
        }
      }
    },
  );

  limitMarketPriceRun = contextAtomMethod(
    async (
      get,
      set,
      fromToken?: ISwapToken,
      toToken?: ISwapToken,
      requestId?: number,
    ) => {
      try {
        if (fromToken && toToken) {
          const { fromTokenPrice, toTokenPrice } =
            await backgroundApiProxy.serviceSwap.fetchLimitMarketPrice({
              fromToken,
              toToken,
            });
          if (requestId !== this.limitOrderMarketPriceRequestId) {
            return;
          }
          const fromTokenPriceInfo = {
            tokenInfo: fromToken,
            price: fromTokenPrice || (fromToken.price ?? ''),
          };
          const toTokenPriceInfo = {
            tokenInfo: toToken,
            price: toTokenPrice || (toToken.price ?? ''),
          };
          set(limitOrderMarketPriceAtom(), (v) => ({
            ...v,
            fromTokenPriceInfo,
            toTokenPriceInfo,
          }));
        }
      } catch (error) {
        console.error(error);
      }
      if (requestId !== this.limitOrderMarketPriceRequestId) {
        return;
      }
      this.limitOrderMarketPriceInterval = setTimeout(() => {
        void this.limitOrderMarketPriceIntervalAction.call(
          set,
          fromToken,
          toToken,
        );
      }, ESwapLimitOrderMarketPriceUpdateInterval);
    },
  );

  limitOrderMarketPriceIntervalAction = contextAtomMethod(
    async (get, set, fromToken?: ISwapToken, toToken?: ISwapToken) => {
      this.limitOrderMarketPriceRequestId += 1;
      const requestId = this.limitOrderMarketPriceRequestId;
      if (this.limitOrderMarketPriceInterval) {
        clearInterval(this.limitOrderMarketPriceInterval);
      }
      const type = get(swapTypeSwitchAtom());
      if (type !== ESwapTabSwitchType.LIMIT) {
        set(limitOrderMarketPriceAtom(), {});
        return;
      }
      if (checkWrappedTokenPair({ fromToken, toToken })) {
        set(limitOrderMarketPriceAtom(), {});
        return;
      }
      await this.limitMarketPriceRun.call(set, fromToken, toToken, requestId);
    },
  );

  swapProTokenMarketDetailFetchAction = contextAtomMethod(
    async (get, set, contractAddress: string, networkId: string) => {
      try {
        set(swapProTokenMarketDetailInfoLoadingAtom(), true);
        const tokenDetail =
          await backgroundApiProxy.serviceMarketV2.fetchMarketTokenDetailByTokenAddress(
            contractAddress,
            networkId,
          );
        const responseData = tokenDetail;

        if (
          typeof responseData?.data?.token?.name === 'undefined' ||
          responseData.data.token.name === ''
        ) {
          console.warn('Token detail is not available');
          return;
        }

        // Extract token and websocket data from new response format
        const tokenData = responseData.data.token;
        const websocketConfig = responseData.data.websocket;
        const currentSelectToken = get(swapProSelectTokenAtom());
        const currentTokenDetail = get(swapProTokenMarketDetailInfoAtom());
        const isSameToken =
          currentTokenDetail &&
          equalTokenNoCaseSensitive({
            token1: {
              networkId,
              contractAddress: tokenData.address,
            },
            token2: {
              networkId,
              contractAddress: currentTokenDetail.address || '',
            },
          });
        const hasKLinePrice = isSameToken && currentTokenDetail?.lastUpdated;

        const finalTokenData = {
          ...(hasKLinePrice
            ? {
                ...tokenData,
                price: currentTokenDetail.price, // Always use K-line price
                lastUpdated: currentTokenDetail.lastUpdated,
              }
            : tokenData),
          networkId,
        };
        set(swapProTokenMarketDetailInfoAtom(), finalTokenData);
        set(
          swapProTokenMarketDetailPerpsInfoAtom(),
          responseData.data.perpsInfo,
        );
        set(swapProTokenDetailWebsocketAtom(), websocketConfig);
        if (
          currentSelectToken &&
          equalTokenNoCaseSensitive({
            token1: {
              networkId,
              contractAddress,
            },
            token2: currentSelectToken,
          })
        ) {
          set(swapProSelectTokenAtom(), {
            ...currentSelectToken,
            price: finalTokenData.price,
          });
        }
      } catch (error) {
        console.error('swap__tokenDetail error', error);
      } finally {
        set(swapProTokenMarketDetailInfoLoadingAtom(), false);
      }
    },
  );
}

const createActions = memoFn(() => new ContentJotaiActionsSwap());

export const useSwapActions = () => {
  const actions = createActions();
  const selectFromToken = actions.selectFromToken.use();
  const selectToToken = actions.selectToToken.use();
  const selectStockExecutionTokens = actions.selectStockExecutionTokens.use();
  const alternationToken = actions.alternationToken.use();
  const syncNetworksSort = actions.syncNetworksSort.use();
  const catchSwapTokensMap = actions.catchSwapTokensMap.use();
  const quoteAction = actions.quoteAction.use();
  const checkSwapWarning = actions.checkSwapWarning.use();
  const tokenListFetchAction = actions.tokenListFetchAction.use();
  const quoteEventHandler = actions.quoteEventHandler.use();
  const quoteEventHandlerV2 = actions.quoteEventHandlerV2.use();
  const closeQuoteEvent = actions.closeQuoteEvent.use();
  const loadSwapSelectTokenDetail = actions.loadSwapSelectTokenDetail.use();
  const swapLoadAllNetworkTokenList = actions.swapLoadAllNetworkTokenList.use();
  const swapTypeSwitchAction = actions.swapTypeSwitchAction.use();
  const limitOrderMarketPriceIntervalAction =
    actions.limitOrderMarketPriceIntervalAction.use();
  const swapProTokenMarketDetailFetchAction =
    actions.swapProTokenMarketDetailFetchAction.use();
  const swapProLoadSupportNetworksTokenList =
    actions.swapProLoadSupportNetworksTokenList.use();
  const quoteSpeedAction = actions.quoteSpeedAction.use();
  const cancelSpeedQuote = actions.cancelSpeedQuote.use();
  const cleanSpeedQuote = actions.cleanSpeedQuote.use();
  const setSwapProSelectToken = actions.setSwapProSelectToken.use();
  const resetSwapTokenData = actions.resetSwapTokenData.use();
  const resetQuoteAction = actions.resetQuoteAction.use();
  const invalidateQuoteIntent = actions.invalidateQuoteIntent.use();
  const {
    cleanQuoteInterval,
    needChangeToken,
    cleanLimitOrderMarketPriceInterval,
  } = actions;

  return useRef({
    selectFromToken,
    quoteAction,
    selectToToken,
    selectStockExecutionTokens,
    alternationToken,
    syncNetworksSort,
    catchSwapTokensMap,
    cleanQuoteInterval,
    tokenListFetchAction,
    checkSwapWarning,
    loadSwapSelectTokenDetail,
    quoteEventHandler,
    quoteEventHandlerV2,
    swapLoadAllNetworkTokenList,
    closeQuoteEvent,
    swapTypeSwitchAction,
    needChangeToken,
    limitOrderMarketPriceIntervalAction,
    cleanLimitOrderMarketPriceInterval,
    swapProTokenMarketDetailFetchAction,
    swapProLoadSupportNetworksTokenList,
    quoteSpeedAction,
    cancelSpeedQuote,
    cleanSpeedQuote,
    setSwapProSelectToken,
    resetSwapTokenData,
    resetQuoteAction,
    invalidateQuoteIntent,
  });
};
