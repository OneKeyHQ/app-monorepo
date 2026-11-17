import { defaultLogger } from '../logger/logger';

import { generateUUID } from './miscUtils';

import type { IPrimeFreeTrialFeatureId } from '../../types/prime/primeFreeTrialTypes';

export type IPrimeFreeTrialAttemptStage = 'access' | 'execution' | 'retry';
export type IPrimeFreeTrialAttemptResult =
  | 'granted'
  | 'success'
  | 'failed'
  | 'cancelled'
  | 'exhausted'
  | 'notOpen'
  | 'loginRequired'
  | 'contextChanged'
  | 'handedOffToExpandTab'
  | 'unlimited';

export type IPrimeFreeTrialAttemptParams = {
  featureId: IPrimeFreeTrialFeatureId;
  attemptId: string;
  stage: IPrimeFreeTrialAttemptStage;
};
export type IPrimeFreeTrialResultParams = IPrimeFreeTrialAttemptParams & {
  result: IPrimeFreeTrialAttemptResult;
  rejectionSource?: 'client' | 'server';
  // Explicit correction when a late broadcast upgrades an unsettled result.
  previousResult?: IPrimeFreeTrialAttemptResult;
};

// Distinct client events: never impersonate the server's reservation/usage
// events, and never call metering APIs just to collect analytics.
export function createPrimeFreeTrialAttempt({
  featureId,
  attemptId = generateUUID(),
  stage,
}: Omit<IPrimeFreeTrialAttemptParams, 'attemptId'> & { attemptId?: string }) {
  const params = { featureId, attemptId, stage };
  try {
    defaultLogger.prime.subscription.primeFreeTrialAttempt({
      ...params,
      source: 'client',
    });
  } catch {
    // Analytics must never prevent the user's action.
  }
  let finished = false;
  return {
    attemptId,
    finish(
      result: IPrimeFreeTrialAttemptResult,
      rejectionSource?: 'client' | 'server',
    ) {
      if (finished) return;
      finished = true;
      logPrimeFreeTrialResult({
        ...params,
        source: 'client',
        result,
        ...(rejectionSource ? { rejectionSource } : {}),
      });
    },
  };
}

export function logPrimeFreeTrialResult(
  params: IPrimeFreeTrialResultParams & { source: 'client' },
) {
  try {
    defaultLogger.prime.subscription.primeFreeTrialResult(params);
  } catch {
    // Analytics must never affect business execution or quota settlement.
  }
}

export function getPrimeFreeTrialAccessDeniedResult(
  reason: IPrimeFreeTrialAttemptResult | 'loginCancelled' | 'loginFailed',
): IPrimeFreeTrialAttemptResult {
  if (reason === 'loginCancelled') return 'cancelled';
  if (reason === 'loginFailed') return 'failed';
  return reason;
}
