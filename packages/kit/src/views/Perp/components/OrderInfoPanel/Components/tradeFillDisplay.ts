import BigNumber from 'bignumber.js';

import type { INumberFormatProps } from '@onekeyhq/shared/src/utils/numberUtils';
import {
  formatLocalizedNumberString,
  numberFormat,
} from '@onekeyhq/shared/src/utils/numberUtils';
import {
  getSpotTokenDisplayName,
  getValidPriceDecimals,
  getValidSpotPriceDecimals,
  isSpotInstrument,
  isUsdcDenominatedFee,
} from '@onekeyhq/shared/src/utils/perpsUtils';

const usdFormatter: INumberFormatProps = {
  formatter: 'value',
  formatterOptions: {
    currency: '$',
  },
};

/**
 * Display strings for one fill row. Pure so the spot/perp formatting rules can
 * be pinned by tests against real Hyperliquid fill payloads.
 */
export function getTradeFillDisplayInfo({
  coin,
  px,
  sz,
  fee,
  feeToken,
}: {
  coin: string;
  px: string;
  sz: string;
  fee: string;
  feeToken?: string;
}) {
  // Spot prices allow up to MAX_DECIMALS_SPOT (8); the perp rule caps at 6 and
  // rounds e.g. 0.0000006 up to 0.000001. szDecimals is unknown for a bare
  // fill, so 0 keeps the loosest valid spot precision.
  const decimals = isSpotInstrument(coin)
    ? getValidSpotPriceDecimals(px, 0)
    : getValidPriceDecimals(px);
  const priceBN = new BigNumber(px);
  // Math always runs on the raw size; only the display copy is formatted
  // (the balance format inserts thousands separators BigNumber cannot parse).
  const sizeBN = new BigNumber(sz);
  const priceFormatted = formatLocalizedNumberString(priceBN.toFixed(decimals));
  // Raw fill sizes can carry float tails and lack separators
  // (18333333.3000000007); balance-format them like the TWAP list does.
  const sizeFormatted = numberFormat(sz, { formatter: 'balance' });
  // Spot buys are charged in the base token; a `$` there would read a
  // dust-value token amount as dollars.
  const feeFormatted = isUsdcDenominatedFee(feeToken)
    ? numberFormat(fee, usdFormatter)
    : `${numberFormat(fee, { formatter: 'balance' })} ${getSpotTokenDisplayName(
        feeToken ?? '',
      )}`;
  const tradeValueFormatted = numberFormat(
    priceBN.times(sizeBN).toFixed(),
    usdFormatter,
  );
  return { priceFormatted, sizeFormatted, feeFormatted, tradeValueFormatted };
}

/**
 * Net closed PnL for one fill: only a USDC fee can be netted against the USDC
 * closedPnl; a base-token fee (spot buys) would subtract token units from
 * dollars.
 */
export function getTradeFillClosePnlBN({
  closedPnl,
  fee,
  feeToken,
}: {
  closedPnl: string;
  fee: string;
  feeToken?: string;
}) {
  return isUsdcDenominatedFee(feeToken)
    ? new BigNumber(closedPnl).minus(new BigNumber(fee))
    : new BigNumber(closedPnl);
}
