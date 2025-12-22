import BigNumber from 'bignumber.js';

import { ESwapDirection } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/SwapPanel/hooks/useTradeType';
import type { IToken } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/SwapPanel/types';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { dangerAllNetworkRepresent } from '@onekeyhq/shared/src/config/presetNetworks';
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
  swapProviderRecommendApprovedWeights,
} from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type {
  ESwapDirectionType,
  ESwapQuoteKind,
  ESwapRateDifferenceUnit,
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
import {
  ESwapNetworkFeeLevel,
  ESwapProTradeType,
  ESwapTabSwitchType,
  LIMIT_PRICE_DEFAULT_DECIMALS,
  defaultLimitExpirationTime,
} from '@onekeyhq/shared/types/swap/types';

import { createJotaiContext } from '../../utils/createJotaiContext';

import type { IAccountSelectorActiveAccountInfo } from '../accountSelector';

const {
  Provider: ProviderJotaiContextSwap,
  contextAtom,
  contextAtomComputed,
  contextAtomMethod,
} = createJotaiContext();
export { ProviderJotaiContextSwap, contextAtomMethod };

// swap mev config
export const { atom: swapMevConfigAtom, use: useSwapMevConfigAtom } =
  contextAtom<{
    swapMevNetConfig: string[];
  }>({
    swapMevNetConfig: mevSwapNetworks,
  });

// swap bridge limit switch
export const { atom: swapTypeSwitchAtom, use: useSwapTypeSwitchAtom } =
  contextAtom<ESwapTabSwitchType>(ESwapTabSwitchType.SWAP);

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
    if (swapType === ESwapTabSwitchType.BRIDGE) {
      return net.supportCrossChainSwap;
    }
    if (swapType === ESwapTabSwitchType.LIMIT) {
      return net.supportLimit;
    }
    return net.supportSingleSwap;
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
} = contextAtom<ISwapToken | undefined>(undefined);

export const { atom: swapSelectToTokenAtom, use: useSwapSelectToTokenAtom } =
  contextAtom<ISwapToken | undefined>(undefined);

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
} = contextAtom<boolean>(false);

// swap quote
export const {
  atom: swapManualSelectQuoteProvidersAtom,
  use: useSwapManualSelectQuoteProvidersAtom,
} = contextAtom<IFetchQuoteResult | undefined>(undefined);

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
  atom: swapShouldRefreshQuoteAtom,
  use: useSwapShouldRefreshQuoteAtom,
} = contextAtom<boolean>(false);

