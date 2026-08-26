import { analytics } from '@onekeyhq/shared/src/analytics';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { getSanitizedErrorLogText } from '@onekeyhq/shared/src/utils/sensitiveErrorMessageUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { primePersistAtom } from '../../states/jotai/atoms/prime';

const ANALYTICS_INIT_WAIT_TIMEOUT_MS = timerUtils.getTimeDurationMs({
  seconds: 30,
});

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
const identityLinkInFlight = new Map<string, Promise<void>>();
const identityLinkReportedThisSession = new Set<string>();

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
  identityLinkInFlight.clear();
  identityLinkReportedThisSession.clear();
}

async function waitForAnalyticsInitialized() {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      analytics.whenInitialized(),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new OneKeyLocalError('Analytics init wait timeout'));
        }, ANALYTICS_INIT_WAIT_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
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

async function sendOneKeyIdIdentityLinked({
  simpleDb,
  onekeyUserId,
}: {
  simpleDb: IPrimeAnalyticsStore;
  onekeyUserId: string;
}) {
  try {
    if (identityLinkReportedThisSession.has(onekeyUserId)) {
      return;
    }
    const now = Date.now();
    if (!(await simpleDb.isIdentityLinkDue({ onekeyUserId, now }))) {
      return;
    }
    await waitForAnalyticsInitialized();
    if (identityLinkReportedThisSession.has(onekeyUserId)) {
      return;
    }
    await defaultLogger.prime.subscription.reportOneKeyIdIdentityLinked({
      onekeyUserId,
    });
    await simpleDb.recordIdentityLinkReported({ onekeyUserId, now });
    identityLinkReportedThisSession.add(onekeyUserId);
  } catch (error) {
    defaultLogger.prime.subscription.onekeyIdStateTrace({
      reason: `trackOneKeyIdIdentityLinked failed: ${getSanitizedErrorLogText(
        error,
      )}`,
    });
  }
}

export function trackOneKeyIdIdentityLinked({
  simpleDb,
  onekeyUserId,
}: {
  simpleDb: IPrimeAnalyticsStore;
  onekeyUserId: string | undefined;
}): Promise<void> {
  if (!onekeyUserId || identityLinkReportedThisSession.has(onekeyUserId)) {
    return Promise.resolve();
  }
  const existing = identityLinkInFlight.get(onekeyUserId);
  if (existing) {
    return existing;
  }
  const task = sendOneKeyIdIdentityLinked({ simpleDb, onekeyUserId }).finally(
    () => {
      identityLinkInFlight.delete(onekeyUserId);
    },
  );
  identityLinkInFlight.set(onekeyUserId, task);
  return task;
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
      return;
    }
    // Web LastActivityTracker inits analytics after a 3s delay. Wait so a
    // startup false:false report is not dropped, then re-read so a login
    // that landed during the wait still wins.
    await waitForAnalyticsInitialized();
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
