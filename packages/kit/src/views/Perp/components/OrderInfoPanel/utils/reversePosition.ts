import BigNumber from 'bignumber.js';

import { DEFAULT_PERPS_SLIPPAGE } from '@onekeyhq/shared/src/consts/perp';
import { PERPS_L2_BOOK_INTERACTIVE_MAX_AGE_MS } from '@onekeyhq/shared/src/consts/perpCache';
import {
  formatHlPrice,
  normalizePerpsAccountAddress,
} from '@onekeyhq/shared/src/utils/perpsUtils';
import type { IL2BookResponse } from '@onekeyhq/shared/types/hyperliquid/sdk';
import type { IPlaceOrderByCoinParams } from '@onekeyhq/shared/types/hyperliquid/types';

import { validateAddPositionOrder } from './addPosition';

import type { IAddPositionValidationError } from './addPosition';

export interface IReversePositionSnapshot {
  coin: string;
  accountAddress: string;
  positionSize: string;
}

export function getReversePositionSize(
  positionSize: string,
  szDecimals: number,
) {
  const size = new BigNumber(positionSize);
  if (!size.isFinite() || size.isZero()) return null;
  const rounded = size.decimalPlaces(szDecimals, BigNumber.ROUND_HALF_UP);
  // The API can serialize binary floating-point noise (e.g. WLD 3965060.8999999999).
  // Only absorb that noise; a genuinely off-step position must still be rejected.
  return !rounded.isZero() &&
    size.minus(rounded).abs().lte(size.abs().multipliedBy(Number.EPSILON))
    ? rounded
    : null;
}

export function getReversePositionClearingPrice({
  coin,
  book,
  referencePrice,
  positionSize,
  szDecimals,
}: {
  coin: string;
  book: IL2BookResponse | undefined;
  referencePrice: string;
  positionSize: BigNumber;
  szDecimals: number;
}): BigNumber | null {
  if (
    !book ||
    book.coin !== coin ||
    !Number.isFinite(book.time) ||
    Math.abs(Date.now() - book.time) > PERPS_L2_BOOK_INTERACTIVE_MAX_AGE_MS
  )
    return null;
  const isBuy = positionSize.lt(0);
  const limitPrice = new BigNumber(
    formatHlPrice(
      new BigNumber(referencePrice).multipliedBy(
        new BigNumber(1).plus(
          isBuy ? DEFAULT_PERPS_SLIPPAGE : -DEFAULT_PERPS_SLIPPAGE,
        ),
      ),
      szDecimals,
    ),
  );
  if (
    !limitPrice.isFinite() ||
    limitPrice.lte(0) ||
    !positionSize.isFinite() ||
    positionSize.isZero()
  )
    return null;
  const orderSize = positionSize.abs().multipliedBy(2);
  let filledSize = new BigNumber(0);
  for (const level of book.levels[isBuy ? 1 : 0]) {
    const price = new BigNumber(level.px);
    const size = new BigNumber(level.sz);
    if (!price.isFinite() || price.lte(0) || !size.isFinite() || size.lt(0))
      return null;
    if (isBuy ? price.gt(limitPrice) : price.lt(limitPrice)) break;
    filledSize = filledSize.plus(size);
    // Hyperliquid uses the last fill level, not the volume-weighted average.
    if (filledSize.gte(orderSize)) return price;
  }
  return limitPrice;
}

export function isReversePositionScopeValid({
  snapshot,
  accountAddress,
  position,
}: {
  snapshot: IReversePositionSnapshot;
  accountAddress?: string | null;
  position?: { coin: string; szi: string };
}) {
  const size = new BigNumber(snapshot.positionSize);
  return Boolean(
    normalizePerpsAccountAddress(snapshot.accountAddress) &&
    normalizePerpsAccountAddress(snapshot.accountAddress) ===
      normalizePerpsAccountAddress(accountAddress) &&
    position?.coin === snapshot.coin &&
    size.isFinite() &&
    !size.isZero() &&
    size.eq(position.szi),
  );
}

export function buildReversePositionOrder({
  snapshot,
  price,
  maxSize,
  szDecimals,
}: {
  snapshot: IReversePositionSnapshot;
  price: string;
  maxSize: string;
  szDecimals: number;
}):
  | { params: IPlaceOrderByCoinParams; error?: undefined }
  | { params?: undefined; error: IAddPositionValidationError } {
  const positionSize = getReversePositionSize(
    snapshot.positionSize,
    szDecimals,
  );
  if (!positionSize) return { error: 'invalidSize' };
  const size = positionSize.abs().multipliedBy(2).toFixed();
  const validation = validateAddPositionOrder({
    size,
    price,
    maxSize,
    szDecimals,
  });
  if (validation.error) {
    return { error: validation.error };
  }
  // Reversal must preserve the normalized position size.
  if (!new BigNumber(validation.size).eq(size)) {
    return { error: 'invalidSize' };
  }
  return {
    params: {
      coin: snapshot.coin,
      expectedAccountAddress: snapshot.accountAddress,
      isBuy: positionSize.lt(0),
      size: validation.size,
      price,
      orderType: 'market',
      slippage: DEFAULT_PERPS_SLIPPAGE,
    },
  };
}
