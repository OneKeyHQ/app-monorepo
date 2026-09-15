import { HardwareErrorCode } from '@onekeyfe/hd-shared';

import { OneKeyLocalError } from '../errors';
import { EOneKeyErrorClassNames } from '../errors/types/errorTypes';
import platformEnv from '../platformEnv';

import {
  noteAvailabilityProxyPreflight,
  resetAvailabilityContextForTest,
  setAvailabilityIpTableState,
} from './availabilityContext';
import {
  createApiAvailabilityTiming,
  createIpTableAvailabilityTiming,
  createWebViewAvailabilityTiming,
  getApiAvailabilityTarget,
  getAvailabilityErrorCode,
  getAvailabilityFailureStatus,
  getAvailabilityFlowFailureStatus,
  markApiAvailabilityProxy,
  markApiAvailabilityRoute,
  normalizeAvailabilityErrorCode,
  reportApiAvailabilityResult,
  reportIpTableAvailabilityResult,
  reportWebViewRenderProcessGone,
  withAvailabilityFlow,
} from './availabilityMetrics';

const mockRecordAvailabilityOutcome = jest.fn();
const mockFinish = jest.fn();
const mockStartAvailabilityFlow = jest.fn(() => ({ finish: mockFinish }));

jest.mock('./availabilityAggregator', () => ({
  normalizeAvailabilityToken: jest.fn(),
  recordAvailabilityOutcome: (...args: unknown[]) => {
    mockRecordAvailabilityOutcome(...args);
  },
  startAvailabilityFlow: (...args: unknown[]) =>
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    (mockStartAvailabilityFlow as (...a: unknown[]) => unknown)(...args),
}));

const mutablePlatformEnv = platformEnv as { isDesktop?: boolean };
const originalIsDesktop = mutablePlatformEnv.isDesktop;
const originalNavigator = Object.getOwnPropertyDescriptor(
  globalThis,
  'navigator',
);

function setNavigator(value: unknown) {
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value,
  });
}

function recordedOutcomes() {
  return mockRecordAvailabilityOutcome.mock.calls.map(
    ([outcome]) =>
      outcome as { source: string; target: string; status: string },
  );
}

