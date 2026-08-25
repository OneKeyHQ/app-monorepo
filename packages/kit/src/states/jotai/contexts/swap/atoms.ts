import BigNumber from 'bignumber.js';

import { ESwapDirection } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/SwapPanel/hooks/useTradeType';
import type { IToken } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/SwapPanel/types';
import {
  EMPTY_SWAP_BALANCE_DISPLAY_CACHE,
  type ISwapBalanceDisplayCache,
} from '@onekeyhq/kit/src/views/Swap/utils/swapBalanceDisplayCacheUtils';
import {
  EMPTY_SWAP_PRO_POSITIONS_CACHE,
  type ISwapProPositionsCache,
} from '@onekeyhq/kit/src/views/Swap/utils/swapProPositionsCacheUtils';
import { isStockQuoteInputAmountMatched } from '@onekeyhq/kit/src/views/Swap/utils/swapStockTradeControl';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { dangerAllNetworkRepresent } from '@onekeyhq/shared/src/config/presetNetworks';
import { CONTEXT_ATOM_COLD_START_CACHE_KEYS } from '@onekeyhq/shared/src/consts/jotaiConsts';
import type { ICustomPriorityFeeOverride } from '@onekeyhq/shared/src/utils/marketPresetFeeUtils';
import { clampLimitRateDecimals } from '@onekeyhq/shared/src/utils/numberUtils';
import type { ISwapSelectedTokensColdStartContext } from '@onekeyhq/shared/src/utils/swapColdStartCacheSnapshotUtils';
import { sortSwapQuotes } from '@onekeyhq/shared/src/utils/swapQuoteSortUtils';
import {
  checkWrappedTokenPair,
  equalTokenNoCaseSensitive,
} from '@onekeyhq/shared/src/utils/tokenUtils';
import type {
  IMarketTokenDetail,
  IMarketTokenDetailWebsocket,
} from '@onekeyhq/shared/types/marketV2';
import {
  ESwapProTimeRange,
  ESwapProviderSort,
  mevSwapNetworks,
  swapProTimeRangeItems,
} from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import {
  type ESwapDirectionType,
  ESwapNetworkFeeLevel,
  ESwapProTradeType,
  type ESwapQuoteKind,
  ESwapQuoteSource,
  type ESwapRateDifferenceUnit,
  type ESwapSlippageSegmentKey,
  ESwapTabSwitchType,
  type IFetchQuoteResult,
  type ISwapAlertState,
  type ISwapAutoSlippageSuggestedValue,
  type ISwapLimitPriceInfo,
  type ISwapNativeTokenReserveGas,
  type ISwapNetwork,
  type ISwapPreSwapData,
  type ISwapStep,
  type ISwapTips,
  type ISwapToken,
  type ISwapTokenCatch,
  type ISwapTokenMetadata,
  LIMIT_PRICE_DEFAULT_DECIMALS,
  defaultLimitExpirationTime,
} from '@onekeyhq/shared/types/swap/types';

import { createJotaiContext } from '../../utils/createJotaiContext';

import {
  type ISwapQuoteEventTotalCount,
  type ISwapQuoteSelectionIntent,
  buildSwapQuoteProviderKey,
  selectSwapCurrentQuote,
} from './quoteProgress';

import type { IAccountSelectorActiveAccountInfo } from '../accountSelector';

const {
  Provider: ProviderJotaiContextSwap,
  contextAtom,
  contextAtomComputed,
  contextAtomMethod,
  useContextData,
} = createJotaiContext();
export { ProviderJotaiContextSwap, contextAtomMethod };

export function useSwapColdStartScopeKey() {
  const { store } = useContextData();
  return (
    store as
      | {
          __ONEKEY_JOTAI_COLD_START_SCOPE_KEY__?: string;
        }
      | undefined
  )?.__ONEKEY_JOTAI_COLD_START_SCOPE_KEY__;
}

export type ISwapQuoteEventErrorState = {
  message: string;
  fromToken?: ISwapToken;
  toToken?: ISwapToken;
  fromTokenAmount?: string;
  isStock?: boolean;
  isMarketOpen?: boolean;
  eventId?: string;
};

// swap mev config
export const { atom: swapMevConfigAtom, use: useSwapMevConfigAtom } =
  contextAtom<{
    swapMevNetConfig: string[];
  }>({
    swapMevNetConfig: mevSwapNetworks,
  });

