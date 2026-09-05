/** @jest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';

import type { IEncodedTx } from '@onekeyhq/core/src/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { EHostSecurityLevel } from '@onekeyhq/shared/types/discovery';
import type { IPrimeUserInfo } from '@onekeyhq/shared/types/prime/primeTypes';
import { ETransactionSecurityResultCode } from '@onekeyhq/shared/types/transactionSecurity';

import { useTransactionSecurityCheck } from './useTransactionSecurityCheck';

let mockUser = { onekeyUserId: 'user-a' };

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  usePrimeInitAtom: () => [{ isReady: false }],
  usePrimePersistAtom: () => [mockUser],
}));
jest.mock('@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth', () => ({
  useOneKeyAuthMethods: () => ({
    user: mockUser,
    isPrimeSubscriptionActive: true,
  }),
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    servicePrime: { getLocalUserInfo: jest.fn() },
    serviceNetwork: { isCustomNetwork: jest.fn(async () => false) },
    serviceSignatureConfirm: { checkTransactionSecurity: jest.fn() },
  },
}));
jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocused: () => true,
}));
jest.mock('@onekeyhq/components', () => ({
  getCurrentVisibilityState: () => true,
  onVisibilityStateChange: () => () => undefined,
  useDeferredPromise: jest.requireActual<
    typeof import('@onekeyhq/components/src/hooks/useDeferredPromise')
  >('../../../../../components/src/hooks/useDeferredPromise')
    .useDeferredPromise,
  useNetInfo: () => ({ isInternetReachable: true }),
}));

const primeService = jest.mocked(backgroundApiProxy.servicePrime);
const securityService = jest.mocked(backgroundApiProxy.serviceSignatureConfirm);
const primeUserInfo = {
  isLoggedIn: true,
  isLoggedInOnServer: true,
  primeSubscription: { isActive: true },
} as IPrimeUserInfo;
const request = {
  requestKey: 'request-1',
  origin: 'https://app.example',
  accountId: 'account-1',
  networkId: 'evm--1',
  jsonRpc: { method: 'personal_sign', params: ['0x1234', '0xaccount'] },
};
const safeResult = {
  level: EHostSecurityLevel.Security,
  detail: { code: 'benign', features: [] },
};

describe('useTransactionSecurityCheck', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = { onekeyUserId: 'user-a' };
    primeService.getLocalUserInfo.mockResolvedValue(primeUserInfo);
    securityService.checkTransactionSecurity.mockResolvedValue(safeResult);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it.each(['membership', 'scan'] as const)(
    'ends a stalled %s lookup and allows an explicit retry',
    async (stage) => {
      jest.useFakeTimers();
      if (stage === 'membership') {
        primeService.getLocalUserInfo.mockReturnValueOnce(
          new Promise(() => undefined),
        );
      } else {
        securityService.checkTransactionSecurity.mockReturnValueOnce(
          new Promise(() => undefined),
        );
      }
      const { result } = renderHook(() => useTransactionSecurityCheck(request));
      await act(async () => undefined);
      expect(result.current.isPending).toBe(true);

      await act(async () => jest.advanceTimersByTimeAsync(10_000));

      expect(result.current.isPending).toBe(false);
      expect(result.current.result?.detail.code).toBe(
        ETransactionSecurityResultCode.CheckFailed,
      );
      await act(async () => result.current.retry?.());
      expect(result.current.isPending).toBe(false);
      expect(result.current.result).toEqual(safeResult);
    },
  );

  it('keeps a known batch risk when a sibling scan times out', async () => {
    jest.useFakeTimers();
    securityService.checkTransactionSecurity
      .mockResolvedValueOnce({
        level: EHostSecurityLevel.High,
        detail: { code: 'known_malicious_interaction', features: [] },
      })
      .mockReturnValueOnce(new Promise(() => undefined));
    const { result } = renderHook(() =>
      useTransactionSecurityCheck({
        ...request,
        jsonRpc: undefined,
        unsignedTxs: ['0x1', '0x2'].map((to) => ({
          encodedTx: {
            to,
            data: '0x',
            value: '0x0',
            gas: '0x5208',
          } as IEncodedTx,
        })),
      }),
    );
    await act(async () => undefined);

    await act(async () => jest.advanceTimersByTimeAsync(10_000));

    expect(result.current.isPending).toBe(false);
    expect(result.current.result).toMatchObject({
      level: EHostSecurityLevel.High,
      coverage: { hasFailedRequests: true },
    });
  });

  it.each([true, false])(
    'resolves membership %s without the lazy Prime effect',
    async (isPrimeUser) => {
      primeService.getLocalUserInfo.mockResolvedValue({
        ...primeUserInfo,
        primeSubscription: isPrimeUser
          ? primeUserInfo.primeSubscription
          : undefined,
      });
      const { result } = renderHook(() => useTransactionSecurityCheck(request));

      expect(result.current.isPending).toBe(true);
      await waitFor(() => expect(result.current.isPending).toBe(false));
      expect(result.current.isPrimeUser).toBe(isPrimeUser);
      expect(securityService.checkTransactionSecurity.mock.calls).toHaveLength(
        isPrimeUser ? 1 : 0,
      );
      if (isPrimeUser) {
        expect(result.current.result).toEqual(safeResult);
      } else {
        await waitFor(() => expect(result.current.isApplicable).toBe(true));
      }
    },
  );

  it('ends a failed eligibility lookup and retries it before scanning', async () => {
    primeService.getLocalUserInfo.mockRejectedValueOnce(
      new Error('IPC unavailable'),
    );
    const { result } = renderHook(() => useTransactionSecurityCheck(request));

    await waitFor(() =>
      expect(result.current.result?.detail.code).toBe(
        ETransactionSecurityResultCode.CheckFailed,
      ),
    );
    expect(result.current.isPending).toBe(false);
    expect(securityService.checkTransactionSecurity.mock.calls).toHaveLength(0);

    act(() => result.current.retry?.());
    await waitFor(() => expect(result.current.result).toEqual(safeResult));
    expect(result.current.isPending).toBe(false);
    expect(primeService.getLocalUserInfo.mock.calls).toHaveLength(2);
  });

  it('ignores late eligibility from a previous user', async () => {
    let resolvePrevious: (userInfo: IPrimeUserInfo) => void = () => undefined;
    primeService.getLocalUserInfo.mockReturnValueOnce(
      new Promise<IPrimeUserInfo>((resolve) => {
        resolvePrevious = resolve;
      }),
    );
    const { result, rerender } = renderHook(() =>
      useTransactionSecurityCheck(request),
    );

    mockUser = { onekeyUserId: 'user-b' };
    rerender();
    await waitFor(() => expect(result.current.result).toEqual(safeResult));
    await act(async () =>
      resolvePrevious({ ...primeUserInfo, primeSubscription: undefined }),
    );
    expect(result.current.isPrimeUser).toBe(true);
    expect(result.current.result).toEqual(safeResult);
  });
});
