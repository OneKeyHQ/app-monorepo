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
