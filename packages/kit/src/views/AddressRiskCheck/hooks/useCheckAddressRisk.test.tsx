/** @jest-environment jsdom */

import { StrictMode } from 'react';
import type { PropsWithChildren } from 'react';

import { act, cleanup, renderHook } from '@testing-library/react';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalAddressRiskCheckRoutes } from '@onekeyhq/shared/src/routes/addressRiskCheck';
import type { IAddressRiskCheckResult } from '@onekeyhq/shared/types/addressRiskCheck';
import { EKytRiskLevel } from '@onekeyhq/shared/types/kyt';

import {
  executeAddressRiskCheck,
  useCheckAddressRisk,
} from './useCheckAddressRisk';

const mockPush = jest.fn();
const mockCheckAddressRisk = jest.fn<
  Promise<IAddressRiskCheckResult>,
  [{ networkId: string; address: string }]
>();
const mockAddCheck = jest.fn<Promise<void>, [unknown]>();
const mockAddressRiskCheckSuccess = jest.fn<void, [unknown]>();
const mockToastError = jest.fn();
let mockIsRouteFocused = true;

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

jest.mock('@onekeyhq/components', () => ({
  Toast: {
    error: (params: unknown) => {
      mockToastError(params);
    },
  },
}));

jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocused: () => mockIsRouteFocused,
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
      },
    },
  },
}));

jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ push: mockPush }),
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

function StrictModeWrapper({ children }: PropsWithChildren) {
  return <StrictMode>{children}</StrictMode>;
}

describe('useCheckAddressRisk navigation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsRouteFocused = true;
    mockCheckAddressRisk.mockResolvedValue(riskResult);
    mockAddCheck.mockResolvedValue(undefined);
  });

  afterEach(cleanup);

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
    });
    expect(mockAddCheck).toHaveBeenCalledTimes(1);
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

  it('keeps manual and history results in the current modal', async () => {
    const { result } = renderHook(() => useCheckAddressRisk());

    for (const entryPoint of ['inputManual', 'historyList'] as const) {
      mockPush.mockClear();

      await act(async () => {
        await result.current.checkRisk({
          networkId: riskResult.networkId,
          address: riskResult.address,
          entryPoint,
        });
      });

      expect(mockPush).toHaveBeenCalledWith(
        EModalAddressRiskCheckRoutes.AddressRiskCheckResult,
        { result: riskResult, showMoreAnalysis: true },
      );
    }
  });

  it('still presents a result after the Strict Mode effect replay', async () => {
    const { result } = renderHook(() => useCheckAddressRisk(), {
      wrapper: StrictModeWrapper,
    });

    await act(async () => {
      await result.current.checkRisk({
        networkId: riskResult.networkId,
        address: riskResult.address,
        entryPoint: 'inputManual',
      });
    });

    expect(mockPush).toHaveBeenCalledWith(
      EModalAddressRiskCheckRoutes.AddressRiskCheckResult,
      { result: riskResult, showMoreAnalysis: true },
    );
  });

  it('does not present a result after the source route loses focus', async () => {
    let resolveCheck: ((value: IAddressRiskCheckResult) => void) | undefined;
    mockCheckAddressRisk.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveCheck = resolve;
        }),
    );
    const { result, rerender } = renderHook(() => useCheckAddressRisk());
    let checkPromise: Promise<IAddressRiskCheckResult | undefined> | undefined;

    act(() => {
      checkPromise = result.current.checkRisk({
        networkId: riskResult.networkId,
        address: riskResult.address,
        entryPoint: 'inputManual',
      });
    });
    mockIsRouteFocused = false;
    rerender();

    await act(async () => {
      resolveCheck?.(riskResult);
      await checkPromise;
    });

    expect(mockPush).not.toHaveBeenCalled();
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it('does not present a result after the source unmounts', async () => {
    let resolveCheck: ((value: IAddressRiskCheckResult) => void) | undefined;
    mockCheckAddressRisk.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveCheck = resolve;
        }),
    );
    const { result, unmount } = renderHook(() => useCheckAddressRisk());
    let checkPromise: Promise<IAddressRiskCheckResult | undefined> | undefined;

    act(() => {
      checkPromise = result.current.checkRisk({
        networkId: riskResult.networkId,
        address: riskResult.address,
        entryPoint: 'inputManual',
      });
    });
    unmount();

    await act(async () => {
      resolveCheck?.(riskResult);
      await checkPromise;
    });

    expect(mockPush).not.toHaveBeenCalled();
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it('shows a retryable address risk error without asking to refresh', async () => {
    mockCheckAddressRisk.mockRejectedValueOnce(new Error('request failed'));
    const { result } = renderHook(() => useCheckAddressRisk());

    await act(async () => {
      await result.current.checkRisk({
        networkId: riskResult.networkId,
        address: riskResult.address,
        entryPoint: 'inputManual',
      });
    });

    expect(mockToastError).toHaveBeenCalledWith({
      title: ETranslations.address_risk_check_level_failed__title,
      message: ETranslations.address_risk_check_level_failed__desc,
    });
  });
});
