import { useRef } from 'react';

import BigNumber from 'bignumber.js';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ESwapDirection } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/SwapPanel/hooks/useTradeType';
import type { useSwapAddressInfo } from '@onekeyhq/kit/src/views/Swap/hooks/useSwapAccount';
import { updateSwapBalanceDisplayCache } from '@onekeyhq/kit/src/views/Swap/utils/swapBalanceDisplayCacheUtils';
import { buildSwapDefaultSelectedTokensForNetwork } from '@onekeyhq/kit/src/views/Swap/utils/swapColdStartTokenCacheUtils';
import { buildSwapNetworkReadyKey } from '@onekeyhq/kit/src/views/Swap/utils/swapNetworkCacheUtils';
import {
  removeSwapNoConnectWalletAlerts,
  shouldShowSwapAccountUnsupportedAlert,
} from '@onekeyhq/kit/src/views/Swap/utils/swapNoWalletWarningGuard';
import {
  getValidSwapProPositionsCache,
  shouldReuseSwapProPositionsCache,
  upsertSwapProPositionsCacheEntry,
} from '@onekeyhq/kit/src/views/Swap/utils/swapProPositionsCacheUtils';
import type { ISwapProTokenCarryUtils } from '@onekeyhq/kit/src/views/Swap/utils/swapProTokenCarryUtils';
import { buildSwapRateDifference } from '@onekeyhq/kit/src/views/Swap/utils/swapRateDifferenceUtils';
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
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { memoFn } from '@onekeyhq/shared/src/utils/cacheUtils';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import { equalsIgnoreCase } from '@onekeyhq/shared/src/utils/stringUtils';
import { buildSwapSelectedTokensColdStartAccountKey } from '@onekeyhq/shared/src/utils/swapColdStartCacheSnapshotUtils';
import { getVisibleSwapTabSwitchType } from '@onekeyhq/shared/src/utils/swapTypeUtils';
import tokenRebaseUtils from '@onekeyhq/shared/src/utils/tokenRebaseUtils';
import {
  buildSwapAllNetworkTokenListCacheKey,
  dedupeTokenSelectorNetworkAccounts,
  isTokenSelectorDappTokenFilterSupportedNetworkBase,
} from '@onekeyhq/shared/src/utils/tokenSelectorFilterUtils';
import {
  checkWrappedTokenPair,
  equalTokenNoCaseSensitive,
} from '@onekeyhq/shared/src/utils/tokenUtils';
import {
  getSwapBridgeDefaultToToken,
  swapDefaultSetTokens,
  swapQuoteIntervalMaxCount,
  swapRefreshInterval,
  swapStockTokenListMaxCount,
  swapTokenCatchMapMaxCount,
} from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type {
  ESwapQuoteSource,
  IFetchQuoteResult,
  IFetchQuotesParams,
  IFetchTokensParams,
  ISwapAlertActionData,
  ISwapAlertState,
  ISwapLimitPriceInfo,
  ISwapNetwork,
  ISwapPreSwapData,
  ISwapQuoteEventAutoSlippage,
  ISwapQuoteEventData,
  ISwapQuoteEventError,
  ISwapQuoteEventInfo,
  ISwapQuoteEventPayload,
  ISwapQuoteEventQuoteResult,
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
  type ISwapInputAmountDraft,
  type ISwapQuoteEventErrorState,
  type ISwapTokenAmountState,
  buildSwapProPositionsOwnerKey,
  contextAtomMethod,
  limitOrderMarketPriceAtom,
  rateDifferenceAtom,
  swapAlertsAtom,
  swapAllNetworkActionLockAtom,
  swapAllNetworkTokenListMapAtom,
  swapAutoSlippageSuggestedValueAtom,
  swapBalanceDisplayCacheAtom,
  swapBuildTxFetchingAtom,
  swapFromTokenAmountAtom,
  swapInitialSelectedTokensSyncedAtom,
  swapInputAmountDraftsAtom,
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
  swapProPositionsCurrentOwnerKeyAtom,
  swapProPositionsDataOwnerKeyAtom,
  swapProPositionsRequestIdAtom,
  swapProPositionsRequestIdsAtom,
  swapProSelectTokenAtom,
  swapProSellToTokenAtom,
  swapProSupportNetworksTokenListAtom,
  swapProTokenBalanceLoadingAtom,
  swapProTokenBalanceRequestIdAtom,
  swapProTokenDetailWebsocketAtom,
  swapProTokenMarketDetailInfoAtom,
  swapProTokenMarketDetailInfoLoadingAtom,
  swapProTradeTypeAtom,
  swapProUseSelectBuyTokenAtom,
  swapProUserSelectedTokenAtom,
  swapProviderSupportReceiveAddressAtom,
  swapQuoteActionLockAtom,
  swapQuoteAutoRefreshTimerAtom,
  swapQuoteCurrentEventProviderKeysAtom,
  swapQuoteCurrentEventReceivedCountAtom,
  swapQuoteCurrentSelectAtom,
  swapQuoteEventCompletedAtom,
  swapQuoteEventErrorAtom,
  swapQuoteEventTotalCountAtom,
  swapQuoteFetchingAtom,
  swapQuoteIntervalCountAtom,
  swapQuoteListAtom,
  swapSelectFromTokenAtom,
  swapSelectToTokenAtom,
  swapSelectTokenDetailFetchingAtom,
  swapSelectedFromTokenBalanceAtom,
  swapSelectedToTokenBalanceAtom,
  swapSelectedTokensColdStartContextAtom,
  swapShouldRefreshQuoteAtom,
  swapSilenceQuoteLoading,
  swapStockExecutionTokenSyncIdAtom,
  swapStockExecutionTokensAtom,
  swapStockSelectedFromTokenBalanceAtom,
  swapStockSelectedTokenAtom,
  swapToTokenAmountAtom,
  swapTokenFetchingAtom,
  swapTokenMapAtom,
  swapTokenMetadataAtom,
  swapTypeSwitchAtom,
  swapUserSelectedTokensAtom,
  swapWarningRequestIdAtom,
} from './atoms';
import {
  ESwapQuoteRefreshAction,
  SWAP_INCOGNITO_QUOTE_PROVIDER_COUNT_CAP,
  buildSwapQuoteProviderKey,
  getSwapQuoteEventProgressTotalCount,
  getSwapQuoteProgressState,
  hasSwapZeroProviderQuoteEvent,
  isSameSwapQuoteAmountValue,
  isSwapOrBridgeQuoteType,
  isSwapQuoteActionable,
  isSwapQuoteEventFetching,
  resolveSwapQuoteRefreshAction,
} from './quoteProgress';

type IIndependentSwapInputAmountType =
  | ESwapTabSwitchType.SWAP
  | ESwapTabSwitchType.STOCK
  | ESwapTabSwitchType.LIMIT;

const EMPTY_SWAP_TOKEN_KEYS = new Set<string>();

function isIndependentSwapInputAmountType(
  type: ESwapTabSwitchType,
): type is IIndependentSwapInputAmountType {
  return (
    type === ESwapTabSwitchType.SWAP ||
    type === ESwapTabSwitchType.STOCK ||
    type === ESwapTabSwitchType.LIMIT
  );
}

function buildSwapInputAmountDraft({
  fromTokenAmount,
  toTokenAmount,
  fromToken,
  toToken,
}: {
  fromTokenAmount: ISwapTokenAmountState;
  toTokenAmount: ISwapTokenAmountState;
  fromToken?: ISwapToken;
  toToken?: ISwapToken;
}): ISwapInputAmountDraft | undefined {
  const emptyAmount = { value: '', isInput: false };
  if (fromTokenAmount.isInput && fromTokenAmount.value) {
    return {
      fromTokenAmount,
      toTokenAmount: emptyAmount,
      fromToken,
      toToken,
    };
  }
  if (toTokenAmount.isInput && toTokenAmount.value) {
    return {
      fromTokenAmount: emptyAmount,
      toTokenAmount,
      fromToken,
      toToken,
    };
  }
  return undefined;
}

function isSameOptionalSwapToken({
  token1,
  token2,
}: {
  token1?: ISwapToken;
  token2?: ISwapToken;
}) {
  return (
    (!token1 && !token2) ||
    equalTokenNoCaseSensitive({
      token1,
      token2,
    })
  );
}

function isSwapInputAmountDraftForTokenPair({
  draft,
  fromToken,
  toToken,
}: {
  draft: ISwapInputAmountDraft;
  fromToken?: ISwapToken;
  toToken?: ISwapToken;
}) {
  const hasInputToken =
    (draft.fromTokenAmount.isInput && draft.fromToken) ||
    (draft.toTokenAmount.isInput && draft.toToken);
  return Boolean(
    hasInputToken &&
    isSameOptionalSwapToken({
      token1: draft.fromToken,
      token2: fromToken,
    }) &&
    isSameOptionalSwapToken({
      token1: draft.toToken,
      token2: toToken,
    }),
  );
}

function getSelectedPairLimitPriceRate({
  protocol,
  limitPriceUseRate,
  fromToken,
  toToken,
}: {
  protocol: ESwapTabSwitchType;
  limitPriceUseRate: ISwapLimitPriceInfo;
  fromToken?: ISwapToken;
  toToken?: ISwapToken;
}) {
  if (protocol !== ESwapTabSwitchType.LIMIT || !limitPriceUseRate.rate) {
    return undefined;
  }

  const isSelectedPair =
    equalTokenNoCaseSensitive({
      token1: limitPriceUseRate.fromToken,
      token2: fromToken,
    }) &&
    equalTokenNoCaseSensitive({
      token1: limitPriceUseRate.toToken,
      token2: toToken,
    });

  return isSelectedPair ? limitPriceUseRate.rate : undefined;
}

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

