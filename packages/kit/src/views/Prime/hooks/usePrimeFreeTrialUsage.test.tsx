/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import { EPrimeFeatures } from '@onekeyhq/shared/src/routes/prime';

import { usePrimeFreeTrialUsage } from './usePrimeFreeTrialUsage';

const mockStartUsage = jest.fn();
const mockGetUsageResult = jest.fn();
const mockEnsureFeatureAccess = jest.fn();
const mockHandleStartRejected = jest.fn();
const mockToastError = jest.fn();
let mockIsPrimeSubscriptionActive = false;

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    servicePrimeFreeTrial: {
      startUsage: (params: unknown) => mockStartUsage(params) as unknown,
      getUsageResult: (params: unknown) =>
        mockGetUsageResult(params) as unknown,
      markUsageSuccess: jest.fn(),
      settleUsage: jest.fn(),
    },
  },
}));

jest.mock('@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth', () => ({
  useOneKeyAuth: () => ({
    isPrimeSubscriptionActive: mockIsPrimeSubscriptionActive,
  }),
}));

jest.mock('./usePrimeFeatureAccess', () => ({
  usePrimeFeatureAccess: () => ({
    ensureFeatureAccess: (params: unknown) =>
      mockEnsureFeatureAccess(params) as unknown,
    handleStartRejected: (params: unknown) =>
      mockHandleStartRejected(params) as unknown,
  }),
}));

jest.mock('@onekeyhq/components', () => ({
  Toast: { error: (params: unknown) => mockToastError(params) as unknown },
}));

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => {
  const noopLogger = new Proxy(jest.fn(), {
    apply: () => undefined,
    get: () => noopLogger,
  });
  return { defaultLogger: noopLogger };
});

function renderUsageHook() {
  return renderHook(() =>
    usePrimeFreeTrialUsage({ featureId: EPrimeFeatures.BulkSend }),
  ).result;
}

describe('usePrimeFreeTrialUsage.startUsage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsPrimeSubscriptionActive = false;
  });

  it('never starts for a Prime user', async () => {
    mockIsPrimeSubscriptionActive = true;
    const result = renderUsageHook();

    await act(async () => {
      await expect(result.current.startUsage()).resolves.toEqual({
        status: 'notMetered',
      });
    });
    expect(mockStartUsage).not.toHaveBeenCalled();
  });

  it('returns the granted usage id', async () => {
    mockStartUsage.mockImplementation(async ({ usageId }) => ({
      status: 'granted',
      usageId,
    }));
    const result = renderUsageHook();

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.startUsage();
    });
    expect(outcome).toEqual({
      status: 'granted',
      usageId: mockStartUsage.mock.calls[0][0].usageId,
    });
  });

  it('logs in once and starts again with a new id', async () => {
    mockStartUsage
      .mockResolvedValueOnce({
        status: 'loginRequired',
        featureId: EPrimeFeatures.BulkSend,
      })
      .mockImplementationOnce(async ({ usageId }) => ({
        status: 'granted',
        usageId,
      }));
    mockEnsureFeatureAccess.mockResolvedValue({
      granted: true,
      entitlementSource: 'freeTrial',
    });
    const result = renderUsageHook();

    let outcome: { status: string } | undefined;
    await act(async () => {
      outcome = await result.current.startUsage();
    });
    expect(outcome?.status).toBe('granted');
    expect(mockEnsureFeatureAccess).toHaveBeenCalledTimes(1);
    expect(mockStartUsage).toHaveBeenCalledTimes(2);
    expect(mockStartUsage.mock.calls[0][0].usageId).not.toBe(
      mockStartUsage.mock.calls[1][0].usageId,
    );
  });

  it('stops when the login is cancelled or still missing', async () => {
    mockStartUsage.mockResolvedValue({
      status: 'loginRequired',
      featureId: EPrimeFeatures.BulkSend,
    });
    mockEnsureFeatureAccess.mockResolvedValueOnce({ granted: false });
    const result = renderUsageHook();

    await act(async () => {
      await expect(result.current.startUsage()).resolves.toEqual({
        status: 'rejected',
      });
    });
    expect(mockStartUsage).toHaveBeenCalledTimes(1);

    mockEnsureFeatureAccess.mockResolvedValueOnce({
      granted: true,
      entitlementSource: 'freeTrial',
    });
    await act(async () => {
      await expect(result.current.startUsage()).resolves.toEqual({
        status: 'rejected',
      });
    });
    // One detour only, no login loop.
    expect(mockStartUsage).toHaveBeenCalledTimes(3);
  });

  it('hands exhausted / not open to the unified feedback', async () => {
    const rejected = { status: 'exhausted', featureId: 'BulkSend', data: {} };
    mockStartUsage.mockResolvedValue(rejected);
    const result = renderUsageHook();

    await act(async () => {
      await expect(
        result.current.startUsage({ networkId: 'evm--1' }),
      ).resolves.toEqual({ status: 'rejected' });
    });
    expect(mockHandleStartRejected).toHaveBeenCalledWith({
      result: rejected,
      networkId: 'evm--1',
    });
  });

  it('shows an error unless the background proxy already toasted it', async () => {
    mockStartUsage
      .mockRejectedValueOnce({ message: 'Network Error' })
      .mockRejectedValueOnce({ message: 'server says no', autoToast: true });
    const result = renderUsageHook();

    await act(async () => {
      await result.current.startUsage();
      await result.current.startUsage();
    });
    expect(mockToastError).toHaveBeenCalledTimes(1);
    expect(mockToastError).toHaveBeenCalledWith({ title: 'Network Error' });
  });
});

