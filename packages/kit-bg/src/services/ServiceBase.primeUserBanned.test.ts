import { AxiosError } from 'axios';

import {
  OneKeyErrorPrimeUserBanned,
  OneKeyServerApiError,
} from '@onekeyhq/shared/src/errors';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';

import ServiceBase from './ServiceBase';

import type { AxiosInstance, AxiosRequestConfig } from 'axios';

const REQUEST_TOKEN = 'test-request-token';
const mockHandleBanned = jest.fn(async () => undefined);
const mockUser = { onekeyUserId: 'user-a', isOneKeyIdBanned: false };

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
  primePersistAtom: { get: async () => mockUser },
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
            getAuthStateGeneration: async () => 7,
          },
        },
        servicePrime: { handlePrimeUserBanned: mockHandleBanned },
      },
    });
    client = await service.getOneKeyIdClient(EServiceEndpointEnum.Prime);
  });

  beforeEach(() => {
    mockHandleBanned.mockClear();
  });

  function respondWith(status: number, code: number) {
    client.defaults.adapter = async (config) => {
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
    };
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
});
