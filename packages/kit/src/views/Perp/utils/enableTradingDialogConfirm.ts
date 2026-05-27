type IEnableTradingStatusForDialogConfirm =
  | {
      canTrade?: boolean | null;
      details?: {
        activatedOk?: boolean | null;
      };
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
