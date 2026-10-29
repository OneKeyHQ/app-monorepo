import { AxiosError } from 'axios';

import {
  OneKeyErrorPrimeUserBanned,
  OneKeyLocalError,
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
const mockHandleBanned = jest.fn(async () => undefined);
const mockUser = { onekeyUserId: 'user-a', isOneKeyIdBanned: false };
const mockReadPrimeUser = jest.fn(async () => mockUser);
const mockReadAuthGeneration = jest.fn(async () => 7);

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
  devSettingsPersistAtom: {
    get: async () => ({ enabled: false, settings: {} }),
  },
}));
jest.mock('../states/jotai/atoms/prime', () => ({
  primePersistAtom: { get: () => mockReadPrimeUser() },
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
            getAuthStateGeneration: () => mockReadAuthGeneration(),
          },
        },
        servicePrime: { handlePrimeUserBanned: mockHandleBanned },
      },
    });
    client = await service.getOneKeyIdClient(EServiceEndpointEnum.Prime);
  });

  beforeEach(() => {
    mockHandleBanned.mockClear();
    mockUser.isOneKeyIdBanned = false;
    mockReadPrimeUser.mockReset().mockResolvedValue(mockUser);
    mockReadAuthGeneration.mockReset().mockResolvedValue(7);
  });

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
    'preserves a ban and private identity context for HTTP %s, autoHandleError=%s',
    async (status, autoHandleError) => {
      respondWith(status, 90_012);
      const error = await client
        .get('/prime/v1/user/info', {
          autoHandleError,
        } as AxiosRequestConfig & { autoHandleError: boolean })
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(OneKeyErrorPrimeUserBanned);
      expect(mockHandleBanned).toHaveBeenCalledTimes(1);
      expect(mockHandleBanned).toHaveBeenCalledWith({
        requestAuthToken: REQUEST_TOKEN,
        requestContext: {
          onekeyUserId: 'user-a',
          authStateGeneration: 7,
          requestUrl: '/prime/v1/user/info',
        },
        requestUrl: '/prime/v1/user/info',
      });
      expect(JSON.stringify(error)).not.toContain(REQUEST_TOKEN);
    },
  );

  it('retains the incoming OAuth bind path across a 403 conversion', async () => {
    respondWith(403, 90_012);
    const path = '/prime/v1/account/identities/oauth/bind';

    await expect(
      client.post(path, { token: 'incoming-oauth-token' }),
    ).rejects.toBeInstanceOf(OneKeyErrorPrimeUserBanned);

    expect(mockHandleBanned).toHaveBeenCalledWith(
      expect.objectContaining({
        requestUrl: path,
        requestContext: expect.objectContaining({ requestUrl: path }),
      }),
    );
  });

  it('keeps ordinary HTTP 403 responses as region errors', async () => {
    respondWith(403, 1234);
    const error = await client
      .get('/prime/v1/user/info')
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(OneKeyServerApiError);
    expect(error).toMatchObject({ code: 403, httpStatusCode: 403 });
    expect(mockHandleBanned).not.toHaveBeenCalled();
  });

  it('keeps successful responses unchanged', async () => {
    respondWith(200, 0);
    await expect(client.get('/prime/v1/user/info')).resolves.toMatchObject({
      data: { code: 0 },
    });
    expect(mockHandleBanned).not.toHaveBeenCalled();
  });

  describe.each(['user projection', 'auth generation'] as const)(
    'when Prime %s storage is unavailable',
    (source) => {
      let storageError: OneKeyLocalError;

      beforeEach(() => {
        storageError = new OneKeyLocalError(
          'Prime storage temporarily unavailable',
        );
        if (source === 'user projection') {
          mockReadPrimeUser.mockRejectedValue(storageError);
        } else {
          mockReadAuthGeneration.mockRejectedValue(storageError);
        }
      });

      test.each([
        '/wallet/v1/account/transaction/history',
        '/wallet/v1/token/list',
      ])(
        'sends independent request %s without reading Prime restriction state',
        async (url) => {
          const adapter = respondWith(200, 0);

          await expect(client.get(url)).resolves.toMatchObject({
            data: { code: 0 },
          });

          expect(adapter).toHaveBeenCalledTimes(1);
          expect(mockReadPrimeUser).not.toHaveBeenCalled();
          expect(mockReadAuthGeneration).not.toHaveBeenCalled();
        },
      );

      test.each([
        '/prime/v1/user/devices',
        '/rebate/v1/user/info',
        '/wallet/v1/account/transaction/export-task/create',
      ])('blocks restricted request %s before the network', async (url) => {
        const adapter = respondWith(200, 0);

        await expect(client.get(url)).rejects.toBe(storageError);

        expect(mockReadPrimeUser).toHaveBeenCalledTimes(1);
        expect(adapter).not.toHaveBeenCalled();
      });
    },
  );

  test.each([
    '/prime/v1/user/devices',
    '/rebate/v1/user/info',
    '/wallet/v1/account/transaction/export-task/create',
  ])('still blocks known-banned feature request %s', async (url) => {
    const adapter = respondWith(200, 0);
    mockUser.isOneKeyIdBanned = true;

    await expect(client.get(url)).rejects.toBeInstanceOf(
      OneKeyErrorPrimeUserBanned,
    );

    expect(adapter).not.toHaveBeenCalled();
  });
});