// swap bridge limit switch
export const { atom: swapTypeSwitchAtom, use: useSwapTypeSwitchAtom } =
  contextAtom<ESwapTabSwitchType>(ESwapTabSwitchType.SWAP, {
    coldStartCache: true,
    coldStartCacheKey: CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapTypeSwitchAtom,
  });

// swap networks & tokens
export const { atom: swapNetworks, use: useSwapNetworksAtom } = contextAtom<
  ISwapNetwork[]
>([]);

export const {
  atom: swapNetworksIncludeAllNetworkAtom,
  use: useSwapNetworksIncludeAllNetworkAtom,
} = contextAtomComputed<ISwapNetwork[]>((get) => {
  let networks = get(swapNetworks());
  const swapType = get(swapTypeSwitchAtom());
  networks = networks.filter((net) => {
    if (swapType === ESwapTabSwitchType.LIMIT) {
      return net.supportLimit;
    }
    if (swapType === ESwapTabSwitchType.STOCK) {
      return net.supportStock;
    }
    return net.supportSingleSwap || net.supportCrossChainSwap;
  });
  const allNetwork = {
    networkId: getNetworkIdsMap().onekeyall,
    name: dangerAllNetworkRepresent.name,
    symbol: dangerAllNetworkRepresent.symbol,
    logoURI: dangerAllNetworkRepresent.logoURI,
    shortcode: dangerAllNetworkRepresent.shortcode,
    isAllNetworks: true,
  };
  return [allNetwork, ...networks];
});

export const { atom: swapTokenMapAtom, use: useSwapTokenMapAtom } =
  contextAtom<{
    updatedAt: number;
    tokenCatch?: Record<string, ISwapTokenCatch>;
  }>({
    updatedAt: 0,
  });

export const { atom: swapTokenFetchingAtom, use: useSwapTokenFetchingAtom } =
  contextAtom<boolean>(false);

// swap account
export const {
  atom: swapToAnotherAccountAddressAtom,
  use: useSwapToAnotherAccountAddressAtom,
} = contextAtom<{
  networkId: string | undefined;
  address: string | undefined;
  accountInfo: IAccountSelectorActiveAccountInfo | undefined;
}>({ networkId: undefined, address: undefined, accountInfo: undefined });

// swap select token
export const {
  atom: swapSelectFromTokenAtom,
  use: useSwapSelectFromTokenAtom,
} = contextAtom<ISwapToken | undefined>(undefined, {
  coldStartCache: true,
  coldStartCacheKey: CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapSelectFromTokenAtom,
});

export const { atom: swapSelectToTokenAtom, use: useSwapSelectToTokenAtom } =
  contextAtom<ISwapToken | undefined>(undefined, {
    coldStartCache: true,
    coldStartCacheKey: CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapSelectToTokenAtom,
  });

export const {
  atom: swapLastNonLimitSelectedTokensAtom,
  use: useSwapLastNonLimitSelectedTokensAtom,
} = contextAtom<
  | {
      sourceSwapType?: ESwapTabSwitchType;
      fromToken?: ISwapToken;
      toToken?: ISwapToken;
    }
  | undefined
>(undefined);

export const {
  atom: swapStockExecutionTokenSyncIdAtom,
  use: useSwapStockExecutionTokenSyncIdAtom,
} = contextAtom<number>(0);

export const {
  atom: swapStockExecutionTokensAtom,
  use: useSwapStockExecutionTokensAtom,
} = contextAtom<
  | {
      syncId: number;
      fromToken: ISwapToken;
      toToken: ISwapToken;
    }
  | undefined
>(undefined);

export const {
  atom: swapStockSelectedTokenAtom,
  use: useSwapStockSelectedTokenAtom,
} = contextAtom<ISwapToken | undefined>(undefined, {
  // Display-only Stock identity. Ordinary Swap execution resets must not clear
  // it; realtime market/pay-token readiness still gates quote and execution.
  coldStartCache: true,
  coldStartCacheKey:
    CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapStockSelectedTokenAtom,
});

export const {
  atom: swapSelectedTokensColdStartContextAtom,
  use: useSwapSelectedTokensColdStartContextAtom,
} = contextAtom<ISwapSelectedTokensColdStartContext | undefined>(undefined, {
  coldStartCache: true,
  coldStartCacheKey:
    CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapSelectedTokensColdStartContextAtom,
});

export const {
  atom: swapStockPayTokenPreferenceAtom,
  use: useSwapStockPayTokenPreferenceAtom,
} = contextAtom<Record<string, string>>(
  {},
  {
    coldStartCache: true,
    coldStartCacheKey:
      CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapStockPayTokenPreferenceAtom,
  },
);

