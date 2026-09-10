export type ICompactStepStatus = 'done' | 'active' | 'failed' | 'upcoming';

export type IPrimaryLineKind =
  | 'approving'
  | 'repaying'
  | 'preparing'
  | 'confirmation'
  | 'waitingSwitchUnlock'
  | 'walletBalance'
  | null;

export type IAuxiliaryLineKind = 'lowersHealthFactor' | 'usdtReset' | null;

type ICompactStepKind = 'repay' | 'removeCollateral' | 'switch';
type IApproveSubStatus = 'preparing' | 'approving' | 'repaying' | null;

export function isStepConfirming({
  submittedKey,
  stepKey,
}: {
  submittedKey: string | null;
  stepKey: string;
  stepKind: ICompactStepKind;
  settlingStepKey: string | null;
}): boolean {
  return submittedKey === stepKey;
}

export function normalizeApproveSubStatusForConfirmation({
  approveSubStatus,
  confirming,
}: {
  approveSubStatus: IApproveSubStatus;
  confirming: boolean;
}): IApproveSubStatus {
  return confirming ? null : approveSubStatus;
}

export function getCompactStepStatus({
  index,
  stepIndex,
  failedKey,
  stepKey,
}: {
  index: number;
  stepIndex: number;
  failedKey: string | null;
  stepKey: string;
}): ICompactStepStatus {
  if (index < stepIndex) {
    return 'done';
  }
  if (index > stepIndex) {
    return 'upcoming';
  }
  return failedKey === stepKey ? 'failed' : 'active';
}

export function getPrimaryLineKind({
  active,
  approveSubStatus,
  confirming,
  waitingSwitchUnlock,
  kind,
  hasWalletBalance,
  hasShortfall,
}: {
  active: boolean;
  approveSubStatus: IApproveSubStatus;
  confirming: boolean;
  waitingSwitchUnlock: boolean;
  kind: ICompactStepKind;
  hasWalletBalance: boolean;
  hasShortfall: boolean;
}): IPrimaryLineKind {
  if (!active) {
    return null;
  }
  if (approveSubStatus) {
    return approveSubStatus;
  }
  if (confirming) {
    return 'confirmation';
  }
  if (waitingSwitchUnlock) {
    return 'waitingSwitchUnlock';
  }
  // A shortfall hands the balance figures to the funding card, which prints
  // them next to the fix. Keeping this line too would state them twice.
  if (kind === 'repay' && hasWalletBalance && !hasShortfall) {
    return 'walletBalance';
  }
  return null;
}

export function getAuxiliaryLineKind({
  status,
  kind,
  usdtResetHint,
}: {
  status: ICompactStepStatus;
  kind: ICompactStepKind;
  usdtResetHint: boolean;
}): IAuxiliaryLineKind {
  if (status !== 'done' && kind === 'removeCollateral') {
    return 'lowersHealthFactor';
  }
  if (status === 'active' && kind === 'repay' && usdtResetHint) {
    return 'usdtReset';
  }
  return null;
}

// The wallet-balance-and-shortfall message joins two whole phrases with a
// mid-dot, and every locale keeps that exact separator. Split it so each phrase
// gets its own line: run together, the two figures read as peers when they are
// really "what you hold" and "what you still need". A translation that ever
// drops the separator falls back to the single joined line — never to a lost
// number.
const BALANCE_SHORTFALL_SEPARATOR = ' \u00b7 ';

export function splitBalanceShortfallLines(message: string): string[] {
  const parts = message.split(BALANCE_SHORTFALL_SEPARATOR);
  return parts.length === 2 ? parts : [message];
}

// Whether the footer hands itself to the remedy. The footer's confirm is
// disabled for exactly as long as the active repay is underfunded, so without
// this the page has no live control at the one moment something has to happen.
// Every other blocking state keeps the plain footer: a retry has its own label,
// a confirming swap has nothing left to press, and a busy or guarded flow
// must not offer a second detour mid-signature.
export function shouldShowFundingFooter({
  canRetryCheck,
  funding,
  isBusy,
  pendingGuardBlocksAction,
  hasUnderfundedActiveRepay,
  hasSwapTarget,
}: {
  canRetryCheck: boolean;
  funding: boolean;
  isBusy: boolean;
  pendingGuardBlocksAction: boolean;
  hasUnderfundedActiveRepay: boolean;
  hasSwapTarget: boolean;
}): boolean {
  return (
    !canRetryCheck &&
    !funding &&
    !isBusy &&
    !pendingGuardBlocksAction &&
    hasUnderfundedActiveRepay &&
    hasSwapTarget
  );
}
