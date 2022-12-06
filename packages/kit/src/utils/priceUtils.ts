import BigNumber from 'bignumber.js';

import { Token } from '@onekeyhq/engine/src/types/token';

import { TokenBalanceValue } from '../store/reducers/tokens';
import { formatDecimalZero } from '../views/Market/utils';

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
    gainTextBg = 'surface-critical-subdued';
  } else if (gainNumber > 0) {
    gainTextColor = 'text-success';
    gainTextBg = 'surface-success-subdued';
  }

  return {
    gain,
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

export function getTokenValues({
  tokens,
  prices,
  balances,
}: {
  tokens: (Token | undefined | null)[];
  prices: Record<string, number | string | null | undefined>;
  balances: Record<string, TokenBalanceValue>;
}) {
  return tokens.map((token) => {
    const tokenId = token?.tokenIdOnNetwork || 'main';
    const balance = balances[tokenId] || 0;
    if (balance !== undefined) {
      const price = new BigNumber(prices[tokenId] || 0);
      return new BigNumber(balance).times(price);
    }
    return new BigNumber(0);
  });
}

export function getSummedValues({
  tokens,
  prices,
  balances,
  hideSmallBalance = false,
}: {
  tokens: Token[];
  prices: Record<string, number | string | null | undefined>;
  balances: Record<string, TokenBalanceValue>;
  hideSmallBalance?: boolean;
}) {
  if (
    !balances ||
    Object.values(balances).every((b) => typeof b === 'undefined')
  ) {
    return new BigNumber(NaN);
  }
  return getTokenValues({ tokens, prices, balances }).reduce((acc, value) => {
    if (value.isNaN() || (hideSmallBalance && value.isLessThan(1))) {
      return acc;
    }
    return acc.plus(value);
  }, new BigNumber(0));
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