export const {
  atom: swapStockPayTokenDisplayAtom,
  use: useSwapStockPayTokenDisplayAtom,
} = contextAtom<Record<string, ISwapToken>>(
  {},
  {
    // Account-scoped Stock pay-token seeds are display-only. Live speed config
    // and token details still gate selection, quote, and execution.
    coldStartCache: true,
    coldStartCacheKey:
      CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapStockPayTokenDisplayAtom,
  },
);

export const {
  atom: swapBalanceDisplayCacheAtom,
  use: useSwapBalanceDisplayCacheAtom,
} = contextAtom<ISwapBalanceDisplayCache>(EMPTY_SWAP_BALANCE_DISPLAY_CACHE, {
  // Last-good, owner-scoped balance values are for first-frame display only.
  // Quote, Max, review, build, and send continue to use live balance state.
  coldStartCache: true,
  coldStartCacheKey:
    CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapBalanceDisplayCacheAtom,
});

export const {
  atom: swapStockBalanceDisplayCacheAtom,
  use: useSwapStockBalanceDisplayCacheAtom,
} = contextAtom<ISwapBalanceDisplayCache>(EMPTY_SWAP_BALANCE_DISPLAY_CACHE, {
  // Stock keeps its own display cache so channel transitions can never replace
  // the ordinary Swap first-frame balance.
  coldStartCache: true,
  coldStartCacheKey:
    CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapStockBalanceDisplayCacheAtom,
});

export const {
  atom: swapInitialSelectedTokensSyncedAtom,
  use: useSwapInitialSelectedTokensSyncedAtom,
} = contextAtom<boolean>(false);

export const {
  atom: swapSwapModalSelectFromTokenAtom,
  use: useSwapModalSelectFromTokenAtom,
} = contextAtom<ISwapToken | undefined>(undefined);

export const {
  atom: swapSwapModalSelectToTokenAtom,
  use: useSwapModalSelectToTokenAtom,
} = contextAtom<ISwapToken | undefined>(undefined);

export type ISwapTokenAmountState = {
  value: string;
  isInput: boolean;
};

export type ISwapInputAmountDraft = {
  fromTokenAmount: ISwapTokenAmountState;
  toTokenAmount: ISwapTokenAmountState;
  fromToken?: ISwapToken;
  toToken?: ISwapToken;
};

export const {
  atom: swapFromTokenAmountAtom,
  use: useSwapFromTokenAmountAtom,
} = contextAtom<ISwapTokenAmountState>({
  value: '',
  isInput: false,
});

export const { atom: swapToTokenAmountAtom, use: useSwapToTokenAmountAtom } =
  contextAtom<ISwapTokenAmountState>({
    value: '',
    isInput: false,
  });

export const {
  atom: swapInputAmountDraftsAtom,
  use: useSwapInputAmountDraftsAtom,
} = contextAtom<Partial<Record<ESwapTabSwitchType, ISwapInputAmountDraft>>>({});

export const {
  atom: swapSelectedFromTokenBalanceAtom,
  use: useSwapSelectedFromTokenBalanceAtom,
} = contextAtom('');

export const {
  atom: swapStockSelectedFromTokenBalanceAtom,
  use: useSwapStockSelectedFromTokenBalanceAtom,
} = contextAtom('');

export const {
  atom: swapActiveSelectedFromTokenBalanceAtom,
  use: useSwapActiveSelectedFromTokenBalanceAtom,
} = contextAtomComputed((get) =>
  get(swapTypeSwitchAtom()) === ESwapTabSwitchType.STOCK
    ? get(swapStockSelectedFromTokenBalanceAtom())
    : get(swapSelectedFromTokenBalanceAtom()),
);

export const {
  atom: swapSelectedToTokenBalanceAtom,
  use: useSwapSelectedToTokenBalanceAtom,
} = contextAtom('');

export const {
  atom: swapAllNetworkTokenListMapAtom,
  use: useSwapAllNetworkTokenListMapAtom,
} = contextAtom<Record<string, ISwapToken[]>>({});

export const {
  atom: swapAllNetworkActionLockAtom,
  use: useSwapAllNetworkActionLockAtom,
} = contextAtom<
  Record<
    string,
    {
      activeRequestKey: string;
      completionPromise: Promise<void>;
      pendingRequestKey?: string;
    }
  >
>({});

// swap quote
export const {
  atom: swapManualSelectQuoteProvidersAtom,
  use: useSwapManualSelectQuoteProvidersAtom,
} = contextAtom<ISwapQuoteSelectionIntent | undefined>(undefined);

