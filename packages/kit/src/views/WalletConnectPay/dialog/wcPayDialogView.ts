import { EWcPayStatus } from '@onekeyhq/shared/src/walletConnect/payTypes';

/**
 * Pure mapping from the flow machine's observable state to the dialog step.
 * Priority (top wins) mirrors the safety ordering of the page it replaces:
 * the terminal result phase must shadow every pre-payment state (it is
 * terminal — see PaymentOptionsModal's phase contract), the paying lock (Q9:
 * the whole confirming stretch is non-dismissible) shadows content states,
 * and content states shadow the skeleton ones.
 */
export type IWcPayDialogTerminalReason =
  | 'failed'
  | 'expired'
  | 'cancelled'
  | 'alreadyPaid';

export type IWcPayDialogStep =
  | { name: 'fetching' }
  | { name: 'fetchFailed' }
  | { name: 'unsupported' }
  | { name: 'options'; empty: 'noAssets' | 'platformRefused' | undefined }
  | { name: 'confirming' }
  | { name: 'damaged' }
  | { name: 'submitted'; canClose: boolean }
  | { name: 'success' }
  | { name: 'terminal'; reason: IWcPayDialogTerminalReason };

export interface IWcPayDialogViewInput {
  isLoading: boolean;
  loadError: boolean;
  hasPayResult: boolean;
  isUnsupportedAccountType: boolean;
  areOptionsRefusedOnPlatform: boolean;
  optionsCount: number;
  payStatus: EWcPayStatus | undefined;
  isExpiredLocally: boolean;
  hasDamagedProgress: boolean;
  pagePhaseName: 'idle' | 'paying' | 'result';
  pollStatus: EWcPayStatus | undefined;
  pollIsFinal: boolean;
  pollExhausted: boolean;
}

export interface IWcPayDialogView {
  step: IWcPayDialogStep;
  dismissible: boolean;
}

function terminalReasonOfStatus(
  status: EWcPayStatus,
): IWcPayDialogTerminalReason | undefined {
  switch (status) {
    case EWcPayStatus.Failed:
      return 'failed';
    case EWcPayStatus.Expired:
      return 'expired';
    case EWcPayStatus.Cancelled:
      return 'cancelled';
    case EWcPayStatus.Succeeded:
      return 'alreadyPaid';
    default:
      return undefined;
  }
}

export function deriveWcPayDialogView(
  input: IWcPayDialogViewInput,
): IWcPayDialogView {
  // Terminal result phase shadows everything: nothing pre-payment may render
  // once signatures were submitted.
  if (input.pagePhaseName === 'result') {
    if (input.pollStatus === EWcPayStatus.Succeeded) {
      return { step: { name: 'success' }, dismissible: true };
    }
    const reason =
      input.pollStatus === undefined
        ? undefined
        : terminalReasonOfStatus(input.pollStatus);
    if (reason && reason !== 'alreadyPaid') {
      return { step: { name: 'terminal', reason }, dismissible: true };
    }
    // Processing (or unknown): the poller may still resolve; closing is only
    // offered once the poll went final or exhausted — matches the page's
    // Done gate on the result view.
    const canClose = input.pollIsFinal || input.pollExhausted;
    return { step: { name: 'submitted', canClose }, dismissible: canClose };
  }

  if (input.hasDamagedProgress) {
    return { step: { name: 'damaged' }, dismissible: true };
  }

  // Q9: from the Pay press to the result phase the dialog cannot be closed.
  if (input.pagePhaseName === 'paying') {
    return { step: { name: 'confirming' }, dismissible: false };
  }

  if (input.isUnsupportedAccountType) {
    return { step: { name: 'unsupported' }, dismissible: true };
  }

  if (input.loadError) {
    return { step: { name: 'fetchFailed' }, dismissible: true };
  }

  if (input.isLoading || !input.hasPayResult) {
    return { step: { name: 'fetching' }, dismissible: true };
  }

  // Q6: no countdown is displayed; hitting the deadline while the options
  // step is up jumps straight to the expired terminal.
  if (input.isExpiredLocally) {
    return { step: { name: 'terminal', reason: 'expired' }, dismissible: true };
  }
  const inactiveReason =
    input.payStatus === undefined
      ? undefined
      : terminalReasonOfStatus(input.payStatus);
  if (inactiveReason) {
    return {
      step: { name: 'terminal', reason: inactiveReason },
      dismissible: true,
    };
  }

  if (input.areOptionsRefusedOnPlatform) {
    return {
      step: { name: 'options', empty: 'platformRefused' },
      dismissible: true,
    };
  }
  if (input.optionsCount === 0) {
    return { step: { name: 'options', empty: 'noAssets' }, dismissible: true };
  }
  return { step: { name: 'options', empty: undefined }, dismissible: true };
}
