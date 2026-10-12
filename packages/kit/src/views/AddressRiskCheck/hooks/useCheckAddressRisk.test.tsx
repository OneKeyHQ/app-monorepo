/** @jest-environment jsdom */

import { act, cleanup, renderHook, waitFor } from '@testing-library/react';

import { EModalAddressRiskCheckRoutes } from '@onekeyhq/shared/src/routes/addressRiskCheck';
import type { IAddressRiskCheckResult } from '@onekeyhq/shared/types/addressRiskCheck';
import { EKytRiskLevel } from '@onekeyhq/shared/types/kyt';

import {
  executeAddressRiskCheck,
  executeAddressRiskCheckWithHistory,
  useAddressRiskCheckRequest,
  useCheckAddressRisk,
} from './useCheckAddressRisk';

const mockPush = jest.fn();
const mockPop = jest.fn();
const mockPopStack = jest.fn();
const mockCheckAddressRisk = jest.fn<
  Promise<IAddressRiskCheckResult>,
  [{ networkId: string; address: string }]
>();
const mockAddCheck = jest.fn<Promise<void>, [unknown]>();
const mockGetCheck = jest.fn<
  Promise<{ result?: IAddressRiskCheckResult } | undefined>,
  [{ networkId: string; address: string }]
>();
const mockAddressRiskCheckSuccess = jest.fn<void, [unknown]>();
const mockHandleFreeTrialError = jest.fn<unknown, [unknown]>();

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/prime', () => ({
  usePrimePersistAtom: () => [
    {
      isLoggedIn: true,
      isLoggedInOnServer: true,
      primeSubscription: undefined,
    },
  ],
}));

jest.mock('../../Prime/hooks/usePrimeFeatureAccess', () => ({
  usePrimeFeatureAccess: () => ({
    handleFreeTrialError: (params: unknown) => mockHandleFreeTrialError(params),
  }),
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceAddressRiskCheck: {
      checkAddressRisk: (params: { networkId: string; address: string }) =>
        mockCheckAddressRisk(params),
    },
    simpleDb: {
      addressRiskCheck: {
        addCheck: (params: unknown) => mockAddCheck(params),
        getCheck: (params: { networkId: string; address: string }) =>
          mockGetCheck(params),
      },
    },
  },
}));

jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ push: mockPush, pop: mockPop, popStack: mockPopStack }),
}));

jest.mock('@onekeyhq/shared/src/utils/timerUtils', () => ({
  __esModule: true,
  default: { wait: () => Promise.resolve() },
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    prime: {
      usage: {
        addressRiskCheckSuccess: (params: unknown) =>
          mockAddressRiskCheckSuccess(params),
      },
    },
  },
}));

const riskResult: IAddressRiskCheckResult = {
  networkId: 'evm--1',
  address: '0x1234',
  provider: 'misttrack',
  level: EKytRiskLevel.Low,
  checkedAt: 1,
  cached: false,
  reasons: [],
};

const historyResult: IAddressRiskCheckResult = {
  ...riskResult,
  level: EKytRiskLevel.High,
  checkedAt: 100,
};

function buildFreeTrialError(code = 90_600) {
  return { code, data: { featureId: 'AddressRiskCheck' } };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCheckAddressRisk.mockResolvedValue(riskResult);
  mockAddCheck.mockResolvedValue(undefined);
  mockGetCheck.mockResolvedValue(undefined);
  mockHandleFreeTrialError.mockReturnValue(undefined);
});

afterEach(cleanup);

