type IEnableTradingStatusForDialogConfirm =
  | {
      canTrade?: boolean | null;
      details?: {
        activatedOk?: boolean | null;
      };
      accountNotSupport?: boolean;
    }
  | undefined;

export type IEnableTradingDialogConfirmDecision =
  | 'continue'
  | 'deposit'
  | 'stop';

export function getEnableTradingDialogConfirmDecision(
  status: IEnableTradingStatusForDialogConfirm,
): IEnableTradingDialogConfirmDecision {
  if (status?.canTrade) {
    return 'continue';
  }
  if (status?.details?.activatedOk === false) {
    return 'deposit';
  }
  return 'stop';
}

export function shouldShowPerpsFirstDepositPrompt({
  status,
  isLiveStatusPending,
  isPerpActionDisabled,
}: {
  status: IEnableTradingStatusForDialogConfirm;
  isLiveStatusPending: boolean;
  isPerpActionDisabled: boolean;
}): boolean {
  return Boolean(
    status &&
    !status.accountNotSupport &&
    !isLiveStatusPending &&
    !isPerpActionDisabled &&
    getEnableTradingDialogConfirmDecision(status) === 'deposit',
  );
}
