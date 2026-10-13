import { EventEmitter } from 'node:events';

import axios from 'axios';
import { getIpAddressesForHostname } from 'react-native-dns-lookup';
import { stopNetworkLogging } from 'react-native-network-logger';
import { Ping } from 'react-native-ping';
import TcpSocket from 'react-native-tcp-socket';

import { getEndpointByServiceName } from '@onekeyhq/shared/src/config/endpointsMap';
import { OneKeyError } from '@onekeyhq/shared/src/errors';
import { isProxyActiveForUrl } from '@onekeyhq/shared/src/request/helpers/sniRequest';
import requestHelper from '@onekeyhq/shared/src/request/requestHelper';

import { NetworkDoctor } from './NetworkDoctor.native';
import {
  EDiagnosticPhase,
  ENetworkConnectivityLevel,
  EOneKeyFailureReason,
} from './types';

const mockClientGet = jest.fn();
const mockReachableHosts = new Set<string>();

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    fetch: jest.fn().mockResolvedValue({
      type: 'none',
      isConnected: false,
      isInternetReachable: false,
      details: null,
    }),
  },
}));

jest.mock('react-native-network-info', () => ({
  NetworkInfo: {
    getIPAddress: jest.fn().mockResolvedValue(null),
    getGatewayIPAddress: jest.fn().mockResolvedValue(null),
    getSubnet: jest.fn().mockResolvedValue(null),
    getBroadcast: jest.fn().mockResolvedValue(null),
  },
}));

jest.mock('react-native-dns-lookup', () => ({
  getIpAddressesForHostname: jest.fn(),
}));

jest.mock('react-native-network-logger', () => ({
  clearRequests: jest.fn(),
  getRequests: jest.fn().mockReturnValue([]),
  startNetworkLogging: jest.fn(),
  stopNetworkLogging: jest.fn(),
}));

jest.mock('react-native-ping', () => ({
  Ping: { start: jest.fn() },
}));

jest.mock('react-native-tcp-socket', () => ({
  __esModule: true,
  default: { createConnection: jest.fn() },
}));

jest.mock('axios', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

jest.mock('@onekeyhq/shared/src/appApiClient/appApiClient', () => ({
  appApiClient: {
    getClient: jest.fn(async () => ({ get: mockClientGet })),
  },
}));

jest.mock('@onekeyhq/shared/src/config/appConfig', () => ({
  ONEKEY_HEALTH_CHECK_URL: '/health',
  buildServiceEndpoint: jest.fn().mockReturnValue('https://wallet.example.com'),
}));

jest.mock('@onekeyhq/shared/src/config/endpointsMap', () => ({
  getEndpointByServiceName: jest
    .fn()
    .mockResolvedValue('https://wallet.example.com'),
}));

jest.mock('@onekeyhq/shared/src/request/helpers/sniRequest', () => ({
  isProxyActiveForUrl: jest.fn(),
}));

jest.mock('@onekeyhq/shared/src/request/requestHelper', () => ({
  __esModule: true,
  default: { getDevSettingsPersistAtom: jest.fn() },
}));

jest.mock('@onekeyhq/shared/src/errors', () => ({
  OneKeyError: class extends Error {},
}));

jest.mock('@onekeyhq/shared/src/locale', () =>
  jest.requireActual<
    typeof import('@onekeyhq/shared/src/locale/enum/translations')
  >('@onekeyhq/shared/src/locale/enum/translations'),
);

jest.mock('@onekeyhq/shared/src/locale/appLocale', () => ({
  appLocale: {
    intl: { formatMessage: ({ id }: { id: string }) => id },
  },
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    networkDoctor: {
      log: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    },
  },
}));

