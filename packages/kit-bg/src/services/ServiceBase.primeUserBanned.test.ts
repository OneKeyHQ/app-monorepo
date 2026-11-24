import { AxiosError } from 'axios';

import {
  OneKeyErrorPrimeUserBanned,
  OneKeyServerApiError,
} from '@onekeyhq/shared/src/errors';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';

import ServiceBase from './ServiceBase';

import type {
  AxiosInstance,
  AxiosRequestConfig,
  InternalAxiosRequestConfig,
} from 'axios';

const REQUEST_TOKEN = 'test-request-token';
const mockHandleInvalidToken = jest.fn(async () => ({ cleared: false }));

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: unknown) => target,
  backgroundMethod: () => (_t: unknown, _k: unknown, d: PropertyDescriptor) =>
    d,
  backgroundMethodForDev:
    () => (_t: unknown, _k: unknown, d: PropertyDescriptor) =>
      d,
}));
jest.mock('../endpoints', () => ({
  getEndpointInfo: async () => ({ endpoint: 'https://test.onekey.so' }),
}));
jest.mock('../states/jotai/atoms/devSettings', () => ({
  devSettingsPersistAtom: { get: async () => ({ enabled: false }) },
}));
jest.mock('./ServicePrime/primeAuthSessionAccess', () => ({
  readAuthTokenOrNull: (read: () => Promise<string>) => read(),
}));
jest.mock('@onekeyhq/shared/src/appApiClient/appApiClient', () => ({
  appApiClient: {
    getOneKeyIdAuthClient: async () => {
      const actualAxios =
        jest.requireActual<typeof import('axios')>('axios').default;
      return actualAxios.create({ baseURL: 'https://test.onekey.so' });
    },
  },
}));
jest.mock('@onekeyhq/shared/src/request/Interceptor', () => ({
  HEADER_REQUEST_ID_KEY: 'x-onekey-request-id',
  checkRequestIsOneKeyDomain: async () => true,
  getRequestHeaders: async () => ({}),
}));
jest.mock('@onekeyhq/shared/src/request/customUA', () => ({
  withCustomUAHeaders: async () => ({}),
}));
jest.mock('@onekeyhq/shared/src/request/availabilityMetrics', () => ({
  createApiAvailabilityTiming: () => undefined,
  reportApiAvailabilityResponse: jest.fn(),
  reportApiAvailabilityError: jest.fn(),
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    app: { network: { start: jest.fn(), end: jest.fn(), error: jest.fn() } },
    prime: { subscription: { onekeyIdInvalidToken: jest.fn() } },
  },
}));
jest.mock(
  '@onekeyhq/shared/src/logger/scopes/app/scenes/networkFilter',
  () => ({
    isEnableLogNetwork: () => false,
  }),
);
jest.mock('@onekeyhq/shared/src/locale/appLocale', () => ({
  appLocale: {
    intl: { formatMessage: ({ id }: { id: string }) => id },
    onLocaleChange: jest.fn(),
  },
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isDev: false, isNative: false, isDesktop: false },
}));
jest.mock('@onekeyhq/shared/src/modules/NetworkThrottle', () => ({
  __esModule: true,
  NATIVE_SLOW_4G_LATENCY_MS: 0,
  default: {},
  getNetworkThrottleRuntimeConfig: () => ({ enabled: false }),
}));
jest.mock('@onekeyhq/shared/src/storage/appStorage', () => ({
  __esModule: true,
  default: { syncStorage: { getBoolean: jest.fn() } },
}));
jest.mock(
  '@onekeyhq/shared/src/storage/instance/devSettingSyncStorageInstance',
  () => ({
    devSettingSyncStorage: { getBoolean: jest.fn() },
  }),
);
jest.mock('@onekeyhq/shared/src/utils/systemTimeUtils', () => ({
  __esModule: true,
  default: { handleServerResponseDate: async () => undefined },
}));

