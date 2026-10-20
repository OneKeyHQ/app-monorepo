import BigNumber from 'bignumber.js';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import { classifyTpSlOrder } from '@onekeyhq/shared/src/utils/perpsTpSlUtils';
import {
  formatHlSize,
  formatWithPrecision,
} from '@onekeyhq/shared/src/utils/perpsUtils';
import type {
  IPerpsAssetPosition,
  IPerpsFrontendOrder,
} from '@onekeyhq/shared/types/hyperliquid/sdk';

import type { ITVLine, ITVLineSide } from '../types';
import type { IntlShape } from 'react-intl';

let lineVersionCounter = 0;

function getNextVersion(): number {
  lineVersionCounter += 1;
  return lineVersionCounter;
}

/**
 * Parse and validate a price value, returning null if invalid.
 */
function parseValidPrice(
  price: string | number | null | undefined,
): BigNumber | null {
  if (price === undefined || price === null || price === '') {
    return null;
  }
  const bn = new BigNumber(price);
  return bn.isFinite() && bn.gt(0) ? bn : null;
}

/**
 * Parse a size string to number, returns 0 if invalid.
 * Uses BigNumber for consistency and safe handling of edge cases (NaN, Infinity).
 */
function parseSize(size: string | undefined): number {
  const bn = new BigNumber(size || '0');
  return bn.isFinite() ? bn.toNumber() : 0;
}

/**
 * Convert price to a safe string for TradingView chart lines.
 * CRITICAL: Preserves exact numeric value (no trailing zero removal).
 */
function toChartPriceString(price: string | number | null | undefined): string {
  return parseValidPrice(price)?.toFixed() ?? '0';
}

/**
 * Format price for display in labels (with thousand separators).
 */
function formatPriceForLabel(
  price: string | number | null | undefined,
): string {
  return parseValidPrice(price)?.toFormat() ?? '0';
}

export function buildLiquidationLine(
  position: IPerpsAssetPosition['position'],
  symbol: string,
  intl: IntlShape,
): ITVLine | null {
  const szi = parseSize(position.szi);
  if (szi === 0 || !parseValidPrice(position.liquidationPx)) {
    return null;
  }

  const leverageType = position.leverage?.type || 'cross';
  const side: ITVLineSide = szi > 0 ? 'long' : 'short';

  return {
    id: `liq:${symbol}:${leverageType}`,
    symbol,
    kind: 'liquidation',
    price: toChartPriceString(position.liquidationPx),
    side,
    label: {
      left: intl.formatMessage({ id: ETranslations.perp_position_liq_price }),
    },
    editable: false,
    meta: { leverageType },
    version: getNextVersion(),
  };
}

export function buildPositionLine(
  position: IPerpsAssetPosition['position'],
  symbol: string,
  szDecimals: number,
  intl: IntlShape,
): ITVLine | null {
  const szi = parseSize(position.szi);
  if (szi === 0 || !parseValidPrice(position.entryPx)) {
    return null;
  }

  const leverageType = position.leverage?.type || 'cross';
  const side: ITVLineSide = szi > 0 ? 'long' : 'short';
  const absSize = Math.abs(szi);
  const unrealizedPnl = new BigNumber(position.unrealizedPnl || '0');

  const pnlSign = unrealizedPnl.gte(0) ? '+' : '-';
  const pnlLabel = intl.formatMessage({
    id: ETranslations.perp_position_pnl_mobile,
  });
  const pnlFormatted = `${pnlLabel} ${pnlSign}$${formatWithPrecision(
    unrealizedPnl.abs(),
    2,
  )}`;
  // Floor-truncate size to szDecimals (HL lot-size rule).
  const formattedAbsSize = formatHlSize(absSize, szDecimals) || '0';
  const sizeFormatted = `${szi > 0 ? '+' : '-'}${formattedAbsSize}`;

  return {
    id: `pos:${symbol}:${leverageType}`,
    symbol,
    kind: 'position',
    price: toChartPriceString(position.entryPx),
    qty: formattedAbsSize,
    side,
    pnlPositive: unrealizedPnl.gte(0),
    label: { left: pnlFormatted, right: sizeFormatted },
    editable: false,
    meta: { leverageType },
    version: getNextVersion(),
  };
}

export function buildOrderLine(
  order: IPerpsFrontendOrder,
  szDecimals: number,
  symbol: string,
  intl: IntlShape,
): ITVLine | null {
  const sz = parseSize(order.sz);
  if (sz === 0 || !parseValidPrice(order.limitPx)) {
    return null;
  }

  const side: ITVLineSide = order.side === 'B' ? 'long' : 'short';
  const orderTypeLabel = intl.formatMessage({
    id: ETranslations.perp_trade_limit,
  });
  const priceLabel = formatPriceForLabel(order.limitPx);
  const triggerCondition = order.isTrigger
    ? formatTriggerCondition(order.triggerCondition)
    : '';
  const labelText = triggerCondition
    ? `${orderTypeLabel} ${priceLabel} ${intl.formatMessage({
        id: ETranslations.global_price,
      })} ${triggerCondition}`
    : `${orderTypeLabel} ${priceLabel}`;

  return {
    id: `order:${order.oid}`,
    // Chart symbol, not order.coin (`@index` for spot), so sync/patch/drag share one key.
    symbol,
    kind: 'order',
    price: toChartPriceString(order.limitPx),
    qty: formatHlSize(sz, szDecimals) || '0',
    side,
    label: { left: labelText },
    editable: order.orderType === 'Limit',
    meta: {
      orderId: String(order.oid),
      orderType: order.orderType,
      coin: order.coin,
    },
    version: getNextVersion(),
  };
}