export const { atom: swapQuoteListAtom, use: useSwapQuoteListAtom } =
  contextAtom<IFetchQuoteResult[]>([]);

export const { atom: swapProviderSortAtom, use: useSwapProviderSortAtom } =
  contextAtom<ESwapProviderSort>(ESwapProviderSort.RECOMMENDED);

export const {
  atom: swapQuoteActionLockAtom,
  use: useSwapQuoteActionLockAtom,
} = contextAtom<{
  type?: ESwapTabSwitchType;
  source?: ESwapQuoteSource;
  actionLock: boolean;
  fromToken?: ISwapToken;
  toToken?: ISwapToken;
  fromTokenAmount?: string;
  toTokenAmount?: string;
  accountId?: string;
  kind?: ESwapQuoteKind;
  address?: string;
  receivingAddress?: string;
  quoteRequestId?: string;
  manualRefresh?: boolean;
}>({ actionLock: false });

export const {
  atom: swapQuoteIntervalCountAtom,
  use: useSwapQuoteIntervalCountAtom,
} = contextAtom<number>(0);

export const {
  atom: swapQuoteAutoRefreshTimerAtom,
  use: useSwapQuoteAutoRefreshTimerAtom,
} = contextAtom<ReturnType<typeof setTimeout> | undefined>(undefined);

export const { atom: swapWarningRequestIdAtom } = contextAtom<number>(0);

export const {
  atom: swapQuoteEventTotalCountAtom,
  use: useSwapQuoteEventTotalCountAtom,
} = contextAtom<ISwapQuoteEventTotalCount>({
  count: 0,
});

export const {
  atom: swapQuoteEventCompletedAtom,
  use: useSwapQuoteEventCompletedAtom,
} = contextAtom<boolean>(false);

export const {
  atom: swapQuoteCurrentEventProviderKeysAtom,
  use: useSwapQuoteCurrentEventProviderKeysAtom,
} = contextAtom<string[]>([]);

export const {
  atom: swapQuoteCurrentEventReceivedCountAtom,
  use: useSwapQuoteCurrentEventReceivedCountAtom,
} = contextAtom<number>(0);

export const {
  atom: swapShouldRefreshQuoteAtom,
  use: useSwapShouldRefreshQuoteAtom,
} = contextAtom<boolean>(false);

export const {
  atom: swapQuoteCurrentEventListAtom,
  use: useSwapQuoteCurrentEventListAtom,
} = contextAtomComputed<IFetchQuoteResult[]>((get) => {
  const list = get(swapQuoteListAtom());
  const quoteEventTotalCount = get(swapQuoteEventTotalCountAtom());
  const currentEventProviderKeys = get(swapQuoteCurrentEventProviderKeysAtom());
  const currentEventProviderKeySet = new Set(currentEventProviderKeys);
  return quoteEventTotalCount.count > 0
    ? list.filter((quote) =>
        currentEventProviderKeySet.has(buildSwapQuoteProviderKey(quote)),
      )
    : list;
});

export const {
  atom: swapSortedQuoteListAtom,
  use: useSwapSortedQuoteListAtom,
} = contextAtomComputed<IFetchQuoteResult[]>((get) => {
  const list = get(swapQuoteCurrentEventListAtom());
  const fromTokenAmount = get(swapFromTokenAmountAtom());
  const quoteActionLock = get(swapQuoteActionLockAtom());
  const sortType = get(swapProviderSortAtom());
  return sortSwapQuotes(list, {
    sort: sortType,
    fromTokenAmount: quoteActionLock.fromTokenAmount ?? fromTokenAmount.value,
  });
});

