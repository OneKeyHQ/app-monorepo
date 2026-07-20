import {
  createIpTableAvailabilityTiming,
  createWebViewAvailabilityTiming,
  getApiAvailabilityTarget,
  getAvailabilityErrorCode,
  getAvailabilityFailureStatus,
  normalizeAvailabilityErrorCode,
} from './availabilityMetrics';

describe('availabilityMetrics', () => {
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

    it('classifies cancellation and timeout without uploading messages', () => {
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
  });

  describe('createWebViewAvailabilityTiming', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('keeps only an allowlisted service group for first-party pages', () => {
      jest.spyOn(Math, 'random').mockReturnValue(0);
      expect(
        createWebViewAvailabilityTiming({
          attemptId: 'attempt-1',
          url: 'https://tradingview.onekey.so/chart/private-account?token=secret',
        }),
      ).toEqual(
        expect.objectContaining({
          attemptId: 'attempt-1',
          service: 'onekey-web',
        }),
      );
    });

    it('coarsens arbitrary WebView hosts and rejects non-http sources', () => {
      jest.spyOn(Math, 'random').mockReturnValue(0);
      expect(
        createWebViewAvailabilityTiming({
          attemptId: 'attempt-2',
          url: 'https://private-dapp.example/user/wallet',
        }),
      ).toEqual(
        expect.objectContaining({
          attemptId: 'attempt-2',
          service: 'external-web',
        }),
      );
      expect(
        createWebViewAvailabilityTiming({
          attemptId: 'attempt-3',
          url: 'file:///private/page.html',
        }),
      ).toBeUndefined();
    });
  });

  describe('createIpTableAvailabilityTiming', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('uses only a known service name and excludes arbitrary hosts', () => {
      jest.spyOn(Math, 'random').mockReturnValue(0);
      expect(
        createIpTableAvailabilityTiming({
          hostname: 'wallet.onekeycn.com',
        }),
      ).toEqual(expect.objectContaining({ service: 'wallet' }));
      expect(
        createIpTableAvailabilityTiming({
          hostname: 'private.example.com',
        }),
      ).toBeUndefined();
    });
  });
});
