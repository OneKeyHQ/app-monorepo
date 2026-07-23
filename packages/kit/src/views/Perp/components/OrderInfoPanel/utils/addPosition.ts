import BigNumber from 'bignumber.js';

import {
  formatHlSize,
  normalizePerpsAccountAddress,
} from '@onekeyhq/shared/src/utils/perpsUtils';
import type { IActiveAssetData } from '@onekeyhq/shared/types/hyperliquid/sdk';

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
  if (new BigNumber(formattedSize).multipliedBy(priceBN).lt(10)) {
    return { size: formattedSize, error: 'minimumOrder' };
  }
  return { size: formattedSize };
}