export const {
  atom: swapQuoteCurrentSelectAtom,
  use: useSwapQuoteCurrentSelectAtom,
} = contextAtomComputed((get) => {
  const list = get(swapQuoteCurrentEventListAtom());
  const fromTokenAmount = get(swapFromTokenAmountAtom());
  const toTokenAmount = get(swapToTokenAmountAtom());
  const swapTypeSwitch = get(swapTypeSwitchAtom());
  const quoteActionLock = get(swapQuoteActionLockAtom());
  const activeFromTokenAmount =
    quoteActionLock.fromTokenAmount ?? fromTokenAmount.value;
  const activeToTokenAmount =
    quoteActionLock.toTokenAmount ?? toTokenAmount.value;
  const activeSwapType = quoteActionLock.type ?? swapTypeSwitch;
  const selectionIntent = get(swapManualSelectQuoteProvidersAtom());
  const quoteEventTotalCount = get(swapQuoteEventTotalCountAtom());
  const quoteEventCompleted = get(swapQuoteEventCompletedAtom());
  const currentEventProviderKeys = get(swapQuoteCurrentEventProviderKeysAtom());
  const recommendedSortedList = sortSwapQuotes(list, {
    sort: ESwapProviderSort.RECOMMENDED,
    fromTokenAmount: activeFromTokenAmount,
  });
  const currentEventSortedQuotes =
    activeSwapType === ESwapTabSwitchType.STOCK
      ? recommendedSortedList.filter((quote) =>
          isStockQuoteInputAmountMatched({
            quote,
            fromAmount: activeFromTokenAmount,
            toAmount: activeToTokenAmount,
          }),
        )
      : recommendedSortedList;
  return selectSwapCurrentQuote({
    currentEventSortedQuotes,
    selectionIntent: selectionIntent ?? undefined,
    quoteEventTotalCount,
    currentEventProviderKeys,
    quoteEventCompleted,
    deferNonActionableQuoteUntilEventSettled:
      activeSwapType === ESwapTabSwitchType.STOCK ||
      quoteActionLock.source === ESwapQuoteSource.MARKET,
  });
});

export const { atom: swapTokenMetadataAtom, use: useSwapTokenMetadataAtom } =
  contextAtomComputed<{
    swapTokenMetadata?: ISwapTokenMetadata;
  }>((get) => {
    const quoteList = get(swapQuoteListAtom());
    const swapTokenMetadata = quoteList.find(
      (item) => item.tokenMetadata,
    )?.tokenMetadata;
    return {
      swapTokenMetadata,
    };
  });

export const { atom: swapQuoteFetchingAtom, use: useSwapQuoteFetchingAtom } =
  contextAtom<boolean>(false);

export const {
  atom: swapSelectTokenDetailFetchingAtom,
  use: useSwapSelectTokenDetailFetchingAtom,
} = contextAtom<Record<ESwapDirectionType, boolean>>({
  from: false,
  to: false,
});

export const {
  atom: swapSilenceQuoteLoading,
  use: useSwapSilenceQuoteLoading,
} = contextAtom<boolean>(false);

export const {
  atom: swapProviderSupportReceiveAddressAtom,
  use: useSwapProviderSupportReceiveAddressAtom,
} = contextAtomComputed((get) => {
  const quoteResult = get(swapQuoteCurrentSelectAtom());
  if (!quoteResult) {
    return true;
  }
  return (
    !quoteResult.unSupportReceiveAddressDifferent && !quoteResult.isWrapped
  );
});

// swap limit price rate
export const {
  atom: swapLimitPriceUseRateAtom,
  use: useSwapLimitPriceUseRateAtom,
} = contextAtom<ISwapLimitPriceInfo>({
  fromToken: undefined,
  toToken: undefined,
});

export const {
  atom: limitOrderMarketPriceAtom,
  use: useLimitOrderMarketPriceAtom,
} = contextAtom<{
  fromTokenPriceInfo?: {
    tokenInfo: ISwapToken;
    price: string;
  };
  toTokenPriceInfo?: {
    tokenInfo: ISwapToken;
    price: string;
  };
}>({});

export const {
  atom: swapLimitExpirationTimeAtom,
  use: useSwapLimitExpirationTimeAtom,
} = contextAtom<{ label: string; value: string }>({
  label: '',
  value: defaultLimitExpirationTime.toString(),
});

export const {
  atom: swapLimitPriceRateReverseAtom,
  use: useSwapLimitPriceRateReverseAtom,
} = contextAtom<boolean>(false);

export const {
  atom: swapLimitPriceFromAmountAtom,
  use: useSwapLimitPriceFromAmountAtom,
} = contextAtomComputed((get) => {
  const swapType = get(swapTypeSwitchAtom());
  const toTokenAmount = get(swapToTokenAmountAtom());
  const limitPriceUseRate = get(swapLimitPriceUseRateAtom());
  if (
    limitPriceUseRate.rate &&
    limitPriceUseRate.reverseRate &&
    swapType === ESwapTabSwitchType.LIMIT
  ) {
    if (toTokenAmount.value && toTokenAmount.isInput) {
      const { fromToken, reverseRate } = limitPriceUseRate;
      const toAmount = new BigNumber(toTokenAmount.value);
      const fromAmountBN = new BigNumber(toAmount).multipliedBy(reverseRate);
      const fromAmount = fromAmountBN
        .decimalPlaces(
          Number(fromToken?.decimals ?? LIMIT_PRICE_DEFAULT_DECIMALS),
          BigNumber.ROUND_HALF_UP,
        )
        .toFixed();
      return fromAmount;
    }
  }
  return '';
});

