import BigNumber from 'bignumber.js';

import { ETranslations } from '@onekeyhq/shared/src/locale';
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
  parseDexCoin,
} from '@onekeyhq/shared/src/utils/perpsUtils';
import type { IFill } from '@onekeyhq/shared/types/hyperliquid/sdk';

import { getFillDirectionDisplayInfo } from '../utils';

import type { IntlShape } from 'react-intl';

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

export function canShareTradeFill(
  fill: Pick<IFill, 'coin' | 'closedPnl' | 'liquidation'>,
): boolean {
  return Boolean(
    fill.closedPnl &&
    !new BigNumber(fill.closedPnl).isZero() &&
    !isSpotInstrument(fill.coin) &&
    !fill.liquidation,
  );
}

export function getTradeFillExtraRows({
  fill,
  assetSymbol,
  intl,
}: {
  fill: IFill;
  assetSymbol: string;
  intl: IntlShape;
}) {
  const rows: { label: ETranslations; value: string; copyValue?: string }[] = [
    {
      label: ETranslations.perp_trades_history_direction,
      value: getFillDirectionDisplayInfo({ fill, intl }).text,
    },
    {
      label: ETranslations.perp_trade_details_liquidity_role__title,
      value: intl.formatMessage({
        id: fill.crossed
          ? ETranslations.perp_trade_details_taker__title
          : ETranslations.perp_trade_details_maker__title,
      }),
    },
    {
      label: ETranslations.perp_trade_details_start_position__title,
      value: `${formatLocalizedNumberString(
        new BigNumber(fill.startPosition).isZero() ? '0' : fill.startPosition,
      )} ${assetSymbol}`,
    },
    {
      label: ETranslations.perp_trade_details_fee_token__title,
      value: fill.feeToken,
    },
  ];
  if (fill.builderFee !== undefined) {
    rows.push({
      label: ETranslations.perps_fee_tiers_builder_fee,
      value: `${formatLocalizedNumberString(fill.builderFee)} ${fill.feeToken}`,
    });
  }
  rows.push(
    {
      label: ETranslations.Limit_order_history_order_id,
      value: String(fill.oid),
      copyValue: String(fill.oid),
    },
    {
      label: ETranslations.swap_history_detail_transaction_hash,
      value: fill.hash,
      copyValue: fill.hash,
    },
  );
  return rows;
}

export type ITradeHistoryTypeFilter = 'all' | 'spot' | 'perp';
export type ITradeHistoryFilters = {
  type: ITradeHistoryTypeFilter;
  side: 'all' | 'long' | 'short';
  market?: string;
};

function getTradeHistoryMarket(
  coin: string,
  spotPairDisplayMap: Record<string, string>,
) {
  if (isSpotInstrument(coin)) {
    const label = getSpotTokenDisplayName(
      (spotPairDisplayMap[coin] || coin).split('/')[0],
    );
    return { coin: `spot:${label}`, label };
  }
  const { displayName, dexLabel } = parseDexCoin(coin);
  return {
    coin,
    label: dexLabel ? `${displayName} (${dexLabel})` : displayName,
  };
}

export function filterTradeHistory(
  fills: IFill[],
  filters: ITradeHistoryFilters,
  activeCoin?: string,
  spotPairDisplayMap: Record<string, string> = {},
): IFill[] {
  return fills.filter((fill) => {
    const matchesMarket =
      filters.market === undefined ||
      (filters.market === 'active'
        ? fill.coin === activeCoin
        : getTradeHistoryMarket(fill.coin, spotPairDisplayMap).coin ===
          filters.market);
    return (
      (filters.type === 'all' ||
        isSpotInstrument(fill.coin) === (filters.type === 'spot')) &&
      (filters.side === 'all' ||
        fill.side === (filters.side === 'long' ? 'B' : 'A')) &&
      matchesMarket
    );
  });
}

export function getTradeHistoryMarketOptions(
  fills: IFill[],
  spotPairDisplayMap: Record<string, string>,
) {
  const markets = new Map<string, { coin: string; label: string }>();
  for (const { coin } of fills) {
    // Wait for metadata so a selectable spot filter never changes identity.
    if (!coin.startsWith('@') || spotPairDisplayMap[coin]) {
      const market = getTradeHistoryMarket(coin, spotPairDisplayMap);
      markets.set(market.coin, market);
    }
  }
  return Array.from(markets.values()).toSorted(
    (a, b) => a.label.localeCompare(b.label) || a.coin.localeCompare(b.coin),
  );
}