describe('executeAddressRiskCheck', () => {
  it('deduplicates an identical Send check and tracks it once', async () => {
    let resolveCheck: ((value: IAddressRiskCheckResult) => void) | undefined;
    mockCheckAddressRisk.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveCheck = resolve;
        }),
    );
    const request = {
      networkId: riskResult.networkId,
      address: riskResult.address,
      entryPoint: 'sendAddressInput' as const,
    };

    const firstCheck = executeAddressRiskCheck(request);
    const secondCheck = executeAddressRiskCheck(request);

    expect(secondCheck).toBe(firstCheck);
    expect(mockCheckAddressRisk).toHaveBeenCalledTimes(1);
    resolveCheck?.(riskResult);
    await expect(firstCheck).resolves.toBe(riskResult);
    await expect(secondCheck).resolves.toBe(riskResult);
    expect(mockAddressRiskCheckSuccess).toHaveBeenCalledTimes(1);
    expect(mockAddressRiskCheckSuccess).toHaveBeenCalledWith({
      entryPoint: 'sendAddressInput',
      network: riskResult.networkId,
      riskLevel: riskResult.level,
      riskFactorsCount: riskResult.reasons.length,
      cached: riskResult.cached,
      featureName: 'AddressRiskCheck',
      entitlementSource: undefined,
    });
    expect(mockAddCheck).toHaveBeenCalledTimes(1);
    expect(mockAddCheck).toHaveBeenCalledWith(
      expect.objectContaining({ result: riskResult }),
    );
  });

  it('returns the server result before local history persistence finishes', async () => {
    let resolvePersistence: (() => void) | undefined;
    mockAddCheck.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePersistence = resolve;
        }),
    );

    const checkPromise = executeAddressRiskCheck({
      networkId: riskResult.networkId,
      address: riskResult.address,
      entryPoint: 'sendAddressInput',
    });

    await expect(checkPromise).resolves.toBe(riskResult);
    expect(mockAddCheck).toHaveBeenCalledTimes(1);

    resolvePersistence?.();
  });

  it('allows retry after a failed request', async () => {
    mockCheckAddressRisk
      .mockRejectedValueOnce(new Error('request failed'))
      .mockResolvedValueOnce(riskResult);
    const request = {
      networkId: riskResult.networkId,
      address: riskResult.address,
      entryPoint: 'sendAddressInput' as const,
    };

    await expect(executeAddressRiskCheck(request)).rejects.toThrow(
      'request failed',
    );
    await expect(executeAddressRiskCheck(request)).resolves.toBe(riskResult);
    expect(mockCheckAddressRisk).toHaveBeenCalledTimes(2);
  });
});

describe('executeAddressRiskCheckWithHistory', () => {
  it('falls back to the last result of an address in the history when the free trial rejects the check', async () => {
    for (const code of [90_600, 90_601]) {
      mockCheckAddressRisk.mockRejectedValueOnce(
        buildFreeTrialError(code) as unknown as Error,
      );
      mockGetCheck.mockResolvedValueOnce({ result: historyResult });

      await expect(
        executeAddressRiskCheckWithHistory({
          networkId: riskResult.networkId,
          address: riskResult.address,
          entryPoint: 'historyList',
        }),
      ).resolves.toEqual({ result: historyResult, isHistoryResult: true });
      expect(mockGetCheck).toHaveBeenLastCalledWith(
        expect.objectContaining({
          networkId: riskResult.networkId,
          address: riskResult.address,
        }),
      );
    }
  });

  it('rethrows the free-trial error for a history record without a stored result', async () => {
    const freeTrialError = buildFreeTrialError();
    mockCheckAddressRisk.mockRejectedValueOnce(
      freeTrialError as unknown as Error,
    );
    // Records written before the full result was stored.
    mockGetCheck.mockResolvedValueOnce({});

    await expect(
      executeAddressRiskCheckWithHistory({
        networkId: riskResult.networkId,
        address: riskResult.address,
        entryPoint: 'inputManual',
      }),
    ).rejects.toBe(freeTrialError);
  });

  it('never falls back to a history result for the Send page check', async () => {
    const freeTrialError = buildFreeTrialError();
    mockCheckAddressRisk.mockRejectedValueOnce(
      freeTrialError as unknown as Error,
    );
    mockGetCheck.mockResolvedValue({ result: riskResult });

    await expect(
      executeAddressRiskCheckWithHistory({
        networkId: riskResult.networkId,
        address: riskResult.address,
        entryPoint: 'sendAddressInput',
      }),
    ).rejects.toBe(freeTrialError);
    expect(mockGetCheck).not.toHaveBeenCalled();
  });

  it('does not read the history for other failures', async () => {
    const error = new Error('request failed');
    mockCheckAddressRisk.mockRejectedValueOnce(error);

    await expect(
      executeAddressRiskCheckWithHistory({
        networkId: riskResult.networkId,
        address: riskResult.address,
        entryPoint: 'historyList',
      }),
    ).rejects.toBe(error);
    expect(mockGetCheck).not.toHaveBeenCalled();
  });
});