/**
 * Convert trigger condition to symbol format.
 * "Price above 95000" -> "> 95000"
 * "Price below 89000" -> "< 89000"
 *
 * Note: triggerCondition is returned directly from Hyperliquid API,
 * always in English format "Price above/below {price}", not localized.
 */
function formatTriggerCondition(triggerCondition: string | undefined): string {
  if (!triggerCondition) return '';
  return triggerCondition
    .replace(/^Price\s+/i, '')
    .replace(/\babove\b/i, '>')
    .replace(/\bbelow\b/i, '<');
}

/**
 * Build a TP (Take Profit) or SL (Stop Loss) line from a trigger order.
 * Uses triggerPx as the line price.
 */
export function buildTpSlLine(
  order: IPerpsFrontendOrder,
  szDecimals: number,
  symbol: string,
  intl: IntlShape,
  positionSize?: string,
): ITVLine | null {
  const orderSize = parseSize(order.sz);
  const resolvedSize =
    order.isPositionTpsl && orderSize === 0
      ? parseSize(positionSize)
      : orderSize;
  // TP/SL orders use triggerPx as the line price
  if (resolvedSize === 0 || !parseValidPrice(order.triggerPx)) {
    return null;
  }

  const side: ITVLineSide = order.side === 'B' ? 'long' : 'short';
  const classification = classifyTpSlOrder(order);
  if (!classification) {
    return null;
  }
  const { kind, isMarket } = classification;
  const isTp = kind === 'tp';
  const formattedCondition = formatTriggerCondition(order.triggerCondition);

  let labelText: string;
  if (isMarket) {
    const prefix = intl.formatMessage({
      id: isTp
        ? ETranslations.perp_trade_tp_price
        : ETranslations.perp_trade_sl_price,
    });
    labelText = `${prefix} ${formattedCondition}`;
  } else {
    const typeLabel = intl.formatMessage({
      id: isTp
        ? ETranslations.perp_order_tp_limit
        : ETranslations.perp_order_stop_limit,
    });
    const priceLabel = intl.formatMessage({ id: ETranslations.global_price });
    labelText = `${typeLabel} ${formatPriceForLabel(
      order.limitPx,
    )} ${priceLabel} ${formattedCondition}`;
  }

  return {
    id: `${kind}:${order.oid}`,
    // Key on the chart symbol (see buildOrderLine), not order.coin.
    symbol,
    kind,
    price: toChartPriceString(order.triggerPx),
    qty: formatHlSize(resolvedSize, szDecimals) || '0',
    side,
    label: { left: labelText },
    editable: true, // Drag moves the trigger price; amend modifies in place.
    meta: {
      orderId: String(order.oid),
      orderType: order.orderType,
      coin: order.coin,
    },
    version: getNextVersion(),
  };
}

function isTpSlOrder(orderType: string): boolean {
  return (
    orderType.startsWith('Take Profit') ||
    orderType.startsWith('Stop') ||
    orderType.startsWith('Trigger')
  );
}

export function buildAllLinesForSymbol(
  positions: IPerpsAssetPosition[],
  orders: IPerpsFrontendOrder[],
  symbol: string,
  szDecimals: number,
  intl: IntlShape,
): ITVLine[] {
  const lines: ITVLine[] = [];

  // Build position and liquidation lines
  for (const { position } of positions.filter(
    (p) => p.position.coin === symbol,
  )) {
    const liquidationLine = buildLiquidationLine(position, symbol, intl);
    const positionLine = buildPositionLine(position, symbol, szDecimals, intl);
    if (liquidationLine) lines.push(liquidationLine);
    if (positionLine) lines.push(positionLine);
  }

  // Build order lines (Limit, TP, SL)
  const currentPosition = positions.find((p) => p.position.coin === symbol);
  const currentPositionSize = currentPosition
    ? new BigNumber(currentPosition.position.szi || '0').abs().toFixed()
    : undefined;

  // Already scoped to the active instrument upstream; re-filtering by
  // `o.coin === symbol` here dropped spot orders (`@index` coin) (OK-56900).
  for (const order of orders) {
    let line: ITVLine | null = null;
    if (order.orderType === 'Limit') {
      line = buildOrderLine(order, szDecimals, symbol, intl);
    } else if (isTpSlOrder(order.orderType)) {
      line = buildTpSlLine(
        order,
        szDecimals,
        symbol,
        intl,
        currentPositionSize,
      );
    }
    if (line) lines.push(line);
  }

  return lines;
}

export function resetLineVersionCounter(): void {
  lineVersionCounter = 0;
}