type ISwapQuoteActionOverride = {
  fromToken: ISwapToken;
  toToken: ISwapToken;
  fromTokenAmount: string;
  toTokenAmount?: string;
  type: ESwapTabSwitchType;
  source?: ESwapQuoteSource;
  manualRefresh?: boolean;
};

function isQuoteEventProtocolForCurrentSwapType({
  currentSwapType,
  protocol,
}: {
  currentSwapType: ESwapTabSwitchType;
  protocol?: string;
}) {
  switch (currentSwapType) {
    case ESwapTabSwitchType.LIMIT:
      return (
        protocol === ESwapTabSwitchType.LIMIT ||
        protocol === EProtocolOfExchange.LIMIT
      );
    case ESwapTabSwitchType.PRIVATE_SEND:
      return (
        protocol === ESwapTabSwitchType.PRIVATE_SEND ||
        protocol === EProtocolOfExchange.PRIVATE_SEND
      );
    case ESwapTabSwitchType.STOCK:
      return isStockProtocol(protocol);
    case ESwapTabSwitchType.BRIDGE:
    case ESwapTabSwitchType.SWAP:
      return (
        protocol === ESwapTabSwitchType.BRIDGE ||
        protocol === ESwapTabSwitchType.SWAP ||
        protocol === EProtocolOfExchange.SWAP
      );
    default:
      return false;
  }
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
      isSameSwapQuoteAmountValue({
        currentAmount: fromTokenAmount,
        requestAmount: quoteEventError.fromTokenAmount,
      })),
  );
}