export const {
  atom: swapSortedQuoteListAtom,
  use: useSwapSortedQuoteListAtom,
} = contextAtomComputed<IFetchQuoteResult[]>((get) => {
  const list = get(swapQuoteListAtom());
  const fromTokenAmount = get(swapFromTokenAmountAtom());
  const fromTokenAmountBN = new BigNumber(fromTokenAmount.value);
  const sortType = get(swapProviderSortAtom());
  const resetList: IFetchQuoteResult[] = list.map(
    (item: IFetchQuoteResult) => ({
      ...item,
      receivedBest: false,
      isBest: false,
      minGasCost: false,
    }),
  );
  let sortedList = [...resetList];
  const gasFeeSorted = resetList.slice().sort((a, b) => {
    const aBig = new BigNumber(a.fee?.estimatedFeeFiatValue || Infinity);
    const bBig = new BigNumber(b.fee?.estimatedFeeFiatValue || Infinity);
    return aBig.comparedTo(bBig);
  });
  if (sortType === ESwapProviderSort.GAS_FEE) {
    sortedList = [...gasFeeSorted];
  }
  if (sortType === ESwapProviderSort.SWAP_DURATION) {
    sortedList = resetList.slice().sort((a, b) => {
      const aVal = new BigNumber(a.estimatedTime || Infinity);
      const bVal = new BigNumber(b.estimatedTime || Infinity);
      return aVal.comparedTo(bVal);
    });
  }
  const receivedSorted = resetList.slice().sort((a, b) => {
    // check toAmountSlippage
    const aToAmountSlippage = new BigNumber(a.toAmountSlippage || 0).plus(1);
    const bToAmountSlippage = new BigNumber(b.toAmountSlippage || 0).plus(1);
    const aVal = new BigNumber(a.toAmount || 0).multipliedBy(aToAmountSlippage);
    const bVal = new BigNumber(b.toAmount || 0).multipliedBy(bToAmountSlippage);
    // Check if limit exists for a and b
    const aHasLimit = !!a.limit;
    const bHasLimit = !!b.limit;

    if (aVal.isZero() && bVal.isZero() && aHasLimit && !bHasLimit) {
      return -1;
    }

    if (aVal.isZero() && bVal.isZero() && bHasLimit && !aHasLimit) {
      return 1;
    }

    if (
      aVal.isZero() ||
      aVal.isNaN() ||
      fromTokenAmountBN.lt(new BigNumber(a.limit?.min || 0)) ||
      fromTokenAmountBN.gt(new BigNumber(a.limit?.max || Infinity))
    ) {
      return 1;
    }
    if (
      bVal.isZero() ||
      bVal.isNaN() ||
      fromTokenAmountBN.lt(new BigNumber(b.limit?.min || 0)) ||
      fromTokenAmountBN.gt(new BigNumber(b.limit?.max || Infinity))
    ) {
      return -1;
    }
    return bVal.comparedTo(aVal);
  });
  const receivedOriginalSorted = resetList.slice().sort((a, b) => {
    const aVal = new BigNumber(a.toAmount || 0);
    const bVal = new BigNumber(b.toAmount || 0);
    // Check if limit exists for a and b
    const aHasLimit = !!a.limit;
    const bHasLimit = !!b.limit;

    if (aVal.isZero() && bVal.isZero() && aHasLimit && !bHasLimit) {
      return -1;
    }

    if (aVal.isZero() && bVal.isZero() && bHasLimit && !aHasLimit) {
      return 1;
    }

    if (
      aVal.isZero() ||
      aVal.isNaN() ||
      fromTokenAmountBN.lt(new BigNumber(a.limit?.min || 0)) ||
      fromTokenAmountBN.gt(new BigNumber(a.limit?.max || Infinity))
    ) {
      return 1;
    }
    if (
      bVal.isZero() ||
      bVal.isNaN() ||
      fromTokenAmountBN.lt(new BigNumber(b.limit?.min || 0)) ||
      fromTokenAmountBN.gt(new BigNumber(b.limit?.max || Infinity))
    ) {
      return -1;
    }
    return bVal.comparedTo(aVal);
  });
  let recommendedSorted = receivedSorted.slice();
  const recommendedSortedApproved = recommendedSorted.filter(
    (item) =>
      !item.allowanceResult && item.toAmount && item.approvedInfo?.isApproved,
  );
  // check allowance result
  if (
    receivedSorted.length > 0 &&
    recommendedSortedApproved.length > 0 &&
    receivedSorted[0].allowanceResult
  ) {
    const recommendedSortedApprovedSorted = recommendedSortedApproved
      .slice()
      .sort((a, b) => {
        const aVal = new BigNumber(a.toAmount || 0);
        const bVal = new BigNumber(b.toAmount || 0);
        return bVal.comparedTo(aVal);
      });
    const recommendedSortedAllowanceSortedBestAmountBN = new BigNumber(
      recommendedSortedApprovedSorted[0].toAmount || 0,
    );
    const receivedSortedBestAmountBN = new BigNumber(
      receivedSorted[0].toAmount || 0,
    );
    if (
      recommendedSortedAllowanceSortedBestAmountBN
        .multipliedBy(swapProviderRecommendApprovedWeights)
        .gt(receivedSortedBestAmountBN)
    ) {
      recommendedSorted = recommendedSorted.filter(
        (item) => item.quoteId !== recommendedSortedApprovedSorted[0].quoteId,
      );
      recommendedSorted = [
        recommendedSortedApprovedSorted[0],
        ...recommendedSorted,
      ];
    }
  }

  if (sortType === ESwapProviderSort.RECEIVED) {
    sortedList = [...receivedSorted];
  }
  if (sortType === ESwapProviderSort.RECOMMENDED) {
    sortedList = [...recommendedSorted];
  }
  sortedList = sortedList.slice().sort((a, b) => {
    if (a.limit && b.limit) {
      const aMin = new BigNumber(a.limit?.min || 0);
      const aMax = new BigNumber(a.limit?.max || 0);
      const bMin = new BigNumber(b.limit?.min || 0);
      const bMax = new BigNumber(b.limit?.max || 0);
      if (aMin.lt(bMin)) {
        return -1;
      }
      if (aMin.gt(bMin)) {
        return 1;
      }

      if (aMax.lt(bMax)) {
        return -1;
      }
      if (aMax.gt(bMax)) {
        return 1;
      }
    }
    return 0;
  });
  return sortedList.map((p) => {
    if (p?.quoteId === recommendedSorted?.[0]?.quoteId && p.toAmount) {
      p.isBest = true;
    }
    if (p?.quoteId === receivedOriginalSorted?.[0]?.quoteId && p.toAmount) {
      p.receivedBest = true;
    }
    if (p.quoteId === gasFeeSorted?.[0]?.quoteId && p.toAmount) {
      p.minGasCost = true;
    }
    return p;
  });
});

export const {
  atom: swapQuoteCurrentSelectAtom,
  use: useSwapQuoteCurrentSelectAtom,
} = contextAtomComputed((get) => {
  const list = get(swapSortedQuoteListAtom());
  const manualSelectQuoteProviders = get(swapManualSelectQuoteProvidersAtom());
  const manualSelectQuoteResult = list.find(
    (item) =>
      item.info.provider === manualSelectQuoteProviders?.info.provider &&
      item.info.providerName === manualSelectQuoteProviders?.info.providerName,
  );
  if (manualSelectQuoteProviders && manualSelectQuoteResult?.toAmount) {
    return manualSelectQuoteResult;
  }
  if (list?.length > 0) {
    if (
      manualSelectQuoteProviders &&
      !manualSelectQuoteProviders?.unSupportReceiveAddressDifferent
    ) {
      return list.find((item) => !item.unSupportReceiveAddressDifferent);
    }
    return list[0];
  }
  return undefined;
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
          fromToken?.decimals ?? LIMIT_PRICE_DEFAULT_DECIMALS,
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
          toToken?.decimals ?? LIMIT_PRICE_DEFAULT_DECIMALS,
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
}>({
  networkFeeLevel: ESwapNetworkFeeLevel.MEDIUM,
});

export const {
  atom: swapSelectTokenNetworkAtom,
  use: useSwapSelectTokenNetworkAtom,
} = contextAtom<ISwapNetwork | undefined>(undefined);

// swap tips
export const { atom: swapTipsAtom, use: useSwapTipsAtom } = contextAtom<
  ISwapTips | undefined
>(undefined);

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
const defaultTimeRangeItem =
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
        toTokenPriceInfo.tokenInfo.decimals ?? LIMIT_PRICE_DEFAULT_DECIMALS,
        BigNumber.ROUND_HALF_UP,
      )
      .toFixed();
    const reverseRate = toPriceBN
      .div(fromPriceBN)
      .decimalPlaces(
        fromTokenPriceInfo.tokenInfo.decimals ?? LIMIT_PRICE_DEFAULT_DECIMALS,
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
