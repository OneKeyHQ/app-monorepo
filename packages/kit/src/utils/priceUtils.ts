import BigNumber from 'bignumber.js';

import { getBalanceKey } from '@onekeyhq/engine/src/managers/token';
import type { Token } from '@onekeyhq/engine/src/types/token';

import { formatDecimalZero } from '../views/Market/utils';

import type {
  SimpleTokenPrices,
  TokenBalanceValue,
} from '../store/reducers/tokens';

export function calculateGains({
  basePrice,
  price,
}: {
  basePrice?: number;
  price?: number | string | null;
}) {
  let gainTextColor = 'text-subdued';
  let gainTextBg = 'surface-neutral-subdued';
  if (!basePrice || !price) {
    return {
      gain: 0,
      gainNumber: 0,
      gainText: '0.00',
      percentageGain: '0.00%',
      isPositive: false,
      gainTextColor,
      gainTextBg,
    };
  }
  const priceNum = new BigNumber(typeof price === 'string' ? +price : price);

  const gain = priceNum.minus(basePrice ?? 0);
  const gainNumber = gain.toNumber();
  const isPositive = gainNumber > 0;
  let percentageGain: number | string = basePrice
    ? gain.dividedBy(basePrice).multipliedBy(100).toNumber()
    : 0;
  const gainText = isPositive
    ? `+${formatDecimalZero(gainNumber)}`
    : formatDecimalZero(gainNumber);
  percentageGain = isPositive
    ? `+${percentageGain.toFixed(2)}%`
    : `${percentageGain.toFixed(2)}%`;

  if (gainNumber < 0) {
    gainTextColor = 'text-critical';
    gainTextBg = 'surface-critical-default';
  } else if (gainNumber > 0) {
    gainTextColor = 'text-success';
    gainTextBg = 'surface-success-default';
  }

  return {
    gain,
    gainNumber,
    gainText,
    gainTextColor,
    gainTextBg,
    percentageGain,
    isPositive,
  };
}

export function getSuggestedDecimals(price: number) {
  return price < 1
    ? Math.min(8, price.toString().slice(2).slice().search(/[^0]/g) + 3)
    : 2;
}

export function getTokenValue({
  token,
  price,
  balances,
}: {
  token: Token | undefined | null;
  price: number | undefined | null;
  balances: Record<string, TokenBalanceValue>;
}) {
  const { balance } = balances[getBalanceKey(token)] || {
    balance: '0',
  };
  if (balance !== undefined) {
    const priceValue = new BigNumber(price || 0);
    return new BigNumber(balance).times(priceValue);
  }
}

export function getTokenValues({
  tokens,
  prices,
  balances,
  vsCurrency,
}: {
  tokens: (Token | undefined | null)[];
  prices?: Record<string, SimpleTokenPrices | number>;
  balances: Record<string, TokenBalanceValue>;
  vsCurrency: string;
}) {
  return tokens.map((token) => {
    const priceId = token?.tokenIdOnNetwork
      ? `${token?.networkId}-${token.tokenIdOnNetwork}`
      : token?.networkId ?? '';
    const { balance } = balances[getBalanceKey(token)] || {
      balance: 0,
    };
    if (balance !== undefined) {
      let price = new BigNumber(0);
      if (prices?.[priceId]) {
        if (typeof prices?.[priceId] === 'number') {
          price = new BigNumber((prices?.[priceId] as number) || 0);
        } else {
          price = new BigNumber(
            (prices?.[priceId] as SimpleTokenPrices)?.[vsCurrency] || 0,
          );
        }
      }
      return new BigNumber(balance).times(price ?? 0);
    }
    return new BigNumber(0);
  });
}

export function getPreBaseValue({
  priceInfo,
  vsCurrency = 'usd',
}: {
  priceInfo?: SimpleTokenPrices;
  vsCurrency: string;
}) {
  const change = new BigNumber(priceInfo?.[`${vsCurrency}_24h_change`] || 0);
  const price = new BigNumber(priceInfo?.[vsCurrency] || 0);
  const res: Record<string, number> = {};
  res[vsCurrency] = price.dividedBy(change.plus(100)).times(100).toNumber();
  return res;
}

export function getSummedValues({
  tokens,
  prices,
  balances,
  vsCurrency = 'usd',
  hideSmallBalance = false,
}: {
  tokens: Token[];
  prices?: Record<string, SimpleTokenPrices | number>;
  balances: Record<string, TokenBalanceValue>;
  vsCurrency?: string;
  hideSmallBalance?: boolean;
}) {
  if (
    !balances ||
    Object.values(balances).every((b) => typeof b === 'undefined') ||
    !prices
  ) {
    return new BigNumber(NaN);
  }
  return getTokenValues({ tokens, prices, balances, vsCurrency }).reduce(
    (acc, value) => {
      if (value.isNaN() || (hideSmallBalance && value.isLessThan(1))) {
        return acc;
      }
      return acc.plus(value);
    },
    new BigNumber(0),
  );
}

export function formatAmount(
  value?: BigNumber.Value,
  precision = 4,
  roundingMode: BigNumber.RoundingMode = 1,
) {
  if (!value) {
    return '';
  }
  const bn = new BigNumber(value);
  if (bn.isNaN()) {
    return '';
  }
  return bn.decimalPlaces(precision, roundingMode).toFixed();
}