function isCurrentQuoteEventParams({
  currentQuoteRequestId,
  currentSwapType,
  fromToken,
  fromTokenAmount,
  params,
  quoteRequestActive,
  quoteRequestId,
  toToken,
  toTokenAmount,
  tokenPairs,
}: {
  currentQuoteRequestId?: string;
  currentSwapType: ESwapTabSwitchType;
  fromToken?: ISwapToken;
  fromTokenAmount?: string;
  params: IFetchQuotesParams;
  quoteRequestActive: boolean;
  quoteRequestId: string;
  toToken?: ISwapToken;
  toTokenAmount?: string;
  tokenPairs: { fromToken: ISwapToken; toToken: ISwapToken };
}) {
  const isExpectedProtocol = isQuoteEventProtocolForCurrentSwapType({
    currentSwapType,
    protocol: params.protocol,
  });
  const isSameTokenPair =
    equalTokenNoCaseSensitive({
      token1: tokenPairs.fromToken,
      token2: fromToken,
    }) &&
    equalTokenNoCaseSensitive({
      token1: tokenPairs.toToken,
      token2: toToken,
    });
  const quoteKind = params.kind ?? ESwapQuoteKind.SELL;
  const requestAmount =
    quoteKind === ESwapQuoteKind.BUY
      ? params.toTokenAmount
      : params.fromTokenAmount;
  const isSameInputAmount =
    requestAmount !== undefined &&
    isSameSwapQuoteAmountValue({
      currentAmount:
        quoteKind === ESwapQuoteKind.BUY ? toTokenAmount : fromTokenAmount,
      requestAmount,
    });
  return Boolean(
    quoteRequestActive &&
    currentQuoteRequestId === quoteRequestId &&
    isExpectedProtocol &&
    isSameTokenPair &&
    isSameInputAmount,
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
  private limitOrderMarketPriceInterval:
    | ReturnType<typeof setTimeout>
    | undefined;

  private limitOrderMarketPriceRequestId = 0;

  scheduleQuoteAutoRefresh = contextAtomMethod(
    (
      get,
      set,
      event: Pick<
        ISwapQuoteEventPayload,
        'accountId' | 'params' | 'quoteRequestId' | 'tokenPairs'
      >,
    ) => {
      this.cleanQuoteInterval.call(set);
      const currentSwapType =
        get(swapQuoteActionLockAtom()).type ?? get(swapTypeSwitchAtom());
      const supportsAutoRefresh =
        isSwapOrBridgeQuoteType(currentSwapType) ||
        currentSwapType === ESwapTabSwitchType.STOCK;
      if (!supportsAutoRefresh || get(swapShouldRefreshQuoteAtom())) {
        return;
      }

      const quoteAutoRefreshTimer = setTimeout(() => {
        set(swapQuoteAutoRefreshTimerAtom(), undefined);
        const currentQuoteRequest = get(swapQuoteActionLockAtom());
        const activeSwapType =
          currentQuoteRequest.type ?? get(swapTypeSwitchAtom());
        const currentFromToken =
          currentQuoteRequest.fromToken ?? get(swapSelectFromTokenAtom());
        const currentToToken =
          currentQuoteRequest.toToken ?? get(swapSelectToTokenAtom());
        const quoteKind = event.params.kind ?? ESwapQuoteKind.SELL;
        const currentInputAmount =
          quoteKind === ESwapQuoteKind.BUY
            ? (currentQuoteRequest.toTokenAmount ??
              get(swapToTokenAmountAtom()).value)
            : (currentQuoteRequest.fromTokenAmount ??
              get(swapFromTokenAmountAtom()).value);
        const requestInputAmount =
          quoteKind === ESwapQuoteKind.BUY
            ? event.params.toTokenAmount
            : event.params.fromTokenAmount;
        const isCurrentRefreshScope =
          currentQuoteRequest.quoteRequestId === event.quoteRequestId &&
          (isSwapOrBridgeQuoteType(activeSwapType) ||
            activeSwapType === ESwapTabSwitchType.STOCK) &&
          isQuoteEventProtocolForCurrentSwapType({
            currentSwapType: activeSwapType,
            protocol: event.params.protocol,
          }) &&
          equalTokenNoCaseSensitive({
            token1: currentFromToken,
            token2: event.tokenPairs.fromToken,
          }) &&
          equalTokenNoCaseSensitive({
            token1: currentToToken,
            token2: event.tokenPairs.toToken,
          }) &&
          requestInputAmount !== undefined &&
          isSameSwapQuoteAmountValue({
            currentAmount: currentInputAmount,
            requestAmount: requestInputAmount,
          });
        if (!isCurrentRefreshScope || get(swapShouldRefreshQuoteAtom())) {
          return;
        }

        const refreshTransition = resolveSwapQuoteRefreshAction({
          automaticRefreshCount: get(swapQuoteIntervalCountAtom()),
          maxAutomaticRefreshCount: swapQuoteIntervalMaxCount,
        });
        if (
          refreshTransition.action ===
          ESwapQuoteRefreshAction.RequireManualRefresh
        ) {
          this.requireManualQuoteRefresh.call(set);
          return;
        }

        set(
          swapQuoteIntervalCountAtom(),
          refreshTransition.nextAutomaticRefreshCount,
        );
        void this.quoteAction.call(
          set,
          {
            key: event.params.autoSlippage
              ? ESwapSlippageSegmentKey.AUTO
              : ESwapSlippageSegmentKey.CUSTOM,
            value: event.params.slippagePercentage,
          },
          event.params.userAddress,
          event.accountId,
          undefined, // Approval block only applies to the first post-approval quote.
          true,
          quoteKind,
          undefined,
          event.params.receivingAddress,
          event.params.incognito,
          {
            fromToken: event.tokenPairs.fromToken,
            toToken: event.tokenPairs.toToken,
            fromTokenAmount: event.params.fromTokenAmount ?? '',
            toTokenAmount: event.params.toTokenAmount,
            type: activeSwapType,
            source: event.params.source,
          },
        );
      }, swapRefreshInterval);
      set(swapQuoteAutoRefreshTimerAtom(), quoteAutoRefreshTimer);
    },
  );

  private settleQuoteRefresh = contextAtomMethod(
    (
      get,
      set,
      event: ISwapQuoteEventPayload,
      shouldScheduleAutoRefresh: boolean,
    ) => {
      if (get(swapShouldRefreshQuoteAtom())) {
        return;
      }

      const refreshTransition = resolveSwapQuoteRefreshAction({
        automaticRefreshCount: get(swapQuoteIntervalCountAtom()),
        maxAutomaticRefreshCount: swapQuoteIntervalMaxCount,
      });
      if (
        refreshTransition.action ===
        ESwapQuoteRefreshAction.RequireManualRefresh
      ) {
        this.cleanQuoteInterval.call(set);
        set(swapShouldRefreshQuoteAtom(), true);
        return;
      }

      if (shouldScheduleAutoRefresh) {
        this.scheduleQuoteAutoRefresh.call(set, event);
      }
    },
  );

  beginSwapProTokenBalanceRequest = contextAtomMethod((get, set) => {
    const requestId = get(swapProTokenBalanceRequestIdAtom()) + 1;
    set(swapProTokenBalanceRequestIdAtom(), requestId);
    set(swapProTokenBalanceLoadingAtom(), true);
    return requestId;
  });

  isSwapProTokenBalanceRequestLatest = contextAtomMethod(
    (get, _set, requestId: number) =>
      get(swapProTokenBalanceRequestIdAtom()) === requestId,
  );

  invalidateSwapProTokenBalanceRequest = contextAtomMethod(
    (get, set, requestId: number) => {
      if (get(swapProTokenBalanceRequestIdAtom()) === requestId) {
        set(swapProTokenBalanceRequestIdAtom(), requestId + 1);
        set(swapProTokenBalanceLoadingAtom(), false);
        return true;
      }
      return false;
    },
  );

  finishSwapProTokenBalanceRequest = contextAtomMethod(
    (get, set, requestId: number) => {
      if (get(swapProTokenBalanceRequestIdAtom()) === requestId) {
        set(swapProTokenBalanceLoadingAtom(), false);
        return true;
      }
      return false;
    },
  );

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
  persistSwapProSelectToken = contextAtomMethod(
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

      const setSelectedToken = (nextToken: ISwapToken) => {
        const currentToken = get(swapProSelectTokenAtom());
        const isSameToken =
          currentToken &&
          equalTokenNoCaseSensitive({
            token1: currentToken,
            token2: nextToken,
          });
        if (!isSameToken) {
          // These atoms belong to the previous selected token. Clear them in
          // the same state transition so its detail and websocket config
          // cannot render under the next token.
          set(swapProTokenMarketDetailInfoAtom(), undefined);
          set(swapProTokenDetailWebsocketAtom(), undefined);
          set(swapProTokenMarketDetailInfoLoadingAtom(), false);
        }
        set(swapProSelectTokenAtom(), nextToken);
      };

      if (token) {
        setSelectedToken(token);
        await backgroundApiProxy.simpleDb.swapProSelectToken.setSwapProSelectToken(
          getTokenForStorage(token),
        );
      } else {
        const savedToken =
          await backgroundApiProxy.simpleDb.swapProSelectToken.getSwapProSelectToken();
        if (savedToken) {
          setSelectedToken(savedToken);
        } else if (defaultToken) {
          setSelectedToken(defaultToken);
          await backgroundApiProxy.simpleDb.swapProSelectToken.setSwapProSelectToken(
            getTokenForStorage(defaultToken),
          );
        }
      }
    },
  );

  selectSwapProToken = contextAtomMethod((get, set, token: ISwapToken) => {
    const persistPromise = this.persistSwapProSelectToken.call(set, token);
    set(swapUserSelectedTokensAtom(), undefined);
    set(swapProUserSelectedTokenAtom(), token);
    return persistPromise;
  });

  initializeSwapProSelectToken = contextAtomMethod(
    (get, set, token?: ISwapToken, defaultToken?: ISwapToken) => {
      set(swapUserSelectedTokensAtom(), undefined);
      set(swapProUserSelectedTokenAtom(), undefined);
      return this.persistSwapProSelectToken.call(set, token, defaultToken);
    },
  );

  updateSwapProSelectTokenMetadata = contextAtomMethod(
    (get, set, token: ISwapToken) => {
      if (
        !equalTokenNoCaseSensitive({
          token1: get(swapProSelectTokenAtom()),
          token2: token,
        })
      ) {
        return;
      }
      return this.persistSwapProSelectToken.call(set, token);
    },
  );

  clearSwapTokenCarryIntent = contextAtomMethod((get, set) => {
    set(swapUserSelectedTokensAtom(), undefined);
    set(swapProUserSelectedTokenAtom(), undefined);
  });

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
    if (
      quoteEventTotalCount.count === 0 ||
      !currentEventProviderKeys.includes(
        buildSwapQuoteProviderKey(selectionIntent),
      )
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
    set(swapUserSelectedTokensAtom(), undefined);
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
      // Scaled-UI (rebase) tokens are blocked from Swap end-to-end: the
      // /swap/v1 pipeline is raw-basis and would desync display and quotes
      // from the wallet. Silent fail-closed, mirroring the wallet-entry
      // gate in TokenActionsView. Multiplier === 1 is a no-op, never block.
      if (
        tokenRebaseUtils.isScalingBalanceMultiplier(token.balanceMultiplier)
      ) {
        return;
      }
      set(swapUserSelectedTokensAtom(), undefined);
      const swapTypeSwitchValue = get(swapTypeSwitchAtom());
      if (isSwapOrBridgeQuoteType(swapTypeSwitchValue)) {
        set(swapProUserSelectedTokenAtom(), undefined);
      }
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
      if (!skipCleanManualSelectQuoteProviders) {
        this.cleanManualSelectQuoteProviders.call(set);
      }
      const syncNetworksSortPromise = this.syncNetworksSort.call(
        set,
        token.networkId,
      );
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
      await syncNetworksSortPromise;
    },
  );

  selectFromTokenByUser = contextAtomMethod(
    (
      get,
      set,
      token: ISwapToken,
      options?: {
        disableCheckToToken?: boolean;
        skipCheckEqualToken?: boolean;
      },
    ) => {
      const selectionPromise = this.selectFromToken.call(
        set,
        token,
        options?.disableCheckToToken,
        undefined,
        options?.skipCheckEqualToken,
      );
      const selectedFromToken = get(swapSelectFromTokenAtom());
      if (
        isSwapOrBridgeQuoteType(get(swapTypeSwitchAtom())) &&
        equalTokenNoCaseSensitive({ token1: selectedFromToken, token2: token })
      ) {
        set(swapUserSelectedTokensAtom(), {
          fromToken: selectedFromToken,
          toToken: get(swapSelectToTokenAtom()),
        });
      }
      return selectionPromise;
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
      // Same scaled-UI gate as selectFromToken above.
      if (
        tokenRebaseUtils.isScalingBalanceMultiplier(token.balanceMultiplier)
      ) {
        return;
      }
      set(swapUserSelectedTokensAtom(), undefined);
      const swapTypeSwitchValue = get(swapTypeSwitchAtom());
      if (isSwapOrBridgeQuoteType(swapTypeSwitchValue)) {
        set(swapProUserSelectedTokenAtom(), undefined);
      }
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
      const syncNetworksSortPromise = this.syncNetworksSort.call(
        set,
        token.networkId,
      );
      set(swapSelectToTokenAtom(), token);
      await syncNetworksSortPromise;
    },
  );

  selectToTokenByUser = contextAtomMethod(
    (
      get,
      set,
      token: ISwapToken,
      options?: { skipCheckEqualToken?: boolean },
    ) => {
      const selectionPromise = this.selectToToken.call(
        set,
        token,
        undefined,
        options?.skipCheckEqualToken,
      );
      const selectedToToken = get(swapSelectToTokenAtom());
      if (
        isSwapOrBridgeQuoteType(get(swapTypeSwitchAtom())) &&
        equalTokenNoCaseSensitive({ token1: selectedToToken, token2: token })
      ) {
        set(swapUserSelectedTokensAtom(), {
          fromToken: get(swapSelectFromTokenAtom()),
          toToken: selectedToToken,
        });
      }
      return selectionPromise;
    },
  );

  // No scaled-UI gate here (unlike selectFromToken/selectToToken above):
  // stock-channel inputs are /swap/v1-shaped and cannot carry
  // balanceMultiplier; the surface is product-owned. See the plan's
  // known-limitations (docs/superpowers/plans/2026-08-21-bstocks-scaled-ui-evm.md).
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
      const stockInputAmountDraft = get(swapInputAmountDraftsAtom())[
        ESwapTabSwitchType.STOCK
      ];
      if (
        getVisibleSwapTabSwitchType(get(swapTypeSwitchAtom())) ===
          ESwapTabSwitchType.STOCK &&
        stockInputAmountDraft &&
        fromToken &&
        toToken
      ) {
        const fromTokenAmount = get(swapFromTokenAmountAtom());
        const toTokenAmount = get(swapToTokenAmountAtom());
        const inputIsEmpty =
          !fromTokenAmount.value &&
          !fromTokenAmount.isInput &&
          !toTokenAmount.value &&
          !toTokenAmount.isInput;
        if (
          inputIsEmpty &&
          isSwapInputAmountDraftForTokenPair({
            draft: stockInputAmountDraft,
            fromToken,
            toToken,
          })
        ) {
          set(swapFromTokenAmountAtom(), stockInputAmountDraft.fromTokenAmount);
          set(swapToTokenAmountAtom(), stockInputAmountDraft.toTokenAmount);
        }
        set(swapInputAmountDraftsAtom(), (drafts) => ({
          ...drafts,
          [ESwapTabSwitchType.STOCK]: undefined,
        }));
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
    if (
      isSwapOrBridgeQuoteType(get(swapTypeSwitchAtom())) &&
      get(swapUserSelectedTokensAtom())
    ) {
      set(swapUserSelectedTokensAtom(), {
        fromToken: toToken,
        toToken: fromToken,
      });
    }
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
    (get, set, event: ISwapQuoteEventPayload) => {
      const quoteActionLock = get(swapQuoteActionLockAtom());
      if (
        !isCurrentQuoteEventParams({
          currentQuoteRequestId: quoteActionLock.quoteRequestId,
          currentSwapType: quoteActionLock.type ?? get(swapTypeSwitchAtom()),
          fromToken:
            quoteActionLock.fromToken ?? get(swapSelectFromTokenAtom()),
          fromTokenAmount:
            quoteActionLock.fromTokenAmount ??
            get(swapFromTokenAmountAtom()).value,
          params: event.params,
          quoteRequestActive: quoteActionLock.actionLock,
          quoteRequestId: event.quoteRequestId,
          toToken: quoteActionLock.toToken ?? get(swapSelectToTokenAtom()),
          toTokenAmount:
            quoteActionLock.toTokenAmount ?? get(swapToTokenAmountAtom()).value,
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
            const dataJson = JSON.parse(data) as ISwapQuoteEventData;
            const errorData = dataJson as ISwapQuoteEventError;
            if (errorData?.errorMessage) {
              const isStockQuoteEventError =
                Boolean(errorData.isStock) ||
                isStockProtocol(event.params.protocol);
              const isStockMarketClosed =
                isStockQuoteEventError && errorData.isMarketOpen === false;
              const currentSwapType =
                quoteActionLock.type ?? get(swapTypeSwitchAtom());
              const shouldRequireManualRefresh =
                isSwapOrBridgeQuoteType(currentSwapType) ||
                currentSwapType === ESwapTabSwitchType.STOCK;
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
              if (isStockMarketClosed || !shouldRequireManualRefresh) {
                this.cleanQuoteInterval.call(set);
                set(swapShouldRefreshQuoteAtom(), false);
                set(swapQuoteActionLockAtom(), (v) => ({
                  ...v,
                  actionLock: false,
                }));
                this.closeQuoteEvent(event.quoteRequestId);
              } else {
                this.requireManualQuoteRefresh.call(set);
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
                const shouldScheduleAutoRefresh = get(swapQuoteFetchingAtom());
                this.reconcileManualSelectQuoteProviders.call(set);
                set(swapQuoteEventCompletedAtom(), true);
                set(swapQuoteFetchingAtom(), false);
                set(swapQuoteActionLockAtom(), (v) => ({
                  ...v,
                  actionLock: false,
                }));
                this.closeQuoteEvent(event.quoteRequestId);
                this.settleQuoteRefresh.call(
                  set,
                  event,
                  shouldScheduleAutoRefresh,
                );
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
                (isStockProtocol(event.params.protocol) ||
                  quoteActionLock.type === ESwapTabSwitchType.SWAP) &&
                Boolean(quoteResultEventId) &&
                !quoteEventTotalCount.eventId;
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
                  // OK-49700: 如果旧报价的 fromAmount 与当前询价的 fromTokenAmount 相同，
                  // 则更新旧报价的 eventId 为当前的 eventId，这样它就不会被 eventId 过滤掉，
                  // 实现再次询价时保留旧报价、只更新部分渠道商报价的效果
                  if (
                    (isStockProtocol(event.params.protocol)
                      ? isSameSwapQuoteAmountValue({
                          currentAmount: oldQuoteRes.fromAmount,
                          requestAmount: event.params.fromTokenAmount,
                        })
                      : oldQuoteRes.fromAmount ===
                        event.params.fromTokenAmount) &&
                    activeQuoteEventTotalCount.eventId
                  ) {
                    return {
                      ...oldQuoteRes,
                      eventId: activeQuoteEventTotalCount.eventId,
                    };
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
                  ...new Set([
                    ...get(swapQuoteCurrentEventProviderKeysAtom()),
                    ...quoteResults.map((quote) =>
                      buildSwapQuoteProviderKey(quote),
                    ),
                  ]),
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
                const selectedQuote = get(swapQuoteCurrentSelectAtom());
                const shouldEndQuoteStartup =
                  quoteActionLock.type !== ESwapTabSwitchType.SWAP ||
                  (isSwapQuoteActionable(selectedQuote) &&
                    selectedQuote?.eventId ===
                      activeQuoteEventTotalCount.eventId);
                if (shouldEndQuoteStartup) {
                  const shouldScheduleAutoRefresh = get(
                    swapQuoteFetchingAtom(),
                  );
                  set(swapQuoteFetchingAtom(), false);
                  if (shouldScheduleAutoRefresh) {
                    this.scheduleQuoteAutoRefresh.call(set, event);
                  }
                }
              }
            }
          }
          break;
        }
        case 'done': {
          const shouldScheduleAutoRefresh = get(swapQuoteFetchingAtom());
          this.reconcileManualSelectQuoteProviders.call(set);
          set(swapQuoteEventCompletedAtom(), true);
          set(swapQuoteActionLockAtom(), (v) => ({ ...v, actionLock: false }));
          set(swapQuoteFetchingAtom(), false);
          this.closeQuoteEvent(event.quoteRequestId);
          this.settleQuoteRefresh.call(set, event, shouldScheduleAutoRefresh);
          break;
        }
        case 'error': {
          const shouldScheduleAutoRefresh = get(swapQuoteFetchingAtom());
          this.reconcileManualSelectQuoteProviders.call(set);
          set(swapQuoteEventCompletedAtom(), true);
          set(swapQuoteFetchingAtom(), false);
          set(swapQuoteActionLockAtom(), (v) => ({ ...v, actionLock: false }));
          this.closeQuoteEvent(event.quoteRequestId);
          this.settleQuoteRefresh.call(set, event, shouldScheduleAutoRefresh);
          break;
        }
        case 'close': {
          const shouldScheduleAutoRefresh = get(swapQuoteFetchingAtom());
          set(swapQuoteEventCompletedAtom(), true);
          set(swapQuoteFetchingAtom(), false);
          set(swapQuoteActionLockAtom(), (v) => ({ ...v, actionLock: false }));
          this.settleQuoteRefresh.call(set, event, shouldScheduleAutoRefresh);
          break;
        }
        default:
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
      quoteRequestId?: string,
      protocolOverride?: ESwapTabSwitchType,
      source?: ESwapQuoteSource,
    ) => {
      const shouldRefreshQuote = get(swapShouldRefreshQuoteAtom());
      const protocol = protocolOverride ?? get(swapTypeSwitchAtom());
      const { swapIncognitoMode } = await settingsAtom.get();
      const incognitoEnabled =
        protocol === ESwapTabSwitchType.LIMIT ||
        protocol === ESwapTabSwitchType.STOCK
          ? false
          : (incognito ?? swapIncognitoMode);
      const isActiveQuoteRequest = () => {
        const activeQuoteRequest = get(swapQuoteActionLockAtom());
        return (
          activeQuoteRequest.actionLock &&
          activeQuoteRequest.quoteRequestId === quoteRequestId
        );
      };
      const limitPartiallyFillableObj = get(swapLimitPartiallyFillAtom());
      const limitPartiallyFillable = limitPartiallyFillableObj.value;
      const expirationTime = get(swapLimitExpirationTimeAtom());
      if (shouldRefreshQuote || !isActiveQuoteRequest()) {
        this.cleanQuoteInterval.call(set);
        if (shouldRefreshQuote && isActiveQuoteRequest()) {
          set(swapQuoteActionLockAtom(), (value) => ({
            ...value,
            actionLock: false,
          }));
        }
        return;
      }
      const handleQuoteRequestFailure = () => {
        if (!isActiveQuoteRequest()) {
          return;
        }
        this.closeQuoteEvent(quoteRequestId);
        set(swapQuoteEventCompletedAtom(), true);
        set(swapQuoteFetchingAtom(), false);
        set(swapShouldRefreshQuoteAtom(), true);
        set(swapQuoteActionLockAtom(), (value) => ({
          ...value,
          actionLock: false,
        }));
      };
      try {
        await backgroundApiProxy.serviceSwap.closeApproving();
      } catch {
        handleQuoteRequestFailure();
        return;
      }
      if (!isActiveQuoteRequest()) {
        return;
      }
      set(swapQuoteEventErrorAtom(), undefined);
      set(swapQuoteFetchingAtom(), true);
      set(swapQuoteEventCompletedAtom(), false);
      const limitUserMarketPrice = get(swapLimitPriceUseRateAtom());
      const userMarketPriceRate = getSelectedPairLimitPriceRate({
        protocol,
        limitPriceUseRate: limitUserMarketPrice,
        fromToken,
        toToken,
      });
      try {
        await backgroundApiProxy.serviceSwap.fetchQuotesEvents({
          source,
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
          userMarketPriceRate,
          quoteRequestId,
          ...(protocol === ESwapTabSwitchType.LIMIT
            ? {
                expirationTime: Number(expirationTime.value),
                limitPartiallyFillable,
              }
            : {}),
        });
      } catch {
        handleQuoteRequestFailure();
      }
    },
  );

  requireManualQuoteRefresh = contextAtomMethod((get, set) => {
    this.cleanQuoteInterval.call(set);
    const quoteRequestId = get(swapQuoteActionLockAtom()).quoteRequestId;
    this.closeQuoteEvent(quoteRequestId);
    set(swapQuoteEventCompletedAtom(), true);
    set(swapQuoteFetchingAtom(), false);
    set(swapShouldRefreshQuoteAtom(), true);
    set(swapQuoteActionLockAtom(), (value) => ({
      ...value,
      actionLock: false,
    }));
  });

  resetQuoteAction = contextAtomMethod(async (get, set) => {
    const fromToken = get(swapSelectFromTokenAtom());
    const toToken = get(swapSelectToTokenAtom());
    const fromTokenAmount = get(swapFromTokenAmountAtom());
    const toTokenAmount = get(swapToTokenAmountAtom());
    const swapTypeSwitch = get(swapTypeSwitchAtom());
    this.closeQuoteEvent(get(swapQuoteActionLockAtom()).quoteRequestId);
    set(swapQuoteFetchingAtom(), false);
    set(swapQuoteEventErrorAtom(), undefined);
    set(swapQuoteCurrentEventProviderKeysAtom(), []);
    set(swapQuoteCurrentEventReceivedCountAtom(), 0);
    set(swapQuoteEventCompletedAtom(), false);
    set(swapQuoteEventTotalCountAtom(), {
      count: 0,
    });
    set(swapQuoteListAtom(), []);
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
      quoteOverride?: ISwapQuoteActionOverride,
    ) => {
      let fromToken =
        quoteOverride?.fromToken ?? get(swapSelectFromTokenAtom());
      let toToken = quoteOverride?.toToken ?? get(swapSelectToTokenAtom());
      const fromTokenAmount = quoteOverride
        ? { value: quoteOverride.fromTokenAmount, isInput: true }
        : get(swapFromTokenAmountAtom());
      const swapTabSwitchType =
        quoteOverride?.type ?? get(swapTypeSwitchAtom());
      const toTokenAmount = quoteOverride
        ? { value: quoteOverride.toTokenAmount ?? '', isInput: false }
        : get(swapToTokenAmountAtom());
      const swapProTradeType = get(swapProTradeTypeAtom());
      const swapProDirection = get(swapProDirectionAtom());
      set(swapQuoteEventErrorAtom(), undefined);
      if (
        !quoteOverride &&
        swapTabSwitchType === ESwapTabSwitchType.LIMIT &&
        swapProTradeType === ESwapProTradeType.MARKET &&
        platformEnv.isNative
      ) {
        void this.resetQuoteAction.call(set);
        return;
      }
      if (
        !quoteOverride &&
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
        const lockedQuoteKind = get(swapQuoteActionLockAtom()).kind;
        if (lockedQuoteKind) {
          quoteKind = lockedQuoteKind;
        } else if (
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

      this.cleanQuoteInterval.call(set);
      this.closeQuoteEvent(get(swapQuoteActionLockAtom()).quoteRequestId);
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
      const quoteRequestId = generateUUID();
      set(swapQuoteActionLockAtom(), (v) => ({
        ...v,
        type: swapTabSwitchType,
        source: quoteOverride?.source,
        actionLock: true,
        fromToken,
        toToken,
        fromTokenAmount: fromTokenAmount.value,
        toTokenAmount: toTokenAmount.value,
        kind: quoteKind,
        accountId,
        address,
        receivingAddress,
        quoteRequestId,
        manualRefresh: quoteOverride?.manualRefresh ?? false,
      }));
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
        quoteRequestId,
        swapTabSwitchType,
        quoteOverride?.source,
      );
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
        void this.resetQuoteAction.call(set);
        return;
      }
      void this.quoteAction.call(
        set,
        slippageItem,
        address,
        accountId,
        undefined,
        undefined,
        ESwapQuoteKind.SELL,
        undefined,
        receivingAddress,
        undefined,
        {
          fromToken,
          toToken,
          fromTokenAmount,
          type: ESwapTabSwitchType.SWAP,
        },
      );
    },
  );

  cleanQuoteInterval = contextAtomMethod((get, set) => {
    const quoteAutoRefreshTimer = get(swapQuoteAutoRefreshTimerAtom());
    if (quoteAutoRefreshTimer !== undefined) {
      clearTimeout(quoteAutoRefreshTimer);
      set(swapQuoteAutoRefreshTimerAtom(), undefined);
    }
  });

  closeQuoteEvent = (quoteRequestId?: string) => {
    if (quoteRequestId) {
      void backgroundApiProxy.serviceSwap.cancelFetchQuoteEvents(
        quoteRequestId,
      );
    }
  };

  cleanLimitOrderMarketPriceInterval = () => {
    this.limitOrderMarketPriceRequestId += 1;
    if (this.limitOrderMarketPriceInterval) {
      clearInterval(this.limitOrderMarketPriceInterval);
      this.limitOrderMarketPriceInterval = undefined;
    }
  };

  checkAddressNeedCreate = (
    swapSupportAllNetworks: ISwapNetwork[],
    token: ISwapToken,
    addressInfo: ReturnType<typeof useSwapAddressInfo>,
    directionType: ESwapDirectionType,
  ) => {
    const networkId = addressInfo.networkId || token.networkId;
    const netInfo = swapSupportAllNetworks.find(
      (net) => net.networkId === networkId,
    );
    const walletId = addressInfo.accountInfo?.wallet?.id;
    const indexedAccountId = addressInfo.accountInfo?.indexedAccount?.id;
    const deriveType = addressInfo.deriveType;
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
    message,
  }: {
    addressInfo?: ReturnType<typeof useSwapAddressInfo>;
    activeNetworkId: string;
    message?: string;
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
      let unsupportedMessage = message;
      if (!unsupportedMessage) {
        // eslint-disable-next-line onekey/no-app-locale-main-thread
        unsupportedMessage = appLocale.intl.formatMessage({
          id: ETranslations.swap_page_alert_account_does_not_support_swap,
        });
      }
      return {
        message: unsupportedMessage,
        alertLevel: ESwapAlertLevel.ERROR,
      };
    }
    return undefined;
  };

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
      const warningRequestId = get(swapWarningRequestIdAtom()) + 1;
      set(swapWarningRequestIdAtom(), warningRequestId);
      const fromToken = get(swapSelectFromTokenAtom());
      const toToken = get(swapSelectToTokenAtom());
      const swapTypeSwitch = get(swapTypeSwitchAtom());
      const isLatestSwapWarningCheck = () =>
        get(swapWarningRequestIdAtom()) === warningRequestId &&
        get(swapTypeSwitchAtom()) === swapTypeSwitch &&
        isSameOptionalSwapToken({
          token1: get(swapSelectFromTokenAtom()),
          token2: fromToken,
        }) &&
        isSameOptionalSwapToken({
          token1: get(swapSelectToTokenAtom()),
          token2: toToken,
        });
      const networks = get(swapNetworks());
      const swapSupportAllNetworks = get(swapNetworksIncludeAllNetworkAtom());
      const quoteResult = get(swapQuoteCurrentSelectAtom());
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
      if (!isLatestSwapWarningCheck()) {
        return;
      }
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
        if (!isLatestSwapWarningCheck()) {
          return false;
        }
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
            isSameSwapQuoteAmountValue({
              currentAmount: latestFromTokenAmount.value,
              requestAmount: quoteResult.fromAmount,
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
        isWaitingActionableQuote
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
      if (!isLatestStockWarningCheck()) {
        return;
      }
      // eslint-disable-next-line onekey/no-app-locale-main-thread
      const notSupportSwapMessage = appLocale.intl.formatMessage({
        id: ETranslations.swap_page_alert_account_does_not_support_swap,
      });
      if (
        swapFromAddressInfo.isAddressInfoReady &&
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
        swapFromAddressInfo.isAddressInfoReady &&
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
          if (!isLatestSwapWarningCheck()) {
            return;
          }
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
      const toWalletId = swapToAddressInfo.accountInfo?.wallet?.id;
      const shouldCheckToAccountNetwork =
        Boolean(fromToken && fromToken.networkId === toToken?.networkId) ||
        accountUtils.isHwWallet({ walletId: toWalletId }) ||
        !get(swapProviderSupportReceiveAddressAtom());
      if (
        swapToAddressInfo.isAddressInfoReady &&
        toToken &&
        !swapToAddressInfo.address &&
        toWalletId &&
        shouldCheckToAccountNetwork &&
        alertsRes.every((item) => item.message !== notSupportSwapMessage)
      ) {
        const toNetworkName =
          swapSupportAllNetworks.find(
            (network) => network.networkId === toToken.networkId,
          )?.name ?? toToken.symbol;
        const accountNetworkNotSupportedAlert =
          await this.checkAccountNetworkNotSupportedAlert({
            addressInfo: swapToAddressInfo,
            activeNetworkId: toToken.networkId,
            // eslint-disable-next-line onekey/no-app-locale-main-thread
            message: appLocale.intl.formatMessage(
              { id: ETranslations.wallet_unsupported_network_title },
              { network: toNetworkName },
            ),
          });
        if (!isLatestSwapWarningCheck()) {
          return;
        }
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

  invalidateSwapWarningCheck = contextAtomMethod((get, set) => {
    set(swapWarningRequestIdAtom(), get(swapWarningRequestIdAtom()) + 1);
  });

  loadSwapSelectTokenDetail = contextAtomMethod(
    async (
      get,
      set,
      type: ESwapDirectionType,
      swapAddressInfo: ReturnType<typeof useSwapAddressInfo>,
      fetchBalance?: boolean,
    ) => {
      const currentSwapType = get(swapTypeSwitchAtom());
      if (
        currentSwapType === ESwapTabSwitchType.STOCK ||
        (platformEnv.isNative && currentSwapType === ESwapTabSwitchType.LIMIT)
      ) {
        return;
      }
      const token =
        type === ESwapDirectionType.FROM
          ? get(swapSelectFromTokenAtom())
          : get(swapSelectToTokenAtom());
      let accountAddress: string | undefined;
      let accountNetworkId: string | undefined;
      let accountId: string | undefined;
      if (type === ESwapDirectionType.TO) {
        // fetch to Token balance use FromAccount id
        if (
          token?.networkId &&
          !networkUtils.isAllNetwork({ networkId: token?.networkId })
        ) {
          try {
            const accountDeriveType =
              await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork(
                { networkId: token.networkId },
              );
            const toAccountInfos =
              await backgroundApiProxy.serviceAccount.getNetworkAccount({
                deriveType: accountDeriveType ?? 'default',
                indexedAccountId:
                  swapAddressInfo.accountInfo?.indexedAccount?.id,
                accountId: swapAddressInfo.accountInfo?.indexedAccount?.id
                  ? undefined
                  : (swapAddressInfo.accountInfo?.account?.id ?? ''),
                dbAccount: swapAddressInfo.accountInfo?.dbAccount,
                networkId: token.networkId,
              });
            if (toAccountInfos) {
              accountAddress = toAccountInfos.addressDetail?.address;
              accountNetworkId = toAccountInfos.addressDetail?.networkId;
              accountId = toAccountInfos.id;
            }
          } catch (e) {
            console.error('swap_toToken_getNetworkAccountError--', e);
          }
        }
      } else {
        accountAddress = swapAddressInfo.address;
        accountNetworkId = swapAddressInfo.networkId;
        accountId = swapAddressInfo.accountInfo?.account?.id;
      }
      let balanceDisplay: string | undefined;
      let hasAuthoritativeBalance = false;
      if (
        (token &&
          accountAddress &&
          accountNetworkId &&
          accountNetworkId === token?.networkId) ||
        (!token?.price && token)
      ) {
        if (
          token.accountAddress === accountAddress &&
          accountNetworkId === token.networkId &&
          token.balanceParsed &&
          !fetchBalance
        ) {
          const balanceParsedBN = new BigNumber(token.balanceParsed ?? 0);
          balanceDisplay = balanceParsedBN.isNaN()
            ? '0.0'
            : balanceParsedBN.toFixed();
          hasAuthoritativeBalance = true;
        } else {
          try {
            set(swapSelectTokenDetailFetchingAtom(), (pre) => ({
              ...pre,
              [type]: true,
            }));
            // reset balance
            if (type === ESwapDirectionType.FROM) {
              set(swapSelectedFromTokenBalanceAtom(), '');
            } else {
              set(swapSelectedToTokenBalanceAtom(), '');
            }
            const detailInfo =
              await backgroundApiProxy.serviceSwap.fetchSwapTokenDetails({
                networkId: token.networkId,
                accountAddress,
                accountId,
                contractAddress: token.contractAddress,
                direction: type,
                currency: USD_CURRENCY_ID,
              });
            if (detailInfo?.[0]) {
              const balanceParsedBN = new BigNumber(
                detailInfo[0].balanceParsed ?? 0,
              );
              balanceDisplay = balanceParsedBN.isNaN()
                ? '0.0'
                : balanceParsedBN.toFixed();
              hasAuthoritativeBalance =
                detailInfo[0].balanceParsed !== undefined;
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
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            if (e?.cause !== ESwapFetchCancelCause.SWAP_TOKENS_CANCEL) {
              balanceDisplay = '0.0';
            }
          } finally {
            set(swapSelectTokenDetailFetchingAtom(), (pre) => ({
              ...pre,
              [type]: false,
            }));
          }
        }
      }
      const newToken =
        type === ESwapDirectionType.FROM
          ? get(swapSelectFromTokenAtom())
          : get(swapSelectToTokenAtom());
      if (
        equalTokenNoCaseSensitive({ token1: newToken, token2: token }) ||
        (!token && !newToken)
      ) {
        if (type === ESwapDirectionType.FROM) {
          set(swapSelectedFromTokenBalanceAtom(), balanceDisplay ?? '');
        } else {
          set(swapSelectedToTokenBalanceAtom(), balanceDisplay ?? '');
        }
        if (
          token &&
          accountAddress &&
          hasAuthoritativeBalance &&
          balanceDisplay !== undefined
        ) {
          const accountKey = buildSwapSelectedTokensColdStartAccountKey(
            swapAddressInfo.activeAccount,
          );
          set(swapBalanceDisplayCacheAtom(), (cache) =>
            updateSwapBalanceDisplayCache({
              accountAddress,
              accountKey,
              balance: balanceDisplay,
              cache,
              token,
            }),
          );
        }
      }
    },
  );

  updateAllNetworkTokenList = contextAtomMethod(
    async (
      get,
      set,
      accountNetworkId: string,
      protocol: ESwapTabSwitchType,
      accountId?: string,
      accountAddress?: string,
      isFirstFetch?: boolean,
      allNetAccountId?: string,
      lpToken?: boolean,
      currency?: string,
    ) => {
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
        ...(isStockProtocol(protocol)
          ? { limit: swapStockTokenListMaxCount }
          : {}),
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
      const swapTypeSwitchValue = get(swapTypeSwitchAtom());
      const tokenListCacheKey = buildSwapAllNetworkTokenListCacheKey({
        accountId:
          indexedAccountId ?? otherWalletTypeAccountId ?? 'noAccountId',
        lpToken,
        currency,
        protocol: swapTypeSwitchValue,
      });
      const buildRequestContext = () => {
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
        return {
          requestKey: buildSwapNetworkReadyKey(tokenListSupportNetworks),
          tokenListSupportNetworks,
        };
      };
      let requestContext = buildRequestContext();
      const currentLock = get(swapAllNetworkActionLockAtom())[
        tokenListCacheKey
      ];
      if (currentLock) {
        if (currentLock.activeRequestKey === requestContext.requestKey) {
          if (currentLock.pendingRequestKey) {
            set(swapAllNetworkActionLockAtom(), (value) => ({
              ...value,
              [tokenListCacheKey]: {
                ...currentLock,
                pendingRequestKey: undefined,
              },
            }));
          }
          await currentLock.completionPromise;
          return;
        }
        if (currentLock.pendingRequestKey === requestContext.requestKey) {
          await currentLock.completionPromise;
          return;
        }
        set(swapAllNetworkActionLockAtom(), (value) => ({
          ...value,
          [tokenListCacheKey]: {
            ...currentLock,
            pendingRequestKey: requestContext.requestKey,
          },
        }));
        await currentLock.completionPromise;
        return;
      }
      let resolveCompletionPromise: (() => void) | undefined;
      const completionPromise = new Promise<void>((resolve) => {
        resolveCompletionPromise = resolve;
      });
      set(swapAllNetworkActionLockAtom(), (value) => ({
        ...value,
        [tokenListCacheKey]: {
          activeRequestKey: requestContext.requestKey,
          completionPromise,
        },
      }));
      let activeRequestKey = requestContext.requestKey;
      try {
        for (;;) {
          let requestError: unknown;
          try {
            const { swapSupportAccounts } =
              await backgroundApiProxy.serviceSwap.getSupportSwapAllAccounts({
                indexedAccountId,
                otherWalletTypeAccountId,
                swapSupportNetworks: requestContext.tokenListSupportNetworks,
              });
            if (swapSupportAccounts.length > 0) {
              const currentSwapAllNetworkTokenList = get(
                swapAllNetworkTokenListMapAtom(),
              )[tokenListCacheKey];
              const accountAddressList = dedupeTokenSelectorNetworkAccounts(
                swapSupportAccounts,
              ).filter(
                (item) =>
                  !networkUtils.isAllNetwork({ networkId: item.networkId }),
              );

              // Create tasks as functions to delay execution until batched
              const tasks: Array<() => Promise<ISwapToken[] | undefined>> =
                accountAddressList.map((networkDataString) => {
                  const {
                    apiAddress,
                    networkId: accountNetworkId,
                    accountId,
                  } = networkDataString;
                  return async () =>
                    (await this.updateAllNetworkTokenList.call(
                      set,
                      accountNetworkId,
                      swapTypeSwitchValue,
                      accountId,
                      apiAddress,
                      !currentSwapAllNetworkTokenList,
                      tokenListCacheKey,
                      lpToken,
                      currency,
                    )) as ISwapToken[] | undefined;
                });

              // Execute requests in batches of 3 to prevent UI thread blocking
              const results = await this.executeBatched(tasks, 3);

              if (!currentSwapAllNetworkTokenList) {
                set(swapAllNetworkTokenListMapAtom(), (value) => {
                  if (value[tokenListCacheKey] !== undefined) {
                    return value;
                  }
                  return {
                    ...value,
                    [tokenListCacheKey]: [],
                  };
                });
              } else {
                // Subsequent fetches: collect results and update atom
                const allTokensResult = results.flatMap((result) =>
                  result.status === 'fulfilled' ? (result.value ?? []) : [],
                );
                set(swapAllNetworkTokenListMapAtom(), (value) => ({
                  ...value,
                  [tokenListCacheKey]: allTokensResult,
                }));
              }
            } else {
              set(swapAllNetworkTokenListMapAtom(), (value) => ({
                ...value,
                [tokenListCacheKey]: [],
              }));
            }
          } catch (error) {
            requestError = error;
          }

          const latestLock = get(swapAllNetworkActionLockAtom())[
            tokenListCacheKey
          ];
          if (
            latestLock?.activeRequestKey === activeRequestKey &&
            latestLock.pendingRequestKey
          ) {
            const nextRequestContext = buildRequestContext();
            const nextActiveRequestKey = nextRequestContext.requestKey;
            requestContext = nextRequestContext;
            activeRequestKey = nextActiveRequestKey;
            set(swapAllNetworkActionLockAtom(), (value) => ({
              ...value,
              [tokenListCacheKey]: {
                ...latestLock,
                activeRequestKey: nextActiveRequestKey,
                pendingRequestKey: undefined,
              },
            }));
          } else {
            if (requestError) {
              throw requestError instanceof Error
                ? requestError
                : new OneKeyLocalError(String(requestError));
            }
            break;
          }
        }
      } finally {
        set(swapAllNetworkActionLockAtom(), (value) => {
          if (value[tokenListCacheKey]?.activeRequestKey !== activeRequestKey) {
            return value;
          }
          const nextValue = { ...value };
          delete nextValue[tokenListCacheKey];
          return nextValue;
        });
        resolveCompletionPromise?.();
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
      currencyId?: string,
      options?: {
        forceRefresh?: boolean;
      },
    ) => {
      const positionCurrencyId = currencyId?.toLowerCase() ?? '';
      const positionNetworkIdsKey = supportNetworks
        .map((item) => item.networkId)
        .filter(Boolean)
        .toSorted()
        .join(',');
      const positionOwnerKey = buildSwapProPositionsOwnerKey({
        accountId: indexedAccountId ?? otherWalletTypeAccountId,
        networkIdsKey: positionNetworkIdsKey,
        currencyId: positionCurrencyId,
      });
      if (!positionOwnerKey) {
        set(swapProPositionsCurrentOwnerKeyAtom(), '');
        set(swapProPositionsDataOwnerKeyAtom(), '');
        set(swapProSupportNetworksTokenListAtom(), []);
        return;
      }
      set(swapProPositionsCurrentOwnerKeyAtom(), positionOwnerKey);
      const positionsCache = getValidSwapProPositionsCache(
        get(swapProPositionsCacheAtom()),
      );
      const cachedPositionEntry = positionsCache.byOwner[positionOwnerKey];
      const activeRequestId = get(swapProPositionsRequestIdsAtom())[
        positionOwnerKey
      ];
      if (activeRequestId && !options?.forceRefresh) {
        return;
      }
      if (
        shouldReuseSwapProPositionsCache({
          cacheEntry: cachedPositionEntry,
          forceRefresh: options?.forceRefresh,
          ownerKey: positionOwnerKey,
        }) &&
        get(swapProPositionsDataOwnerKeyAtom()) === positionOwnerKey
      ) {
        // Only authoritative data loaded in this runtime may short-circuit.
        // The persisted top-N snapshot is a display seed, never the live list.
        return;
      }
      // Requests are tracked per owner. Pro and Stock may load concurrently,
      // but only the currently visible owner may update the shared live list.
      const requestId = get(swapProPositionsRequestIdAtom()) + 1;
      set(swapProPositionsRequestIdAtom(), requestId);
      set(swapProPositionsRequestIdsAtom(), (previousRequestIds) => ({
        ...previousRequestIds,
        [positionOwnerKey]: requestId,
      }));
      const isLatestOwnerRequest = () =>
        get(swapProPositionsRequestIdsAtom())[positionOwnerKey] === requestId;
      const isCurrentOwner = () =>
        get(swapProPositionsCurrentOwnerKeyAtom()) === positionOwnerKey;
      const settleRequestFailure = () => {
        if (
          isLatestOwnerRequest() &&
          isCurrentOwner() &&
          get(swapProPositionsDataOwnerKeyAtom()) !== positionOwnerKey &&
          !cachedPositionEntry
        ) {
          // A failed first load must leave the loading surface. Keep any
          // last-good persisted seed display-only, but do not persist this
          // fallback as cache or mark the seed as authoritative live data.
          set(swapProSupportNetworksTokenListAtom(), []);
          set(swapProPositionsDataOwnerKeyAtom(), positionOwnerKey);
        }
      };
      const updatePositionsCache = (tokens: ISwapToken[]) => {
        if (!positionOwnerKey || !positionNetworkIdsKey) {
          return;
        }
        set(swapProPositionsCacheAtom(), (prev) => {
          const updatedAt = Date.now();
          return upsertSwapProPositionsCacheEntry({
            cache: prev,
            entry: {
              ownerKey: positionOwnerKey,
              networkIdsKey: positionNetworkIdsKey,
              currencyId: positionCurrencyId,
              tokens,
              updatedAt,
            },
          });
        });
      };
      try {
        const {
          supportAccountsFetchFailed,
          swapSupportAccounts: swapProSupportAccounts,
        } = await backgroundApiProxy.serviceSwap.getSupportSwapAllAccounts({
          indexedAccountId,
          otherWalletTypeAccountId,
          swapSupportNetworks: supportNetworks,
        });
        if (supportAccountsFetchFailed) {
          settleRequestFailure();
          return;
        }
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
                throwOnError: true,
                currency: positionCurrencyId,
                protocol: ESwapTabSwitchType.SWAP,
              });
          });

          // Execute requests in batches of 3 to prevent UI thread blocking
          const results = await this.executeBatched(tasks, 3);
          if (!isLatestOwnerRequest()) {
            return;
          }
          if (results.some((result) => result.status === 'rejected')) {
            settleRequestFailure();
            return;
          }

          // Extract successful results and sort by fiat value
          const sortedResult = results
            .filter((r) => r.status === 'fulfilled' && r.value)
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            .map((r) => (r as PromiseFulfilledResult<any>).value)
            .filter(Boolean)
            .flat()
            .toSorted((a, b) => {
              return new BigNumber(b.fiatValue ?? '0').comparedTo(
                new BigNumber(a.fiatValue ?? '0'),
              );
            });
          updatePositionsCache(sortedResult);
          if (isCurrentOwner()) {
            set(swapProSupportNetworksTokenListAtom(), sortedResult);
            set(swapProPositionsDataOwnerKeyAtom(), positionOwnerKey);
          }
        } else if (isLatestOwnerRequest()) {
          updatePositionsCache([]);
          if (isCurrentOwner()) {
            set(swapProSupportNetworksTokenListAtom(), []);
            set(swapProPositionsDataOwnerKeyAtom(), positionOwnerKey);
          }
        }
      } catch (error) {
        settleRequestFailure();
        console.error('swapPro__loadPositions error', error);
      } finally {
        if (isLatestOwnerRequest()) {
          set(swapProPositionsRequestIdsAtom(), (previousRequestIds) => {
            const { [positionOwnerKey]: _, ...remainingRequestIds } =
              previousRequestIds;
            return remainingRequestIds;
          });
        }
      }
    },
  );

  updateSwapProPositionTokenBalances = contextAtomMethod(
    (
      get,
      set,
      {
        positionOwnerKey,
        tokens,
      }: {
        positionOwnerKey: string;
        tokens: ISwapToken[];
      },
    ) => {
      if (
        !positionOwnerKey ||
        get(swapProPositionsCurrentOwnerKeyAtom()) !== positionOwnerKey ||
        get(swapProPositionsDataOwnerKeyAtom()) !== positionOwnerKey
      ) {
        return;
      }
      const mergeTokenBalances = (previousTokens: ISwapToken[]) => {
        const updatedTokens = [...previousTokens];
        for (const tokenDetail of tokens) {
          const existingIndex = updatedTokens.findIndex((token) =>
            equalTokenNoCaseSensitive({
              token1: token,
              token2: tokenDetail,
            }),
          );
          const nextToken = {
            ...tokenDetail,
            balanceParsed: tokenDetail.balanceParsed ?? '',
            fiatValue: tokenDetail.fiatValue ?? '',
            price: tokenDetail.price ?? '',
          };
          if (existingIndex === -1) {
            updatedTokens.push(nextToken);
          } else {
            updatedTokens[existingIndex] = {
              ...updatedTokens[existingIndex],
              ...nextToken,
            };
          }
        }
        return updatedTokens;
      };
      set(swapProSupportNetworksTokenListAtom(), mergeTokenBalances);
      set(swapProPositionsCacheAtom(), (previousCache) => {
        const validPreviousCache = getValidSwapProPositionsCache(previousCache);
        const cachedEntry = validPreviousCache.byOwner[positionOwnerKey];
        if (!cachedEntry) {
          return validPreviousCache;
        }
        return upsertSwapProPositionsCacheEntry({
          cache: validPreviousCache,
          entry: {
            ...cachedEntry,
            tokens: mergeTokenBalances(cachedEntry.tokens),
          },
        });
      });
    },
  );

  swapTypeSwitchAction = contextAtomMethod(
    async (
      get,
      set,
      type: ESwapTabSwitchType,
      swapAccountNetworkId?: string,
      options?: {
        carryTargetToken?: boolean;
        proSupportedNetworkIds?: ReadonlySet<string>;
        stableTokenKeys?: ReadonlySet<string>;
        tokenCarryUtils?: ISwapProTokenCarryUtils;
      },
    ): Promise<ISwapToken | undefined> => {
      const oldType = get(swapTypeSwitchAtom());
      const normalizedType = getVisibleSwapTabSwitchType(type) ?? type;
      const oldVisibleType = getVisibleSwapTabSwitchType(oldType) ?? oldType;
      const stableTokenKeys = options?.stableTokenKeys ?? EMPTY_SWAP_TOKEN_KEYS;
      const swapUserSelectedTokens = get(swapUserSelectedTokensAtom());
      const swapProUserSelectedToken = get(swapProUserSelectedTokenAtom());
      const swapProTargetToken =
        platformEnv.isNative &&
        options?.carryTargetToken &&
        oldType === ESwapTabSwitchType.LIMIT &&
        normalizedType === ESwapTabSwitchType.SWAP &&
        equalTokenNoCaseSensitive({
          token1: swapProUserSelectedToken,
          token2: get(swapProSelectTokenAtom()),
        })
          ? swapProUserSelectedToken
          : undefined;
      const carrySwapProTargetToSwap = () => {
        const carriedPair = options?.tokenCarryUtils?.resolveProToSwapCarryPair(
          {
            fromToken: get(swapSelectFromTokenAtom()),
            proToken: swapProTargetToken,
            stableTokenKeys,
            swapNetworks: get(swapNetworks()),
          },
        );
        if (!carriedPair) {
          return;
        }
        this.cleanManualSelectQuoteProviders.call(set);
        set(swapSelectFromTokenAtom(), carriedPair.fromToken);
        set(swapSelectToTokenAtom(), carriedPair.toToken);
        void this.syncNetworksSort.call(set, carriedPair.toToken.networkId);
      };
      let currentFromToken = get(swapSelectFromTokenAtom());
      let currentToToken = get(swapSelectToTokenAtom());
      if (
        isSwapOrBridgeQuoteType(oldType) &&
        !isSwapOrBridgeQuoteType(normalizedType)
      ) {
        set(swapUserSelectedTokensAtom(), undefined);
      }
      if (
        oldType === ESwapTabSwitchType.LIMIT &&
        normalizedType !== ESwapTabSwitchType.LIMIT
      ) {
        set(swapProUserSelectedTokenAtom(), undefined);
      }
      const shouldHandleInputAmountDraft =
        oldVisibleType !== normalizedType &&
        isIndependentSwapInputAmountType(oldVisibleType) &&
        isIndependentSwapInputAmountType(normalizedType);
      // Native Limit owns its own amount state. Preserve the non-Limit side in
      // the shared draft map without copying the Limit owner's state into it.
      const shouldSaveInputAmountDraft =
        shouldHandleInputAmountDraft &&
        (!platformEnv.isNative || oldVisibleType !== ESwapTabSwitchType.LIMIT);
      const shouldRestoreInputAmountDraft =
        shouldHandleInputAmountDraft &&
        (!platformEnv.isNative || normalizedType !== ESwapTabSwitchType.LIMIT);
      let targetInputAmountDraft: ISwapInputAmountDraft | undefined;
      if (shouldSaveInputAmountDraft || shouldRestoreInputAmountDraft) {
        const inputAmountDrafts = get(swapInputAmountDraftsAtom());
        if (shouldSaveInputAmountDraft) {
          const currentInputAmountDraft = buildSwapInputAmountDraft({
            fromTokenAmount: get(swapFromTokenAmountAtom()),
            toTokenAmount: get(swapToTokenAmountAtom()),
            fromToken: currentFromToken,
            toToken: currentToToken,
          });
          const shouldPreservePendingStockDraft =
            oldVisibleType === ESwapTabSwitchType.STOCK &&
            Boolean(inputAmountDrafts[ESwapTabSwitchType.STOCK]) &&
            !currentInputAmountDraft;
          set(swapInputAmountDraftsAtom(), {
            ...inputAmountDrafts,
            [oldVisibleType]: shouldPreservePendingStockDraft
              ? inputAmountDrafts[ESwapTabSwitchType.STOCK]
              : currentInputAmountDraft,
          });
        }
        targetInputAmountDraft = shouldRestoreInputAmountDraft
          ? inputAmountDrafts[normalizedType]
          : undefined;
        set(swapFromTokenAmountAtom(), { value: '', isInput: false });
        set(swapToTokenAmountAtom(), { value: '', isInput: false });
      }
      const restoreTargetInputAmountDraft = () => {
        if (
          !targetInputAmountDraft ||
          normalizedType === ESwapTabSwitchType.STOCK
        ) {
          return;
        }
        if (
          isSwapInputAmountDraftForTokenPair({
            draft: targetInputAmountDraft,
            fromToken: get(swapSelectFromTokenAtom()),
            toToken: get(swapSelectToTokenAtom()),
          })
        ) {
          set(
            swapFromTokenAmountAtom(),
            targetInputAmountDraft.fromTokenAmount,
          );
          set(swapToTokenAmountAtom(), targetInputAmountDraft.toTokenAmount);
        }
        set(swapInputAmountDraftsAtom(), (drafts) => ({
          ...drafts,
          [normalizedType]: undefined,
        }));
      };
      const isCrossingStockBoundary =
        (oldType === ESwapTabSwitchType.STOCK) !==
        (normalizedType === ESwapTabSwitchType.STOCK);
      if (isCrossingStockBoundary) {
        set(swapStockSelectedFromTokenBalanceAtom(), '');
      }
      if (
        oldType === ESwapTabSwitchType.STOCK &&
        normalizedType === ESwapTabSwitchType.LIMIT
      ) {
        set(swapSelectedFromTokenBalanceAtom(), '');
      }
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
        set(swapFromTokenAmountAtom(), { value: '', isInput: false });
        set(swapToTokenAmountAtom(), { value: '', isInput: false });
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
          sourceSwapType: oldVisibleType,
          fromToken: currentFromToken,
          toToken: currentToToken,
        });
      }
      if (
        platformEnv.isNative &&
        options?.carryTargetToken &&
        options.tokenCarryUtils &&
        isSwapOrBridgeQuoteType(oldType) &&
        normalizedType === ESwapTabSwitchType.LIMIT &&
        swapUserSelectedTokens &&
        options.tokenCarryUtils.isSwapTokenSelectionCurrent({
          currentFromToken,
          currentToToken,
          selectedFromToken: swapUserSelectedTokens.fromToken,
          selectedToToken: swapUserSelectedTokens.toToken,
        })
      ) {
        const carryToken = options.tokenCarryUtils.resolveSwapToProCarryToken({
          fromToken: swapUserSelectedTokens.fromToken,
          proSupportedNetworkIds:
            options.proSupportedNetworkIds ?? EMPTY_SWAP_TOKEN_KEYS,
          stableTokenKeys,
          toToken: swapUserSelectedTokens.toToken,
        });
        if (carryToken) {
          void this.persistSwapProSelectToken.call(set, carryToken);
        }
      }
      if (
        platformEnv.isNative &&
        (oldType === ESwapTabSwitchType.LIMIT ||
          type === ESwapTabSwitchType.LIMIT)
      ) {
        set(swapFromTokenAmountAtom(), { value: '', isInput: false });
        set(swapToTokenAmountAtom(), { value: '', isInput: false });
      }
      // OK-49718: Clear quote list when switching type to prevent showing stale data
      set(swapQuoteListAtom(), []);
      set(swapQuoteCurrentEventProviderKeysAtom(), []);
      set(swapQuoteCurrentEventReceivedCountAtom(), 0);
      set(swapQuoteEventCompletedAtom(), false);
      set(swapQuoteEventTotalCountAtom(), { count: 0 });
      set(swapTypeSwitchAtom(), normalizedType);
      if (platformEnv.isNative && normalizedType === ESwapTabSwitchType.LIMIT) {
        return get(swapSelectFromTokenAtom());
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
          carrySwapProTargetToSwap();
          restoreTargetInputAmountDraft();
          return get(swapSelectFromTokenAtom());
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
      carrySwapProTargetToSwap();
      restoreTargetInputAmountDraft();
      return get(swapSelectFromTokenAtom());
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
        if (
          !currentSelectToken ||
          !equalTokenNoCaseSensitive({
            token1: {
              networkId,
              contractAddress,
            },
            token2: currentSelectToken,
          })
        ) {
          return;
        }
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
        const currentSelectToken = get(swapProSelectTokenAtom());
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
          set(swapProTokenMarketDetailInfoLoadingAtom(), false);
        }
      }
    },
  );
}

