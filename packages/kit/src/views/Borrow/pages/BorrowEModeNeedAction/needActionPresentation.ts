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
}: {
  active: boolean;
  approveSubStatus: IApproveSubStatus;
  confirming: boolean;
  waitingSwitchUnlock: boolean;
  kind: ICompactStepKind;
  hasWalletBalance: boolean;
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
  if (kind === 'repay' && hasWalletBalance) {
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