describe('useCheckAddressRisk', () => {
  it('opens the result page right away and lets it run the check', () => {
    for (const entryPoint of [
      'inputManual',
      'inputRecentList',
      'historyList',
    ] as const) {
      mockPush.mockClear();
      const { result } = renderHook(() => useCheckAddressRisk());

      act(() => {
        result.current.checkRisk({
          networkId: riskResult.networkId,
          address: riskResult.address,
          entryPoint,
        });
      });

      expect(mockPush).toHaveBeenCalledWith(
        EModalAddressRiskCheckRoutes.AddressRiskCheckResult,
        {
          checkRequest: {
            networkId: riskResult.networkId,
            address: riskResult.address,
            entryPoint,
          },
          showMoreAnalysis: true,
        },
      );
    }
    expect(mockCheckAddressRisk).not.toHaveBeenCalled();
  });

  it('ignores a double tap', () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(10_000);
    const { result } = renderHook(() => useCheckAddressRisk());
    const request = {
      networkId: riskResult.networkId,
      address: riskResult.address,
      entryPoint: 'inputRecentList' as const,
    };

    act(() => {
      result.current.checkRisk(request);
      result.current.checkRisk(request);
    });
    expect(mockPush).toHaveBeenCalledTimes(1);

    nowSpy.mockReturnValue(11_000);
    act(() => {
      result.current.checkRisk(request);
    });
    expect(mockPush).toHaveBeenCalledTimes(2);
    nowSpy.mockRestore();
  });
});

describe('useAddressRiskCheckRequest', () => {
  const historyRequest = {
    networkId: riskResult.networkId,
    address: riskResult.address,
    entryPoint: 'historyList' as const,
  };

  it('shows the server result', async () => {
    const { result } = renderHook(() =>
      useAddressRiskCheckRequest(historyRequest),
    );

    expect(result.current.result).toBeUndefined();
    await waitFor(() => expect(result.current.result).toBe(riskResult));
    expect(result.current.isHistoryResult).toBe(false);
    expect(result.current.isFailed).toBe(false);
    expect(mockCheckAddressRisk).toHaveBeenCalledWith({
      networkId: riskResult.networkId,
      address: riskResult.address,
    });
  });

  it('shows the history result when the free trial rejects the check', async () => {
    mockCheckAddressRisk.mockRejectedValueOnce(
      buildFreeTrialError() as unknown as Error,
    );
    mockGetCheck.mockResolvedValueOnce({ result: historyResult });
    const { result } = renderHook(() =>
      useAddressRiskCheckRequest(historyRequest),
    );

    await waitFor(() => expect(result.current.result).toBe(historyResult));
    expect(result.current.isHistoryResult).toBe(true);
    expect(mockPop).not.toHaveBeenCalled();
    expect(mockHandleFreeTrialError).not.toHaveBeenCalled();
  });

  it('goes back to the list before the free-trial feedback inside the feature', async () => {
    const freeTrialError = buildFreeTrialError();
    mockCheckAddressRisk.mockRejectedValueOnce(
      freeTrialError as unknown as Error,
    );
    renderHook(() => useAddressRiskCheckRequest(historyRequest));

    await waitFor(() =>
      expect(mockHandleFreeTrialError).toHaveBeenCalledWith({
        error: freeTrialError,
        networkId: riskResult.networkId,
        afterPageExit: true,
      }),
    );
    expect(mockPop).toHaveBeenCalledTimes(1);
    expect(mockPopStack).not.toHaveBeenCalled();
  });

  it('closes the whole modal before the free-trial feedback of the Send page check', async () => {
    mockCheckAddressRisk.mockRejectedValueOnce(
      buildFreeTrialError() as unknown as Error,
    );
    renderHook(() =>
      useAddressRiskCheckRequest({
        ...historyRequest,
        entryPoint: 'sendAddressInput',
      }),
    );

    await waitFor(() => expect(mockHandleFreeTrialError).toHaveBeenCalled());
    expect(mockPopStack).toHaveBeenCalledTimes(1);
    expect(mockPop).not.toHaveBeenCalled();
  });

  it('shows the failed state for other failures', async () => {
    mockCheckAddressRisk.mockRejectedValueOnce(new Error('request failed'));
    const { result } = renderHook(() =>
      useAddressRiskCheckRequest(historyRequest),
    );

    await waitFor(() => expect(result.current.isFailed).toBe(true));
    expect(result.current.result).toBeUndefined();
    expect(mockPop).not.toHaveBeenCalled();
    expect(mockHandleFreeTrialError).not.toHaveBeenCalled();
  });

  it('gives no feedback after the page is closed', async () => {
    let rejectCheck: ((error: unknown) => void) | undefined;
    mockCheckAddressRisk.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejectCheck = reject;
        }),
    );
    const { unmount } = renderHook(() =>
      useAddressRiskCheckRequest(historyRequest),
    );
    unmount();

    await act(async () => {
      rejectCheck?.(buildFreeTrialError());
    });

    expect(mockPop).not.toHaveBeenCalled();
    expect(mockHandleFreeTrialError).not.toHaveBeenCalled();
  });
});