export const {
  atom: swapLimitPriceToAmountAtom,
  use: useSwapLimitPriceToAmountAtom,
} = contextAtomComputed((get) => {
  const swapType = get(swapTypeSwitchAtom());
  const fromTokenAmount = get(swapFromTokenAmountAtom());
  const limitPriceUseRate = get(swapLimitPriceUseRateAtom());
  if (
    limitPriceUseRate.rate &&
    limitPriceUseRate.reverseRate &&
    swapType === ESwapTabSwitchType.LIMIT
  ) {
    if (fromTokenAmount.value && fromTokenAmount.isInput) {
      const { toToken, rate } = limitPriceUseRate;
      const fromAmount = new BigNumber(fromTokenAmount.value);
      const toAmountBN = new BigNumber(fromAmount).multipliedBy(rate);
      const toAmount = toAmountBN
        .decimalPlaces(
          Number(toToken?.decimals ?? LIMIT_PRICE_DEFAULT_DECIMALS),
          BigNumber.ROUND_HALF_UP,
        )
        .toFixed();
      return toAmount;
    }
  }
  return '';
});

export const {
  atom: swapLimitPartiallyFillAtom,
  use: useSwapLimitPartiallyFillAtom,
} = contextAtom<{ label: string; value: boolean }>({
  label: '',
  value: true,
});

// swap state
export const { atom: swapAlertsAtom, use: useSwapAlertsAtom } = contextAtom<{
  states: ISwapAlertState[];
  quoteId: string;
}>({ states: [], quoteId: '' });

export const {
  atom: swapQuoteEventErrorAtom,
  use: useSwapQuoteEventErrorAtom,
} = contextAtom<ISwapQuoteEventErrorState | undefined>(undefined);

export const { atom: rateDifferenceAtom, use: useRateDifferenceAtom } =
  contextAtom<{ value: string; unit: ESwapRateDifferenceUnit } | undefined>(
    undefined,
  );

// swap approve
export const {
  atom: swapQuoteApproveAllowanceUnLimitAtom,
  use: useSwapQuoteApproveAllowanceUnLimitAtom,
} = contextAtom<boolean>(false);

export const {
  atom: swapApproveAllowanceSelectOpenAtom,
  use: useSwapApproveAllowanceSelectOpenAtom,
} = contextAtom<boolean>(false);

// swap slippage
export const {
  atom: swapAutoSlippageSuggestedValueAtom,
  use: useSwapAutoSlippageSuggestedValueAtom,
} = contextAtom<ISwapAutoSlippageSuggestedValue | undefined>(undefined);

export const {
  atom: swapSlippageDialogOpeningAtom,
  use: useSwapSlippageDialogOpeningAtom,
} = contextAtom<{ status: boolean; flag?: string }>({ status: false });

// swap build_tx
export const {
  atom: swapBuildTxFetchingAtom,
  use: useSwapBuildTxFetchingAtom,
} = contextAtom<boolean>(false);

export const { atom: swapStepsAtom, use: useSwapStepsAtom } = contextAtom<{
  steps: ISwapStep[];
  preSwapData: ISwapPreSwapData;
  quoteResult?: IFetchQuoteResult;
}>({
  steps: [],
  preSwapData: {},
});

export const {
  atom: swapStepNetFeeLevelAtom,
  use: useSwapStepNetFeeLevelAtom,
} = contextAtom<{
  networkFeeLevel: ESwapNetworkFeeLevel;
  customPriorityFee?: ICustomPriorityFeeOverride;
}>({
  networkFeeLevel: ESwapNetworkFeeLevel.MEDIUM,
});

// Session-scoped slippage override sourced from Market preset. When set, takes
// precedence over the global persisted swap slippage in
// `useSwapSlippagePercentageModeInfo`. Cleanup is owned by the component that
// installed it (e.g. `useMarketPresetSwapOverridesEffect`).
export const {
  atom: swapSlippageOverrideAtom,
  use: useSwapSlippageOverrideAtom,
} = contextAtom<
  | {
      key: ESwapSlippageSegmentKey;
      value?: number;
    }
  | undefined
>(undefined);

export const {
  atom: swapSelectTokenNetworkAtom,
  use: useSwapSelectTokenNetworkAtom,
} = contextAtom<ISwapNetwork | undefined>(undefined);

