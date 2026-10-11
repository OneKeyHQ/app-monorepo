import { EPrimeFeatures } from '@onekeyhq/shared/src/routes/prime';
import type {
  IPrimeFreeTrialPublicConfig,
  IPrimeFreeTrialQuota,
} from '@onekeyhq/shared/types/prime/primeFreeTrialTypes';

import {
  getPrimeFreeTrialQuotaOfUser,
  resolvePrimeFreeTrialAccess,
} from './primeFreeTrialAccess';

const openConfig: IPrimeFreeTrialPublicConfig = {
  enabled: true,
  features: [
    {
      featureId: EPrimeFeatures.BulkSend,
      unit: 'count',
      monthlyQuota: 1,
    },
  ],
};

function buildQuota(remaining: number): IPrimeFreeTrialQuota {
  return {
    period: '2026-10',
    resetAt: 1_793_491_200_000,
    features: [
      {
        featureId: EPrimeFeatures.BulkSend,
        unit: 'count',
        monthlyQuota: 1,
        used: 1 - remaining,
        remaining,
      },
    ],
  };
}

describe('resolvePrimeFreeTrialAccess', () => {
  it('lets Prime users in without looking at the free trial', () => {
    expect(
      resolvePrimeFreeTrialAccess({
        featureId: EPrimeFeatures.BulkSend,
        isPrimeSubscriptionActive: true,
        isLoggedIn: true,
        config: { enabled: false, features: [] },
        quota: buildQuota(0),
      }),
    ).toEqual({ status: 'prime' });
  });

  it('asks logged-out users to log in when the trial is open or unknown', () => {
    for (const config of [openConfig, undefined]) {
      expect(
        resolvePrimeFreeTrialAccess({
          featureId: EPrimeFeatures.BulkSend,
          isPrimeSubscriptionActive: false,
          isLoggedIn: false,
          config,
          quota: undefined,
        }),
      ).toEqual({ status: 'loginRequired' });
    }
  });

  it('treats a closed switch or a missing feature as not open', () => {
    const configs: IPrimeFreeTrialPublicConfig[] = [
      { enabled: false, features: [] },
      {
        enabled: true,
        features: [
          {
            featureId: EPrimeFeatures.BulkRevoke,
            unit: 'count',
            monthlyQuota: 1,
          },
        ],
      },
    ];
    for (const config of configs) {
      expect(
        resolvePrimeFreeTrialAccess({
          featureId: EPrimeFeatures.BulkSend,
          isPrimeSubscriptionActive: false,
          isLoggedIn: false,
          config,
          quota: undefined,
        }),
      ).toEqual({ status: 'notOpen' });
    }
  });

  it('reports an exhausted quota with its reset time', () => {
    const quota = buildQuota(0);
    expect(
      resolvePrimeFreeTrialAccess({
        featureId: EPrimeFeatures.BulkSend,
        isPrimeSubscriptionActive: false,
        isLoggedIn: true,
        config: undefined,
        quota,
      }),
    ).toEqual({
      status: 'exhausted',
      featureQuota: quota.features[0],
      resetAt: quota.resetAt,
    });
  });

  it('lets a logged-in free user in when the quota is unknown', () => {
    expect(
      resolvePrimeFreeTrialAccess({
        featureId: EPrimeFeatures.BulkSend,
        isPrimeSubscriptionActive: false,
        isLoggedIn: true,
        config: undefined,
        quota: undefined,
      }),
    ).toEqual({ status: 'available', featureQuota: undefined });
  });

  it('treats a feature missing from the quota list as not open', () => {
    expect(
      resolvePrimeFreeTrialAccess({
        featureId: EPrimeFeatures.AddressRiskCheck,
        isPrimeSubscriptionActive: false,
        isLoggedIn: true,
        config: undefined,
        quota: buildQuota(1),
      }),
    ).toEqual({ status: 'notOpen' });
  });

  it('does not treat a null quota as exhausted', () => {
    expect(
      resolvePrimeFreeTrialAccess({
        featureId: EPrimeFeatures.BulkSend,
        isPrimeSubscriptionActive: false,
        isLoggedIn: true,
        config: undefined,
        quota: null,
      }).status,
    ).toBe('available');
    expect(
      resolvePrimeFreeTrialAccess({
        featureId: EPrimeFeatures.BulkSend,
        isPrimeSubscriptionActive: false,
        isLoggedIn: true,
        config: { enabled: false, features: [] },
        quota: null,
      }).status,
    ).toBe('notOpen');
  });
});

describe('getPrimeFreeTrialQuotaOfUser', () => {
  it('never returns another account quota', () => {
    const quota = buildQuota(1);
    expect(
      getPrimeFreeTrialQuotaOfUser({
        quota: { status: 'success', onekeyUserId: 'user-a', data: quota },
        onekeyUserId: 'user-b',
        now: quota.resetAt - 1,
      }),
    ).toBeUndefined();
    expect(
      getPrimeFreeTrialQuotaOfUser({
        quota: { status: 'success', onekeyUserId: 'user-a', data: quota },
        onekeyUserId: 'user-a',
        now: quota.resetAt - 1,
      }),
    ).toBe(quota);
  });

  it('treats the quota of a month that has reset as unknown', () => {
    const quota = buildQuota(0);
    expect(
      getPrimeFreeTrialQuotaOfUser({
        quota: { status: 'success', onekeyUserId: 'user-a', data: quota },
        onekeyUserId: 'user-a',
        now: quota.resetAt,
      }),
    ).toBeUndefined();
  });
});
