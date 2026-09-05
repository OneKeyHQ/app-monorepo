/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  EHostSecurityLevel,
  type IHostSecurity,
} from '@onekeyhq/shared/types/discovery';

import { useRiskDetection } from './useRiskDetection';

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

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: jest.fn(),
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceDiscovery: {
      checkUrlSecurity: jest.fn(),
    },
  },
}));

jest.mock(
  '@onekeyhq/kit-bg/src/services/ServicePrime/primeAnalyticsProfile',
  () => ({
    buildPrimeAnalyticsProfileSnapshot: jest.fn(() => ({
      isPrimeActive: false,
    })),
  }),
);

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  primePersistAtom: {
    get: jest.fn(async () => ({})),
  },
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    discovery: {
      dapp: {
        dappRiskDetect: jest.fn(),
      },
    },
    prime: {
      usage: {
        siteScanRiskWarned: jest.fn(),
      },
    },
  },
}));

const mockUsePromiseResult = usePromiseResult as jest.Mock;

function securityInfo(level: EHostSecurityLevel): IHostSecurity {
  return { level } as IHostSecurity;
}

describe('useRiskDetection', () => {
  let backendSecurityResult:
    | { origin: string; info: IHostSecurity }
    | undefined;

  beforeEach(() => {
    backendSecurityResult = undefined;
    mockUsePromiseResult.mockImplementation(() => ({
      result: backendSecurityResult,
    }));
  });

  it('blocks an origin until its security check settles', () => {
    const { result, rerender } = renderHook(
      ({ origin }) => useRiskDetection({ origin }),
      { initialProps: { origin: 'https://safe.example' } },
    );

    expect(result.current.showContinueOperate).toBe(false);
    expect(result.current.continueOperate).toBe(false);

    backendSecurityResult = {
      origin: 'https://safe.example',
      info: securityInfo(EHostSecurityLevel.Security),
    };
    rerender({ origin: 'https://safe.example' });

    expect(result.current.continueOperate).toBe(true);
  });

  it('waits for the backend when WalletConnect cannot verify the origin', () => {
    const walletConnectVerifyContext = {
      verified: {
        validation: 'UNKNOWN',
        isScam: false,
      },
    } as Parameters<typeof useRiskDetection>[0]['walletConnectVerifyContext'];
    const { result } = renderHook(() =>
      useRiskDetection({
        origin: 'https://unknown.example',
        walletConnectVerifyContext,
      }),
    );

    expect(result.current.urlSecurityInfo).toBeUndefined();
    expect(result.current.continueOperate).toBe(false);
  });

  it('lets a user acknowledge a conclusive WalletConnect risk before the backend settles', () => {
    const walletConnectVerifyContext = {
      verified: {
        validation: 'INVALID',
        isScam: false,
      },
    } as Parameters<typeof useRiskDetection>[0]['walletConnectVerifyContext'];
    const { result, rerender } = renderHook(() =>
      useRiskDetection({
        origin: 'https://invalid.example',
        walletConnectVerifyContext,
      }),
    );

    expect(result.current.riskLevel).toBe(EHostSecurityLevel.High);
    act(() => result.current.setContinueOperate(true));
    expect(result.current.continueOperate).toBe(true);

    backendSecurityResult = {
      origin: 'https://invalid.example',
      info: securityInfo(EHostSecurityLevel.Security),
    };
    rerender();
    expect(result.current.continueOperate).toBe(true);
  });

  it('does not reuse an acknowledgement for a new origin or verdict', () => {
    backendSecurityResult = {
      origin: 'https://risky.example',
      info: securityInfo(EHostSecurityLevel.Medium),
    };
    const { result, rerender } = renderHook(
      ({ origin }) => useRiskDetection({ origin }),
      { initialProps: { origin: 'https://risky.example' } },
    );

    act(() => result.current.setContinueOperate(true));
    expect(result.current.continueOperate).toBe(true);

    rerender({ origin: 'https://other.example' });
    expect(result.current.continueOperate).toBe(false);

    backendSecurityResult = {
      origin: 'https://risky.example',
      info: securityInfo(EHostSecurityLevel.Medium),
    };
    rerender({ origin: 'https://risky.example' });
    expect(result.current.continueOperate).toBe(false);

    backendSecurityResult = {
      origin: 'https://other.example',
      info: securityInfo(EHostSecurityLevel.Medium),
    };
    rerender({ origin: 'https://other.example' });
    expect(result.current.continueOperate).toBe(false);

    act(() => result.current.setContinueOperate(true));
    backendSecurityResult = {
      origin: 'https://other.example',
      info: securityInfo(EHostSecurityLevel.High),
    };
    rerender({ origin: 'https://other.example' });
    expect(result.current.continueOperate).toBe(false);
  });

  it('allows requests without an origin without waiting for a scan', () => {
    const { result } = renderHook(() => useRiskDetection({ origin: '' }));

    expect(result.current.continueOperate).toBe(true);
  });

  it('treats a malformed completed response as unverified', () => {
    backendSecurityResult = {
      origin: 'https://unknown.example',
      info: {} as IHostSecurity,
    };
    const { result } = renderHook(() =>
      useRiskDetection({ origin: 'https://unknown.example' }),
    );

    expect(result.current.urlSecurityInfo?.level).toBe(
      EHostSecurityLevel.Unknown,
    );
    expect(result.current.continueOperate).toBe(true);
  });
});

describe('site security lookup deadline', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockUsePromiseResult.mockImplementation(
      jest.requireActual<
        typeof import('@onekeyhq/kit/src/hooks/usePromiseResult')
      >('../../../hooks/usePromiseResult').usePromiseResult,
    );
    jest
      .mocked(backgroundApiProxy.serviceDiscovery)
      .checkUrlSecurity.mockReturnValue(new Promise(() => undefined));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it.each([false, true])(
    'settles a stalled lookup without erasing WalletConnect risk (%s)',
    async (isScam) => {
      const { result } = renderHook(() =>
        useRiskDetection({
          origin: 'https://app.example',
          walletConnectVerifyContext: {
            verified: { validation: 'UNKNOWN', isScam },
          } as Parameters<
            typeof useRiskDetection
          >[0]['walletConnectVerifyContext'],
        }),
      );

      await act(async () => jest.advanceTimersByTimeAsync(10_000));

      expect(result.current.urlSecurityInfo?.level).toBe(
        isScam ? EHostSecurityLevel.High : EHostSecurityLevel.Unknown,
      );
      expect(result.current.continueOperate).toBe(!isScam);
    },
  );
});
