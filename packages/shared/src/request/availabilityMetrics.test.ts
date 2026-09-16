import { OneKeyLocalError } from '../errors';
import platformEnv, { ERuntimeRole } from '../platformEnv';

import {
  createApiAvailabilityTiming,
  markApiAvailabilityProxy,
  markApiAvailabilityRoute,
  reportApiAvailabilityError,
  reportApiAvailabilityResponse,
  reportApiAvailabilityStream,
  setAvailabilityIpTableState,
} from './availabilityMetrics';

import type { IAvailabilityOutcome } from './availabilityAggregator';

const mockOutcomes: IAvailabilityOutcome[] = [];

jest.mock('./availabilityAggregator', () => ({
  AVAILABILITY_SLOW_MS: 3000,
  recordAvailabilityOutcome: (outcome: IAvailabilityOutcome) => {
    mockOutcomes.push(outcome);
  },
}));

jest.mock('./availabilityNetworkType', () => ({
  getAvailabilityNetworkType: () => 'WIFI',
  startAvailabilityNetworkTypeTracking: () => undefined,
}));

const env = platformEnv as { isNative?: boolean; runtimeRole: ERuntimeRole };
const originalEnv = { isNative: env.isNative, runtimeRole: env.runtimeRole };

function walletTiming() {
  const timing = createApiAvailabilityTiming({
    baseURL: 'https://wallet.onekeycn.com',
    url: '/wallet/v1/account/0xAbC123/history?cursor=9',
  });
  if (!timing) throw new OneKeyLocalError('expected a timing');
  return timing;
}

