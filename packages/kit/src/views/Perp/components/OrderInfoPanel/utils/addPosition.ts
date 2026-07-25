import BigNumber from 'bignumber.js';

import {
  formatHlSize,
  normalizePerpsAccountAddress,
} from '@onekeyhq/shared/src/utils/perpsUtils';
import type { IActiveAssetData } from '@onekeyhq/shared/types/hyperliquid/sdk';

export const ADD_POSITION_MIN_ORDER_NOTIONAL = 10;

export type IAddPositionValidationError =
  | 'invalidSize'
  | 'invalidPrice'
  | 'insufficientMargin'
  | 'minimumOrder';

export function getPositionDirection(szi: string): 'long' | 'short' | null {
  const size = new BigNumber(szi);
  if (!size.isFinite() || size.isZero()) {
    return null;
  }
  return size.gt(0) ? 'long' : 'short';
}

export function isAddPositionScopeValid({
  expectedAccountAddress,
  currentAccountAddress,
  coin,
  isBuy,
  currentPosition,
}: {
  expectedAccountAddress: string;
  currentAccountAddress?: string | null;
  coin: string;
  isBuy: boolean;
  currentPosition?: { coin: string; szi: string };
}) {
  const expectedAccount = normalizePerpsAccountAddress(expectedAccountAddress);
  const currentAccount = normalizePerpsAccountAddress(currentAccountAddress);
  const expectedDirection = isBuy ? 'long' : 'short';
  return Boolean(
    expectedAccount &&
    currentAccount === expectedAccount &&
    currentPosition?.coin === coin &&
    getPositionDirection(currentPosition.szi) === expectedDirection,
  );
}

export function isAddPositionAssetDataScoped({
  data,
  coin,
  accountAddress,
}: {
  data?: IActiveAssetData;
  coin: string;
  accountAddress: string;
}) {
  return Boolean(
    data?.coin === coin &&
    normalizePerpsAccountAddress(data.user) ===
      normalizePerpsAccountAddress(accountAddress),
  );
}

export function validateAddPositionOrder({
  size,
  price,
  maxSize,
  szDecimals,
}: {
  size: string;
  price: string;
  maxSize: string;
  szDecimals: number;
}): { size: string; error?: IAddPositionValidationError } {
  const sizeBN = new BigNumber(size);
  const priceBN = new BigNumber(price);
  const maxSizeBN = new BigNumber(maxSize);
  const formattedSize = formatHlSize(sizeBN, szDecimals);

  if (!sizeBN.isFinite() || sizeBN.lte(0) || !formattedSize) {
    return { size: '', error: 'invalidSize' };
  }
  if (!priceBN.isFinite() || priceBN.lte(0)) {
    return { size: formattedSize, error: 'invalidPrice' };
  }
  if (!maxSizeBN.isFinite() || new BigNumber(formattedSize).gt(maxSizeBN)) {
    return { size: formattedSize, error: 'insufficientMargin' };
  }
  if (
    new BigNumber(formattedSize)
      .multipliedBy(priceBN)
      .lt(ADD_POSITION_MIN_ORDER_NOTIONAL)
  ) {
    return { size: formattedSize, error: 'minimumOrder' };
  }
  return { size: formattedSize };
}

// Mirrors the main trading panel: the minimum order hint is expressed in the
// unit the size field is currently showing, not always in USD.
export function buildAddPositionMinimumAmountLabel({
  price,
  szDecimals,
  sizeInputUnit,
  leverage,
  symbol,
}: {
  price: string;
  szDecimals: number;
  sizeInputUnit: 'token' | 'usd' | 'margin';
  leverage: number;
  symbol: string;
}): string {
  const fallback = `$${ADD_POSITION_MIN_ORDER_NOTIONAL}`;
  const priceBN = new BigNumber(price);
  if (!priceBN.isFinite() || priceBN.lte(0) || sizeInputUnit === 'usd') {
    return fallback;
  }

  const minSize = new BigNumber(ADD_POSITION_MIN_ORDER_NOTIONAL)
    .dividedBy(priceBN)
    .decimalPlaces(szDecimals, BigNumber.ROUND_UP);

  if (sizeInputUnit === 'token') {
    return `${minSize.toFixed(szDecimals)} ${symbol}`;
  }

  const leverageBN = new BigNumber(leverage);
  if (!leverageBN.isFinite() || leverageBN.lte(0)) {
    return fallback;
  }
  return `$${minSize
    .multipliedBy(priceBN)
    .dividedBy(leverageBN)
    .decimalPlaces(2, BigNumber.ROUND_UP)
    .toFixed(2)}`;
}