describe('NetworkDoctor native diagnostics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReachableHosts.clear();
    jest
      .spyOn(requestHelper, 'getDevSettingsPersistAtom')
      .mockReset()
      .mockResolvedValue({
        enabled: false,
        settings: { enableTestEndpoint: false },
      });
    mockClientGet
      .mockReset()
      .mockRejectedValue(new Error('Network unreachable'));
    jest
      .spyOn(axios, 'get')
      .mockReset()
      .mockRejectedValue(new Error('Network unreachable'));
    jest
      .spyOn(Ping, 'start')
      .mockReset()
      .mockRejectedValue(new Error('Network unreachable'));
    jest.mocked(getIpAddressesForHostname).mockReset();
    jest.mocked(isProxyActiveForUrl).mockReset().mockResolvedValue(false);
    jest
      .mocked(TcpSocket.createConnection)
      .mockImplementation((options, onConnect) => {
        const socket = Object.assign(new EventEmitter(), {
          destroy: jest.fn(),
        });
        queueMicrotask(() => {
          if (mockReachableHosts.has(options.host)) {
            onConnect();
          } else {
            socket.emit('error', new Error('Network unreachable'));
          }
        });
        return socket;
      });
  });

  it.each(['failed lookup', 'empty lookup'])(
    'completes an offline report after a %s',
    async (scenario) => {
      if (scenario === 'failed lookup') {
        jest
          .mocked(getIpAddressesForHostname)
          .mockRejectedValue(new Error('DNS lookup failed'));
      } else {
        jest.mocked(getIpAddressesForHostname).mockResolvedValue([]);
      }
      const onProgress = jest.fn();

      const report = await new NetworkDoctor({ onProgress }).run();

      expect(report.summary.conclusion.connectivityLevel).toBe(
        ENetworkConnectivityLevel.COMPLETELY_DOWN,
      );
      expect(report.results.dns.ips).toEqual([]);
      expect(report.results.tcpTests.yourApi.success).toBe(false);
      expect(report.results.tcpTests.google.success).toBe(false);
      expect(report.results.tcpTests.cloudflare.success).toBe(false);
      expect(report.results.healthCheck.success).toBe(false);
      expect(TcpSocket.createConnection).toHaveBeenCalledWith(
        expect.objectContaining({ host: 'wallet.example.com' }),
        expect.any(Function),
      );
      expect(onProgress).toHaveBeenLastCalledWith(
        expect.objectContaining({
          phase: EDiagnosticPhase.COMPLETED,
          percentage: 100,
        }),
      );
      expect(stopNetworkLogging).toHaveBeenCalledTimes(1);
    },
  );

  it('reports a DNS failure when reference services remain reachable', async () => {
    jest
      .mocked(getIpAddressesForHostname)
      .mockRejectedValue(new Error('DNS lookup failed'));
    mockReachableHosts.add('www.google.com');
    mockReachableHosts.add('1.1.1.1');

    const report = await new NetworkDoctor({}).run();

    expect(report.summary.conclusion).toMatchObject({
      connectivityLevel: ENetworkConnectivityLevel.ONEKEY_BLOCKED,
      oneKeyFailureReason: EOneKeyFailureReason.DNS_RESOLUTION_FAILED,
      failureLayer: 'dns',
    });
    expect(report.results.tcpTests.google.success).toBe(true);
    expect(report.results.tcpTests.cloudflare.success).toBe(true);
  });

  it.each(['resolved IP', 'failed DNS'])(
    'keeps a successful health check healthy with a %s',
    async (scenario) => {
      if (scenario === 'resolved IP') {
        jest
          .mocked(getIpAddressesForHostname)
          .mockResolvedValue(['203.0.113.10']);
        mockReachableHosts.add('203.0.113.10');
      } else {
        jest
          .mocked(getIpAddressesForHostname)
          .mockRejectedValue(new Error('DNS lookup failed'));
      }
      mockReachableHosts.add('challenges.cloudflare.com');
      mockReachableHosts.add('login.onekey.so');
      jest.spyOn(axios, 'get').mockResolvedValue({ status: 200, data: 'ok' });
      mockClientGet.mockResolvedValue({ status: 200, data: 'ok' });

      const report = await new NetworkDoctor({}).run();

      expect(report.summary.allCriticalChecksPassed).toBe(true);
      expect(report.summary.conclusion.connectivityLevel).toBe(
        ENetworkConnectivityLevel.HEALTHY,
      );
      if (scenario === 'resolved IP') {
        expect(TcpSocket.createConnection).toHaveBeenCalledWith(
          expect.objectContaining({ host: '203.0.113.10' }),
          expect.any(Function),
        );
        expect(report.results.tcpTests.yourApi.success).toBe(true);
      }
    },
  );

  it('runs configured domain and IP probes', async () => {
    jest.mocked(getIpAddressesForHostname).mockResolvedValue(['203.0.113.5']);
    const pingSpy = jest.spyOn(Ping, 'start').mockResolvedValue(12);
    const httpSpy = jest
      .spyOn(axios, 'get')
      .mockResolvedValue({ status: 200, data: 'ok' });
    mockClientGet.mockResolvedValue({ status: 200, data: 'ok' });
    const pingTargets = ['login.onekey.so', '203.0.113.10'];
    for (const host of pingTargets) {
      mockReachableHosts.add(host);
    }
    const httpProbes = [
      { label: 'login', url: 'https://login.onekey.so/' },
      { label: 'custom_ip', url: 'http://203.0.113.10:8080/health' },
    ];

    const report = await new NetworkDoctor({
      extraPingTargets: pingTargets,
      extraConnectivityTargets: pingTargets,
      extraHttpProbes: httpProbes,
    }).run();

    expect(report.results.extraDnsChecks).toMatchObject(
      pingTargets.map((hostname) => ({ hostname, ips: ['203.0.113.5'] })),
    );
    expect(report.results.extraTcpChecks).toMatchObject(
      pingTargets.map((host) => ({ host, port: 443, success: true })),
    );
    expect(report.results.extraPings).toEqual(
      pingTargets.map((target) => ({ target, success: true, timeMs: 12 })),
    );
    for (const target of pingTargets) {
      expect(getIpAddressesForHostname).toHaveBeenCalledWith(target);
      expect(TcpSocket.createConnection).toHaveBeenCalledWith(
        expect.objectContaining({ host: target, port: 443 }),
        expect.any(Function),
      );
      expect(pingSpy).toHaveBeenCalledWith(
        target,
        expect.objectContaining({ timeout: 5000 }),
      );
    }
    expect(TcpSocket.createConnection).not.toHaveBeenCalledWith(
      expect.objectContaining({ host: 'challenges.cloudflare.com' }),
      expect.any(Function),
    );
    expect(report.results.publicHttpChecks).toMatchObject(
      httpProbes.map((probe) => ({ ...probe, success: true, status: 200 })),
    );
    for (const probe of httpProbes) {
      expect(httpSpy).toHaveBeenCalledWith(probe.url, { timeout: 10_000 });
    }
  });

  const captchaScenarios = [
    {
      environment: 'production',
      enabled: true,
      testEndpoint: false,
      captchaHost: 'login.onekey.so',
      inactiveHost: 'login.onekeytest.com',
    },
    {
      environment: 'test',
      enabled: true,
      testEndpoint: true,
      captchaHost: 'login.onekeytest.com',
      inactiveHost: 'login.onekey.so',
    },
    {
      environment: 'disabled developer mode',
      enabled: false,
      testEndpoint: true,
      captchaHost: 'login.onekey.so',
      inactiveHost: 'login.onekeytest.com',
    },
  ].flatMap((environment) =>
    [true, false].map((turnstileReachable) => ({
      ...environment,
      turnstileReachable,
    })),
  );

  it.each(captchaScenarios)(
    'probes the active captcha in $environment with Turnstile TCP reachability $turnstileReachable without downloading the SDK',
    async ({
      enabled,
      testEndpoint,
      captchaHost,
      inactiveHost,
      turnstileReachable,
    }) => {
      jest.spyOn(requestHelper, 'getDevSettingsPersistAtom').mockResolvedValue({
        enabled,
        settings: { enableTestEndpoint: testEndpoint },
      });
      jest.mocked(getIpAddressesForHostname).mockResolvedValue(['203.0.113.5']);
      const pingSpy = jest.spyOn(Ping, 'start').mockResolvedValue(12);
      const turnstileHost = 'challenges.cloudflare.com';
      if (turnstileReachable) {
        mockReachableHosts.add(turnstileHost);
      }
      mockReachableHosts.add(captchaHost);
      const httpSpy = jest
        .spyOn(axios, 'get')
        .mockResolvedValue({ status: 200, data: 'ok' });
      mockClientGet.mockResolvedValue({ status: 200, data: 'ok' });

      const report = await new NetworkDoctor({}).run();

      const captchaUrl = `https://${captchaHost}/captcha`;
      const inactiveUrl = `https://${inactiveHost}/captcha`;
      expect(report.results.publicHttpChecks).toContainEqual(
        expect.objectContaining({
          label: 'onekey_captcha_page',
          url: captchaUrl,
          success: true,
          status: 200,
        }),
      );
      expect(httpSpy).toHaveBeenCalledWith(captchaUrl, { timeout: 10_000 });
      expect(httpSpy).not.toHaveBeenCalledWith(inactiveUrl, expect.anything());
      expect(pingSpy).not.toHaveBeenCalledWith(inactiveHost, expect.anything());
      expect(getIpAddressesForHostname).not.toHaveBeenCalledWith(inactiveHost);
      expect(TcpSocket.createConnection).not.toHaveBeenCalledWith(
        expect.objectContaining({ host: inactiveHost }),
        expect.any(Function),
      );
      expect(report.results.publicHttpChecks).not.toContainEqual(
        expect.objectContaining({ url: inactiveUrl }),
      );
      for (const host of [captchaHost, turnstileHost]) {
        expect(getIpAddressesForHostname).toHaveBeenCalledWith(host);
        expect(report.results.extraDnsChecks).toContainEqual(
          expect.objectContaining({ hostname: host, ips: ['203.0.113.5'] }),
        );
        expect(report.results.extraPings).toContainEqual({
          target: host,
          success: true,
          timeMs: 12,
        });
        expect(pingSpy).toHaveBeenCalledWith(
          host,
          expect.objectContaining({ timeout: 5000 }),
        );
      }
      expect(report.results.extraTcpChecks).toContainEqual(
        expect.objectContaining({
          host: turnstileHost,
          port: 443,
          success: turnstileReachable,
        }),
      );
      expect(report.results.extraTcpChecks).toContainEqual(
        expect.objectContaining({
          host: captchaHost,
          port: 443,
          success: true,
        }),
      );
      expect(TcpSocket.createConnection).toHaveBeenCalledWith(
        expect.objectContaining({ host: turnstileHost, port: 443 }),
        expect.any(Function),
      );
      expect(
        httpSpy.mock.calls.some(
          ([url]) => new URL(url).hostname === turnstileHost,
        ),
      ).toBe(false);
      expect(report.results.publicHttpChecks).not.toContainEqual(
        expect.objectContaining({ label: 'cloudflare_turnstile_sdk' }),
      );
      expect(report.results.publicHttpChecks).toContainEqual(
        expect.objectContaining({
          label: 'baidu_home',
          success: true,
        }),
      );
      expect(report.summary.allCriticalChecksPassed).toBe(turnstileReachable);
      expect(report.summary.conclusion).toMatchObject(
        turnstileReachable
          ? {
              connectivityLevel: ENetworkConnectivityLevel.HEALTHY,
              failureLayer: null,
            }
          : {
              connectivityLevel: ENetworkConnectivityLevel.ONEKEY_BLOCKED,
              oneKeyFailureReason: EOneKeyFailureReason.TCP_HANDSHAKE_FAILED,
              failureLayer: 'tcp',
              summary: 'auth_captcha_load_failed__msg',
            },
      );
    },
  );

  it.each([
    {
      failure: 'a connection error',
      status: undefined,
      connectivityLevel: ENetworkConnectivityLevel.ONEKEY_BLOCKED,
      summary: 'auth_captcha_load_failed__msg',
      assessment: 'blocked',
    },
    {
      failure: 'a 503 response',
      status: 503,
      connectivityLevel: ENetworkConnectivityLevel.ONEKEY_SERVICE_ERROR,
      summary: 'auth_captcha_unavailable__msg',
      assessment: 'degraded',
    },
  ])(
    'reports a CAPTCHA page with $failure when its host accepts TCP connections',
    async ({ status, connectivityLevel, summary, assessment }) => {
      jest
        .mocked(getIpAddressesForHostname)
        .mockResolvedValue(['203.0.113.5']);
      mockReachableHosts.add('challenges.cloudflare.com');
      mockReachableHosts.add('login.onekey.so');
      mockClientGet.mockResolvedValue({ status: 200, data: 'ok' });
      jest.spyOn(axios, 'get').mockImplementation(async (url) => {
        if (url === 'https://login.onekey.so/captcha') {
          throw Object.assign(new OneKeyError('CAPTCHA page failed'), {
            response: status ? { status } : undefined,
          });
        }
        return { status: 200, data: 'ok' };
      });

      const report = await new NetworkDoctor({}).run();

      expect(report.summary.allCriticalChecksPassed).toBe(false);
      expect(report.summary.conclusion).toMatchObject({
        connectivityLevel,
        oneKeyFailureReason: EOneKeyFailureReason.HTTP_REQUEST_FAILED,
        failureLayer: 'http',
        summary,
        assessment,
      });
    },
  );

  it.each([
    { proxyState: true, healthy: true },
    { proxyState: null, healthy: false },
    { proxyState: 'error', healthy: false },
  ])(
    'treats a direct Turnstile TCP failure with proxy state $proxyState as healthy: $healthy',
    async ({ proxyState, healthy }) => {
      const turnstileHost = 'challenges.cloudflare.com';
      jest
        .mocked(getIpAddressesForHostname)
        .mockResolvedValue(['203.0.113.5']);
      mockReachableHosts.add('login.onekey.so');
      mockClientGet.mockResolvedValue({ status: 200, data: 'ok' });
      jest.spyOn(axios, 'get').mockResolvedValue({ status: 200, data: 'ok' });
      jest.mocked(isProxyActiveForUrl).mockImplementation(async (url) => {
        if (url !== `https://${turnstileHost}/`) {
          return false;
        }
        if (proxyState === 'error') {
          throw new OneKeyError('Proxy preflight failed');
        }
        return proxyState as boolean | null;
      });

      const report = await new NetworkDoctor({}).run();

      expect(report.results.extraTcpChecks).toContainEqual(
        expect.objectContaining({ host: turnstileHost, success: false }),
      );
      expect(report.results.proxiedCaptchaHosts).toEqual(
        healthy ? [turnstileHost] : [],
      );
      expect(report.summary.conclusion.connectivityLevel).toBe(
        healthy
          ? ENetworkConnectivityLevel.HEALTHY
          : ENetworkConnectivityLevel.ONEKEY_BLOCKED,
      );
    },
  );

  it('starts every ping before any ping settles', async () => {
    jest.mocked(getIpAddressesForHostname).mockResolvedValue(['203.0.113.5']);
    const releasePings: Array<() => void> = [];
    const pingSpy = jest.spyOn(Ping, 'start').mockImplementation(
      () =>
        new Promise((resolve) => {
          releasePings.push(() => resolve(12));
        }),
    );
    const extraPingTargets = ['1.1.1.1', '8.8.8.8', 'baidu.com'];
    // Domain, resolved IP, and every extra target.
    const expectedPings = extraPingTargets.length + 2;

    const pending = new NetworkDoctor({ extraPingTargets }).run();
    for (
      let i = 0;
      i < 50 && pingSpy.mock.calls.length < expectedPings;
      i += 1
    ) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    expect(pingSpy).toHaveBeenCalledTimes(expectedPings);
    releasePings.forEach((release) => release());
    const report = await pending;
    expect(report.results.extraPings).toEqual(
      extraPingTargets.map((target) => ({ target, success: true, timeMs: 12 })),
    );
  });

  it('records a Turnstile DNS failure and still completes without an SDK request', async () => {
    const turnstileHost = 'challenges.cloudflare.com';
    jest
      .mocked(getIpAddressesForHostname)
      .mockImplementation(async (hostname) => {
        if (hostname === turnstileHost) {
          throw new OneKeyError('Turnstile DNS lookup failed');
        }
        return ['203.0.113.5'];
      });
    mockClientGet.mockResolvedValue({ status: 200, data: 'ok' });
    const httpSpy = jest.spyOn(axios, 'get');
    const onProgress = jest.fn();

    const report = await new NetworkDoctor({ onProgress }).run();

    expect(report.results.extraDnsChecks).toContainEqual(
      expect.objectContaining({
        hostname: turnstileHost,
        ips: [],
        error: 'Turnstile DNS lookup failed',
      }),
    );
    expect(report.results.extraTcpChecks).toContainEqual(
      expect.objectContaining({
        host: turnstileHost,
        port: 443,
        success: false,
      }),
    );
    expect(
      httpSpy.mock.calls.some(
        ([url]) => new URL(url).hostname === turnstileHost,
      ),
    ).toBe(false);
    expect(onProgress).toHaveBeenLastCalledWith(
      expect.objectContaining({
        phase: EDiagnosticPhase.COMPLETED,
        percentage: 100,
      }),
    );
    expect(report.summary.allCriticalChecksPassed).toBe(false);
    expect(report.summary.conclusion).toMatchObject({
      connectivityLevel: ENetworkConnectivityLevel.ONEKEY_BLOCKED,
      oneKeyFailureReason: EOneKeyFailureReason.DNS_RESOLUTION_FAILED,
      failureLayer: 'dns',
    });
  });

  it('waits for the active settings before starting network probes', async () => {
    jest.mocked(getIpAddressesForHostname).mockResolvedValue(['203.0.113.5']);
    let resolveSettings: (
      settings: Awaited<
        ReturnType<typeof requestHelper.getDevSettingsPersistAtom>
      >,
    ) => void = () => undefined;
    jest.spyOn(requestHelper, 'getDevSettingsPersistAtom').mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSettings = resolve;
      }),
    );
    const httpSpy = jest.spyOn(axios, 'get');

    const pending = new NetworkDoctor({}).run();
    await Promise.resolve();

    expect(getIpAddressesForHostname).not.toHaveBeenCalled();
    expect(httpSpy).not.toHaveBeenCalled();

    resolveSettings({ enabled: true, settings: { enableTestEndpoint: true } });
    const report = await pending;

    expect(report.results.publicHttpChecks).toContainEqual(
      expect.objectContaining({ url: 'https://login.onekeytest.com/captcha' }),
    );
    expect(report.results.publicHttpChecks).not.toContainEqual(
      expect.objectContaining({ url: 'https://login.onekey.so/captcha' }),
    );
  });

  it('refreshes the captcha environment when the same instance is run again', async () => {
    jest.mocked(getIpAddressesForHostname).mockResolvedValue(['203.0.113.5']);
    const doctor = new NetworkDoctor({});
    const first = await doctor.run();
    expect(first.results.publicHttpChecks).toContainEqual(
      expect.objectContaining({ url: 'https://login.onekey.so/captcha' }),
    );
    jest.spyOn(requestHelper, 'getDevSettingsPersistAtom').mockResolvedValue({
      enabled: true,
      settings: { enableTestEndpoint: true },
    });
    jest
      .mocked(getEndpointByServiceName)
      .mockResolvedValueOnce('https://wallet.onekeytest.com');
    const httpSpy = jest.spyOn(axios, 'get').mockClear();
    const pingSpy = jest.spyOn(Ping, 'start').mockClear();

    const second = await doctor.run();

    expect(second.config).toEqual({
      targetDomain: 'wallet.onekeytest.com',
      healthCheckUrl: 'https://wallet.onekeytest.com/health',
    });

    expect(second.results.publicHttpChecks).toContainEqual(
      expect.objectContaining({ url: 'https://login.onekeytest.com/captcha' }),
    );
    expect(second.results.publicHttpChecks).not.toContainEqual(
      expect.objectContaining({ url: 'https://login.onekey.so/captcha' }),
    );
    expect(second.results.extraPings).not.toContainEqual(
      expect.objectContaining({ target: 'login.onekey.so' }),
    );
    expect(second.results.extraDnsChecks).toMatchObject([
      { hostname: 'challenges.cloudflare.com' },
      { hostname: 'login.onekeytest.com' },
    ]);
    expect(second.results.extraTcpChecks).toMatchObject([
      { host: 'challenges.cloudflare.com', port: 443 },
      { host: 'login.onekeytest.com', port: 443 },
    ]);
    expect(httpSpy).not.toHaveBeenCalledWith(
      'https://login.onekey.so/captcha',
      expect.anything(),
    );
    expect(pingSpy).not.toHaveBeenCalledWith(
      'login.onekey.so',
      expect.anything(),
    );
  });
});
