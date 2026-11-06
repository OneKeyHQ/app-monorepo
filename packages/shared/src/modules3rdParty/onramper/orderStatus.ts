import {
  EHeadlessBuyOrderStatus,
  type IHeadlessBuyAbandonReason,
  type IHeadlessBuyOrder,
  type IOnramperTransactionStatus,
} from '../../../types/fiatCrypto';
import { ETranslations } from '../../locale';

// Processing for about an hour reads as "taking longer than usual".
export const HEADLESS_BUY_ORDER_DELAYED_MS = 60 * 60 * 1000;
// No payment sign for about a day: a hidden record is dropped, a visible one
// is shown as failed (Coinbase never reports abandoned orders as failed, so
// the client has to decide). Both thresholds are placeholders to be tuned on
// real orders.
export const HEADLESS_BUY_ORDER_TIMEOUT_MS = 24 * 60 * 60 * 1000;

// Raw statuses that carry no evidence of a payment. `pending` belongs here:
// a provider order is `pending` from creation, before its payment page is
// ready (device-observed 2026-11-06 on Coinbase, where the authorization then
// failed and the transaction stayed `pending`). Only `paid` and the terminal
// statuses prove that money moved.
const PRE_PAYMENT_RAW_STATUSES = new Set(['init', 'new', 'pending']);

export function mapOnramperStatus(raw: string | undefined): {
  status: EHeadlessBuyOrderStatus;
  paymentSeen: boolean;
} {
  switch (raw?.toLowerCase()) {
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
      // init / new / pending / unknown values: nothing has happened yet as
      // far as the user is concerned.
      return {
        status: EHeadlessBuyOrderStatus.Processing,
        paymentSeen: false,
      };
  }
}

// Provider payment-page reasons (the SDK's `providerError.reason`) that mean
// the payment authorization itself failed. Coinbase documents `commit_error`
// as "payment authorization failed"; `commit_success` is its paid branch.
const AUTHORIZATION_FAILED_PROVIDER_REASONS = new Set([
  'onramp_api.commit_error',
]);

// How a failed checkout settles its order. SDK 1.3.1 reports every Coinbase
// page error as `providerFailed` ("outcome unknown"), a failed authorization
// included, so the page reason that preceded the failure decides between the
// two; every other error code is a plain pre-payment failure.
export function getHeadlessBuyAbandonReason({
  errorCode,
  providerReason,
}: {
  errorCode?: string;
  providerReason?: string;
}): IHeadlessBuyAbandonReason {
  if (errorCode !== 'providerFailed') {
    return 'failed';
  }
  return providerReason !== undefined &&
    AUTHORIZATION_FAILED_PROVIDER_REASONS.has(providerReason)
    ? 'authorizationFailed'
    : 'providerFailed';
}

// Failed by the client (24 h no-progress rule, or the provider's payment page
// reporting a failed authorization) rather than by the backend. The backend
// has not confirmed it, so such an order keeps being refreshed and never
// claims anything about the money.
export function isClientFailedHeadlessBuyOrder(
  order: IHeadlessBuyOrder,
): boolean {
  return Boolean(order.timedOut || order.authorizationFailed);
}

function isPrePayment(rawStatus: string | undefined): boolean {
  return (
    rawStatus === undefined ||
    PRE_PAYMENT_RAW_STATUSES.has(rawStatus.toLowerCase())
  );
}

