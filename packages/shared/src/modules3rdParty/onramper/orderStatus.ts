import {
  EHeadlessBuyOrderStatus,
  type IHeadlessBuyOrder,
  type IOnramperTransactionStatus,
} from '../../../types/fiatCrypto';

// Processing for about an hour reads as "taking longer than usual".
export const HEADLESS_BUY_ORDER_DELAYED_MS = 60 * 60 * 1000;
// No payment sign for about a day: a hidden record is dropped, a visible one
// is shown as failed (Coinbase never reports abandoned orders as failed, so
// the client has to decide). Both thresholds are placeholders to be tuned on
// real orders.
export const HEADLESS_BUY_ORDER_TIMEOUT_MS = 24 * 60 * 60 * 1000;

// Raw statuses that carry no evidence of a payment.
const PRE_PAYMENT_RAW_STATUSES = new Set(['init', 'new']);

export function mapOnramperStatus(raw: string | undefined): {
  status: EHeadlessBuyOrderStatus;
  paymentSeen: boolean;
} {
  switch (raw?.toLowerCase()) {
    case 'pending':
    case 'paid':
      return { status: EHeadlessBuyOrderStatus.Processing, paymentSeen: true };
    case 'completed':
      return { status: EHeadlessBuyOrderStatus.Delivered, paymentSeen: true };
    case 'failed':
    case 'canceled':
    case 'cancelled':
      return { status: EHeadlessBuyOrderStatus.Failed, paymentSeen: false };
    case 'refunded':
      return { status: EHeadlessBuyOrderStatus.Refunded, paymentSeen: true };
    default:
      // init / new / unknown values: nothing has happened yet as far as the
      // user is concerned.
      return {
        status: EHeadlessBuyOrderStatus.Processing,
        paymentSeen: false,
      };
  }
}

function isPrePayment(rawStatus: string | undefined): boolean {
  return (
    rawStatus === undefined ||
    PRE_PAYMENT_RAW_STATUSES.has(rawStatus.toLowerCase())
  );
}

// Timed-out failures keep being refreshed: a late completion must flip them.
export function isTerminalHeadlessBuyOrder(order: IHeadlessBuyOrder): boolean {
  switch (order.status) {
    case EHeadlessBuyOrderStatus.Delivered:
    case EHeadlessBuyOrderStatus.Refunded:
      return true;
    case EHeadlessBuyOrderStatus.Failed:
      return !order.timedOut;
    default:
      return false;
  }
}

export function isHeadlessBuyOrderDelayed(
  order: IHeadlessBuyOrder,
  now: number,
): boolean {
  return (
    order.status === EHeadlessBuyOrderStatus.Processing &&
    now - (order.submittedAt ?? order.createdAt) >=
      HEADLESS_BUY_ORDER_DELAYED_MS
  );
}

export type IHeadlessBuyFailureKind = 'notCharged' | 'refund' | 'unknown';

// Which failure sentence to show. Only a backend reason lets us promise
// anything about the money; a timeout knows nothing.
export function getHeadlessBuyFailureKind(
  order: IHeadlessBuyOrder,
): IHeadlessBuyFailureKind {
  if (order.timedOut || !order.statusReason) {
    return 'unknown';
  }
  return /refund/i.test(order.statusReason) ? 'refund' : 'notCharged';
}

function parseStatusDate(statusDate: string | undefined): number | undefined {
  if (!statusDate) {
    return undefined;
  }
  const ts = Date.parse(statusDate);
  return Number.isFinite(ts) ? ts : undefined;
}

// Merges one lookup result into an order. Returns undefined when the record
// should be deleted: a hidden order the backend reports failed/canceled — the
// user never paid, so there is nothing to show.
export function applyOnramperTransactionStatus(
  order: IHeadlessBuyOrder,
  tx: IOnramperTransactionStatus,
  now: number,
): IHeadlessBuyOrder | undefined {
  const mapped = mapOnramperStatus(tx.status);
  const next: IHeadlessBuyOrder = {
    ...order,
    rawStatus: tx.status ?? order.rawStatus,
    statusReason: tx.statusReason ?? order.statusReason,
    statusDate: tx.statusDate ?? order.statusDate,
    outAmount: tx.outAmount ?? order.outAmount,
    transactionHash: tx.transactionHash ?? order.transactionHash,
    paymentSeen: Boolean(order.paymentSeen) || mapped.paymentSeen,
    lastCheckedAt: now,
    lastCheckOk: true,
  };
  if (!order.submittedAt) {
    if (mapped.status === EHeadlessBuyOrderStatus.Failed) {
      return undefined;
    }
    if (mapped.paymentSeen) {
      // Payment happened while the app was away: surface the order.
      next.submittedAt = parseStatusDate(tx.statusDate) ?? now;
    }
  }
  if (mapped.status !== EHeadlessBuyOrderStatus.Processing) {
    next.status = mapped.status;
    next.timedOut = false;
  } else if (order.timedOut && mapped.paymentSeen) {
    // The provider finally saw the payment: back to processing.
    next.status = EHeadlessBuyOrderStatus.Processing;
    next.timedOut = false;
  } else if (!order.timedOut) {
    next.status = EHeadlessBuyOrderStatus.Processing;
  }
  return next;
}

// Time-based rules, applied on every read so the UI never depends on a
// network round-trip. Returns undefined when the record should be deleted;
// returns the same reference when nothing changed.
export function applyHeadlessBuyOrderTimeRules(
  order: IHeadlessBuyOrder,
  now: number,
): IHeadlessBuyOrder | undefined {
  if (!order.submittedAt) {
    if (
      isPrePayment(order.rawStatus) &&
      now - order.createdAt >= HEADLESS_BUY_ORDER_TIMEOUT_MS
    ) {
      return undefined;
    }
    return order;
  }
  if (
    order.status === EHeadlessBuyOrderStatus.Processing &&
    !order.paymentSeen &&
    isPrePayment(order.rawStatus) &&
    now - order.submittedAt >= HEADLESS_BUY_ORDER_TIMEOUT_MS
  ) {
    return { ...order, status: EHeadlessBuyOrderStatus.Failed, timedOut: true };
  }
  return order;
}

export function selectHeadlessBuyOrders(orders: IHeadlessBuyOrder[]): {
  visibleOrders: IHeadlessBuyOrder[];
  processingOrders: IHeadlessBuyOrder[];
  unseenFailedOrder: IHeadlessBuyOrder | undefined;
} {
  const visibleOrders = orders
    .filter((o) => o.submittedAt !== undefined)
    .toSorted((a, b) => (b.submittedAt ?? 0) - (a.submittedAt ?? 0));
  return {
    visibleOrders,
    processingOrders: visibleOrders.filter(
      (o) => o.status === EHeadlessBuyOrderStatus.Processing,
    ),
    unseenFailedOrder: visibleOrders.find(
      (o) =>
        o.status === EHeadlessBuyOrderStatus.Failed &&
        o.failureViewedAt === undefined,
    ),
  };
}
