import type {
  IEarnTransactionTip,
  IStakeTransactionConfirmation,
} from '@onekeyhq/shared/types/staking';

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

export function getWithdrawFormTips(
  confirmation: IStakeTransactionConfirmation | undefined,
  selectedPathIndex: number,
) {
  const path = confirmation?.withdrawPath?.data;
  const pathTip = path?.confirmBoxes?.[selectedPathIndex]?.tip;
  const rootTip = path?.tip ?? confirmation?.tip;

  // A single path has no selector dialog to surface its warning.
  if (path?.confirmBoxes?.length === 1) {
    return { formTip: rootTip, inlinePathTip: pathTip };
  }
  return { formTip: pathTip ? undefined : rootTip, inlinePathTip: undefined };
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