// Client-decided failures keep being refreshed: a late completion must flip
// them.
export function isTerminalHeadlessBuyOrder(order: IHeadlessBuyOrder): boolean {
  switch (order.status) {
    case EHeadlessBuyOrderStatus.Delivered:
    case EHeadlessBuyOrderStatus.Refunded:
      return true;
    case EHeadlessBuyOrderStatus.Failed:
      return !isClientFailedHeadlessBuyOrder(order);
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
// anything about the money, and "not charged" is only safe when nothing ever
// showed a payment (no local paymentAuthorized, no backend paid) and the
// payment surface never failed with the outcome unknown (SDK 1.3
// `providerFailed`); a client-decided failure knows nothing.
export function getHeadlessBuyFailureKind(
  order: IHeadlessBuyOrder,
): IHeadlessBuyFailureKind {
  if (isClientFailedHeadlessBuyOrder(order) || !order.statusReason) {
    return 'unknown';
  }
  if (/refund/i.test(order.statusReason)) {
    return 'refund';
  }
  return order.paymentSeen || order.paymentOutcomeUnknown
    ? 'unknown'
    : 'notCharged';
}

// The single sentence under the status label — only when the label alone
// does not say what happens next. Past the delay threshold the "taking
// longer" copy replaces the plain processing copy (never both); a delivered
// order needs no sentence.
export function getHeadlessBuyOrderSentenceId(
  order: IHeadlessBuyOrder,
  now: number,
): ETranslations | undefined {
  switch (order.status) {
    case EHeadlessBuyOrderStatus.Processing:
      return isHeadlessBuyOrderDelayed(order, now)
        ? ETranslations.buy_order_delayed__desc
        : ETranslations.buy_order_processing__desc;
    case EHeadlessBuyOrderStatus.Refunded:
      return ETranslations.buy_order_refunded__desc;
    case EHeadlessBuyOrderStatus.Failed:
      switch (getHeadlessBuyFailureKind(order)) {
        case 'refund':
          return ETranslations.buy_order_failed_refund__desc;
        case 'notCharged':
          return ETranslations.buy_order_failed_not_charged__desc;
        default:
          return ETranslations.buy_order_failed_unknown__desc;
      }
    default:
      return undefined;
  }
}

function parseStatusDate(statusDate: string | undefined): number | undefined {
  if (!statusDate) {
    return undefined;
  }
  const ts = Date.parse(statusDate);
  return Number.isFinite(ts) ? ts : undefined;
}

// Merges one lookup result into an order. Returns undefined when the record
// should be deleted: a hidden order the backend reports failed/canceled before
// any payment sign — the user never paid, so there is nothing to show. A
// hidden order whose Apple Pay sheet was already authorized is surfaced
// instead: the user may have been charged and needs the order id.
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
      if (!order.paymentSeen) {
        return undefined;
      }
      next.submittedAt = parseStatusDate(tx.statusDate) ?? now;
    } else if (mapped.paymentSeen) {
      // Payment happened while the app was away: surface the order.
      next.submittedAt = parseStatusDate(tx.statusDate) ?? now;
    }
  }
  const clientFailed = isClientFailedHeadlessBuyOrder(order);
  if (mapped.status !== EHeadlessBuyOrderStatus.Processing) {
    // A backend verdict replaces whatever the client had decided.
    next.status = mapped.status;
    next.timedOut = false;
    delete next.authorizationFailed;
  } else if (clientFailed && mapped.paymentSeen) {
    // The provider saw a payment after all: back to processing.
    next.status = EHeadlessBuyOrderStatus.Processing;
    next.timedOut = false;
    delete next.authorizationFailed;
  } else if (!clientFailed) {
    next.status = EHeadlessBuyOrderStatus.Processing;
  }
  if (next.status !== EHeadlessBuyOrderStatus.Failed) {
    // The banner's "unseen failure" mark belongs to one failure, not to the
    // record: once the order leaves Failed, a later failure must show again.
    delete next.failureViewedAt;
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
      if (!order.paymentSeen) {
        return undefined;
      }
      // Apple Pay was authorized but `completed` never arrived (the app was
      // killed in between): the user may have been charged, so the record
      // is surfaced as a timed-out failure — still refreshed, shown with the
      // "contact support with your order id" copy — instead of being dropped.
      return {
        ...order,
        submittedAt: order.createdAt,
        status: EHeadlessBuyOrderStatus.Failed,
        timedOut: true,
      };
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
