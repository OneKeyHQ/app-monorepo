import BigNumber from 'bignumber.js';

import { formatWithPrecision } from '@onekeyhq/shared/src/utils/perpsUtils';
import type {
  IPerpsAssetPosition,
  IPerpsFrontendOrder,
} from '@onekeyhq/shared/types/hyperliquid/sdk';

import type { ITVLine, ITVLineSide } from '../types';

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
 * Convert price to a safe string for TradingView chart lines.
 * CRITICAL: Preserves exact numeric value (no trailing zero removal).
 */
function toChartPriceString(price: string | number | null | undefined): string {
  const bn = parseValidPrice(price);
  return bn?.toFixed() ?? '0';
}

/**
 * Format price for display in labels (with thousand separators).
 */
function formatPriceForLabel(
  price: string | number | null | undefined,
): string {
  const bn = parseValidPrice(price);
  return bn?.toFormat() ?? '0';
}

export function buildLiquidationLine(
  position: IPerpsAssetPosition['position'],
  symbol: string,
): ITVLine | null {
  const szi = parseFloat(position.szi || '0');
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
  const szi = parseFloat(position.szi || '0');
  if (szi === 0 || !parseValidPrice(position.entryPx)) {
    return null;
  }

  const leverageType = position.leverage?.type || 'cross';
  const side: ITVLineSide = szi > 0 ? 'long' : 'short';
  const absSize = Math.abs(szi);
  const unrealizedPnl = new BigNumber(position.unrealizedPnl || '0');

  const pnlSign = unrealizedPnl.gte(0) ? '+' : '';
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
  const sz = parseFloat(order.sz || '0');
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

export function buildAllLinesForSymbol(
  positions: IPerpsAssetPosition[],
  orders: IPerpsFrontendOrder[],
  symbol: string,
  szDecimals: number,
): ITVLine[] {
  const lines: ITVLine[] = [];

  const symbolPositions = positions.filter((p) => p.position.coin === symbol);
  for (const { position } of symbolPositions) {
    const liquidationLine = buildLiquidationLine(position, symbol);
    const positionLine = buildPositionLine(position, symbol, szDecimals);
    if (liquidationLine) lines.push(liquidationLine);
    if (positionLine) lines.push(positionLine);
  }

  const symbolOrders = orders.filter(
    (o) => o.coin === symbol && o.orderType === 'Limit',
  );
  for (const order of symbolOrders) {
    const orderLine = buildOrderLine(order, szDecimals);
    if (orderLine) lines.push(orderLine);
  }

  return lines;
}

export function resetLineVersionCounter(): void {
  lineVersionCounter = 0;
}
