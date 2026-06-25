import type { IPerpsFrontendOrder } from '@onekeyhq/shared/types/hyperliquid/sdk';

export type ITpSlKind = 'tp' | 'sl';

export interface ITpSlClassification {
  kind: ITpSlKind;
  // True for market triggers (execute at market once triggered), false for limit
  // triggers (rest as a limit order at limitPx once triggered).
  isMarket: boolean;
}

// Position TP/SL come back from HL with an orderType that does NOT start with
// "Take"/"Stop" (it is "Trigger"-prefixed), so the tp/sl direction has to be
// inferred from the trigger condition relative to the position side.
function inferTpSlKindFromTriggerOrder(
  order: IPerpsFrontendOrder,
): ITpSlKind | null {
  if (!order.isPositionTpsl || !order.orderType.startsWith('Trigger')) {
    return null;
  }

  const normalizedCondition = (order.triggerCondition || '').toLowerCase();
  const isAbove = normalizedCondition.includes('above');
  const isBelow = normalizedCondition.includes('below');

  if (!isAbove && !isBelow) {
    return null;
  }

  if (order.side === 'A') {
    return isAbove ? 'tp' : 'sl';
  }

  if (order.side === 'B') {
    return isBelow ? 'tp' : 'sl';
  }

  return null;
}

// Single source of truth for "is this order a TP/SL trigger, and which kind".
// Shared by the chart line builder, order amend, and positions/open-order rows
// so the classification cannot drift between surfaces.
export function getTpSlKind(order: IPerpsFrontendOrder): ITpSlKind | null {
  if (order.orderType.startsWith('Take Profit')) {
    return 'tp';
  }

  if (order.orderType.startsWith('Stop')) {
    return 'sl';
  }

  return inferTpSlKindFromTriggerOrder(order);
}

// Resolve market-vs-limit trigger nature. Do not rely solely on
// `orderType.includes('Market')`: position TP/SL can arrive as a bare "Trigger"
// (no Market/Limit suffix) yet are created as market triggers by
// `setPositionTpsl()` (isMarket: true). Misreading them as limit would convert a
// market TP/SL into a limit trigger on amend and change its post-trigger fill.
function resolveTpSlIsMarket(order: IPerpsFrontendOrder): boolean {
  if (order.orderType.includes('Market')) {
    return true;
  }
  if (order.orderType.includes('Limit')) {
    return false;
  }
  return order.isPositionTpsl && order.orderType.startsWith('Trigger');
}

// Returns the TP/SL kind + market nature, or null when the order is not a TP/SL
// trigger. Use this everywhere TP/SL semantics are needed.
export function classifyTpSlOrder(
  order: IPerpsFrontendOrder,
): ITpSlClassification | null {
  const kind = getTpSlKind(order);
  if (!kind) {
    return null;
  }
  return { kind, isMarket: resolveTpSlIsMarket(order) };
}
