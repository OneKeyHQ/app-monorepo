import BigNumber from 'bignumber.js';

import { Token } from '@onekeyhq/engine/src/types/token';

import { TokenBalanceValue } from '../store/reducers/tokens';

export function calculateGains({
  basePrice,
  price,
}: {
  basePrice?: number;
  price?: number;
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
  const gain = price - basePrice;
  const isPositive = gain > 0;
  let percentageGain: number | string = basePrice
    ? (gain / basePrice) * 100
    : 0;
  const gainText = isPositive ? `+${gain.toFixed(2)}` : gain.toFixed(2);
  percentageGain = isPositive
    ? `+${percentageGain.toFixed(2)}%`
    : `${percentageGain.toFixed(2)}%`;

  if (typeof gain === 'number') {
    if (gain < 0) {
      gainTextColor = 'text-critical';
      gainTextBg = 'surface-critical-subdued';
    } else if (gain > 0) {
      gainTextColor = 'text-success';
      gainTextBg = 'surface-success-subdued';
    }
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
  tokens: Token[];
  prices: Record<string, string | number>;
  balances: Record<string, TokenBalanceValue>;
}) {
  return tokens.map((token) => {
    const tokenId = token.tokenIdOnNetwork || 'main';
    const balance = balances[tokenId];
    if (typeof balance !== 'undefined') {
      const price = prices[tokenId];
      return new BigNumber(balance).times(Number(price));
    }
    return new BigNumber(0);
  });
}

export function getSummedValues({
  tokens,
  prices,
  balances,
}: {
  tokens: Token[];
  prices: Record<string, string | number>;
  balances: Record<string, TokenBalanceValue>;
}) {
  return getTokenValues({ tokens, prices, balances }).reduce(
    (acc, value) => acc.plus(value.isNaN() ? 0 : value),
    new BigNumber(0),
  );
}