const createActions = memoFn(() => new ContentJotaiActionsSwap());

export const useSwapActions = () => {
  const actions = createActions();
  const selectFromToken = actions.selectFromToken.use();
  const selectFromTokenByUser = actions.selectFromTokenByUser.use();
  const selectToToken = actions.selectToToken.use();
  const selectToTokenByUser = actions.selectToTokenByUser.use();
  const selectStockExecutionTokens = actions.selectStockExecutionTokens.use();
  const alternationToken = actions.alternationToken.use();
  const syncNetworksSort = actions.syncNetworksSort.use();
  const catchSwapTokensMap = actions.catchSwapTokensMap.use();
  const quoteAction = actions.quoteAction.use();
  const requireManualQuoteRefresh = actions.requireManualQuoteRefresh.use();
  const checkSwapWarning = actions.checkSwapWarning.use();
  const invalidateSwapWarningCheck = actions.invalidateSwapWarningCheck.use();
  const tokenListFetchAction = actions.tokenListFetchAction.use();
  const quoteEventHandler = actions.quoteEventHandler.use();
  const loadSwapSelectTokenDetail = actions.loadSwapSelectTokenDetail.use();
  const swapLoadAllNetworkTokenList = actions.swapLoadAllNetworkTokenList.use();
  const swapTypeSwitchAction = actions.swapTypeSwitchAction.use();
  const limitOrderMarketPriceIntervalAction =
    actions.limitOrderMarketPriceIntervalAction.use();
  const swapProTokenMarketDetailFetchAction =
    actions.swapProTokenMarketDetailFetchAction.use();
  const swapProLoadSupportNetworksTokenList =
    actions.swapProLoadSupportNetworksTokenList.use();
  const updateSwapProPositionTokenBalances =
    actions.updateSwapProPositionTokenBalances.use();
  const beginSwapProTokenBalanceRequest =
    actions.beginSwapProTokenBalanceRequest.use();
  const isSwapProTokenBalanceRequestLatest =
    actions.isSwapProTokenBalanceRequestLatest.use();
  const invalidateSwapProTokenBalanceRequest =
    actions.invalidateSwapProTokenBalanceRequest.use();
  const finishSwapProTokenBalanceRequest =
    actions.finishSwapProTokenBalanceRequest.use();
  const quoteSpeedAction = actions.quoteSpeedAction.use();
  const cleanQuoteInterval = actions.cleanQuoteInterval.use();
  const selectSwapProToken = actions.selectSwapProToken.use();
  const initializeSwapProSelectToken =
    actions.initializeSwapProSelectToken.use();
  const updateSwapProSelectTokenMetadata =
    actions.updateSwapProSelectTokenMetadata.use();
  const clearSwapTokenCarryIntent = actions.clearSwapTokenCarryIntent.use();
  const resetSwapTokenData = actions.resetSwapTokenData.use();
  const resetQuoteAction = actions.resetQuoteAction.use();
  const {
    closeQuoteEvent,
    needChangeToken,
    cleanLimitOrderMarketPriceInterval,
  } = actions;

  return useRef({
    selectFromToken,
    selectFromTokenByUser,
    quoteAction,
    requireManualQuoteRefresh,
    selectToToken,
    selectToTokenByUser,
    selectStockExecutionTokens,
    alternationToken,
    syncNetworksSort,
    catchSwapTokensMap,
    cleanQuoteInterval,
    tokenListFetchAction,
    checkSwapWarning,
    invalidateSwapWarningCheck,
    loadSwapSelectTokenDetail,
    quoteEventHandler,
    swapLoadAllNetworkTokenList,
    closeQuoteEvent,
    swapTypeSwitchAction,
    needChangeToken,
    limitOrderMarketPriceIntervalAction,
    cleanLimitOrderMarketPriceInterval,
    swapProTokenMarketDetailFetchAction,
    swapProLoadSupportNetworksTokenList,
    updateSwapProPositionTokenBalances,
    beginSwapProTokenBalanceRequest,
    isSwapProTokenBalanceRequestLatest,
    invalidateSwapProTokenBalanceRequest,
    finishSwapProTokenBalanceRequest,
    quoteSpeedAction,
    selectSwapProToken,
    initializeSwapProSelectToken,
    updateSwapProSelectTokenMetadata,
    clearSwapTokenCarryIntent,
    resetSwapTokenData,
    resetQuoteAction,
  });
};
