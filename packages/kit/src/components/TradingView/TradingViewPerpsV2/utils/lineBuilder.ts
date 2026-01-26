import BigNumber from 'bignumber.js';

import { formatWithPrecision } from '@onekeyhq/shared/src/utils/perpsUtils';
import type {
  IPerpsAssetPosition,
  IPerpsFrontendOrder,
} from '@onekeyhq/shared/types/hyperliquid/sdk';

import type { ITVLine, ITVLineKind, ITVLineSide } from '../types';

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
    label: { left: 'Liq. Price' },
    editable: false,
    meta: { leverageType },
    version: getNextVersion(),
  };
}

export function buildPositionLine(
  position: IPerpsAssetPosition['position'],
  symbol: string,
  szDecimals: number,
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
  const pnlFormatted = `PNL ${pnlSign}$${formatWithPrecision(
    unrealizedPnl.abs(),
    2,
  )}`;
  const sizeFormatted = `${szi > 0 ? '+' : '-'}${formatWithPrecision(
    absSize,
    szDecimals,
  )}`;

  return {
    id: `pos:${symbol}:${leverageType}`,
    symbol,
    kind: 'position',
    price: toChartPriceString(position.entryPx),
    qty: formatWithPrecision(absSize, szDecimals),
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
): ITVLine | null {
  const sz = parseSize(order.sz);
  if (sz === 0 || !parseValidPrice(order.limitPx)) {
    return null;
  }

  const side: ITVLineSide = order.side === 'B' ? 'long' : 'short';
  const triggerCondition = order.triggerCondition || 'N/A';
  const orderTypeLabel = order.orderType || 'Limit';
  const labelText = `${orderTypeLabel} ${formatPriceForLabel(
    order.limitPx,
  )} ${triggerCondition}`;

  return {
    id: `order:${order.oid}`,
    symbol: order.coin,
    kind: 'order',
    price: toChartPriceString(order.limitPx),
    qty: formatWithPrecision(sz, szDecimals),
    side,
    label: { left: labelText },
    editable: order.orderType === 'Limit',
    meta: { orderId: String(order.oid), orderType: order.orderType },
    version: getNextVersion(),
  };
}

/**
 * Convert trigger condition to symbol format.
 * "Price above 95000" -> "Price > 95000"
 * "Price below 89000" -> "Price < 89000"
 *
 * Note: triggerCondition is returned directly from Hyperliquid API,
 * always in English format "Price above/below {price}", not localized.
 */
function formatTriggerCondition(triggerCondition: string | undefined): string {
  if (!triggerCondition) return '';
  // Replace "above" with ">" and "below" with "<"
  // Using word boundary to be more precise
  return triggerCondition.replace(/\babove\b/i, '>').replace(/\bbelow\b/i, '<');
}

/**
 * Build a TP (Take Profit) or SL (Stop Loss) line from a trigger order.
 * Uses triggerPx as the line price.
 */
export function buildTpSlLine(
  order: IPerpsFrontendOrder,
  szDecimals: number,
): ITVLine | null {
  const sz = parseSize(order.sz);
  // TP/SL orders use triggerPx as the line price
  if (sz === 0 || !parseValidPrice(order.triggerPx)) {
    return null;
  }

  const side: ITVLineSide = order.side === 'B' ? 'long' : 'short';
  const isTp = order.orderType.startsWith('Take Profit');
  const kind: ITVLineKind = isTp ? 'tp' : 'sl';
  const isMarket = order.orderType.includes('Market');
  const formattedCondition = formatTriggerCondition(order.triggerCondition);

  // Build label text
  // Market: "TP Price > 93723" or "SL Price > 95000"
  // Limit: "Take Profit Limit 92,206 Price < 89000" or "Stop Limit 92,206 Price > 96502"
  let labelText: string;
  if (isMarket) {
    const prefix = isTp ? 'TP' : 'SL';
    labelText = `${prefix} ${formattedCondition}`;
  } else {
    const typeLabel = isTp ? 'Take Profit Limit' : 'Stop Limit';
    labelText = `${typeLabel} ${formatPriceForLabel(
      order.limitPx,
    )} ${formattedCondition}`;
  }

  return {
    id: `${kind}:${order.oid}`,
    symbol: order.coin,
    kind,
    price: toChartPriceString(order.triggerPx),
    qty: formatWithPrecision(sz, szDecimals),
    side,
    label: { left: labelText },
    editable: false, // TP/SL orders are not draggable
    meta: { orderId: String(order.oid), orderType: order.orderType },
    version: getNextVersion(),
  };
}

function isTpSlOrder(orderType: string): boolean {
  return orderType.startsWith('Take Profit') || orderType.startsWith('Stop');
}

export function buildAllLinesForSymbol(
  positions: IPerpsAssetPosition[],
  orders: IPerpsFrontendOrder[],
  symbol: string,
  szDecimals: number,
): ITVLine[] {
  const lines: ITVLine[] = [];

  // Build position and liquidation lines
  for (const { position } of positions.filter(
    (p) => p.position.coin === symbol,
  )) {
    const liquidationLine = buildLiquidationLine(position, symbol);
    const positionLine = buildPositionLine(position, symbol, szDecimals);
    if (liquidationLine) lines.push(liquidationLine);
    if (positionLine) lines.push(positionLine);
  }

  // Build order lines (Limit, TP, SL)
  for (const order of orders.filter((o) => o.coin === symbol)) {
    let line: ITVLine | null = null;
    if (order.orderType === 'Limit') {
      line = buildOrderLine(order, szDecimals);
    } else if (isTpSlOrder(order.orderType)) {
      line = buildTpSlLine(order, szDecimals);
    }
    if (line) lines.push(line);
  }

  return lines;
}

export function resetLineVersionCounter(): void {
  lineVersionCounter = 0;
}
