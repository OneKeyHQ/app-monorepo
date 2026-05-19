export type IReferralBindDisplayStatus =
  | 'bind'
  | 'bound'
  | 'notApplicable'
  | 'unknown';

type IReferralBindState = {
  isBound?: boolean;
  bindable?: boolean;
  bindWindowReason?: string;
};

export function canBindReferralCode(
  status: IReferralBindState | null | undefined,
): boolean {
  return Boolean(
    status &&
    !status.isBound &&
    status.bindable === true &&
    !hasExceededBindWindowReason(status),
  );
}

function hasExceededBindWindowReason(
  status: IReferralBindState | null | undefined,
): boolean {
  return status?.bindWindowReason === 'exceeded_bind_window';
}

export function isReferralBindNotApplicable(
  status: IReferralBindState | null | undefined,
): boolean {
  return Boolean(
    status && !status.isBound && hasExceededBindWindowReason(status),
  );
}

export function getReferralBindDisplayStatus(
  status: IReferralBindState | null | undefined,
): IReferralBindDisplayStatus {
  if (status?.isBound) {
    return 'bound';
  }
  if (isReferralBindNotApplicable(status)) {
    return 'notApplicable';
  }
  if (canBindReferralCode(status)) {
    return 'bind';
  }
  return 'unknown';
}
