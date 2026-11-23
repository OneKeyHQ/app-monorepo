import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';
import { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';

import { ESwapDirection, type ITradeType } from '../hooks/useTradeType';

export function getMarketTradeFallbackInput({
  marketToken,
  paymentToken,
  tokenMetadataReady,
  tradeType,
  amount,
}: {
  marketToken?: ISwapToken;
  paymentToken?: ISwapToken;
  tokenMetadataReady: boolean;
  tradeType: ITradeType;
  amount: string;
}) {
  if (
    !marketToken?.networkId ||
    (!marketToken.isNative && !marketToken.contractAddress)
  ) {
    return undefined;
  }

  const verifiedPaymentToken =
    tokenMetadataReady &&
    paymentToken?.networkId &&
    (paymentToken.isNative || paymentToken.contractAddress)
      ? paymentToken
      : undefined;
  const isBuy = tradeType === ESwapDirection.BUY;
  return {
    fromAmount: verifiedPaymentToken ? amount : '',
    importFromToken: isBuy ? verifiedPaymentToken : marketToken,
    importToToken: isBuy ? marketToken : verifiedPaymentToken,
    marketPresetToken: {
      networkId: marketToken.networkId,
      contractAddress: marketToken.contractAddress,
      isNative: marketToken.isNative,
    },
  };
}

export function resolveMarketTradeFallbackSwapType({
  isStock,
  onlySupportCrossChain,
}: {
  isStock?: boolean;
  onlySupportCrossChain?: boolean;
}) {
  if (isStock) {
    return ESwapTabSwitchType.STOCK;
  }
  return onlySupportCrossChain
    ? ESwapTabSwitchType.BRIDGE
    : ESwapTabSwitchType.SWAP;
}

export function resolveMarketTradeActionState({
  supportSpeedSwap,
  isAccountNetworkSupported,
  isBalanceAvailable,
  isInsufficientBalance,
  isWrapped,
  isRefreshQuote = false,
}: {
  supportSpeedSwap?: boolean;
  isAccountNetworkSupported: boolean;
  isBalanceAvailable: boolean;
  isInsufficientBalance: boolean;
  isWrapped?: boolean;
  isRefreshQuote?: boolean;
}) {
  const shouldJumpToSwap = shouldJumpToMarketTradeFallback({
    supportSpeedSwap,
    isAccountNetworkSupported,
    isWrapped,
    isRefreshQuote,
  });
  const shouldDisable =
    !shouldJumpToSwap &&
    !isRefreshQuote &&
    (isInsufficientBalance || (isWrapped && !isBalanceAvailable));

  return { shouldDisable, shouldJumpToSwap };
}

export function shouldJumpToMarketTradeFallback({
  supportSpeedSwap,
  isAccountNetworkSupported,
  isWrapped,
  isRefreshQuote = false,
}: {
  supportSpeedSwap?: boolean;
  isAccountNetworkSupported: boolean;
  isWrapped?: boolean;
  isRefreshQuote?: boolean;
}) {
  return (
    !isRefreshQuote &&
    (!isAccountNetworkSupported || (!isWrapped && !supportSpeedSwap))
  );
}
