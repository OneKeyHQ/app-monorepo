import BigNumber from 'bignumber.js';

import { convertFiat } from '@onekeyhq/kit/src/utils/fiatConvert';
import { USD_CURRENCY_ID } from '@onekeyhq/shared/src/consts/currencyConsts';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import type { ICurrencyItem } from '@onekeyhq/shared/types';
import type { IMarketTokenDetail } from '@onekeyhq/shared/types/marketV2';
import type {
  ISwapToken,
  ISwapTokenBase,
} from '@onekeyhq/shared/types/swap/types';

export const STOCK_PRICE_SOURCE_CURRENCY = USD_CURRENCY_ID;

const STOCK_USD_VALUE_SYMBOLS = new Set(['USD', 'USDC', 'USDT']);

export type IStockResolvedTokenPrice = {
  price: string;
  currency: string;
};

type IStockTokenPriceSource = Partial<
  Pick<
    ISwapTokenBase,
    'balanceParsed' | 'currency' | 'fiatValue' | 'price' | 'symbol'
  >
>;

function getPositiveFiniteValue(value?: string) {
  const valueBN = new BigNumber(value ?? '');
  return valueBN.isFinite() && valueBN.gt(0) ? valueBN.toFixed() : undefined;
}

function hasPricedFields(token: Partial<ISwapToken>) {
  return token.price !== undefined || token.fiatValue !== undefined;
}

export function markStockUsdPriceCurrency<T extends Partial<ISwapToken>>(
  token?: T,
) {
  if (!token || !hasPricedFields(token)) {
    return token;
  }
  return {
    ...token,
    currency: token.currency ?? STOCK_PRICE_SOURCE_CURRENCY,
  };
}

export function resolveStockTokenPrice({
  fallbackCurrency,
  token,
}: {
  fallbackCurrency?: string;
  token?: IStockTokenPriceSource;
}): IStockResolvedTokenPrice | undefined {
  const sourceCurrency = token?.currency ?? fallbackCurrency;
  const price = getPositiveFiniteValue(token?.price);
  if (price) {
    return sourceCurrency
      ? {
          price,
          currency: sourceCurrency,
        }
      : undefined;
  }

  const balanceBN = new BigNumber(token?.balanceParsed ?? 0);
  const fiatValueBN = new BigNumber(token?.fiatValue ?? 0);
  if (
    balanceBN.isFinite() &&
    balanceBN.gt(0) &&
    fiatValueBN.isFinite() &&
    fiatValueBN.gt(0) &&
    sourceCurrency
  ) {
    return {
      price: fiatValueBN.dividedBy(balanceBN).toFixed(),
      currency: sourceCurrency,
    };
  }

  const symbol = token?.symbol?.toUpperCase();
  if (symbol && STOCK_USD_VALUE_SYMBOLS.has(symbol)) {
    return {
      price: '1',
      currency: STOCK_PRICE_SOURCE_CURRENCY,
    };
  }

  return undefined;
}

export function resolveStockTradeTokenPrice({
  token,
  quoteToken,
  quoteCurrency,
  stockTokenDetail,
}: {
  token?: ISwapToken;
  quoteToken?: ISwapToken;
  quoteCurrency?: string;
  stockTokenDetail?: Pick<
    IMarketTokenDetail,
    'networkId' | 'address' | 'price'
  >;
}): IStockResolvedTokenPrice | undefined {
  const quotePrice = equalTokenNoCaseSensitive({
    token1: token,
    token2: quoteToken,
  })
    ? resolveStockTokenPrice({
        token: { price: quoteToken?.price, currency: quoteToken?.currency },
        fallbackCurrency: quoteCurrency,
      })
    : undefined;
  if (quotePrice) return quotePrice;

  if (
    token?.isStock &&
    stockTokenDetail &&
    equalTokenNoCaseSensitive({
      token1: token,
      token2: {
        networkId: stockTokenDetail.networkId ?? token.networkId,
        contractAddress: stockTokenDetail.address,
      },
    })
  ) {
    // Market token detail prices are USD; share prices and priceConverted
    // belong to different units and must not price a token amount.
    const detailPrice = resolveStockTokenPrice({
      token: { price: stockTokenDetail.price },
      fallbackCurrency: STOCK_PRICE_SOURCE_CURRENCY,
    });
    if (detailPrice) return detailPrice;
  }

  return resolveStockTokenPrice({
    token,
    fallbackCurrency: STOCK_PRICE_SOURCE_CURRENCY,
  });
}

export function getStockTokenFiatValue({
  amount,
  currencyMap,
  targetCurrency,
  tokenPrice,
}: {
  amount: string;
  currencyMap: Record<string, ICurrencyItem>;
  targetCurrency: string;
  tokenPrice?: IStockResolvedTokenPrice;
}) {
  if (!tokenPrice) {
    return '';
  }

  const amountBN = new BigNumber(amount ?? 0);
  const priceBN = new BigNumber(tokenPrice.price);
  const fiatBN = amountBN.multipliedBy(priceBN);
  if (!fiatBN.isFinite() || fiatBN.isZero()) {
    return '';
  }

  return convertFiat({
    value: fiatBN,
    sourceCurrency: tokenPrice.currency,
    targetCurrency,
    currencyMap,
  });
}