describe('usePrimeFreeTrialUsage.prepareRetryUsage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsPrimeSubscriptionActive = false;
  });

  it('does not meter a page without a usage', async () => {
    const result = renderUsageHook();
    await act(async () => {
      await expect(
        result.current.prepareRetryUsage({
          usageId: undefined,
          succeededLocally: false,
        }),
      ).resolves.toEqual({
        proceed: true,
        usageId: undefined,
        isNewUsage: false,
      });
    });
    expect(mockStartUsage).not.toHaveBeenCalled();
  });

  it('reuses a usage that already broadcast', async () => {
    mockGetUsageResult.mockResolvedValue('success');
    const result = renderUsageHook();

    await act(async () => {
      await expect(
        result.current.prepareRetryUsage({
          usageId: 'usage-1',
          succeededLocally: false,
        }),
      ).resolves.toEqual({
        proceed: true,
        usageId: 'usage-1',
        isNewUsage: false,
      });
    });
    expect(mockStartUsage).not.toHaveBeenCalled();
  });

  it('starts a new usage after a round without any broadcast', async () => {
    mockGetUsageResult.mockResolvedValue('failed');
    mockStartUsage.mockImplementation(async ({ usageId }) => ({
      status: 'granted',
      usageId,
    }));
    const result = renderUsageHook();

    let prepared: { proceed: boolean; usageId?: string; isNewUsage: boolean };
    await act(async () => {
      prepared = await result.current.prepareRetryUsage({
        usageId: 'usage-1',
        succeededLocally: false,
      });
    });
    expect(prepared!).toMatchObject({ proceed: true, isNewUsage: true });
    expect(prepared!.usageId).not.toBe('usage-1');
  });

  it('keeps the result page when the new start is rejected', async () => {
    mockGetUsageResult.mockResolvedValue(undefined);
    mockStartUsage.mockResolvedValue({
      status: 'exhausted',
      featureId: 'BulkSend',
      data: {},
    });
    const result = renderUsageHook();

    await act(async () => {
      await expect(
        result.current.prepareRetryUsage({
          usageId: 'usage-1',
          succeededLocally: false,
        }),
      ).resolves.toMatchObject({ proceed: false, isNewUsage: false });
    });
  });
});