export type ISwapTipsState = {
  tips?: ISwapTips;
  status: 'unknown' | 'ready' | 'empty';
  updatedAt: number;
};

// swap tips
export const { atom: swapTipsAtom, use: useSwapTipsAtom } =
  contextAtom<ISwapTipsState>(
    {
      status: 'unknown',
      updatedAt: 0,
    },
    {
      coldStartCache: true,
      coldStartCacheKey: CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapTipsStateAtom,
    },
  );

export const {
  atom: swapNativeTokenReserveGasAtom,
  use: useSwapNativeTokenReserveGasAtom,
} = contextAtom<ISwapNativeTokenReserveGas[]>([]);

export const { atom: swapUserSelectedTokensAtom } = contextAtom<
  | {
      fromToken?: ISwapToken;
      toToken?: ISwapToken;
    }
  | undefined
>(undefined);

// swap pro
export const { atom: swapProSelectTokenAtom, use: useSwapProSelectTokenAtom } =
  contextAtom<ISwapToken | undefined>(undefined);

export const { atom: swapProUserSelectedTokenAtom } = contextAtom<
  ISwapToken | undefined
>(undefined);

export const { atom: swapProDirectionAtom, use: useSwapProDirectionAtom } =
  contextAtom<ESwapDirection>(ESwapDirection.BUY);

export const { atom: swapProTradeTypeAtom, use: useSwapProTradeTypeAtom } =
  contextAtom<ESwapProTradeType>(ESwapProTradeType.MARKET);

export const { atom: swapProInputAmountAtom, use: useSwapProInputAmountAtom } =
  contextAtom<string>('');

export const {
  atom: swapProUseSelectBuyTokenAtom,
  use: useSwapProUseSelectBuyTokenAtom,
} = contextAtom<IToken | undefined>(undefined);

export const { atom: swapProSellToTokenAtom, use: useSwapProSellToTokenAtom } =
  contextAtom<IToken | undefined>(undefined);

export const {
  atom: swapProTokenMarketDetailInfoAtom,
  use: useSwapProTokenMarketDetailInfoAtom,
} = contextAtom<IMarketTokenDetail | undefined>(undefined);

export const {
  atom: swapProTokenDetailWebsocketAtom,
  use: useSwapProTokenDetailWebsocketAtom,
} = contextAtom<IMarketTokenDetailWebsocket | undefined>(undefined);

export const {
  atom: swapProTokenMarketDetailInfoLoadingAtom,
  use: useSwapProTokenMarketDetailInfoLoadingAtom,
} = contextAtom<boolean>(false);

const DEFAULT_TIME_RANGE = ESwapProTimeRange.TWENTY_FOUR_HOURS;
export const defaultTimeRangeItem =
  swapProTimeRangeItems.find((item) => item.value === DEFAULT_TIME_RANGE) ??
  swapProTimeRangeItems[swapProTimeRangeItems.length - 1];

export const { atom: swapProTimeRangeAtom, use: useSwapProTimeRangeAtom } =
  contextAtom<{ label: string; value: ESwapProTimeRange }>({
    label: defaultTimeRangeItem.label,
    value: defaultTimeRangeItem.value,
  });

export const {
  atom: swapProSupportNetworksTokenListAtom,
  use: useSwapProSupportNetworksTokenListAtom,
} = contextAtom<ISwapToken[]>([]);

export function buildSwapProPositionsOwnerKey({
  accountId,
  networkIdsKey,
  currencyId,
}: {
  accountId?: string;
  networkIdsKey: string;
  currencyId: string;
}) {
  if (!accountId || !networkIdsKey || !currencyId) {
    return '';
  }
  return `${accountId}__${networkIdsKey}__${currencyId.toLowerCase()}`;
}

export const {
  atom: swapProPositionsCacheAtom,
  use: useSwapProPositionsCacheAtom,
} = contextAtom<ISwapProPositionsCache>(EMPTY_SWAP_PRO_POSITIONS_CACHE, {
  coldStartCache: true,
  coldStartCacheKey:
    CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapProPositionsCacheAtom,
});

export const {
  atom: swapProPositionsCurrentOwnerKeyAtom,
  use: useSwapProPositionsCurrentOwnerKeyAtom,
} = contextAtom<string>('');

export const {
  atom: swapProPositionsRequestIdAtom,
  use: useSwapProPositionsRequestIdAtom,
} = contextAtom<number>(0);

