import { OneKeyLocalError } from '../errors';

import {
  createApiAvailabilityTiming,
  markApiAvailabilityProxy,
  markApiAvailabilityRoute,
  reportApiAvailabilityError,
  reportApiAvailabilityResponse,
  setAvailabilityIpTableState,
} from './availabilityMetrics';

import type { IAvailabilityOutcome } from './availabilityAggregator';

const mockOutcomes: IAvailabilityOutcome[] = [];

jest.mock('./availabilityAggregator', () => ({
  recordAvailabilityOutcome: (outcome: IAvailabilityOutcome) => {
    mockOutcomes.push(outcome);
  },
}));

jest.mock('./availabilityNetworkType', () => ({
  getAvailabilityNetworkType: () => 'WIFI',
  startAvailabilityNetworkTypeTracking: () => undefined,
}));

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
});
