import BigNumber from 'bignumber.js';

import { convertFiat } from '@onekeyhq/kit/src/utils/fiatConvert';
import { USD_CURRENCY_ID } from '@onekeyhq/shared/src/consts/currencyConsts';
import type { ICurrencyItem } from '@onekeyhq/shared/types';
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
