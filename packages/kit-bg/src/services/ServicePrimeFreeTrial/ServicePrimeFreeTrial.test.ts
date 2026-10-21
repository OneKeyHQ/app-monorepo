import {
  OneKeyErrorPrimeLoginExceedDeviceLimit,
  OneKeyErrorPrimeLoginInvalidToken,
  OneKeyErrorPrimePaidMembershipRequired,
  OneKeyServerApiError,
} from '@onekeyhq/shared/src/errors';
import { EPrimeFeatures } from '@onekeyhq/shared/src/routes/prime';
import type {
  IPrimeFreeTrialAtomData,
  IPrimeFreeTrialFeatureQuota,
  IPrimeFreeTrialPendingAction,
  IPrimeFreeTrialQuota,
  IPrimeFreeTrialUsageRecord,
} from '@onekeyhq/shared/types/prime/primeFreeTrialTypes';
import {
  EPrimeFreeTrialPendingActionType,
  PRIME_FREE_TRIAL_NOT_OPEN_CODE,
  PRIME_FREE_TRIAL_QUOTA_EXHAUSTED_CODE,
} from '@onekeyhq/shared/types/prime/primeFreeTrialTypes';

import ServicePrimeFreeTrial from './ServicePrimeFreeTrial';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => () => undefined,
  backgroundMethod: () => (_t: unknown, _k: unknown, d: PropertyDescriptor) =>
    d,
}));

const mockTrialResult = jest.fn();
const mockOneKeyIdClient = {
  get: jest.fn(),
  post: jest.fn(),
};
const mockPlainClient = {
  get: jest.fn(),
};

jest.mock('../ServiceBase', () => ({
  __esModule: true,
  default: class ServiceBase {
    backgroundApi: any;

    constructor({ backgroundApi }: { backgroundApi: any }) {
      this.backgroundApi = backgroundApi;
    }

    async getClient() {
      return mockPlainClient;
    }

    async getOneKeyIdClient() {
      return mockOneKeyIdClient;
    }
  },
}));

type IMockUser = {
  isLoggedIn: boolean;
  isLoggedInOnServer: boolean;
  onekeyUserId?: string;
  primeSubscription?: { isActive: boolean };
};

const mockState: {
  user: IMockUser;
  freeTrial: IPrimeFreeTrialAtomData;
} = {
  user: { isLoggedIn: false, isLoggedInOnServer: false },
  freeTrial: { config: { status: 'idle' }, quota: { status: 'idle' } },
};

jest.mock('../../states/jotai/atoms/prime', () => ({
  primePersistAtom: {
    get: async () => mockState.user,
  },
  primeFreeTrialAtom: {
    get: async () => mockState.freeTrial,
    set: async (
      updater: (v: IPrimeFreeTrialAtomData) => IPrimeFreeTrialAtomData,
    ) => {
      mockState.freeTrial = updater(mockState.freeTrial);
    },
  },
  primeFreeTrialAtomInitialValue: {
    config: { status: 'idle' },
    quota: { status: 'idle' },
  },
}));

const mockDevSettings = { enabled: true };

jest.mock('../../states/jotai/atoms/devSettings', () => ({
  devSettingsPersistAtom: {
    get: async () => mockDevSettings,
  },
}));

jest.mock('@onekeyhq/shared/src/travelMode', () => ({
  travelModeManager: {
    getRuntimeEnvironment: async () => ({ profile: { kind: 'standard' } }),
  },
}));

