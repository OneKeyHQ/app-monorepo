let latestReferralLandingRequestId = 0;

export function createReferralLandingRequestId() {
  latestReferralLandingRequestId += 1;
  return latestReferralLandingRequestId;
}

export function isReferralLandingRequestActive(requestId?: number) {
  return !requestId || requestId === latestReferralLandingRequestId;
}
