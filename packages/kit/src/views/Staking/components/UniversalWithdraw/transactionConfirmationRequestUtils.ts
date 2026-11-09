import type { IEarnTransactionTip } from '@onekeyhq/shared/types/staking';

type ILatestTransactionConfirmationRequestParams = {
  requestId: number;
  requestKey: string;
  latestRequestId: number;
  latestRequestKey: string;
};

export function isLatestTransactionConfirmationRequest({
  requestId,
  requestKey,
  latestRequestId,
  latestRequestKey,
}: ILatestTransactionConfirmationRequestParams) {
  return requestId === latestRequestId && requestKey === latestRequestKey;
}

export function selectCurrentTransactionConfirmation<T>({
  snapshot,
  currentRequestKey,
  resolvedRequestKey,
  requiresCurrentRequest,
}: {
  snapshot: T | undefined;
  currentRequestKey: string;
  resolvedRequestKey: string | undefined;
  requiresCurrentRequest: boolean;
}) {
  if (requiresCurrentRequest && currentRequestKey !== resolvedRequestKey) {
    return undefined;
  }
  return snapshot;
}

export function shouldShowPendleSummaryTip({
  formTip,
  transactionTip,
}: {
  formTip?: IEarnTransactionTip;
  transactionTip?: IEarnTransactionTip;
}) {
  // A path-specific tip can carry different information even if its text matches.
  return !formTip?.text || formTip !== transactionTip;
}