describe('OneKey ID client through global and service interceptors', () => {
  let client: AxiosInstance;

  beforeAll(async () => {
    // The production global interceptors must be installed before the
    // authenticated client is created, exactly as in application startup.
    await import('@onekeyhq/shared/src/request/axiosInterceptor');
    const service = new ServiceBase({
      backgroundApi: {
        simpleDb: {
          prime: {
            getActiveAuthToken: async () => REQUEST_TOKEN,
          },
        },
        servicePrime: { handlePrimeLoginInvalidToken: mockHandleInvalidToken },
      },
    });
    client = await service.getOneKeyIdClient(EServiceEndpointEnum.Prime);
  });

  beforeEach(() => {
    mockHandleInvalidToken.mockClear();
  });

  afterEach(() => jest.restoreAllMocks());

  function respondWith(status: number, code: number) {
    const adapter = jest.fn(async (config: InternalAxiosRequestConfig) => {
      const response = {
        config,
        data: { code, message: 'server message' },
        headers: {},
        status,
        statusText: status === 403 ? 'Forbidden' : 'OK',
      };
      if (status >= 400) {
        throw new AxiosError(
          'Request failed',
          AxiosError.ERR_BAD_REQUEST,
          config,
          undefined,
          response,
        );
      }
      return response;
    });
    client.defaults.adapter = adapter;
    return adapter;
  }

  test.each([
    [200, true],
    [200, false],
    [403, true],
    [403, false],
  ])(
    'signs out the banned session and keeps the token private for HTTP %s, autoHandleError=%s',
    async (status, autoHandleError) => {
      respondWith(status, 90_012);
      const error = await client
        .get('/prime/v1/user/info', {
          autoHandleError,
        } as AxiosRequestConfig & { autoHandleError: boolean })
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(OneKeyErrorPrimeUserBanned);
      expect(mockHandleInvalidToken).toHaveBeenCalledTimes(1);
      expect(mockHandleInvalidToken).toHaveBeenCalledWith(
        expect.objectContaining({
          requestAuthToken: REQUEST_TOKEN,
          errorCode: 90_012,
          requestUrl: '/prime/v1/user/info',
        }),
      );
      expect(JSON.stringify(error)).not.toContain(REQUEST_TOKEN);
    },
  );

  test.each([200, 403])(
    'keeps the signed-in account when an incoming OAuth bind identity is banned (HTTP %s)',
    async (status) => {
      respondWith(status, 90_012);
      await expect(
        client.post('/prime/v1/account/identities/oauth/bind', {
          token: 'incoming-oauth-token',
        }),
      ).rejects.toBeInstanceOf(OneKeyErrorPrimeUserBanned);
      expect(mockHandleInvalidToken).not.toHaveBeenCalled();
    },
  );

  it('keeps the banned error when signing out fails', async () => {
    respondWith(200, 90_012);
    mockHandleInvalidToken.mockRejectedValueOnce(new Error('storage'));
    await expect(client.get('/prime/v1/user/info')).rejects.toBeInstanceOf(
      OneKeyErrorPrimeUserBanned,
    );
  });

  it('keeps ordinary HTTP 403 responses as region errors', async () => {
    respondWith(403, 1234);
    const error = await client
      .get('/prime/v1/user/info')
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(OneKeyServerApiError);
    expect(error).toMatchObject({ code: 403, httpStatusCode: 403 });
    expect(mockHandleInvalidToken).not.toHaveBeenCalled();
  });

  test.each([
    '/prime/v1/user/info',
    '/prime/v1/user/delete',
    '/wallet/v1/account/transaction/history',
  ])('sends %s without a local ban gate', async (url) => {
    const adapter = respondWith(200, 0);
    await expect(client.get(url)).resolves.toMatchObject({
      data: { code: 0 },
    });
    expect(adapter).toHaveBeenCalledTimes(1);
    expect(mockHandleInvalidToken).not.toHaveBeenCalled();
  });
});
