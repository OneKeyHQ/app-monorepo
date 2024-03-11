import BigNumber from 'bignumber.js';

import { isOnlySupportSingleChainProvider } from '@onekeyhq/kit/src/views/Swap/utils/utils';
import {
  ESwapReceiveAddressType,
  ESwapSlippageSegmentKey,
  ESwapTxHistoryStatus,
} from '@onekeyhq/shared/types/swap/types';
import type {
  ESwapProviders,
  IFetchQuoteResult,
  ISwapNetwork,
  ISwapSlippageSegmentItem,
  ISwapToken,
  ISwapTokenCatch,
  ISwapTxHistory,
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

// swap networks & tokens
export const { atom: swapNetworks, use: useSwapNetworksAtom } = contextAtom<
  ISwapNetwork[]
>([]);

export const { atom: swapTokenMapAtom, use: useSwapTokenMapAtom } =
  contextAtom<{
    updatedAt: number;
    tokenCatch?: Record<string, ISwapTokenCatch>;
  }>({
    updatedAt: 0,
  });

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
  atom: swapFromTokenAmountAtom,
  use: useSwapFromTokenAmountAtom,
} = contextAtom<string>('');

export const {
  atom: swapOnlySupportSingleChainAtom,
  use: useSwapOnlySupportSingleChainAtom,
} = contextAtomComputed((get) => {
  const fromToken = get(swapSelectFromTokenAtom());
  return fromToken && isOnlySupportSingleChainProvider(fromToken)
    ? fromToken.networkId
    : undefined;
});

export const {
  atom: swapSelectedFromTokenBalanceAtom,
  use: useSwapSelectedFromTokenBalanceAtom,
} = contextAtom('0');

export const {
  atom: swapSelectedToTokenBalanceAtom,
  use: useSwapSelectedToTokenBalanceAtom,
} = contextAtom('0');

// swap quote
export const {
  atom: swapManualSelectQuoteProvidersAtom,
  use: useSwapManualSelectQuoteProvidersAtom,
} = contextAtom<IFetchQuoteResult | undefined>(undefined);

export const { atom: swapQuoteListAtom, use: useSwapQuoteListAtom } =
  contextAtom<IFetchQuoteResult[]>([]);

export const { atom: swapQuoteFetchingAtom, use: useSwapQuoteFetchingAtom } =
  contextAtom<boolean>(false);

export const {
  atom: swapQuoteCurrentSelectAtom,
  use: useSwapQuoteCurrentSelectAtom,
} = contextAtomComputed((get) => {
  const list = get(swapQuoteListAtom());
  const manualSelectQuoteProviders = get(swapManualSelectQuoteProvidersAtom());
  return manualSelectQuoteProviders
    ? list.find(
        (item) =>
          item.info.provider === manualSelectQuoteProviders.info.provider,
      )
    : list[0];
});

export const {
  atom: swapQuoteTokenMarketingRateWarningAtom,
  use: useSwapQuoteTokenMarketingRateWarningAtom,
} = contextAtomComputed((get) => {
  const fromToken = get(swapSelectFromTokenAtom());
  const toToken = get(swapSelectToTokenAtom());
  const quoteResult = get(swapQuoteCurrentSelectAtom());
  if (!quoteResult) {
    return '';
  }
  if (!fromToken?.price || !toToken?.price) {
    return 'no price';
  }
  const fromTokenPrice = new BigNumber(fromToken.price);
  const toTokenPrice = new BigNumber(toToken.price);
  const marketingRate = fromTokenPrice.dividedBy(toTokenPrice).decimalPlaces(6);
  const quoteRateBN = new BigNumber(quoteResult.instantRate);
  const difference = marketingRate
    .dividedBy(quoteRateBN)
    .minus(1)
    .multipliedBy(100);
  if (quoteRateBN.isZero()) {
    return 'amount too small to quote rate is zero';
  }
  if (difference.comparedTo(5) === 1) {
    return `rate difference high ${difference.decimalPlaces(2).toFixed()}%`;
  }
  return '';
});

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

export const {
  atom: swapQuoteApproveAllowanceUnLimitAtom,
  use: useSwapQuoteApproveAllowanceUnLimitAtom,
} = contextAtom<boolean>(false);

// swap approve
export const {
  atom: swapApprovingTransactionAtom,
  use: useSwapApprovingTransactionAtom,
} = contextAtom<
  | {
      fromToken: ISwapToken;
      toToken: ISwapToken;
      provider: ESwapProviders;
      useAddress: string;
      spenderAddress: string;
      amount: string;
      txId?: string;
    }
  | undefined
>(undefined);

// swap slippage
export const {
  atom: swapSlippagePercentageAtom,
  use: useSwapSlippagePercentageAtom,
} = contextAtom<ISwapSlippageSegmentItem>({
  key: ESwapSlippageSegmentKey.AUTO,
  value: 0.5,
});

export const {
  atom: swapSlippagePopoverOpeningAtom,
  use: useSwapSlippagePopoverOpeningAtom,
} = contextAtom<boolean>(false);

// swap build_tx
export const {
  atom: swapBuildTxFetchingAtom,
  use: useSwapBuildTxFetchingAtom,
} = contextAtom<boolean>(false);

// swap receiver address
export const {
  atom: swapReceiverAddressTypeAtom,
  use: useSwapReceiverAddressTypeAtom,
} = contextAtom<ESwapReceiveAddressType>(ESwapReceiveAddressType.USER_ACCOUNT);

export const {
  atom: swapReceiverAddressInputValueAtom,
  use: useSwapReceiverAddressInputValueAtom,
} = contextAtom<string>('');

export const {
  atom: swapReceiverAddressBookValueAtom,
  use: useSwapReceiverAddressBookValueAtom,
} = contextAtom<string>('');

// swap tx history
export const { atom: swapTxHistoryAtom, use: useSwapTxHistoryAtom } =
  contextAtom<ISwapTxHistory[]>([]);

export const {
  atom: swapTxHistoryStatusChangeAtom,
  use: useSwapTxHistoryStatusChangeAtom,
} = contextAtom<ISwapTxHistory[]>([]);

export const {
  atom: swapTxHistoryPendingAtom,
  use: useSwapTxHistoryPendingAtom,
} = contextAtomComputed((get) => {
  const list = get(swapTxHistoryAtom());
  get(swapTxHistoryStatusChangeAtom());
  return list.filter((item) => item.status === ESwapTxHistoryStatus.PENDING);
});