describe('availabilityMetrics', () => {
  afterEach(() => {
    mutablePlatformEnv.isDesktop = originalIsDesktop;
    if (originalNavigator) {
      Object.defineProperty(globalThis, 'navigator', originalNavigator);
    } else {
      Reflect.deleteProperty(globalThis, 'navigator');
    }
  });

  beforeEach(() => {
    resetAvailabilityContextForTest();
    mockRecordAvailabilityOutcome.mockClear();
    mockFinish.mockClear();
    mockStartAvailabilityFlow.mockClear();
  });

  describe('getApiAvailabilityTarget', () => {
    it('keeps only a low-cardinality route group for OneKey APIs', () => {
      expect(
        getApiAvailabilityTarget({
          baseURL: 'https://wallet.onekeycn.com',
          url: '/wallet/v1/account/send-transaction?address=0xsecret',
        }),
      ).toEqual({
        routeGroup: '/wallet/v1/account',
        service: 'wallet',
      });
    });

    it('replaces id-like path segments', () => {
      expect(
        getApiAvailabilityTarget({
          url: 'https://earn.onekeycn.com/earn/0x9f8e7d6c5b4a/detail',
        }),
      ).toEqual({
        routeGroup: '/earn/:id/detail',
        service: 'earn',
      });
    });

    it('classifies supported third-party services', () => {
      expect(
        getApiAvailabilityTarget({
          url: 'https://api.hyperliquid.xyz/info',
        }),
      ).toEqual({
        routeGroup: '/info',
        service: 'hyperliquid',
      });
    });

    it('does not report unknown hosts or analytics delivery', () => {
      expect(
        getApiAvailabilityTarget({
          url: 'https://example.com/private/path',
        }),
      ).toBeUndefined();
      expect(
        getApiAvailabilityTarget({
          baseURL: 'https://utility.onekeycn.com',
          url: '/utility/v1/track/event',
        }),
      ).toBeUndefined();
    });
  });

  describe('error normalization', () => {
    it('keeps stable codes and rejects free-form messages', () => {
      expect(normalizeAvailabilityErrorCode('ERR_NETWORK')).toBe('err_network');
      expect(normalizeAvailabilityErrorCode(40_001)).toBe('40001');
      expect(normalizeAvailabilityErrorCode('request failed: secret')).toBe(
        'unknown',
      );
      expect(
        getAvailabilityErrorCode({ className: 'OneKeyServerApiError' }),
      ).toBe('onekeyserverapierror');
    });

    it('classifies aborts, timeouts and network errors', () => {
      expect(getAvailabilityFailureStatus({ code: 'ERR_CANCELED' })).toBe(
        'cancelled',
      );
      expect(getAvailabilityFailureStatus({ code: 'ETIMEDOUT' })).toBe(
        'timeout',
      );
      expect(getAvailabilityFailureStatus({ code: 'ERR_NETWORK' })).toBe(
        'network_error',
      );
    });

    it('treats user and hardware cancellations as cancelled, not failed', () => {
      expect(
        getAvailabilityFlowFailureStatus({
          className: EOneKeyErrorClassNames.PasswordPromptDialogCancel,
        }),
      ).toBe('cancelled');
      expect(
        getAvailabilityFlowFailureStatus({
          code: HardwareErrorCode.ActionCancelled,
        }),
      ).toBe('cancelled');
      expect(
        getAvailabilityFlowFailureStatus({
          code: HardwareErrorCode.PinCancelled,
        }),
      ).toBe('cancelled');
      expect(getAvailabilityFlowFailureStatus(new Error('boom'))).toBe(
        'failed',
      );
    });

    it('classifies without mutating the observed error', () => {
      const abortError = { code: 'ERR_CANCELED', name: 'CanceledError' };
      expect(getAvailabilityFailureStatus(abortError)).toBe('cancelled');
      expect(abortError).toEqual({
        code: 'ERR_CANCELED',
        name: 'CanceledError',
      });
      expect(getAvailabilityFailureStatus({ code: 'SNI_CANCELLED' })).toBe(
        'cancelled',
      );
    });
  });

  describe('API results', () => {
    it('records one outcome per timing with a stable error code', () => {
      const timing = createApiAvailabilityTiming({
        baseURL: 'https://swap.onekeycn.com',
        url: '/swap/v1/quote',
      });

      reportApiAvailabilityResult({
        httpStatusCode: 200,
        responseCode: 50_001,
        status: 'api_error',
        timing,
      });
      reportApiAvailabilityResult({ status: 'ok', timing });

      // Web/extension runtimes (jest default) keep only the network breakdown.
      expect(recordedOutcomes()).toEqual([
        expect.objectContaining({
          source: 'api',
          target: 'swap',
          status: 'api_error',
          detail: 'direct:/swap/v1/quote',
          errorCode: 'api_50001',
        }),
        { source: 'api_net', target: 'unknown', status: 'error' },
      ]);
    });

    it('attaches real route, proxy, network and IP Table context on IP Table runtimes', () => {
      mutablePlatformEnv.isDesktop = true;
      setNavigator({ onLine: false });
      setAvailabilityIpTableState('enabled');
      const timing = createApiAvailabilityTiming({
        baseURL: 'https://wallet.onekeycn.com',
        url: '/wallet/v1/account/list',
      });
      markApiAvailabilityRoute(timing, 'sni');
      markApiAvailabilityProxy(timing, false);

      reportApiAvailabilityResult({
        errorCode: 'SNI_TIMEOUT',
        status: 'timeout',
        timing,
      });

      expect(recordedOutcomes()).toEqual([
        expect.objectContaining({
          source: 'api',
          detail: 'sni:/wallet/v1/account',
        }),
        expect.objectContaining({
          source: 'api_route',
          target: 'sni',
          status: 'timeout',
          durationMs: expect.any(Number) as number,
        }),
        { source: 'api_net', target: 'offline', status: 'failed' },
        { source: 'api_proxy', target: 'off', status: 'failed' },
        { source: 'api_ip_table', target: 'enabled', status: 'failed' },
      ]);
      // A route mark after the outcome is ignored.
      markApiAvailabilityRoute(timing, 'fallback');
      expect(timing?.route).toBe('sni');
    });

    it('buckets server answers as error and transport failures as failed', () => {
      mutablePlatformEnv.isDesktop = true;
      const report = (
        status: 'api_error' | 'http_error' | 'network_error' | 'ok',
      ) => {
        mockRecordAvailabilityOutcome.mockClear();
        reportApiAvailabilityResult({
          httpStatusCode: 502,
          status,
          timing: createApiAvailabilityTiming({
            url: 'https://wallet.onekeycn.com/wallet/v1/network/list',
          }),
        });
        return recordedOutcomes()
          .filter(({ source }) => source === 'api_ip_table')
          .map(({ status: bucket }) => bucket);
      };

      expect(report('ok')).toEqual(['ok']);
      expect(report('api_error')).toEqual(['error']);
      expect(report('http_error')).toEqual(['error']);
      expect(report('network_error')).toEqual(['failed']);
    });

    it('reuses a proxy preflight only for the same hostname', () => {
      mutablePlatformEnv.isDesktop = true;
      noteAvailabilityProxyPreflight('wallet.onekeycn.com', true);
      const proxyTarget = (url: string) => {
        mockRecordAvailabilityOutcome.mockClear();
        reportApiAvailabilityResult({
          status: 'ok',
          timing: createApiAvailabilityTiming({ url }),
        });
        return recordedOutcomes().find(({ source }) => source === 'api_proxy')
          ?.target;
      };

      expect(proxyTarget('https://wallet.onekeycn.com/wallet/v1/x')).toBe('on');
      expect(proxyTarget('https://api.hyperliquid.xyz/info')).toBe('unknown');
    });

    it('keeps cancelled requests out of the settled breakdowns', () => {
      mutablePlatformEnv.isDesktop = true;
      reportApiAvailabilityResult({
        status: 'cancelled',
        timing: createApiAvailabilityTiming({
          url: 'https://wallet.onekeycn.com/wallet/v1/network/list',
        }),
      });

      expect(recordedOutcomes().map(({ source }) => source)).toEqual([
        'api',
        'api_route',
      ]);
    });

    it('ignores requests without a known target', () => {
      reportApiAvailabilityResult({
        status: 'ok',
        timing: createApiAvailabilityTiming({ url: 'https://example.com/a' }),
      });
      expect(mockRecordAvailabilityOutcome).not.toHaveBeenCalled();
    });
  });

  describe('createWebViewAvailabilityTiming', () => {
    it('keeps only an allowlisted service group for first-party pages', () => {
      expect(
        createWebViewAvailabilityTiming({
          url: 'https://tradingview.onekey.so/chart/private-account?token=secret',
        }),
      ).toEqual(expect.objectContaining({ service: 'onekey-web' }));
    });

    it('coarsens arbitrary WebView hosts and rejects non-http sources', () => {
      expect(
        createWebViewAvailabilityTiming({
          url: 'https://private-dapp.example/user/wallet',
        }),
      ).toEqual(expect.objectContaining({ service: 'external-web' }));
      expect(
        createWebViewAvailabilityTiming({
          url: 'file:///private/page.html',
        }),
      ).toBeUndefined();
    });

    it('counts render process loss without an active navigation', () => {
      reportWebViewRenderProcessGone({
        didCrash: true,
        url: 'https://private-dapp.example/user/wallet',
      });
      expect(mockRecordAvailabilityOutcome).toHaveBeenCalledWith({
        source: 'webview',
        target: 'external-web',
        status: 'render_process_gone',
        errorCode: 'crashed',
      });
    });
  });

  describe('IP Table results', () => {
    it('uses only a known service name and excludes arbitrary hosts', () => {
      expect(
        createIpTableAvailabilityTiming({
          hostname: 'wallet.onekeycn.com',
          url: '/wallet/v1/network/list',
        }),
      ).toEqual(
        expect.objectContaining({
          routeGroup: '/wallet/v1/network',
          service: 'wallet',
        }),
      );
      expect(
        createIpTableAvailabilityTiming({
          hostname: 'private.example.com',
        }),
      ).toBeUndefined();
    });

    it('does not measure analytics delivery through the adapter', () => {
      expect(
        createIpTableAvailabilityTiming({
          baseURL: 'https://utility.onekeycn.com',
          hostname: 'utility.onekeycn.com',
          url: '/utility/v1/track/event',
        }),
      ).toBeUndefined();
    });

    it('combines SNI and fallback codes for failed fallbacks', () => {
      reportIpTableAvailabilityResult({
        fallbackErrorCode: 'ERR_NETWORK',
        sniErrorCode: 'SNI_TIMEOUT',
        status: 'fallback_failed',
        timing: createIpTableAvailabilityTiming({
          hostname: 'wallet.onekeycn.com',
        }),
      });
      expect(mockRecordAvailabilityOutcome).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'sni',
          status: 'fallback_failed',
          errorCode: 'sni_timeout-err_network',
        }),
      );
    });
  });

  describe('withAvailabilityFlow', () => {
    it('passes results through and records the success outcome', async () => {
      await expect(
        withAvailabilityFlow('cloud_backup', async () => 'done', {
          detail: 'icloud',
          trackUnfinished: true,
        }),
      ).resolves.toBe('done');
      expect(mockStartAvailabilityFlow).toHaveBeenCalledWith('cloud_backup', {
        detail: 'icloud',
        trackUnfinished: true,
      });
      expect(mockFinish).toHaveBeenCalledWith({ status: 'ok' });
    });

    it('rethrows the original error with a classified outcome', async () => {
      const error = { code: HardwareErrorCode.ActionCancelled };
      await expect(
        withAvailabilityFlow('hw_connect', async () => {
          // eslint-disable-next-line no-throw-literal -- hardware SDK failures are plain payload objects
          throw error;
        }),
      ).rejects.toBe(error);
      expect(mockFinish).toHaveBeenCalledWith({
        status: 'cancelled',
        errorCode: '803',
        detail: undefined,
      });
    });

    it('never lets classification callbacks break the flow', async () => {
      await expect(
        withAvailabilityFlow('send', async () => 1, {
          onSuccess: () => {
            throw new OneKeyLocalError('classifier bug');
          },
        }),
      ).resolves.toBe(1);
      expect(mockFinish).toHaveBeenCalledWith({ status: 'ok' });
    });
  });
});

describe('availabilityMetrics error codes', () => {
  it('prefers the class name over the default OneKey error code', () => {
    expect(
      getAvailabilityErrorCode({
        code: -99_999,
        className: 'PasswordPromptDialogCancel',
      }),
    ).toBe('passwordpromptdialogcancel');
    expect(
      getAvailabilityErrorCode({ code: 803, className: 'OneKeyHardwareError' }),
    ).toBe('803');
    expect(getAvailabilityErrorCode({ code: -99_999 })).toBe('-99999');
  });

  it('classifies hardware SDK timeout payloads as timeout', () => {
    expect(
      getAvailabilityFlowFailureStatus({
        code: HardwareErrorCode.BleTimeoutError,
        error: 'BLE connect',
      }),
    ).toBe('timeout');
    expect(
      getAvailabilityFlowFailureStatus({ code: 1, error: 'Polling timeout' }),
    ).toBe('timeout');
  });
});
