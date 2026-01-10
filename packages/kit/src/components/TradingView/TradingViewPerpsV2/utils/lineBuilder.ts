import BigNumber from 'bignumber.js';

import { formatWithPrecision } from '@onekeyhq/shared/src/utils/perpsUtils';
import type {
  IPerpsAssetPosition,
  IPerpsFrontendOrder,
} from '@onekeyhq/shared/types/hyperliquid/sdk';

import type { ITVLine, ITVLineSide } from '../types';

// Version counter for diff detection
let lineVersionCounter = 0;

function getNextVersion(): number {
  lineVersionCounter += 1;
  return lineVersionCounter;
}

/**
 * Convert price to a safe string for TradingView chart lines.
 *
 * CRITICAL: TradingView needs the exact numeric value as a string.
 * DO NOT use formatPriceToValid() here - it removes trailing zeros
 * which corrupts prices like "85000" → "85".
 *
 * @param price - Raw price string from API (e.g., "85000", "98960.5")
 * @returns Safe price string preserving all digits
 */
function toChartPriceString(price: string | number | undefined): string {
  if (price === undefined || price === null || price === '') {
    return '0';
  }

  const bn = new BigNumber(price);
  if (!bn.isFinite() || bn.lte(0)) {
    return '0';
  }

  // Use toFixed() without removing trailing zeros
  // This preserves the exact numeric value
  return bn.toFixed();
}

/**
 * Format price for display in labels (with thousand separators).
 * This is ONLY for human-readable labels, not for chart positioning.
 */
function formatPriceForLabel(price: string | number | undefined): string {
  if (price === undefined || price === null || price === '') {
    return '0';
  }

  const bn = new BigNumber(price);
  if (!bn.isFinite() || bn.lte(0)) {
    return '0';
  }

  // Format with thousand separators for readability
  return bn.toFormat();
}

/**
 * Build liquidation line from position data
 */
export function buildLiquidationLine(
  position: IPerpsAssetPosition['position'],
  symbol: string,
): ITVLine | null {
  const szi = parseFloat(position.szi || '0');
  const liquidationPx = position.liquidationPx;

  // Skip if no position or invalid liquidation price
  if (szi === 0 || !liquidationPx) {
    return null;
  }

  const liquidationPrice = new BigNumber(liquidationPx);
  if (!liquidationPrice.isFinite() || liquidationPrice.lte(0)) {
    return null;
  }

  const leverageType = position.leverage?.type || 'cross';
  const side: ITVLineSide = szi > 0 ? 'long' : 'short';

  return {
    id: `liq:${symbol}:${leverageType}`,
    symbol,
    kind: 'liquidation',
    price: toChartPriceString(liquidationPx),
    side,
    label: {
      left: 'Liq. Price',
    },
    editable: false,
    meta: {
      leverageType,
    },
    version: getNextVersion(),
  };
}

/**
 * Build position line from position data
 */
export function buildPositionLine(
  position: IPerpsAssetPosition['position'],
  symbol: string,
  szDecimals: number,
): ITVLine | null {
  const szi = parseFloat(position.szi || '0');
  const entryPx = position.entryPx;

  // Skip if no position
  if (szi === 0 || !entryPx) {
    return null;
  }

  const entryPrice = new BigNumber(entryPx);
  if (!entryPrice.isFinite() || entryPrice.lte(0)) {
    return null;
  }

  const leverageType = position.leverage?.type || 'cross';
  const side: ITVLineSide = szi > 0 ? 'long' : 'short';
  const absSize = Math.abs(szi);
  const unrealizedPnl = new BigNumber(position.unrealizedPnl || '0');

  // Format PNL label
  const pnlValue = unrealizedPnl.toNumber();
  const pnlSign = pnlValue >= 0 ? '+' : '';
  const pnlFormatted = `PNL ${pnlSign}$${formatWithPrecision(
    unrealizedPnl.abs(),
    2,
  )}`;

  // Format size label
  const sizeSign = szi > 0 ? '+' : '-';
  const sizeFormatted = `${sizeSign}${formatWithPrecision(
    absSize,
    szDecimals,
  )}`;

  return {
    id: `pos:${symbol}:${leverageType}`,
    symbol,
    kind: 'position',
    price: toChartPriceString(entryPx),
    qty: formatWithPrecision(absSize, szDecimals),
    side,
    label: {
      left: pnlFormatted,
      right: sizeFormatted,
    },
    editable: false,
    meta: {
      leverageType,
    },
    version: getNextVersion(),
  };
}

/**
 * Build order line from order data
 */
export function buildOrderLine(
  order: IPerpsFrontendOrder,
  szDecimals: number,
): ITVLine | null {
  const limitPx = order.limitPx;
  const sz = parseFloat(order.sz || '0');

  // Skip if invalid price or size
  if (!limitPx || sz === 0) {
    return null;
  }

  const price = new BigNumber(limitPx);
  if (!price.isFinite() || price.lte(0)) {
    return null;
  }

  // B = Buy (long), A = Ask/Sell (short)
  const side: ITVLineSide = order.side === 'B' ? 'long' : 'short';
  const isLimitOrder = order.orderType === 'Limit';

  // CRITICAL: Use toChartPriceString for chart positioning (preserves exact value)
  // Use formatPriceForLabel for human-readable display (with thousand separators)
  const chartPrice = toChartPriceString(limitPx);
  const displayPrice = formatPriceForLabel(limitPx);

  // Build label: "Limit 84,619 N/A" format
  // triggerCondition is the trigger condition, N/A for regular limit orders
  const triggerCondition = order.triggerCondition || 'N/A';
  const orderTypeLabel = order.orderType || 'Limit';
  const labelText = `${orderTypeLabel} ${displayPrice} ${triggerCondition}`;

  return {
    id: `order:${order.oid}`,
    symbol: order.coin,
    kind: 'order',
    price: chartPrice, // Use exact numeric value for chart positioning
    qty: formatWithPrecision(sz, szDecimals),
    side,
    label: {
      left: labelText, // "Limit 84,619 N/A" with formatted display price
    },
    editable: isLimitOrder, // Only limit orders are draggable
    meta: {
      orderId: String(order.oid),
      orderType: order.orderType,
    },
    version: getNextVersion(),
  };
}

/**
 * Build all lines for a specific symbol
 */
export function buildAllLinesForSymbol(
  positions: IPerpsAssetPosition[],
  orders: IPerpsFrontendOrder[],
  symbol: string,
  szDecimals: number,
): ITVLine[] {
  const lines: ITVLine[] = [];

  // Filter positions for this symbol
  const symbolPositions = positions.filter((p) => p.position.coin === symbol);

  // Build position and liquidation lines
  for (const positionWrapper of symbolPositions) {
    const { position } = positionWrapper;

    const liquidationLine = buildLiquidationLine(position, symbol);
    if (liquidationLine) {
      lines.push(liquidationLine);
    }

    const positionLine = buildPositionLine(position, symbol, szDecimals);
    if (positionLine) {
      lines.push(positionLine);
    }
  }

  // Filter orders for this symbol (Limit orders only)
  const symbolOrders = orders.filter(
    (o) => o.coin === symbol && o.orderType === 'Limit',
  );

  // Build order lines
  for (const order of symbolOrders) {
    const orderLine = buildOrderLine(order, szDecimals);
    if (orderLine) {
      lines.push(orderLine);
    }
  }

  return lines;
}

/**
 * Reset version counter (useful for testing)
 */
export function resetLineVersionCounter(): void {
  lineVersionCounter = 0;
}