jest.mock('@onekeyhq/shared/src/utils/timerUtils', () => ({
  __esModule: true,
  default: {
    wait: async () => undefined,
    getTimeDurationMs: () => 0,
  },
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => {
  const noopLogger = new Proxy(jest.fn(), {
    apply: () => undefined,
    get: (_target, key) =>
      key === 'primeFreeTrialResult' ? mockTrialResult : noopLogger,
  });
  return { defaultLogger: noopLogger };
});

function recordKey(record: {
  onekeyUserId: string;
  featureId: string;
  usageId: string;
}) {
  return `${record.onekeyUserId}__${record.featureId}__${record.usageId}`;
}

function createSimpleDbMock() {
  const records = new Map<string, IPrimeFreeTrialUsageRecord>();
  let pendingAction: IPrimeFreeTrialPendingAction | undefined;
  return {
    records,
    entity: {
      getUsageRecords: jest.fn(async () => [...records.values()]),
      updateUsageRecord: jest.fn(
        async (
          key: { onekeyUserId: string; featureId: string; usageId: string },
          updater: (
            record: IPrimeFreeTrialUsageRecord | undefined,
          ) => IPrimeFreeTrialUsageRecord | undefined,
        ) => {
          const next = updater(records.get(recordKey(key)));
          if (next) {
            records.set(recordKey(key), next);
          } else {
            records.delete(recordKey(key));
          }
          return next;
        },
      ),
      deleteUsageRecordsOfUser: jest.fn(
        async ({ onekeyUserId }: { onekeyUserId: string }) => {
          [...records.entries()].forEach(([key, record]) => {
            if (record.onekeyUserId === onekeyUserId) {
              records.delete(key);
            }
          });
        },
      ),
      getPendingAction: jest.fn(async () => pendingAction),
      setPendingAction: jest.fn(
        async (action: IPrimeFreeTrialPendingAction) => {
          pendingAction = action;
        },
      ),
      clearPendingAction: jest.fn(
        async (predicate?: (a: IPrimeFreeTrialPendingAction) => boolean) => {
          if (pendingAction && predicate && !predicate(pendingAction)) {
            return;
          }
          pendingAction = undefined;
        },
      ),
    },
  };
}

function createService() {
  const simpleDb = createSimpleDbMock();
  const servicePrime = {
    captureOneKeyIdAuthRequestConfig: jest.fn(
      async ({
        expectedOneKeyUserId,
        createStateChangedError,
      }: {
        expectedOneKeyUserId: string;
        createStateChangedError: () => Error;
      }) => {
        if (mockState.user.onekeyUserId !== expectedOneKeyUserId) {
          throw createStateChangedError();
        }
        return {
          snapshot: { expectedOneKeyUserId },
          requestConfig: { headers: { 'X-Onekey-Request-Token': 't' } },
        };
      },
    ),
    assertOneKeyIdAuthSnapshotUnchanged: jest.fn(
      async (_params: {
        snapshot: { expectedOneKeyUserId: string };
        createStateChangedError: () => Error;
      }) => undefined,
    ),
    apiFetchPrimeUserInfo: jest.fn(async () => undefined),
  };
  const service = new ServicePrimeFreeTrial({
    backgroundApi: {
      servicePrime,
      simpleDb: { primeFreeTrial: simpleDb.entity },
    },
  });
  return { service, simpleDb, servicePrime };
}

async function flushPromises() {
  for (let i = 0; i < 20; i += 1) {
    await new Promise((resolve) => {
      setImmediate(resolve);
    });
  }
}

function serverError(code: number, data?: unknown) {
  return new OneKeyServerApiError({
    code,
    message: `server ${code}`,
    data: { code, message: `server ${code}`, data } as never,
    httpStatusCode: 200,
  });
}

function networkError() {
  return new Error('Network Error');
}

const quotaOfBulkSend: IPrimeFreeTrialFeatureQuota = {
  featureId: EPrimeFeatures.BulkSend,
  unit: 'count',
  monthlyQuota: 1,
  used: 1,
  remaining: 0,
};

function finishCalls(): Array<[string, Record<string, unknown>, unknown]> {
  return (
    mockOneKeyIdClient.post.mock.calls as Array<
      [string, Record<string, unknown>, unknown]
    >
  ).filter(([url]) => url === '/prime/v1/free-trial/usage/finish');
}

describe('ServicePrimeFreeTrial', () => {
  beforeEach(() => {
    jest.useFakeTimers({
      doNotFake: ['setImmediate', 'nextTick', 'queueMicrotask'],
    });
    mockOneKeyIdClient.get.mockReset();
    mockOneKeyIdClient.post.mockReset();
    mockPlainClient.get.mockReset();
    mockState.user = {
      isLoggedIn: true,
      isLoggedInOnServer: true,
      onekeyUserId: 'user-a',
      primeSubscription: { isActive: false },
    };
    mockState.freeTrial = {
      config: { status: 'idle' },
      quota: { status: 'idle' },
    };
    mockDevSettings.enabled = true;
    mockOneKeyIdClient.get.mockResolvedValue({ data: { code: 0, data: null } });
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('startUsage', () => {
    it('reserves a use and keeps a durable record with the expiry', async () => {
      const { service, simpleDb } = createService();
      mockOneKeyIdClient.post.mockResolvedValueOnce({
        data: {
          code: 0,
          data: {
            unlimited: false,
            featureId: EPrimeFeatures.BulkSend,
            usageId: 'usage-0001',
            quota: quotaOfBulkSend,
            expiresAt: 1000,
            resetAt: 2000,
          },
        },
      });

      const result = await service.startUsage({
        featureId: EPrimeFeatures.BulkSend,
        usageId: 'usage-0001',
      });

      expect(result).toMatchObject({
        status: 'granted',
        usageId: 'usage-0001',
      });
      const record = simpleDb.records.get('user-a__BulkSend__usage-0001');
      expect(record).toMatchObject({ expiresAt: 1000 });
      expect(record?.result).toBeUndefined();
    });

    it('returns exhausted for 90600 without throwing', async () => {
      const { service } = createService();
      mockOneKeyIdClient.post.mockRejectedValueOnce(
        serverError(PRIME_FREE_TRIAL_QUOTA_EXHAUSTED_CODE, {
          ...quotaOfBulkSend,
          resetAt: 2000,
        }),
      );

      const result = await service.startUsage({
        featureId: EPrimeFeatures.BulkSend,
        usageId: 'usage-0002',
      });

      expect(result).toMatchObject({
        status: 'exhausted',
        featureId: EPrimeFeatures.BulkSend,
        data: { featureId: EPrimeFeatures.BulkSend, remaining: 0 },
      });
    });

    it('keeps the 90600 of a start off the quota of a user who logged in meanwhile', async () => {
      const { service } = createService();
      mockState.freeTrial = {
        config: { status: 'idle' },
        quota: {
          status: 'success',
          onekeyUserId: 'user-b',
          data: {
            period: '2026-10',
            resetAt: 2000,
            features: [{ ...quotaOfBulkSend, used: 0, remaining: 1 }],
          },
        },
      };
      mockOneKeyIdClient.post.mockImplementationOnce(async () => {
        mockState.user = { ...mockState.user, onekeyUserId: 'user-b' };
        throw serverError(PRIME_FREE_TRIAL_QUOTA_EXHAUSTED_CODE, {
          ...quotaOfBulkSend,
          resetAt: 2000,
        });
      });

      await expect(
        service.startUsage({
          featureId: EPrimeFeatures.BulkSend,
          usageId: 'usage-0031',
        }),
      ).resolves.toMatchObject({ status: 'exhausted' });
      expect(mockState.freeTrial.quota.data?.features[0].remaining).toBe(1);
    });

    it('treats the rewritten 90005 and a raw 90601 as not open', async () => {
      const { service } = createService();
      mockOneKeyIdClient.post
        .mockRejectedValueOnce(new OneKeyErrorPrimePaidMembershipRequired())
        .mockRejectedValueOnce(serverError(PRIME_FREE_TRIAL_NOT_OPEN_CODE));

      await expect(
        service.startUsage({
          featureId: EPrimeFeatures.BulkRevoke,
          usageId: 'usage-0003',
        }),
      ).resolves.toEqual({
        status: 'notOpen',
        featureId: EPrimeFeatures.BulkRevoke,
      });
      await expect(
        service.startUsage({
          featureId: EPrimeFeatures.BulkRevoke,
          usageId: 'usage-0004',
        }),
      ).resolves.toEqual({
        status: 'notOpen',
        featureId: EPrimeFeatures.BulkRevoke,
      });
    });

    it('retries the same id and releases it with cancelled when still unknown', async () => {
      const { service } = createService();
      mockOneKeyIdClient.post.mockImplementation(async (url: string) => {
        if (url === '/prime/v1/free-trial/usage/start') {
          throw networkError();
        }
        return { data: { code: 0, data: { unlimited: false } } };
      });

      await expect(
        service.startUsage({
          featureId: EPrimeFeatures.BulkSend,
          usageId: 'usage-0005',
        }),
      ).rejects.toThrow('Network Error');
      await flushPromises();

      const startCalls = mockOneKeyIdClient.post.mock.calls.filter(
        ([url]) => url === '/prime/v1/free-trial/usage/start',
      );
      expect(startCalls).toHaveLength(3);
      startCalls.forEach(([, body]) =>
        expect(body).toEqual({
          featureId: EPrimeFeatures.BulkSend,
          usageId: 'usage-0005',
        }),
      );
      expect(finishCalls()).toEqual([
        [
          '/prime/v1/free-trial/usage/finish',
          {
            featureId: EPrimeFeatures.BulkSend,
            usageId: 'usage-0005',
            result: 'cancelled',
          },
          expect.anything(),
        ],
      ]);
    });

    it('never starts for a local Prime user', async () => {
      const { service } = createService();
      mockState.user.primeSubscription = { isActive: true };

      await expect(
        service.startUsage({
          featureId: EPrimeFeatures.BulkSend,
          usageId: 'usage-0007',
        }),
      ).resolves.toEqual({ status: 'unlimited' });
      expect(mockOneKeyIdClient.post).not.toHaveBeenCalled();
    });

    it('asks for a login instead of failing silently', async () => {
      const { service } = createService();
      mockState.user = { isLoggedIn: false, isLoggedInOnServer: false };

      await expect(
        service.startUsage({
          featureId: EPrimeFeatures.BulkCopyAddresses,
          usageId: 'usage-0008',
        }),
      ).resolves.toEqual({
        status: 'loginRequired',
        featureId: EPrimeFeatures.BulkCopyAddresses,
      });
      expect(mockOneKeyIdClient.post).not.toHaveBeenCalled();
    });

    it('releases a possibly held reservation when a later attempt fails definitively', async () => {
      const { service } = createService();
      let startCount = 0;
      mockOneKeyIdClient.post.mockImplementation(async (url: string) => {
        if (url === '/prime/v1/free-trial/usage/start') {
          startCount += 1;
          throw startCount === 1 ? networkError() : serverError(90_001);
        }
        return { data: { code: 0, data: { unlimited: false } } };
      });

      await expect(
        service.startUsage({
          featureId: EPrimeFeatures.BulkSend,
          usageId: 'usage-0009',
        }),
      ).rejects.toBeTruthy();
      await flushPromises();

      expect(startCount).toBe(2);
      expect(finishCalls()).toEqual([
        [
          '/prime/v1/free-trial/usage/finish',
          {
            featureId: EPrimeFeatures.BulkSend,
            usageId: 'usage-0009',
            result: 'cancelled',
          },
          expect.anything(),
        ],
      ]);
    });

    it('releases a possibly held reservation when a later attempt says not open', async () => {
      const { service } = createService();
      let startCount = 0;
      mockOneKeyIdClient.post.mockImplementation(async (url: string) => {
        if (url === '/prime/v1/free-trial/usage/start') {
          startCount += 1;
          throw startCount === 1
            ? networkError()
            : serverError(PRIME_FREE_TRIAL_NOT_OPEN_CODE);
        }
        return { data: { code: 0, data: { unlimited: false } } };
      });

      await expect(
        service.startUsage({
          featureId: EPrimeFeatures.BulkSend,
          usageId: 'usage-0010',
        }),
      ).resolves.toMatchObject({ status: 'notOpen' });
      await flushPromises();

      expect(finishCalls()).toEqual([
        [
          '/prime/v1/free-trial/usage/finish',
          expect.objectContaining({
            usageId: 'usage-0010',
            result: 'cancelled',
          }),
          expect.anything(),
        ],
      ]);
    });

    it('releases a possibly held reservation when a later attempt says exhausted', async () => {
      const { service } = createService();
      let startCount = 0;
      mockOneKeyIdClient.post.mockImplementation(async (url: string) => {
        if (url === '/prime/v1/free-trial/usage/start') {
          startCount += 1;
          throw startCount === 1
            ? networkError()
            : serverError(PRIME_FREE_TRIAL_QUOTA_EXHAUSTED_CODE, {
                ...quotaOfBulkSend,
                resetAt: 2000,
              });
        }
        return { data: { code: 0, data: { unlimited: false } } };
      });

      await expect(
        service.startUsage({
          featureId: EPrimeFeatures.BulkSend,
          usageId: 'usage-0017',
        }),
      ).resolves.toMatchObject({ status: 'exhausted' });

      // Reported before the result returns, so the feedback does not take
      // this id for a held reservation.
      expect(finishCalls()).toEqual([
        [
          '/prime/v1/free-trial/usage/finish',
          expect.objectContaining({
            usageId: 'usage-0017',
            result: 'cancelled',
          }),
          expect.anything(),
        ],
      ]);
      await expect(
        service.getHeldReservationEnd({ featureId: EPrimeFeatures.BulkSend }),
      ).resolves.toBeUndefined();
    });

    it('never runs unmetered on a start reply without a grant', async () => {
      const { service } = createService();
      mockOneKeyIdClient.post.mockImplementation(async (url: string) => {
        if (url === '/prime/v1/free-trial/usage/start') {
          return { data: { code: 0, data: null } };
        }
        return { data: { code: 0, data: { unlimited: false } } };
      });

      await expect(
        service.startUsage({
          featureId: EPrimeFeatures.BulkSend,
          usageId: 'usage-0020',
        }),
      ).rejects.toThrow('Invalid free trial start response');
      await flushPromises();

      const startCalls = mockOneKeyIdClient.post.mock.calls.filter(
        ([url]) => url === '/prime/v1/free-trial/usage/start',
      );
      expect(startCalls).toHaveLength(3);
      expect(finishCalls()).toEqual([
        [
          '/prime/v1/free-trial/usage/finish',
          expect.objectContaining({
            usageId: 'usage-0020',
            result: 'cancelled',
          }),
          expect.anything(),
        ],
      ]);
    });

    describe('another user logged in during the start', () => {
      function switchUserDuringStart(
        servicePrime: ReturnType<typeof createService>['servicePrime'],
        startData: unknown,
      ) {
        servicePrime.assertOneKeyIdAuthSnapshotUnchanged.mockImplementation(
          async ({ snapshot, createStateChangedError }) => {
            if (mockState.user.onekeyUserId !== snapshot.expectedOneKeyUserId) {
              throw createStateChangedError();
            }
            return undefined;
          },
        );
        mockOneKeyIdClient.post.mockImplementation(async (url: string) => {
          if (url === '/prime/v1/free-trial/usage/start') {
            mockState.user = {
              isLoggedIn: true,
              isLoggedInOnServer: true,
              onekeyUserId: 'user-b',
              primeSubscription: { isActive: false },
            };
            return { data: { code: 0, data: startData } };
          }
          return { data: { code: 0, data: { unlimited: false } } };
        });
      }

      it('releases the grant as the user that started instead of running', async () => {
        const { service, simpleDb, servicePrime } = createService();
        switchUserDuringStart(servicePrime, {
          unlimited: false,
          featureId: EPrimeFeatures.BulkSend,
          usageId: 'usage-0021',
          quota: quotaOfBulkSend,
          expiresAt: 1000,
          resetAt: 2000,
        });

        await expect(
          service.startUsage({
            featureId: EPrimeFeatures.BulkSend,
            usageId: 'usage-0021',
          }),
        ).rejects.toThrow('Prime free trial user changed');
        await flushPromises();

        // Never reported as user-b.
        expect(finishCalls()).toHaveLength(0);
        expect(
          simpleDb.records.get('user-a__BulkSend__usage-0021'),
        ).toMatchObject({ result: 'cancelled' });

        mockState.user = {
          isLoggedIn: true,
          isLoggedInOnServer: true,
          onekeyUserId: 'user-a',
          primeSubscription: { isActive: false },
        };
        await service.flushPendingReports({ force: true });
        await flushPromises();
        expect(finishCalls()).toEqual([
          [
            '/prime/v1/free-trial/usage/finish',
            expect.objectContaining({
              usageId: 'usage-0021',
              result: 'cancelled',
            }),
            expect.anything(),
          ],
        ]);
      });

      it('releases a reply without a grant as the user that started', async () => {
        const { service, simpleDb, servicePrime } = createService();
        switchUserDuringStart(servicePrime, null);

        await expect(
          service.startUsage({
            featureId: EPrimeFeatures.BulkSend,
            usageId: 'usage-0023',
          }),
        ).rejects.toThrow('Prime free trial user changed');
        await flushPromises();

        // Whether it reserved is unknown: released, never reported as user-b.
        expect(
          simpleDb.records.get('user-a__BulkSend__usage-0023'),
        ).toMatchObject({ result: 'cancelled' });
        expect(finishCalls()).toHaveLength(0);
      });

      it('does not run unmetered on the Prime of the user that started', async () => {
        const { service, simpleDb, servicePrime } = createService();
        switchUserDuringStart(servicePrime, { unlimited: true });

        await expect(
          service.startUsage({
            featureId: EPrimeFeatures.BulkSend,
            usageId: 'usage-0022',
          }),
        ).rejects.toThrow('Prime free trial user changed');
        expect(simpleDb.records.size).toBe(0);
      });
    });

    it('does not release anything when the first attempt is already definitive', async () => {
      const { service } = createService();
      mockOneKeyIdClient.post.mockRejectedValue(serverError(90_001));

      await expect(
        service.startUsage({
          featureId: EPrimeFeatures.BulkSend,
          usageId: 'usage-0011',
        }),
      ).rejects.toBeTruthy();
      await flushPromises();

      expect(finishCalls()).toEqual([]);
    });

    describe('exhausted by a release of this device', () => {
      function seedSettledUsage(
        simpleDb: ReturnType<typeof createSimpleDbMock>,
        usageId: string,
      ) {
        simpleDb.records.set(
          recordKey({
            onekeyUserId: 'user-a',
            featureId: EPrimeFeatures.BulkSend,
            usageId,
          }),
          {
            onekeyUserId: 'user-a',
            featureId: EPrimeFeatures.BulkSend,
            usageId,
            startedAt: Date.now(),
            expiresAt: Date.now() + 30 * 60 * 1000,
            result: 'failed',
            resultAt: Date.now(),
            reportAttempts: 0,
          },
        );
      }

      const grantedStart = {
        data: {
          code: 0,
          data: {
            unlimited: false,
            featureId: EPrimeFeatures.BulkSend,
            usageId: 'usage-0013',
            quota: { ...quotaOfBulkSend, used: 1, remaining: 0 },
            expiresAt: 1000,
            resetAt: 2000,
          },
        },
      };

      it('confirms the pending release, then asks once more', async () => {
        const { service, simpleDb } = createService();
        seedSettledUsage(simpleDb, 'usage-0012');
        let startCount = 0;
        mockOneKeyIdClient.post.mockImplementation(async (url: string) => {
          if (url === '/prime/v1/free-trial/usage/start') {
            startCount += 1;
            if (startCount === 1) {
              throw serverError(PRIME_FREE_TRIAL_QUOTA_EXHAUSTED_CODE, {
                ...quotaOfBulkSend,
                resetAt: 2000,
              });
            }
            return grantedStart;
          }
          return { data: { code: 0, data: { unlimited: false } } };
        });

        const result = await service.startUsage({
          featureId: EPrimeFeatures.BulkSend,
          usageId: 'usage-0013',
        });

        expect(result).toMatchObject({
          status: 'granted',
          usageId: 'usage-0013',
        });
        expect(startCount).toBe(2);
        expect(finishCalls()).toEqual([
          [
            '/prime/v1/free-trial/usage/finish',
            expect.objectContaining({
              usageId: 'usage-0012',
              result: 'failed',
            }),
            expect.anything(),
          ],
        ]);
        expect(
          simpleDb.records.get('user-a__BulkSend__usage-0012')?.reportedAt,
        ).toEqual(expect.any(Number));
      });

      it('stays exhausted when the release cannot be confirmed', async () => {
        const { service, simpleDb } = createService();
        seedSettledUsage(simpleDb, 'usage-0014');
        let startCount = 0;
        mockOneKeyIdClient.post.mockImplementation(async (url: string) => {
          if (url === '/prime/v1/free-trial/usage/start') {
            startCount += 1;
            throw serverError(PRIME_FREE_TRIAL_QUOTA_EXHAUSTED_CODE, {
              ...quotaOfBulkSend,
              resetAt: 2000,
            });
          }
          throw networkError();
        });

        const result = await service.startUsage({
          featureId: EPrimeFeatures.BulkSend,
          usageId: 'usage-0015',
        });

        expect(result).toMatchObject({ status: 'exhausted' });
        expect(startCount).toBe(1);
      });

      it('still releases an unknown attempt after asking once more', async () => {
        const { service, simpleDb } = createService();
        seedSettledUsage(simpleDb, 'usage-0018');
        let startCount = 0;
        mockOneKeyIdClient.post.mockImplementation(async (url: string) => {
          if (url === '/prime/v1/free-trial/usage/start') {
            startCount += 1;
            throw startCount === 1
              ? networkError()
              : serverError(PRIME_FREE_TRIAL_QUOTA_EXHAUSTED_CODE, {
                  ...quotaOfBulkSend,
                  resetAt: 2000,
                });
          }
          return { data: { code: 0, data: { unlimited: false } } };
        });

        await expect(
          service.startUsage({
            featureId: EPrimeFeatures.BulkSend,
            usageId: 'usage-0019',
          }),
        ).resolves.toMatchObject({ status: 'exhausted' });

        expect(startCount).toBe(3);
        expect(finishCalls().map(([, body]) => body)).toEqual([
          expect.objectContaining({ usageId: 'usage-0018', result: 'failed' }),
          expect.objectContaining({
            usageId: 'usage-0019',
            result: 'cancelled',
          }),
        ]);
      });

      it('releases as the user that started when another user logged in before asking once more', async () => {
        const { service, simpleDb } = createService();
        seedSettledUsage(simpleDb, 'usage-0020');
        let startCount = 0;
        mockOneKeyIdClient.post.mockImplementation(async (url: string) => {
          if (url === '/prime/v1/free-trial/usage/start') {
            startCount += 1;
            throw startCount === 1
              ? networkError()
              : serverError(PRIME_FREE_TRIAL_QUOTA_EXHAUSTED_CODE, {
                  ...quotaOfBulkSend,
                  resetAt: 2000,
                });
          }
          // The pending release is confirmed, then another user logs in.
          mockState.user = { ...mockState.user, onekeyUserId: 'user-b' };
          return { data: { code: 0, data: { unlimited: false } } };
        });

        await expect(
          service.startUsage({
            featureId: EPrimeFeatures.BulkSend,
            usageId: 'usage-0021',
          }),
        ).rejects.toThrow('Prime free trial user changed');

        expect(startCount).toBe(2);
        expect(
          simpleDb.records.get('user-a__BulkSend__usage-0021')?.result,
        ).toBe('cancelled');
        expect(
          simpleDb.records.get('user-b__BulkSend__usage-0021'),
        ).toBeUndefined();
      });

      it('does not wait for anything without a pending release', async () => {
        const { service } = createService();
        mockOneKeyIdClient.post.mockRejectedValue(
          serverError(PRIME_FREE_TRIAL_QUOTA_EXHAUSTED_CODE, {
            ...quotaOfBulkSend,
            resetAt: 2000,
          }),
        );

        await expect(
          service.startUsage({
            featureId: EPrimeFeatures.BulkSend,
            usageId: 'usage-0016',
          }),
        ).resolves.toMatchObject({ status: 'exhausted' });
        expect(mockOneKeyIdClient.post).toHaveBeenCalledTimes(1);
      });
    });

    it('does not retry a definitive error', async () => {
      const { service } = createService();
      mockOneKeyIdClient.post.mockRejectedValue(serverError(90_001));

      await expect(
        service.startUsage({
          featureId: EPrimeFeatures.BulkSend,
          usageId: 'usage-0006',
        }),
      ).rejects.toBeTruthy();
      expect(mockOneKeyIdClient.post).toHaveBeenCalledTimes(1);
    });
  });

  describe('usage results', () => {
    function seedStartedUsage(
      simpleDb: ReturnType<typeof createSimpleDbMock>,
      {
        usageId,
        featureId = EPrimeFeatures.BulkSend,
        onekeyUserId = 'user-a',
      }: {
        usageId: string;
        featureId?: EPrimeFeatures.BulkSend | EPrimeFeatures.BulkRevoke;
        onekeyUserId?: string;
      },
    ) {
      simpleDb.records.set(recordKey({ onekeyUserId, featureId, usageId }), {
        onekeyUserId,
        featureId,
        usageId,
        startedAt: Date.now(),
        expiresAt: Date.now() + 30 * 60 * 1000,
        reportAttempts: 0,
      });
    }

    it.each(['success', 'failed', 'cancelled'] as const)(
      'tracks the real %s once with the original client attempt id',
      async (result) => {
        mockTrialResult.mockClear();
        const { service, simpleDb } = createService();
        seedStartedUsage(simpleDb, { usageId: 'usage-analytics' });
        const record = simpleDb.records.get(
          'user-a__BulkSend__usage-analytics',
        );
        expect(record).toBeDefined();
        if (!record) return;
        record.analyticsAttemptId = 'attempt-analytics';
        mockOneKeyIdClient.post.mockResolvedValue({
          data: { data: { unlimited: false } },
        });
        if (result === 'success') {
          await service.markUsageSuccess({
            featureId: EPrimeFeatures.BulkSend,
            usageId: record.usageId,
          });
          await service.markUsageSuccess({
            featureId: EPrimeFeatures.BulkSend,
            usageId: record.usageId,
          });
        } else {
          await service.settleUsage({
            featureId: EPrimeFeatures.BulkSend,
            usageId: record.usageId,
            result,
          });
          await service.settleUsage({
            featureId: EPrimeFeatures.BulkSend,
            usageId: record.usageId,
            result,
          });
        }
        expect(mockTrialResult).toHaveBeenCalledTimes(1);
        expect(mockTrialResult).toHaveBeenCalledWith({
          featureId: EPrimeFeatures.BulkSend,
          attemptId: 'attempt-analytics',
          stage: 'execution',
          source: 'client',
          result,
        });
      },
    );

    it.each(['failed', 'cancelled'] as const)(
      'tracks a reused retry ending %s without releasing the charged usage',
      async (result) => {
        mockTrialResult.mockClear();
        const { service, simpleDb } = createService();
        seedStartedUsage(simpleDb, { usageId: 'usage-failed-retry' });
        const record = simpleDb.records.get(
          'user-a__BulkSend__usage-failed-retry',
        );
        expect(record).toBeDefined();
        if (!record) return;
        record.result = 'success';
        record.reportedAt = Date.now();
        const params = {
          featureId: EPrimeFeatures.BulkSend as const,
          usageId: record.usageId,
          analyticsRetryAttemptId: 'retry-no-broadcast',
          result,
        };
        await service.settleUsage(params);
        await service.settleUsage(params);
        expect(mockTrialResult).toHaveBeenCalledTimes(1);
        expect(mockTrialResult).toHaveBeenCalledWith(
          expect.objectContaining({ stage: 'retry', result }),
        );
        expect(mockOneKeyIdClient.post).not.toHaveBeenCalled();
        expect(record.result).toBe('success');
      },
    );

    it('identifies a late broadcast as a correction of an unsettled failure', async () => {
      mockTrialResult.mockClear();
      const { service, simpleDb } = createService();
      seedStartedUsage(simpleDb, { usageId: 'usage-late-broadcast' });
      mockOneKeyIdClient.post.mockReturnValue(new Promise(() => {}));
      await service.settleUsage({
        featureId: EPrimeFeatures.BulkSend,
        usageId: 'usage-late-broadcast',
        result: 'failed',
      });
      await service.markUsageSuccess({
        featureId: EPrimeFeatures.BulkSend,
        usageId: 'usage-late-broadcast',
      });
      expect(mockTrialResult).toHaveBeenCalledTimes(2);
      expect(mockTrialResult).toHaveBeenLastCalledWith(
        expect.objectContaining({
          result: 'success',
          previousResult: 'failed',
        }),
      );
    });

    it('tracks a retry broadcast once without another reservation or consumption', async () => {
      mockTrialResult.mockClear();
      const { service, simpleDb } = createService();
      seedStartedUsage(simpleDb, { usageId: 'usage-analytics-retry' });
      const record = simpleDb.records.get(
        'user-a__BulkSend__usage-analytics-retry',
      );
      expect(record).toBeDefined();
      if (!record) return;
      record.result = 'success';
      record.reportedAt = Date.now();
      const usage = {
        featureId: EPrimeFeatures.BulkSend as const,
        usageId: record.usageId,
        analyticsRetryAttemptId: 'retry-analytics',
      };
      await service.markBroadcastSuccess(usage);
      await service.markBroadcastSuccess(usage);
      await service.settleUsage({ ...usage, result: 'cancelled' });
      expect(mockTrialResult).toHaveBeenCalledTimes(1);
      expect(mockTrialResult).toHaveBeenCalledWith(
        expect.objectContaining({
          stage: 'retry',
          result: 'success',
          attemptId: 'retry-analytics',
        }),
      );
      expect(mockOneKeyIdClient.post).not.toHaveBeenCalled();
    });

    it('keeps success over later failed / cancelled and reports once', async () => {
      const { service, simpleDb } = createService();
      seedStartedUsage(simpleDb, { usageId: 'usage-1001' });
      let resolveFinish: ((value: unknown) => void) | undefined;
      mockOneKeyIdClient.post.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveFinish = resolve;
          }),
      );

      await service.markUsageSuccess({
        featureId: EPrimeFeatures.BulkSend,
        usageId: 'usage-1001',
      });
      await service.settleUsage({
        featureId: EPrimeFeatures.BulkSend,
        usageId: 'usage-1001',
        result: 'failed',
      });
      await service.markUsageSuccess({
        featureId: EPrimeFeatures.BulkSend,
        usageId: 'usage-1001',
      });
      await flushPromises();

      expect(finishCalls()).toHaveLength(1);
      expect(finishCalls()[0][1]).toMatchObject({ result: 'success' });

      resolveFinish?.({ data: { code: 0, data: { unlimited: false } } });
      await flushPromises();
      expect(
        simpleDb.records.get('user-a__BulkSend__usage-1001'),
      ).toMatchObject({ result: 'success', reportedAt: expect.any(Number) });
      await expect(
        service.getUsageResult({
          featureId: EPrimeFeatures.BulkSend,
          usageId: 'usage-1001',
        }),
      ).resolves.toBe('success');
    });

    it('keeps the accepted failed when a success is marked during that finish', async () => {
      const { service, simpleDb } = createService();
      seedStartedUsage(simpleDb, { usageId: 'usage-1011' });
      let resolveFinish: ((value: unknown) => void) | undefined;
      mockOneKeyIdClient.post.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveFinish = resolve;
          }),
      );

      await service.settleUsage({
        featureId: EPrimeFeatures.BulkSend,
        usageId: 'usage-1011',
        result: 'failed',
      });
      await flushPromises();
      await service.markBroadcastSuccess({
        featureId: EPrimeFeatures.BulkSend,
        usageId: 'usage-1011',
      });
      await flushPromises();
      resolveFinish?.({ data: { code: 0, data: { unlimited: false } } });
      await flushPromises();

      expect(finishCalls()).toHaveLength(1);
      expect(finishCalls()[0][1]).toMatchObject({ result: 'failed' });
      // The first finish is final on the server: this use was not charged,
      // so a retry must start a new one instead of reusing the id.
      expect(
        simpleDb.records.get('user-a__BulkSend__usage-1011'),
      ).toMatchObject({ result: 'failed', reportedAt: expect.any(Number) });
      await expect(
        service.getUsageResult({
          featureId: EPrimeFeatures.BulkSend,
          usageId: 'usage-1011',
        }),
      ).resolves.toBe('failed');
    });

    it('reports a success marked during a failed finish the server did not record', async () => {
      const { service, simpleDb } = createService();
      seedStartedUsage(simpleDb, { usageId: 'usage-1012' });
      let rejectFinish: ((error: unknown) => void) | undefined;
      mockOneKeyIdClient.post.mockImplementationOnce(
        () =>
          new Promise((_resolve, reject) => {
            rejectFinish = reject;
          }),
      );

      await service.settleUsage({
        featureId: EPrimeFeatures.BulkSend,
        usageId: 'usage-1012',
        result: 'failed',
      });
      await flushPromises();
      await service.markBroadcastSuccess({
        featureId: EPrimeFeatures.BulkSend,
        usageId: 'usage-1012',
      });
      rejectFinish?.(serverError(90_000));
      await flushPromises();

      mockOneKeyIdClient.post.mockResolvedValue({
        data: { code: 0, data: { unlimited: false } },
      });
      await service.flushPendingReports({ force: true });
      await flushPromises();

      expect(finishCalls().map(([, body]) => body.result)).toEqual([
        'failed',
        'success',
      ]);
      expect(
        simpleDb.records.get('user-a__BulkSend__usage-1012'),
      ).toMatchObject({ result: 'success', reportedAt: expect.any(Number) });
    });

    it('never reports again after the server confirmed (one mark per broadcast)', async () => {
      const { service, simpleDb } = createService();
      seedStartedUsage(simpleDb, { usageId: 'usage-1002' });
      mockOneKeyIdClient.post.mockResolvedValue({
        data: { code: 0, data: { unlimited: false } },
      });

      for (let i = 0; i < 5; i += 1) {
        await service.markBroadcastSuccess({
          featureId: EPrimeFeatures.BulkSend,
          usageId: 'usage-1002',
        });
        await flushPromises();
      }

      expect(finishCalls()).toHaveLength(1);
    });

    it('drops a result of an unknown usage instead of charging the current user', async () => {
      const { service, simpleDb } = createService();
      mockOneKeyIdClient.post.mockResolvedValue({
        data: { code: 0, data: { unlimited: false } },
      });

      await service.markUsageSuccess({
        featureId: EPrimeFeatures.BulkSend,
        usageId: 'usage-1003',
      });
      await flushPromises();

      expect(simpleDb.records.size).toBe(0);
      expect(finishCalls()).toHaveLength(0);
    });

    it('keeps the first non-success result', async () => {
      const { service, simpleDb } = createService();
      seedStartedUsage(simpleDb, {
        usageId: 'usage-1004',
        featureId: EPrimeFeatures.BulkRevoke,
      });
      mockOneKeyIdClient.post.mockImplementation(() => new Promise(() => {}));

      await service.settleUsage({
        featureId: EPrimeFeatures.BulkRevoke,
        usageId: 'usage-1004',
        result: 'cancelled',
      });
      await service.settleUsage({
        featureId: EPrimeFeatures.BulkRevoke,
        usageId: 'usage-1004',
        result: 'failed',
      });
      await flushPromises();

      expect(finishCalls()).toHaveLength(1);
      expect(finishCalls()[0][1]).toMatchObject({ result: 'cancelled' });
    });

    it('keeps the record with backoff on a transient finish failure', async () => {
      const { service, simpleDb } = createService();
      seedStartedUsage(simpleDb, { usageId: 'usage-1005' });
      mockOneKeyIdClient.post.mockRejectedValue(serverError(90_000));

      await service.markUsageSuccess({
        featureId: EPrimeFeatures.BulkSend,
        usageId: 'usage-1005',
      });
      await flushPromises();

      const record = simpleDb.records.get('user-a__BulkSend__usage-1005');
      expect(record).toMatchObject({ result: 'success', reportAttempts: 1 });
      expect(record?.reportedAt).toBeUndefined();
      expect(record?.nextReportAt).toBeGreaterThan(Date.now());
    });

    it('treats 90001 as terminal', async () => {
      const { service, simpleDb } = createService();
      seedStartedUsage(simpleDb, { usageId: 'usage-1006' });
      mockOneKeyIdClient.post.mockRejectedValue(serverError(90_001));

      await service.markUsageSuccess({
        featureId: EPrimeFeatures.BulkSend,
        usageId: 'usage-1006',
      });
      await flushPromises();
      await service.flushPendingReports({ force: true });
      await flushPromises();

      expect(finishCalls()).toHaveLength(1);
      expect(
        simpleDb.records.get('user-a__BulkSend__usage-1006')?.reportedAt,
      ).toEqual(expect.any(Number));
    });

    it('keeps the record without a retry timer after an invalid token', async () => {
      const { service, simpleDb } = createService();
      seedStartedUsage(simpleDb, { usageId: 'usage-1007' });
      const invalidToken = new OneKeyErrorPrimeLoginInvalidToken();
      invalidToken.$$invalidTokenHandled = true;
      mockOneKeyIdClient.post.mockRejectedValue(invalidToken);

      await service.markUsageSuccess({
        featureId: EPrimeFeatures.BulkSend,
        usageId: 'usage-1007',
      });
      await flushPromises();

      expect(
        simpleDb.records.get('user-a__BulkSend__usage-1007'),
      ).toMatchObject({ result: 'success', reportAttempts: 0 });
      expect(jest.getTimerCount()).toBe(0);
    });

    it('keeps the record without a retry timer after a device-limit reply', async () => {
      const { service, simpleDb } = createService();
      seedStartedUsage(simpleDb, { usageId: 'usage-1010' });
      mockOneKeyIdClient.post.mockRejectedValue(
        new OneKeyErrorPrimeLoginExceedDeviceLimit(),
      );

      await service.markUsageSuccess({
        featureId: EPrimeFeatures.BulkSend,
        usageId: 'usage-1010',
      });
      await flushPromises();

      expect(
        simpleDb.records.get('user-a__BulkSend__usage-1010'),
      ).toMatchObject({ result: 'success', reportAttempts: 0 });
      expect(
        simpleDb.records.get('user-a__BulkSend__usage-1010')?.nextReportAt,
      ).toBeUndefined();
      // No backoff timer: each retry would reopen the device-limit page.
      expect(jest.getTimerCount()).toBe(0);
    });

    it('only reports a record as its owner and never spins for others', async () => {
      const { service, simpleDb } = createService();
      mockOneKeyIdClient.post.mockResolvedValue({
        data: { code: 0, data: { unlimited: false } },
      });
      simpleDb.records.set('user-a__BulkSend__usage-1008', {
        onekeyUserId: 'user-a',
        featureId: EPrimeFeatures.BulkSend,
        usageId: 'usage-1008',
        startedAt: Date.now(),
        result: 'success',
        resultAt: Date.now(),
        reportAttempts: 2,
        // Backoff already due: must not schedule a 1s loop for user-b.
        nextReportAt: Date.now() - 1000,
      });
      mockState.user = {
        isLoggedIn: true,
        isLoggedInOnServer: true,
        onekeyUserId: 'user-b',
      };

      await service.flushPendingReports({ force: true });
      await flushPromises();
      expect(finishCalls()).toHaveLength(0);
      expect(jest.getTimerCount()).toBe(0);

      mockState.user = {
        isLoggedIn: true,
        isLoggedInOnServer: true,
        onekeyUserId: 'user-a',
      };
      await service.flushPendingReports({ force: true });
      await flushPromises();
      expect(finishCalls()).toHaveLength(1);
      expect(
        simpleDb.records.get('user-a__BulkSend__usage-1008')?.reportedAt,
      ).toEqual(expect.any(Number));
    });

    it('schedules a record that came due while a flush was reporting', async () => {
      const { service, simpleDb } = createService();
      const now = Date.now();
      const seed = (usageId: string, nextReportAt: number) => {
        simpleDb.records.set(`user-a__BulkSend__${usageId}`, {
          onekeyUserId: 'user-a',
          featureId: EPrimeFeatures.BulkSend,
          usageId,
          startedAt: now,
          result: 'success',
          resultAt: now,
          reportAttempts: 1,
          nextReportAt,
        });
      };
      seed('usage-1013', now - 1);
      seed('usage-1014', now + 100);
      let resolveFirstFinish: ((value: unknown) => void) | undefined;
      mockOneKeyIdClient.post
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              resolveFirstFinish = resolve;
            }),
        )
        .mockResolvedValue({ data: { code: 0, data: { unlimited: false } } });

      const flush = service.flushPendingReports();
      await flushPromises();
      // The second record comes due while the first one is being reported.
      jest.advanceTimersByTime(200);
      resolveFirstFinish?.({ data: { code: 0, data: { unlimited: false } } });
      await flush;
      await flushPromises();
      expect(finishCalls().map(([, body]) => body.usageId)).toEqual([
        'usage-1013',
      ]);

      jest.advanceTimersByTime(5000);
      await flushPromises();
      expect(finishCalls().map(([, body]) => body.usageId)).toEqual([
        'usage-1013',
        'usage-1014',
      ]);
    });

    it('clears every record of a deleted account', async () => {
      const { service, simpleDb } = createService();
      simpleDb.records.set('user-a__BulkSend__usage-1009', {
        onekeyUserId: 'user-a',
        featureId: EPrimeFeatures.BulkSend,
        usageId: 'usage-1009',
        startedAt: Date.now(),
        result: 'success',
        reportAttempts: 3,
      });

      await service.clearUserData({ onekeyUserId: 'user-a' });

      expect(simpleDb.records.size).toBe(0);
    });
  });

  describe('getHeldReservationEnd', () => {
    function seedRecord(
      simpleDb: ReturnType<typeof createSimpleDbMock>,
      record: Partial<IPrimeFreeTrialUsageRecord> & { usageId: string },
    ) {
      const full: IPrimeFreeTrialUsageRecord = {
        onekeyUserId: 'user-a',
        featureId: EPrimeFeatures.BulkSend,
        startedAt: Date.now(),
        reportAttempts: 0,
        ...record,
      };
      simpleDb.records.set(recordKey(full), full);
    }

    it('returns the earliest end of a reservation still held', async () => {
      const { service, simpleDb } = createService();
      const now = Date.now();
      // Interrupted: no result yet
      seedRecord(simpleDb, { usageId: 'usage-2001', expiresAt: now + 20_000 });
      // Release not reported yet
      seedRecord(simpleDb, {
        usageId: 'usage-2002',
        expiresAt: now + 10_000,
        result: 'cancelled',
      });

      await expect(
        service.getHeldReservationEnd({ featureId: EPrimeFeatures.BulkSend }),
      ).resolves.toBe(now + 10_000);
    });

    it('ignores charged, released, expired and foreign reservations', async () => {
      const { service, simpleDb } = createService();
      const now = Date.now();
      seedRecord(simpleDb, {
        usageId: 'usage-2003',
        expiresAt: now + 10_000,
        result: 'success',
      });
      seedRecord(simpleDb, {
        usageId: 'usage-2004',
        expiresAt: now + 10_000,
        result: 'failed',
        reportedAt: now,
      });
      seedRecord(simpleDb, { usageId: 'usage-2005', expiresAt: now - 1 });
      seedRecord(simpleDb, {
        usageId: 'usage-2006',
        expiresAt: now + 10_000,
        onekeyUserId: 'user-b',
      });
      seedRecord(simpleDb, {
        usageId: 'usage-2007',
        expiresAt: now + 10_000,
        featureId: EPrimeFeatures.BulkRevoke,
      });

      await expect(
        service.getHeldReservationEnd({ featureId: EPrimeFeatures.BulkSend }),
      ).resolves.toBeUndefined();
    });
  });

  describe('quota snapshot', () => {
    const quota: IPrimeFreeTrialQuota = {
      period: '2026-10',
      resetAt: 2000,
      features: [{ ...quotaOfBulkSend, used: 0, remaining: 1 }],
    };

    it('ignores a slower /user/info that started before a newer quota request', async () => {
      const { service } = createService();
      const userInfoSeq = service.allocateQuotaRequestSeq();
      mockOneKeyIdClient.get.mockResolvedValueOnce({
        data: {
          code: 0,
          data: {
            ...quota,
            features: [{ ...quotaOfBulkSend, used: 1, remaining: 0 }],
          },
        },
      });
      await service.refreshQuota();

      await service.applyQuotaFromPrimeUserInfo({
        freeTrial: quota,
        onekeyUserId: 'user-a',
        requestSeq: userInfoSeq,
        isPrimeSubscriptionActive: false,
      });

      expect(mockState.freeTrial.quota.data?.features[0].remaining).toBe(0);
    });

    it('keeps the start quota over an older refresh still in flight', async () => {
      const { service } = createService();
      await service.applyQuotaFromPrimeUserInfo({
        freeTrial: quota,
        onekeyUserId: 'user-a',
        requestSeq: service.allocateQuotaRequestSeq(),
        isPrimeSubscriptionActive: false,
      });
      // Answered before the start reserved: still one use left.
      let resolveRefresh: ((value: unknown) => void) | undefined;
      mockOneKeyIdClient.get
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              resolveRefresh = resolve;
            }),
        )
        .mockImplementation(() => new Promise(() => {}));
      const refresh = service.refreshQuota();
      await flushPromises();
      mockOneKeyIdClient.post.mockResolvedValueOnce({
        data: {
          code: 0,
          data: {
            unlimited: false,
            featureId: EPrimeFeatures.BulkSend,
            usageId: 'usage-3001',
            quota: quotaOfBulkSend,
            expiresAt: 1000,
            resetAt: quota.resetAt,
          },
        },
      });

      await service.startUsage({
        featureId: EPrimeFeatures.BulkSend,
        usageId: 'usage-3001',
      });
      await flushPromises();
      expect(mockState.freeTrial.quota.data?.features[0].remaining).toBe(0);

      resolveRefresh?.({ data: { code: 0, data: quota } });
      await refresh;
      await flushPromises();
      expect(mockState.freeTrial.quota.data?.features[0].remaining).toBe(0);
    });

    it('keeps the other features of a refresh that was in flight during a start', async () => {
      const { service } = createService();
      const bulkRevokeQuota: IPrimeFreeTrialFeatureQuota = {
        featureId: EPrimeFeatures.BulkRevoke,
        unit: 'count',
        monthlyQuota: 1,
        used: 0,
        remaining: 1,
      };
      await service.applyQuotaFromPrimeUserInfo({
        freeTrial: {
          ...quota,
          features: [quotaOfBulkSend, bulkRevokeQuota],
        },
        onekeyUserId: 'user-a',
        requestSeq: service.allocateQuotaRequestSeq(),
        isPrimeSubscriptionActive: false,
      });
      // Requested after a BulkSend release: its use is back.
      let resolveRefresh: ((value: unknown) => void) | undefined;
      mockOneKeyIdClient.get
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              resolveRefresh = resolve;
            }),
        )
        .mockImplementation(() => new Promise(() => {}));
      const refresh = service.refreshQuota();
      await flushPromises();
      // A BulkRevoke start reply lands first.
      mockOneKeyIdClient.post.mockResolvedValueOnce({
        data: {
          code: 0,
          data: {
            unlimited: false,
            featureId: EPrimeFeatures.BulkRevoke,
            usageId: 'usage-3002',
            quota: { ...bulkRevokeQuota, used: 1, remaining: 0 },
            expiresAt: 1000,
            resetAt: quota.resetAt,
          },
        },
      });
      await service.startUsage({
        featureId: EPrimeFeatures.BulkRevoke,
        usageId: 'usage-3002',
      });
      await flushPromises();

      resolveRefresh?.({
        data: {
          code: 0,
          data: {
            ...quota,
            features: [
              { ...quotaOfBulkSend, used: 0, remaining: 1 },
              bulkRevokeQuota,
            ],
          },
        },
      });
      const refreshed = await refresh;
      await flushPromises();

      const remainingOf = (
        data: IPrimeFreeTrialQuota | null | undefined,
        featureId: EPrimeFeatures,
      ) =>
        data?.features.find((item) => item.featureId === featureId)?.remaining;
      const snapshot = mockState.freeTrial.quota.data;
      expect(remainingOf(snapshot, EPrimeFeatures.BulkSend)).toBe(1);
      expect(remainingOf(snapshot, EPrimeFeatures.BulkRevoke)).toBe(0);
      // A caller that joined the refresh decides on the same snapshot.
      expect(remainingOf(refreshed, EPrimeFeatures.BulkSend)).toBe(1);
      expect(remainingOf(refreshed, EPrimeFeatures.BulkRevoke)).toBe(0);
    });

    it('drops a feature a refresh no longer lists, even after a start', async () => {
      const { service } = createService();
      const bulkRevokeQuota: IPrimeFreeTrialFeatureQuota = {
        featureId: EPrimeFeatures.BulkRevoke,
        unit: 'count',
        monthlyQuota: 1,
        used: 0,
        remaining: 1,
      };
      await service.applyQuotaFromPrimeUserInfo({
        freeTrial: {
          ...quota,
          features: [quotaOfBulkSend, bulkRevokeQuota],
        },
        onekeyUserId: 'user-a',
        requestSeq: service.allocateQuotaRequestSeq(),
        isPrimeSubscriptionActive: false,
      });
      let resolveRefresh: ((value: unknown) => void) | undefined;
      mockOneKeyIdClient.get
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              resolveRefresh = resolve;
            }),
        )
        .mockImplementation(() => new Promise(() => {}));
      const refresh = service.refreshQuota();
      await flushPromises();
      mockOneKeyIdClient.post.mockResolvedValueOnce({
        data: {
          code: 0,
          data: {
            unlimited: false,
            featureId: EPrimeFeatures.BulkRevoke,
            usageId: 'usage-3003',
            quota: { ...bulkRevokeQuota, used: 1, remaining: 0 },
            expiresAt: 1000,
            resetAt: quota.resetAt,
          },
        },
      });
      await service.startUsage({
        featureId: EPrimeFeatures.BulkRevoke,
        usageId: 'usage-3003',
      });
      await flushPromises();

      // BulkRevoke was closed meanwhile.
      resolveRefresh?.({
        data: { code: 0, data: { ...quota, features: [quotaOfBulkSend] } },
      });
      const refreshed = await refresh;
      await flushPromises();

      const featureIds = (data: IPrimeFreeTrialQuota | null | undefined) =>
        data?.features.map((item) => item.featureId);
      expect(featureIds(mockState.freeTrial.quota.data)).toEqual([
        EPrimeFeatures.BulkSend,
      ]);
      expect(featureIds(refreshed)).toEqual([EPrimeFeatures.BulkSend]);
    });

    it('keeps the snapshot when freeTrial is missing and clears it on null', async () => {
      const { service } = createService();
      await service.applyQuotaFromPrimeUserInfo({
        freeTrial: quota,
        onekeyUserId: 'user-a',
        requestSeq: service.allocateQuotaRequestSeq(),
        isPrimeSubscriptionActive: false,
      });
      await service.applyQuotaFromPrimeUserInfo({
        freeTrial: undefined,
        onekeyUserId: 'user-a',
        requestSeq: service.allocateQuotaRequestSeq(),
        isPrimeSubscriptionActive: false,
      });
      expect(mockState.freeTrial.quota.data).toEqual(quota);

      await service.applyQuotaFromPrimeUserInfo({
        freeTrial: null,
        onekeyUserId: 'user-a',
        requestSeq: service.allocateQuotaRequestSeq(),
        isPrimeSubscriptionActive: false,
      });
      expect(mockState.freeTrial.quota.data).toBeNull();
    });

    it('writes a 90600 only for the user the request was sent as', async () => {
      const { service } = createService();
      mockState.user.onekeyUserId = 'user-b';
      await service.applyQuotaFromPrimeUserInfo({
        freeTrial: quota,
        onekeyUserId: 'user-b',
        requestSeq: service.allocateQuotaRequestSeq(),
        isPrimeSubscriptionActive: false,
      });

      await service.applyQuotaExhaustedData(
        { ...quotaOfBulkSend, resetAt: 2000 },
        { onekeyUserId: 'user-a' },
      );
      expect(mockState.freeTrial.quota.data?.features[0].remaining).toBe(1);

      await service.applyQuotaExhaustedData(
        { ...quotaOfBulkSend, resetAt: 2000 },
        { onekeyUserId: 'user-b' },
      );
      expect(mockState.freeTrial.quota.data?.features[0].remaining).toBe(0);
    });

    it('keeps the server reservation fields of the quota and of a 90600', async () => {
      const { service } = createService();
      mockOneKeyIdClient.get.mockResolvedValueOnce({
        data: {
          code: 0,
          data: {
            ...quota,
            features: [
              {
                ...quotaOfBulkSend,
                used: 1,
                remaining: 0,
                reserved: 1,
                reservationExpiresAt: 5000,
              },
            ],
          },
        },
      });
      await service.refreshQuota();
      expect(mockState.freeTrial.quota.data?.features[0]).toMatchObject({
        reserved: 1,
        reservationExpiresAt: 5000,
      });

      await service.applyQuotaExhaustedData(
        { ...quotaOfBulkSend, resetAt: 2000, reserved: 0 },
        { onekeyUserId: 'user-a' },
      );
      const afterExhausted = mockState.freeTrial.quota.data?.features[0];
      expect(afterExhausted?.reserved).toBe(0);
      expect(afterExhausted?.reservationExpiresAt).toBeUndefined();
    });

    it('leaves the reservation unknown for an older server', async () => {
      const { service } = createService();
      mockOneKeyIdClient.get.mockResolvedValueOnce({
        data: { code: 0, data: quota },
      });
      await service.refreshQuota();
      expect(mockState.freeTrial.quota.data?.features[0]).not.toHaveProperty(
        'reserved',
      );
    });

    it('never writes the quota of another account', async () => {
      const { service } = createService();
      await service.applyQuotaFromPrimeUserInfo({
        freeTrial: quota,
        onekeyUserId: 'user-b',
        requestSeq: service.allocateQuotaRequestSeq(),
        isPrimeSubscriptionActive: false,
      });
      expect(mockState.freeTrial.quota.data).toBeUndefined();
    });

    it('does not query the quota for Prime users', async () => {
      const { service } = createService();
      mockState.user.primeSubscription = { isActive: true };

      await expect(service.refreshQuota()).resolves.toBeNull();
      expect(mockOneKeyIdClient.get).not.toHaveBeenCalled();
    });
  });

  describe('normalizeFreeTrialError', () => {
    it('normalizes the raw translate 90005 to the client not-open code', () => {
      const { service } = createService();
      expect(
        service.normalizeFreeTrialError({
          error: serverError(90_005),
          featureId: EPrimeFeatures.DAppTranslate,
        }),
      ).toEqual({
        code: PRIME_FREE_TRIAL_NOT_OPEN_CODE,
        data: { featureId: EPrimeFeatures.DAppTranslate, reason: undefined },
      });
    });

    it('reads the 90600 business data from the response wrapper', () => {
      const { service } = createService();
      expect(
        service.normalizeFreeTrialError({
          error: serverError(PRIME_FREE_TRIAL_QUOTA_EXHAUSTED_CODE, {
            featureId: EPrimeFeatures.AddressRiskCheck,
            unit: 'count',
            monthlyQuota: 5,
            used: 5,
            remaining: 0,
            resetAt: 2000,
          }),
          featureId: EPrimeFeatures.AddressRiskCheck,
        }),
      ).toEqual({
        code: PRIME_FREE_TRIAL_QUOTA_EXHAUSTED_CODE,
        data: {
          featureId: EPrimeFeatures.AddressRiskCheck,
          unit: 'count',
          monthlyQuota: 5,
          used: 5,
          remaining: 0,
          resetAt: 2000,
        },
      });
    });

    it('ignores unrelated errors', () => {
      const { service } = createService();
      expect(
        service.normalizeFreeTrialError({
          error: serverError(90_104),
          featureId: EPrimeFeatures.DAppTranslate,
        }),
      ).toBeUndefined();
    });
  });

  describe('pending action', () => {
    it('keeps an action saved after the cancelled login started', async () => {
      const { service } = createService();
      const action = await service.savePendingAction({
        type: EPrimeFreeTrialPendingActionType.BulkCopyAddresses,
        walletId: 'hd-1',
        networkId: 'btc--0',
      });

      await service.clearPendingActionCreatedBefore({
        timestamp: action.createdAt,
      });
      await expect(service.consumePendingAction()).resolves.toEqual(action);
      await expect(service.consumePendingAction()).resolves.toBeUndefined();
    });

    it('drops an expired action', async () => {
      const { service } = createService();
      await service.savePendingAction({
        type: EPrimeFreeTrialPendingActionType.AddressRiskCheck,
        networkId: 'evm--1',
      });
      jest.setSystemTime(Date.now() + 11 * 60 * 1000);

      await expect(service.consumePendingAction()).resolves.toBeUndefined();
    });
  });

  describe('devResetFreeTrialUsage', () => {
    it('requires developer mode', async () => {
      mockDevSettings.enabled = false;
      const { service } = createService();

      await expect(
        service.devResetFreeTrialUsage({
          featureIds: [EPrimeFeatures.BulkSend],
        }),
      ).rejects.toThrow('Developer mode is required');
      expect(mockOneKeyIdClient.post).not.toHaveBeenCalled();
    });

    it('requires at least one feature', async () => {
      const { service } = createService();

      await expect(
        service.devResetFreeTrialUsage({ featureIds: [] }),
      ).rejects.toThrow('Select at least one feature');
      expect(mockOneKeyIdClient.post).not.toHaveBeenCalled();
    });

    it('resets the selected features, refreshes the quota and reports failures', async () => {
      const { service } = createService();
      mockOneKeyIdClient.post.mockImplementation(
        async (_url: string, body: { featureId: string }) => {
          if (body.featureId === EPrimeFeatures.DAppTranslate) {
            throw serverError(90_002);
          }
          return { data: { code: 0, data: {} } };
        },
      );

      await expect(
        service.devResetFreeTrialUsage({
          featureIds: [EPrimeFeatures.DAppTranslate, EPrimeFeatures.BulkSend],
        }),
      ).resolves.toEqual({
        failedFeatureIds: [EPrimeFeatures.DAppTranslate],
        errorMessage: 'server 90002',
      });
      expect(
        (mockOneKeyIdClient.post.mock.calls as Array<[string, unknown]>).map(
          ([url, body]) => [url, body],
        ),
      ).toEqual([
        [
          '/prime/v1/free-trial/test/reset',
          { featureId: EPrimeFeatures.BulkSend },
        ],
        [
          '/prime/v1/free-trial/test/reset',
          { featureId: EPrimeFeatures.DAppTranslate },
        ],
      ]);
      expect(mockOneKeyIdClient.get).toHaveBeenCalledWith(
        '/prime/v1/free-trial/quota',
        expect.anything(),
      );
    });
  });
});