describe('availabilityMetrics', () => {
  beforeEach(() => {
    mockOutcomes.length = 0;
    setAvailabilityIpTableState('unknown');
    Object.assign(env, originalEnv);
  });

  it('counts only allowlisted hosts with digit-free route groups', () => {
    expect(walletTiming()).toMatchObject({
      service: 'wallet',
      routeGroup: '/wallet/v1/account',
    });
    expect(
      createApiAvailabilityTiming({ url: 'https://evil.example/wallet' }),
    ).toBeUndefined();
    expect(
      createApiAvailabilityTiming({
        url: 'https://utility.onekeycn.com/utility/v1/track/event',
      }),
    ).toBeUndefined();
    expect(
      createApiAvailabilityTiming({
        url: 'https://wallet.onekeycn.com/wallet/v1/health',
      }),
    ).toBeUndefined();
    expect(
      createApiAvailabilityTiming({
        url: 'https://wallet.onekeycn.com/cdn-cgi/trace',
      }),
    ).toBeUndefined();
    expect(
      createApiAvailabilityTiming({
        url: 'https://swap.onekeytest.com/swap/v1/build-tx',
      }),
    ).toMatchObject({ endpoint: 'swapBuildTx', testEndpoint: true });
    expect(
      createApiAvailabilityTiming({
        baseURL: 'https://swap.onekeycn.com/swap/',
        url: 'v1/0xAbC123/quote',
      }),
    ).toMatchObject({ service: 'swap', routeGroup: '/swap/v1/:id' });
    expect(createApiAvailabilityTiming({ url: '/relative' })).toBeUndefined();
  });

  it.each([
    [
      'ok',
      () =>
        reportApiAvailabilityResponse({
          timing: walletTiming(),
          httpStatus: 200,
          isOneKeyApi: true,
          apiCode: 0,
        }),
      { status: 'ok', errorCode: undefined },
      'ok',
    ],
    [
      'api_error',
      () =>
        reportApiAvailabilityResponse({
          timing: walletTiming(),
          httpStatus: 200,
          isOneKeyApi: true,
          apiCode: 4001,
        }),
      { status: 'api_error', errorCode: 'api_4001' },
      'error',
    ],
    [
      'http_error',
      () =>
        reportApiAvailabilityError(walletTiming(), {
          code: 'ERR_BAD_RESPONSE',
          response: { status: 502 },
        }),
      { status: 'http_error', errorCode: 'http_502' },
      'error',
    ],
    [
      'timeout',
      () =>
        reportApiAvailabilityError(walletTiming(), { code: 'ECONNABORTED' }),
      { status: 'timeout', errorCode: 'econnaborted' },
      'failed',
    ],
    [
      'network_error',
      () =>
        reportApiAvailabilityError(walletTiming(), {
          code: -99_999,
          className: 'SniTlsFailed',
        }),
      { status: 'network_error', errorCode: 'snitlsfailed' },
      'failed',
    ],
  ])('classifies %s', (_name, report, expected, bucket) => {
    report();
    const [api, net] = mockOutcomes;
    expect(api).toMatchObject({
      source: 'api',
      target: 'wallet',
      status: expected.status,
    });
    expect(api.failure).toEqual(
      expected.errorCode
        ? { detail: 'direct:/wallet/v1/account', errorCode: expected.errorCode }
        : undefined,
    );
    expect(net).toEqual({ source: 'api_net', target: 'wifi', status: bucket });
    expect(mockOutcomes).toHaveLength(2);
  });

  it('gives critical endpoints their own counters and failure detail', () => {
    const timing = createApiAvailabilityTiming({
      baseURL: 'https://wallet.onekeycn.com',
      url: '/wallet/v1/account/send-transaction',
    });
    reportApiAvailabilityResponse({
      timing,
      httpStatus: 200,
      isOneKeyApi: true,
      apiCode: 80_001,
    });

    expect(mockOutcomes.slice(0, 2)).toEqual([
      expect.objectContaining({
        source: 'api',
        target: 'wallet',
        status: 'api_error',
        failure: { detail: 'direct:sendTransaction', errorCode: 'api_80001' },
      }),
      {
        source: 'api_endpoint',
        target: 'sendTransaction',
        status: 'error',
        durationMs: expect.any(Number),
      },
    ]);
  });

  it('counts bodies without a numeric OneKey code as ok', () => {
    reportApiAvailabilityResponse({
      timing: walletTiming(),
      httpStatus: 200,
      isOneKeyApi: true,
      apiCode: undefined,
    });
    expect(mockOutcomes[0]).toMatchObject({ status: 'ok' });
  });

  it('counts an abort by a timeout signal as a timeout', () => {
    reportApiAvailabilityError(
      walletTiming(),
      { name: 'AbortError' },
      { reason: { name: 'TimeoutError' } },
    );
    reportApiAvailabilityError(walletTiming(), { name: 'TimeoutError' });
    expect(
      mockOutcomes
        .filter(({ source }) => source === 'api')
        .map(({ status }) => status),
    ).toEqual(['timeout', 'timeout']);
  });

  it('counts the first result of a stream, and streams abandoned after 3s', () => {
    const timing = walletTiming();
    reportApiAvailabilityStream(timing, 'error', 503);
    reportApiAvailabilityStream(timing, 'ok');
    reportApiAvailabilityStream(walletTiming(), 'timeout');
    reportApiAvailabilityStream(walletTiming(), 'abandoned');
    const slowTiming = walletTiming();
    slowTiming.startedAt -= 3000;
    reportApiAvailabilityStream(slowTiming, 'abandoned');
    expect(
      mockOutcomes
        .filter(({ source }) => source === 'api')
        .map(({ status, failure }) => [status, failure?.errorCode]),
    ).toEqual([
      ['http_error', 'http_503'],
      ['timeout', 'sse_timeout'],
      ['timeout', 'sse_abandoned'],
    ]);
  });

  it('does not count cancellations and counts a request once', () => {
    for (const error of [
      { code: 'ERR_CANCELED' },
      { name: 'AbortError' },
      { code: 'SNI_CANCELLED' },
    ]) {
      reportApiAvailabilityError(walletTiming(), error);
    }
    expect(mockOutcomes).toHaveLength(0);

    const timing = walletTiming();
    reportApiAvailabilityResponse({ timing, httpStatus: 503 });
    reportApiAvailabilityError(timing, { response: { status: 503 } });
    expect(mockOutcomes.filter(({ source }) => source === 'api')).toHaveLength(
      1,
    );
  });

  it('adds route, proxy and IP Table breakdowns for requests the IP Table adapter handled', () => {
    setAvailabilityIpTableState('enabled');
    const timing = walletTiming();
    markApiAvailabilityRoute(timing, 'sni');
    markApiAvailabilityProxy(timing, false);

    reportApiAvailabilityError(timing, { code: 'ERR_NETWORK' });

    expect(mockOutcomes.slice(1)).toEqual([
      { source: 'api_net', target: 'wifi', status: 'failed' },
      {
        source: 'api_route',
        target: 'sni',
        status: 'failed',
        durationMs: expect.any(Number),
      },
      { source: 'api_proxy', target: 'off', status: 'failed' },
      { source: 'api_ip_table', target: 'enabled', status: 'failed' },
    ]);
    expect(mockOutcomes[0].failure?.detail).toBe('sni:/wallet/v1/account');
  });

  it('skips IP Table breakdowns in the native main runtime, which has no IP Table config', () => {
    env.isNative = true;
    env.runtimeRole = ERuntimeRole.Main;
    const timing = walletTiming();
    markApiAvailabilityRoute(timing, 'domain');

    reportApiAvailabilityResponse({ timing, httpStatus: 200 });

    expect(mockOutcomes.map(({ source }) => source)).toEqual([
      'api',
      'api_net',
    ]);
  });
});
