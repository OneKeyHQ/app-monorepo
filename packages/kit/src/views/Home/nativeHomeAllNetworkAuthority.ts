export interface INativeHomeAllNetworkScopedResponse {
  isSameAllNetworksAccountData?: boolean;
}

export interface INativeHomeAllNetworkRequestOutcome {
  attemptCount: number;
  failureCount: number;
  successCount: number;
}

export function createNativeHomeAllNetworkRequestOutcome(): INativeHomeAllNetworkRequestOutcome {
  return {
    attemptCount: 0,
    failureCount: 0,
    successCount: 0,
  };
}

export function isNativeHomeAllNetworkResponseAuthoritative(
  response: INativeHomeAllNetworkScopedResponse,
): boolean {
  return response.isSameAllNetworksAccountData !== false;
}

export function recordNativeHomeAllNetworkResponse(
  outcome: INativeHomeAllNetworkRequestOutcome,
  response: INativeHomeAllNetworkScopedResponse,
): INativeHomeAllNetworkRequestOutcome {
  const authoritative = isNativeHomeAllNetworkResponseAuthoritative(response);
  return {
    attemptCount: outcome.attemptCount + 1,
    failureCount: outcome.failureCount + (authoritative ? 0 : 1),
    successCount: outcome.successCount + (authoritative ? 1 : 0),
  };
}

export function recordNativeHomeAllNetworkFailure(
  outcome: INativeHomeAllNetworkRequestOutcome,
): INativeHomeAllNetworkRequestOutcome {
  return {
    attemptCount: outcome.attemptCount + 1,
    failureCount: outcome.failureCount + 1,
    successCount: outcome.successCount,
  };
}

export function filterNativeHomeAllNetworkAuthoritativeResponses<
  T extends INativeHomeAllNetworkScopedResponse,
>(responses: T[]): T[] {
  return responses.filter(isNativeHomeAllNetworkResponseAuthoritative);
}

export function resolveNativeHomeAllNetworkAuthorityStatus({
  emptyAccountsResolved,
  expectedRequestCount,
  outcome,
  startedSucceeded,
}: {
  emptyAccountsResolved: boolean;
  expectedRequestCount: number;
  outcome: INativeHomeAllNetworkRequestOutcome;
  startedSucceeded: boolean;
}): 'success' | 'error' {
  if (!startedSucceeded) {
    return 'error';
  }
  if (emptyAccountsResolved) {
    return expectedRequestCount === 0 ? 'success' : 'error';
  }
  return expectedRequestCount > 0 &&
    outcome.attemptCount === expectedRequestCount &&
    outcome.failureCount === 0 &&
    outcome.successCount === expectedRequestCount
    ? 'success'
    : 'error';
}
