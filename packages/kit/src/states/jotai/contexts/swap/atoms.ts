import BigNumber from 'bignumber.js';

import { ESwapDirection } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/SwapPanel/hooks/useTradeType';
import type { IToken } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/SwapPanel/types';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { dangerAllNetworkRepresent } from '@onekeyhq/shared/src/config/presetNetworks';
import { CONTEXT_ATOM_COLD_START_CACHE_KEYS } from '@onekeyhq/shared/src/consts/jotaiConsts';
import type { ICustomPriorityFeeOverride } from '@onekeyhq/shared/src/utils/marketPresetFeeUtils';
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
  ESwapNetworkFeeLevel,
  ESwapProTradeType,
  ESwapTabSwitchType,
  LIMIT_PRICE_DEFAULT_DECIMALS,
  defaultLimitExpirationTime,
} from '@onekeyhq/shared/types/swap/types';
import type {
  ESwapDirectionType,
  ESwapQuoteKind,
  ESwapRateDifferenceUnit,
  ESwapSlippageSegmentKey,
  IFetchQuoteResult,
  ISwapAlertState,
  ISwapAutoSlippageSuggestedValue,
  ISwapLimitPriceInfo,
  ISwapNativeTokenReserveGas,
  ISwapNetwork,
  ISwapPreSwapData,
  ISwapStep,
  ISwapTips,
  ISwapToken,
  ISwapTokenCatch,
  ISwapTokenMetadata,
} from '@onekeyhq/shared/types/swap/types';

import { createJotaiContext } from '../../utils/createJotaiContext';

import {
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
} = createJotaiContext();
export { ProviderJotaiContextSwap, contextAtomMethod };

export type ISwapQuoteEventErrorState = {
  message: string;
  fromToken?: ISwapToken;
  toToken?: ISwapToken;
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
      fromToken?: ISwapToken;
      toToken?: ISwapToken;
    }
  | undefined
>(undefined);

export const {
  atom: swapSelectedTokensColdStartContextAtom,
  use: useSwapSelectedTokensColdStartContextAtom,
} = contextAtom<ISwapSelectedTokensColdStartContext | undefined>(undefined, {
  coldStartCache: true,
  coldStartCacheKey:
    CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapSelectedTokensColdStartContextAtom,
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

export const {
  atom: swapFromTokenAmountAtom,
  use: useSwapFromTokenAmountAtom,
} = contextAtom<{
  value: string;
  isInput: boolean;
}>({
  value: '',
  isInput: false,
});

export const { atom: swapToTokenAmountAtom, use: useSwapToTokenAmountAtom } =
  contextAtom<{
    value: string;
    isInput: boolean;
  }>({
    value: '',
    isInput: false,
  });

export const {
  atom: swapSelectedFromTokenBalanceAtom,
  use: useSwapSelectedFromTokenBalanceAtom,
} = contextAtom('');

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
} = contextAtom<Record<string, boolean>>({});

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
  actionLock: boolean;
  fromToken?: ISwapToken;
  toToken?: ISwapToken;
  fromTokenAmount?: string;
  toTokenAmount?: string;
  accountId?: string;
  kind?: ESwapQuoteKind;
  address?: string;
  receivingAddress?: string;
}>({ actionLock: false });

export const {
  atom: swapQuoteIntervalCountAtom,
  use: useSwapQuoteIntervalCountAtom,
} = contextAtom<number>(0);

export const {
  atom: swapQuoteEventTotalCountAtom,
  use: useSwapQuoteEventTotalCountAtom,
} = contextAtom<{ eventId?: string; count: number }>({
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
  const sortType = get(swapProviderSortAtom());
  return sortSwapQuotes(list, {
    sort: sortType,
    fromTokenAmount: fromTokenAmount.value,
  });
});

