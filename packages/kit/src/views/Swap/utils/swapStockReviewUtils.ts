import BigNumber from 'bignumber.js';

import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import type { ICurrencyItem } from '@onekeyhq/shared/types';
import type {
  IMarketStockTokenVariant,
  IMarketTokenDetail,
} from '@onekeyhq/shared/types/marketV2';
import type {
  ISwapStockTradeConfig,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

import { getSwapTokenDisplayFiatValue } from './swapDisplayFiatValue';

export function getValidStockTokenToAssetRatio(value?: string) {
  const ratio = value?.trim();
  const ratioBN = new BigNumber(ratio ?? '');
  return ratioBN.isFinite() && ratioBN.gt(0) ? ratio : undefined;
}

export function resolveStockTokenToAssetRatio({
  selectedVariantRatio,
  tokenDetailRatio,
  hasSelectedVariant,
  selectedVariantMatchesTokenDetail,
}: {
  selectedVariantRatio?: string;
  tokenDetailRatio?: string;
  hasSelectedVariant: boolean;
  selectedVariantMatchesTokenDetail: boolean;
}) {
  return (
    getValidStockTokenToAssetRatio(selectedVariantRatio) ??
    (!hasSelectedVariant || selectedVariantMatchesTokenDetail
      ? getValidStockTokenToAssetRatio(tokenDetailRatio)
      : undefined)
  );
}

export function resolveSwapStockReviewToken({
  stockToken,
  selectedTokenVariant,
  tokenDetail,
  stockTradeConfig,
  underlyingSymbol,
}: {
  stockToken?: ISwapToken;
  selectedTokenVariant?: Pick<
    IMarketStockTokenVariant,
    'networkId' | 'contractAddress' | 'tokenToAssetRatio'
  >;
  tokenDetail?: Pick<IMarketTokenDetail, 'networkId' | 'address' | 'stock'>;
  stockTradeConfig?: ISwapStockTradeConfig;
  underlyingSymbol?: string;
}): ISwapToken | undefined {
  if (!stockToken?.isStock) {
    return undefined;
  }

  const selectedVariantMatchesStockToken = equalTokenNoCaseSensitive({
    token1: selectedTokenVariant,
    token2: stockToken,
  });
  const tokenDetailMatchesStockToken = equalTokenNoCaseSensitive({
    token1: tokenDetail
      ? {
          networkId: tokenDetail.networkId ?? stockToken.networkId,
          contractAddress: tokenDetail.address,
        }
      : undefined,
    token2: stockToken,
  });
  // Market config belongs to the selected variant, which may lead the execution token.
  const matchingConfig = selectedVariantMatchesStockToken
    ? stockTradeConfig
    : undefined;
  const matchingDetail = tokenDetailMatchesStockToken ? tokenDetail : undefined;
  const tokenToAssetRatio = resolveStockTokenToAssetRatio({
    selectedVariantRatio: selectedVariantMatchesStockToken
      ? (getValidStockTokenToAssetRatio(matchingConfig?.tokenToAssetRatio) ??
        selectedTokenVariant?.tokenToAssetRatio)
      : undefined,
    tokenDetailRatio: matchingDetail?.stock?.tokenToAssetRatio,
    hasSelectedVariant: Boolean(selectedTokenVariant),
    selectedVariantMatchesTokenDetail: selectedVariantMatchesStockToken,
  });

  return {
    ...stockToken,
    stock: {
      subtitle: '',
      sourceLogoUri: '',
      ...stockToken.stock,
      // Keep an explicit undefined when the live sources withdraw the ratio.
      tokenToAssetRatio,
      underlyingAssetTicker:
        matchingConfig?.underlyingSymbol ??
        matchingDetail?.stock?.underlyingAssetTicker ??
        (selectedVariantMatchesStockToken ? underlyingSymbol : undefined) ??
        stockToken.stock?.underlyingAssetTicker ??
        stockToken.symbol,
    },
  };
}

export function calculateSwapStockEstimatedShares({
  stockTokenAmount,
  tokenToAssetRatio,
}: {
  stockTokenAmount?: string;
  tokenToAssetRatio?: string;
}) {
  const amountBN = new BigNumber(stockTokenAmount ?? '');
  const ratio = getValidStockTokenToAssetRatio(tokenToAssetRatio);
  if (!amountBN.isFinite() || !amountBN.gt(0) || !ratio) {
    return undefined;
  }

  return amountBN.multipliedBy(ratio).toFixed();
}

export function buildSwapStockReviewDisplay({
  currencyMap,
  fromAmount,
  fromToken,
  targetCurrency,
  toAmount,
  toToken,
}: {
  currencyMap: Record<string, ICurrencyItem>;
  fromAmount: string;
  fromToken?: ISwapToken;
  targetCurrency: string;
  toAmount: string;
  toToken?: ISwapToken;
}) {
  const isBuy = Boolean(toToken?.isStock && !fromToken?.isStock);
  const isSell = Boolean(fromToken?.isStock && !toToken?.isStock);
  if (!isBuy && !isSell) {
    return undefined;
  }

  const stockToken = isBuy ? toToken : fromToken;
  const paymentToken = isBuy ? fromToken : toToken;
  const stockTokenAmount = isBuy ? toAmount : fromAmount;
  const paymentTokenAmount = isBuy ? fromAmount : toAmount;
  const estimatedShares = calculateSwapStockEstimatedShares({
    stockTokenAmount,
    tokenToAssetRatio: stockToken?.stock?.tokenToAssetRatio,
  });
  if (!estimatedShares) {
    return undefined;
  }

  const paymentFiatValue = getSwapTokenDisplayFiatValue({
    token: paymentToken,
    amount: paymentTokenAmount,
    targetCurrency,
    currencyMap,
  });
  const paymentFiatValueBN = new BigNumber(paymentFiatValue);
  const estimatedSharesBN = new BigNumber(estimatedShares);
  const sharePrice =
    paymentFiatValueBN.isFinite() && paymentFiatValueBN.gt(0)
      ? paymentFiatValueBN.dividedBy(estimatedSharesBN).toFixed()
      : undefined;

  return {
    estimatedShares,
    sharePrice,
    underlyingSymbol:
      stockToken?.stock?.underlyingAssetTicker ?? stockToken?.symbol ?? '',
  };
}
