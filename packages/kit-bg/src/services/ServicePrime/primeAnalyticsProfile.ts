import { analytics } from '@onekeyhq/shared/src/analytics';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { getSanitizedErrorLogText } from '@onekeyhq/shared/src/utils/sensitiveErrorMessageUtils';

import { primePersistAtom } from '../../states/jotai/atoms/prime';

export type IPrimeAnalyticsProfileSnapshot = {
  isOneKeyIdLoggedIn: boolean;
  isPrimeActive: boolean;
  profileKey: string;
};

export type IPrimeAnalyticsStore = {
  isIdentityLinkDue: (params: {
    onekeyUserId: string;
    now: number;
  }) => Promise<boolean>;
  recordIdentityLinkReported: (params: {
    onekeyUserId: string;
    now: number;
  }) => Promise<void>;
  isPrimeProfileDue: (params: {
    isOneKeyIdLoggedIn: boolean;
    isPrimeActive: boolean;
    now: number;
  }) => Promise<boolean>;
  recordPrimeProfileReported: (params: {
    isOneKeyIdLoggedIn: boolean;
    isPrimeActive: boolean;
    now: number;
  }) => Promise<void>;
};

let lastHandledPrimeProfileKey: string | undefined;
let primeProfileReportChain: Promise<void> = Promise.resolve();

export function buildPrimeAnalyticsProfileSnapshot({
  isLoggedIn,
  isLoggedInOnServer,
  isPrimeSubscriptionActive,
}: {
  isLoggedIn: boolean | undefined;
  isLoggedInOnServer: boolean | undefined;
  isPrimeSubscriptionActive: boolean | undefined;
}): IPrimeAnalyticsProfileSnapshot {
  const isOneKeyIdLoggedIn = Boolean(isLoggedIn && isLoggedInOnServer);
  const isPrimeActive = Boolean(
    isOneKeyIdLoggedIn && isPrimeSubscriptionActive,
  );
  return {
    isOneKeyIdLoggedIn,
    isPrimeActive,
    profileKey: `${isOneKeyIdLoggedIn}:${isPrimeActive}`,
  };
}

export function resetPrimeAnalyticsReporterForTests() {
  lastHandledPrimeProfileKey = undefined;
  primeProfileReportChain = Promise.resolve();
}

async function readPrimeAnalyticsProfileSnapshot() {
  const { isLoggedIn, isLoggedInOnServer, primeSubscription } =
    await primePersistAtom.get();
  return buildPrimeAnalyticsProfileSnapshot({
    isLoggedIn,
    isLoggedInOnServer,
    isPrimeSubscriptionActive: primeSubscription?.isActive,
  });
}

export async function trackOneKeyIdIdentityLinked({
  simpleDb,
  onekeyUserId,
}: {
  simpleDb: IPrimeAnalyticsStore;
  onekeyUserId: string | undefined;
}) {
  if (!onekeyUserId) {
    return;
  }
  try {
    const now = Date.now();
    if (!(await simpleDb.isIdentityLinkDue({ onekeyUserId, now }))) {
      return;
    }
    await defaultLogger.prime.subscription.reportOneKeyIdIdentityLinked({
      onekeyUserId,
    });
    await simpleDb.recordIdentityLinkReported({ onekeyUserId, now });
  } catch (error) {
    defaultLogger.prime.subscription.onekeyIdStateTrace({
      reason: `trackOneKeyIdIdentityLinked failed: ${getSanitizedErrorLogText(
        error,
      )}`,
    });
  }
}

async function reportPrimeProfileToAnalytics(simpleDb: IPrimeAnalyticsStore) {
  try {
    const snapshot = await readPrimeAnalyticsProfileSnapshot();
    if (lastHandledPrimeProfileKey === snapshot.profileKey) {
      return;
    }
    const now = Date.now();
    if (
      !(await simpleDb.isPrimeProfileDue({
        isOneKeyIdLoggedIn: snapshot.isOneKeyIdLoggedIn,
        isPrimeActive: snapshot.isPrimeActive,
        now,
      }))
    ) {
      lastHandledPrimeProfileKey = snapshot.profileKey;
      return;
    }
    // Web LastActivityTracker inits analytics after a 3s delay. Wait so a
    // startup false:false report is not dropped, then re-read so a login
    // that landed during the wait still wins.
    await analytics.whenInitialized();
    const confirmed = await readPrimeAnalyticsProfileSnapshot();
    if (confirmed.profileKey !== snapshot.profileKey) {
      return;
    }
    await analytics.updateUserProfileAsync({
      isOneKeyIdLoggedIn: confirmed.isOneKeyIdLoggedIn,
      isPrimeActive: confirmed.isPrimeActive,
    });
    await simpleDb.recordPrimeProfileReported({
      isOneKeyIdLoggedIn: confirmed.isOneKeyIdLoggedIn,
      isPrimeActive: confirmed.isPrimeActive,
      now,
    });
    lastHandledPrimeProfileKey = confirmed.profileKey;
  } catch (error) {
    defaultLogger.prime.subscription.onekeyIdStateTrace({
      reason: `reportPrimeProfileToAnalytics failed: ${getSanitizedErrorLogText(
        error,
      )}`,
    });
  }
}

export function enqueuePrimeProfileAnalyticsReport({
  simpleDb,
}: {
  simpleDb: IPrimeAnalyticsStore;
}): Promise<void> {
  primeProfileReportChain = primeProfileReportChain
    .then(() => reportPrimeProfileToAnalytics(simpleDb))
    .catch(() => undefined);
  return primeProfileReportChain;
}