export const {
  atom: swapProPositionsRequestIdsAtom,
  use: useSwapProPositionsRequestIdsAtom,
} = contextAtom<Record<string, number>>({});

export const {
  atom: swapProPositionsDataOwnerKeyAtom,
  use: useSwapProPositionsDataOwnerKeyAtom,
} = contextAtom<string>('');

export const { atom: swapProTokenBalanceRequestIdAtom } =
  contextAtom<number>(0);

export const {
  atom: swapProTokenBalanceLoadingAtom,
  use: useSwapProTokenBalanceLoadingAtom,
} = contextAtom<boolean>(false);

export const { atom: swapProTokenValueAtom, use: useSwapProTokenValueAtom } =
  contextAtom<string>('');

export const {
  atom: swapProEnableCurrentSymbolAtom,
  use: useSwapProEnableCurrentSymbolAtom,
} = contextAtom<boolean>(false);

export const {
  atom: swapProLimitPriceValueAtom,
  use: useSwapProLimitPriceValueAtom,
} = contextAtom<string>('');

export const {
  atom: swapProTokenSupportLimitAtom,
  use: useSwapProTokenSupportLimitAtom,
} = contextAtomComputed((get) => {
  const swapProSelectToken = get(swapProSelectTokenAtom());
  const swapSupportNetworks = get(swapNetworks());
  const swapSupportLimitNetworks = swapSupportNetworks.filter(
    (net) => net.supportLimit,
  );
  return !!swapSupportLimitNetworks.find(
    (net) => net.networkId === swapProSelectToken?.networkId,
  );
});

export const { atom: swapProErrorAlertAtom, use: useSwapProErrorAlertAtom } =
  contextAtom<{ title: string; message?: string } | undefined>(undefined);

export const {
  atom: swapLimitPriceMarketPriceAtom,
  use: useSwapLimitPriceMarketPriceAtom,
} = contextAtomComputed<ISwapLimitPriceInfo>((get) => {
  const limitOrderMarketPrice = get(limitOrderMarketPriceAtom());
  const { fromTokenPriceInfo, toTokenPriceInfo } = limitOrderMarketPrice;
  let fromToken = get(swapSelectFromTokenAtom());
  let toToken = get(swapSelectToTokenAtom());
  const swapProTradeType = get(swapProTradeTypeAtom());
  const swapProDirection = get(swapProDirectionAtom());
  if (swapProTradeType === ESwapProTradeType.LIMIT) {
    if (swapProDirection === ESwapDirection.BUY) {
      fromToken = get(swapProUseSelectBuyTokenAtom());
      toToken = get(swapProSelectTokenAtom());
    } else {
      fromToken = get(swapProSelectTokenAtom());
      toToken = get(swapProSellToTokenAtom());
    }
  }
  if (
    fromTokenPriceInfo &&
    toTokenPriceInfo &&
    equalTokenNoCaseSensitive({
      token1: fromToken,
      token2: fromTokenPriceInfo.tokenInfo,
    }) &&
    equalTokenNoCaseSensitive({
      token1: toToken,
      token2: toTokenPriceInfo.tokenInfo,
    }) &&
    !checkWrappedTokenPair({
      fromToken,
      toToken,
    })
  ) {
    const fromPriceBN = new BigNumber(
      fromTokenPriceInfo.price ? fromTokenPriceInfo.price : '0',
    );
    const toPriceBN = new BigNumber(
      toTokenPriceInfo.price ? toTokenPriceInfo.price : '0',
    );
    if (fromPriceBN.isZero() || toPriceBN.isZero()) {
      return {};
    }
    // clampLimitRateDecimals keeps ultra-small market rates (many-leading-
    // zeros tokens) from collapsing to "0" at the source, which would defeat
    // every downstream consumer (percent presets, market-price display,
    // equal-market checks).
    const rate = clampLimitRateDecimals(
      fromPriceBN.div(toPriceBN),
      toTokenPriceInfo.tokenInfo.decimals,
    ).toFixed();
    const reverseRate = clampLimitRateDecimals(
      toPriceBN.div(fromPriceBN),
      fromTokenPriceInfo.tokenInfo.decimals,
    ).toFixed();
    const limitPriceMarketInfo = {
      fromToken: fromTokenPriceInfo.tokenInfo,
      toToken: toTokenPriceInfo.tokenInfo,
      rate,
      reverseRate,
      fromTokenMarketPrice: fromTokenPriceInfo.price,
      toTokenMarketPrice: toTokenPriceInfo.price,
    };
    return limitPriceMarketInfo;
  }
  return {};
});