export const {
  atom: swapQuoteCurrentSelectAtom,
  use: useSwapQuoteCurrentSelectAtom,
} = contextAtomComputed((get) => {
  const list = get(swapQuoteCurrentEventListAtom());
  const fromTokenAmount = get(swapFromTokenAmountAtom());
  const selectionIntent = get(swapManualSelectQuoteProvidersAtom());
  const quoteEventTotalCount = get(swapQuoteEventTotalCountAtom());
  const currentEventProviderKeys = get(swapQuoteCurrentEventProviderKeysAtom());
  const recommendedSortedList = sortSwapQuotes(list, {
    sort: ESwapProviderSort.RECOMMENDED,
    fromTokenAmount: fromTokenAmount.value,
  });
  return selectSwapCurrentQuote({
    currentEventSortedQuotes: recommendedSortedList,
    selectionIntent: selectionIntent ?? undefined,
    quoteEventTotalCount,
    currentEventProviderKeys,
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
  'from': false,
  'to': false,
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

// swap pro
export const { atom: swapProSelectTokenAtom, use: useSwapProSelectTokenAtom } =
  contextAtom<ISwapToken | undefined>(undefined);

export const { atom: swapProDirectionAtom, use: useSwapProDirectionAtom } =
  contextAtom<ESwapDirection>(ESwapDirection.BUY);

export const { atom: swapProTradeTypeAtom, use: useSwapProTradeTypeAtom } =
  contextAtom<ESwapProTradeType>(ESwapProTradeType.MARKET);

export const { atom: swapProInputAmountAtom, use: useSwapProInputAmountAtom } =
  contextAtom<string>('');

export const { atom: swapProSliderValueAtom, use: useSwapProSliderValueAtom } =
  contextAtom<number>(0);

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
  atom: swapProTokenTransactionPriceAtom,
  use: useSwapProTokenTransactionPriceAtom,
} = contextAtom<string>('');

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

export const SWAP_PRO_POSITIONS_CACHE_MAX_OWNERS = 20;

export type ISwapProPositionsCacheEntry = {
  ownerKey: string;
  networkIdsKey: string;
  tokens: ISwapToken[];
  updatedAt: number;
};

export function buildSwapProPositionsOwnerKey({
  accountId,
  networkIdsKey,
}: {
  accountId?: string;
  networkIdsKey: string;
}) {
  if (!accountId || !networkIdsKey) {
    return '';
  }
  return `${accountId}__${networkIdsKey}`;
}

export const {
  atom: swapProPositionsCacheAtom,
  use: useSwapProPositionsCacheAtom,
} = contextAtom<{
  byOwner: Record<string, ISwapProPositionsCacheEntry>;
}>(
  { byOwner: {} },
  {
    coldStartCache: true,
    coldStartCacheKey:
      CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapProPositionsCacheAtom,
  },
);

export const {
  atom: swapProSupportNetworksTokenListLoadingAtom,
  use: useSwapProSupportNetworksTokenListLoadingAtom,
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
  atom: swapSpeedQuoteFetchingAtom,
  use: useSwapSpeedQuoteFetchingAtom,
} = contextAtom<boolean>(false);

export const {
  atom: swapSpeedQuoteResultAtom,
  use: useSwapSpeedQuoteResultAtom,
} = contextAtom<IFetchQuoteResult | undefined>(undefined);

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
    const rate = fromPriceBN
      .div(toPriceBN)
      .decimalPlaces(
        Number(
          toTokenPriceInfo.tokenInfo.decimals ?? LIMIT_PRICE_DEFAULT_DECIMALS,
        ),
        BigNumber.ROUND_HALF_UP,
      )
      .toFixed();
    const reverseRate = toPriceBN
      .div(fromPriceBN)
      .decimalPlaces(
        Number(
          fromTokenPriceInfo.tokenInfo.decimals ?? LIMIT_PRICE_DEFAULT_DECIMALS,
        ),
        BigNumber.ROUND_HALF_UP,
      )
      .toFixed();
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
