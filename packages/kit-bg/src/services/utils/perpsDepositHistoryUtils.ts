import type { IPerpsDepositOrderAtom } from '../../states/jotai/atoms';

export function normalizePerpsDepositTxId(
  txid: string | undefined,
): string | undefined {
  const normalized = txid?.trim().toLowerCase();
  return normalized || undefined;
}

export function getKnownPerpsDepositOrderTxIds({
  txid,
  originalTxId,
}: {
  txid: string | undefined;
  originalTxId: string | undefined;
}) {
  const txIds = new Set<string>();
  const normalizedTxId = normalizePerpsDepositTxId(txid);
  const normalizedOriginalTxId = normalizePerpsDepositTxId(originalTxId);
  if (normalizedTxId) {
    txIds.add(normalizedTxId);
  }
  if (normalizedOriginalTxId) {
    txIds.add(normalizedOriginalTxId);
  }
  return txIds;
}

export function isPerpsDepositOrderMatchedByTxIds(
  order: Pick<IPerpsDepositOrderAtom, 'fromTxId' | 'toTxId'>,
  txIds: Set<string>,
) {
  const fromTxId = normalizePerpsDepositTxId(order.fromTxId);
  const toTxId = normalizePerpsDepositTxId(order.toTxId);
  return Boolean(
    (fromTxId && txIds.has(fromTxId)) || (toTxId && txIds.has(toTxId)),
  );
}

export function isPerpsDepositOrderMatchedByTargetTxIds(
  order: Pick<IPerpsDepositOrderAtom, 'toTxId'>,
  txIds: Set<string>,
) {
  const toTxId = normalizePerpsDepositTxId(order.toTxId);
  return Boolean(toTxId && txIds.has(toTxId));
}

export function shouldKeepHistoryConfirmationMarker(
  order: Pick<
    IPerpsDepositOrderAtom,
    'fromTxId' | 'toTxId' | 'keepForHistoryConfirmation'
  >,
  txIds: Set<string>,
) {
  if (!order.keepForHistoryConfirmation) {
    return true;
  }
  const toTxId = normalizePerpsDepositTxId(order.toTxId);
  if (toTxId) {
    return !txIds.has(toTxId);
  }
  return !isPerpsDepositOrderMatchedByTxIds(order, txIds);
}
