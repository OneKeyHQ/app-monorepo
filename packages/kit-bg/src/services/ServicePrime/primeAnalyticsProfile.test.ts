import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import {
  buildPrimeAnalyticsProfileSnapshot,
  enqueuePrimeProfileAnalyticsReport,
  resetPrimeAnalyticsReporterForTests,
  trackOneKeyIdIdentityLinked,
} from './primeAnalyticsProfile';

const mockWhenInitialized = jest.fn(async (): Promise<void> => undefined);
const mockUpdateUserProfileAsync = jest.fn(
  async (_attributes: unknown): Promise<void> => undefined,
);
const mockReportIdentity = jest.fn(
  async (_params: unknown): Promise<void> => undefined,
);
const mockStateTrace = jest.fn((_params: unknown): void => undefined);
const mockPersistGet = jest.fn();

jest.mock('@onekeyhq/shared/src/analytics', () => ({
  analytics: {
    whenInitialized: (): Promise<void> => mockWhenInitialized(),
    updateUserProfileAsync: (attributes: unknown): Promise<void> =>
      mockUpdateUserProfileAsync(attributes),
  },
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    prime: {
      subscription: {
        reportOneKeyIdIdentityLinked: (params: unknown): Promise<void> =>
          mockReportIdentity(params),
        onekeyIdStateTrace: (params: unknown): void => {
          mockStateTrace(params);
        },
      },
    },
  },
}));

jest.mock('../../states/jotai/atoms/prime', () => ({
  primePersistAtom: {
    get: (): unknown => mockPersistGet(),
  },
}));

function createStore({
  identityDue = true,
  profileDue = true,
}: {
  identityDue?: boolean;
  profileDue?: boolean;
} = {}) {
  return {
    isIdentityLinkDue: jest.fn(async () => identityDue),
    recordIdentityLinkReported: jest.fn(async () => undefined),
    isPrimeProfileDue: jest.fn(async () => profileDue),
    recordPrimeProfileReported: jest.fn(async () => undefined),
  };
}

describe('buildPrimeAnalyticsProfileSnapshot', () => {
  it('reports never-logged-in users as false/false', () => {
    expect(
      buildPrimeAnalyticsProfileSnapshot({
        isLoggedIn: false,
        isLoggedInOnServer: false,
        isPrimeSubscriptionActive: true,
      }),
    ).toEqual({
      isOneKeyIdLoggedIn: false,
      isPrimeActive: false,
      profileKey: 'false:false',
    });
  });

  it('requires both local and server login flags before Prime can be active', () => {
    expect(
      buildPrimeAnalyticsProfileSnapshot({
        isLoggedIn: true,
        isLoggedInOnServer: true,
        isPrimeSubscriptionActive: true,
      }),
    ).toEqual({
      isOneKeyIdLoggedIn: true,
      isPrimeActive: true,
      profileKey: 'true:true',
    });
    expect(
      buildPrimeAnalyticsProfileSnapshot({
        isLoggedIn: true,
        isLoggedInOnServer: false,
        isPrimeSubscriptionActive: true,
      }).isPrimeActive,
    ).toBe(false);
  });
});

describe('trackOneKeyIdIdentityLinked', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('persists only after the identity event is delivered', async () => {
    const simpleDb = createStore({ identityDue: true });

    await trackOneKeyIdIdentityLinked({
      simpleDb,
      onekeyUserId: 'user-1',
    });

    expect(mockReportIdentity).toHaveBeenCalledWith({ onekeyUserId: 'user-1' });
    expect(simpleDb.recordIdentityLinkReported).toHaveBeenCalledTimes(1);
    expect(mockReportIdentity.mock.invocationCallOrder[0]).toBeLessThan(
      simpleDb.recordIdentityLinkReported.mock.invocationCallOrder[0],
    );
  });

  it('does not persist when delivery throws', async () => {
    const simpleDb = createStore({ identityDue: true });
    mockReportIdentity.mockRejectedValueOnce(
      new OneKeyLocalError('network failed'),
    );

    await trackOneKeyIdIdentityLinked({
      simpleDb,
      onekeyUserId: 'user-1',
    });

    expect(simpleDb.recordIdentityLinkReported).not.toHaveBeenCalled();
    expect(mockStateTrace).toHaveBeenCalled();
  });

  it('skips emit and persist when the link is not due', async () => {
    const simpleDb = createStore({ identityDue: false });

    await trackOneKeyIdIdentityLinked({
      simpleDb,
      onekeyUserId: 'user-1',
    });

    expect(mockReportIdentity).not.toHaveBeenCalled();
    expect(simpleDb.recordIdentityLinkReported).not.toHaveBeenCalled();
  });
});

describe('enqueuePrimeProfileAnalyticsReport', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetPrimeAnalyticsReporterForTests();
    mockPersistGet.mockResolvedValue({
      isLoggedIn: false,
      isLoggedInOnServer: false,
      primeSubscription: undefined,
    });
  });

  it('persists only after profile delivery succeeds', async () => {
    const simpleDb = createStore({ profileDue: true });

    await enqueuePrimeProfileAnalyticsReport({ simpleDb });

    expect(mockWhenInitialized).toHaveBeenCalled();
    expect(mockUpdateUserProfileAsync).toHaveBeenCalledWith({
      isOneKeyIdLoggedIn: false,
      isPrimeActive: false,
    });
    expect(simpleDb.recordPrimeProfileReported).toHaveBeenCalledTimes(1);
    expect(mockUpdateUserProfileAsync.mock.invocationCallOrder[0]).toBeLessThan(
      simpleDb.recordPrimeProfileReported.mock.invocationCallOrder[0],
    );
  });

  it('does not persist when delivery throws', async () => {
    const simpleDb = createStore({ profileDue: true });
    mockUpdateUserProfileAsync.mockRejectedValueOnce(
      new OneKeyLocalError('network failed'),
    );

    await enqueuePrimeProfileAnalyticsReport({ simpleDb });

    expect(simpleDb.recordPrimeProfileReported).not.toHaveBeenCalled();
    expect(mockStateTrace).toHaveBeenCalled();
  });

  it('drops a stale snapshot after init without persisting it', async () => {
    const simpleDb = createStore({ profileDue: true });
    mockPersistGet
      .mockResolvedValueOnce({
        isLoggedIn: false,
        isLoggedInOnServer: false,
      })
      .mockResolvedValueOnce({
        isLoggedIn: true,
        isLoggedInOnServer: true,
        primeSubscription: { isActive: true },
      });

    await enqueuePrimeProfileAnalyticsReport({ simpleDb });

    expect(mockUpdateUserProfileAsync).not.toHaveBeenCalled();
    expect(simpleDb.recordPrimeProfileReported).not.toHaveBeenCalled();
  });
});
