let latestReferralLandingRequestId = 0;

export function createReferralLandingRequestId() {
  latestReferralLandingRequestId += 1;
  return latestReferralLandingRequestId;
}

export function isReferralLandingRequestActive(requestId?: number) {
  return !requestId || requestId === latestReferralLandingRequestId;
}

export function createReferralLandingRequestGuard({
  requestId,
  shouldContinue,
}: {
  requestId?: number;
  shouldContinue?: () => boolean;
} = {}) {
  const currentRequestId = requestId ?? createReferralLandingRequestId();
  return {
    requestId: currentRequestId,
    shouldContinue: () =>
      isReferralLandingRequestActive(currentRequestId) &&
      (shouldContinue?.() ?? true),
  };
}
