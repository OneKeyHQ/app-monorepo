import axios from 'axios';

import { EServiceEndpointEnum } from '../../types/endpoint';
import platformEnv from '../platformEnv';

import { getRequestHeaders } from './Interceptor';

import type { dispatchGuardedWalletRequest } from './guardedWalletRequest';
import type { InternalAxiosRequestConfig } from 'axios';

jest.mock('../platformEnv', () => ({
  __esModule: true,
  default: {
    isWeb: true,
    isExtension: false,
    isNative: false,
    isDesktop: false,
  },
}));

jest.mock('../logger/logger', () => ({
  defaultLogger: {
    app: { network: { end: jest.fn(), error: jest.fn(), start: jest.fn() } },
  },
}));

jest.mock('../logger/scopes/app/scenes/networkFilter', () => ({
  isEnableLogNetwork: () => false,
}));

jest.mock('../utils/systemTimeUtils', () => ({
  __esModule: true,
  default: { handleServerResponseDate: jest.fn() },
}));

jest.mock('../request/helpers/ipTableAdapter', () => ({
  createIpTableAdapter: jest.fn(),
}));

jest.mock('../utils/ipTableUtils', () => ({
  isSupportIpTablePlatform: () => false,
}));

jest.mock('./requestHelper', () => ({
  __esModule: true,
  default: { checkIsOneKeyDomain: async () => true },
}));

jest.mock('./Interceptor', () => ({
  HEADER_REQUEST_ID_KEY: 'x-onekey-request-id',
  getRequestHeaders: jest.fn(async () => ({
    'x-onekey-request-id': 'wrapped',
  })),
}));

jest.mock('./customUA', () => ({
  withCustomUAHeaders: async (_url: string, headers: Record<string, string>) =>
    headers,
}));

jest.mock('./availabilityMetrics', () => ({
  createApiAvailabilityTiming: () => undefined,
  reportApiAvailabilityError: jest.fn(),
  reportApiAvailabilityResponse: jest.fn(),
}));

const origin = 'https://prime.example.invalid';
const upload = '/prime/v1/sync/upload';
const check = '/prime/v1/sync/check';
const primitiveFetch = jest.fn<Promise<Response>, [Request, RequestInit?]>();
const originalFetch = globalThis.fetch;
let adapter: typeof dispatchGuardedWalletRequest;

function onlineResponse(url: string) {
  const response = new Response('{"data":"ok"}', { status: 200 });
  Object.defineProperty(response, 'url', { value: url });
  // The real browser clone retains its internal final URL. Node's synthetic
  // new Response has no network URL, so keep the explicitly supplied fixture.
  jest.spyOn(response, 'clone').mockReturnValue(response);
  return response;
}

function client() {
  const result = axios.create({ baseURL: origin, adapter });
  result.interceptors.request.use(async (config) => {
    config.headers.set('x-onekey-keyless-sync-signature', 'synthetic-auth');
    config.headers.set('x-onekey-request-id', 'axios-original');
    return config;
  });
  return result;
}

beforeAll(async () => {
  globalThis.fetch = primitiveFetch as typeof fetch;
  adapter = (await import('./guardedWalletRequest'))
    .dispatchGuardedWalletRequest;
});

beforeEach(() => {
  primitiveFetch.mockReset();
  jest.mocked(getRequestHeaders).mockClear();
  jest.replaceProperty(platformEnv, 'isWeb', true);
  jest.replaceProperty(platformEnv, 'isExtension', false);
  jest.replaceProperty(platformEnv, 'isNative', false);
  jest.replaceProperty(platformEnv, 'isDesktop', false);
});

afterAll(() => {
  jest.restoreAllMocks();
  globalThis.fetch = originalFetch;
});

describe('guarded Wallet browser dispatch', () => {
  test.each([upload, check])(
    'keeps auth and invokes the final veto for POST %s',
    async (path) => {
      const url = origin + path;
      const admit = jest.fn(async () => {
        expect(getRequestHeaders).toHaveBeenCalledTimes(1);
        expect(primitiveFetch).not.toHaveBeenCalled();
        return () => true;
      });
      primitiveFetch.mockResolvedValue(onlineResponse(url));

      const response = await client().post(
        path,
        { opaque: 'fixture' },
        {
          $oneKeyGuardedWalletRequest: { expectedURL: url, admit },
          maxRedirects: 0, // Must not replace Fetch's stricter redirect mode.
        },
      );

      expect(admit).toHaveBeenCalledTimes(1);
      expect(primitiveFetch).toHaveBeenCalledTimes(1);
      const [request, init] = primitiveFetch.mock.calls[0];
      expect(request).toBeInstanceOf(Request);
      expect(request.url).toBe(url);
      expect(request.method).toBe('POST');
      expect(request.redirect).toBe('error');
      expect(init?.redirect).toBe('error');
      expect(
        new Headers(init?.headers).get('x-onekey-keyless-sync-signature'),
      ).toBe('synthetic-auth');
      expect(new Headers(init?.headers).get('x-onekey-request-id')).toBe(
        'axios-original',
      );
      await expect(request.clone().json()).resolves.toEqual({
        opaque: 'fixture',
      });
      expect(response.request).toEqual({
        responseURL: url,
        oneKeyVerifiedFinalUrl: url,
      });
    },
  );

  test.each(['source-changed', 'abort'])(
    'holds without a wire request after %s',
    async (scenario) => {
      const controller = new AbortController();
      let current = true;
      const admit = jest.fn(async () => {
        await Promise.resolve();
        if (scenario === 'abort') controller.abort();
        else current = false;
        return () => current;
      });
      await expect(
        client().post<unknown>(
          upload,
          {},
          {
            $oneKeyGuardedWalletRequest: {
              expectedURL: origin + upload,
              admit,
            },
            signal: controller.signal,
          },
        ),
      ).rejects.toThrow();
      expect(admit).toHaveBeenCalledTimes(1);
      expect(primitiveFetch).not.toHaveBeenCalled();
    },
  );

  test.each(['origin', 'path', 'query', 'method'])(
    'denies actual Request %s mismatch',
    async (field) => {
      const admit = jest.fn(async () => () => true);
      const urls = {
        origin: `https://other.example.invalid${upload}`,
        path: '/prime/v1/unknown',
        query: `${upload}?extra=1`,
      };
      await expect(
        client().request({
          url: field === 'method' ? upload : urls[field as keyof typeof urls],
          method: field === 'method' ? 'GET' : 'POST',
          $oneKeyGuardedWalletRequest: { expectedURL: origin + upload, admit },
        }),
      ).rejects.toThrow();
      expect(admit).not.toHaveBeenCalled();
      expect(primitiveFetch).not.toHaveBeenCalled();
    },
  );

  test.each(['missing-url', 'wrong-url', 'redirect-error'])(
    'withholds %s without fallback',
    async (scenario) => {
      if (scenario === 'redirect-error') {
        primitiveFetch.mockImplementation(async (request) => {
          expect(request.redirect).toBe('error');
          throw new TypeError('Fetch redirect rejected');
        });
      } else {
        primitiveFetch.mockResolvedValue(
          onlineResponse(
            scenario === 'missing-url'
              ? ''
              : `https://other.example.invalid${upload}`,
          ),
        );
      }
      await expect(
        client().post(
          upload,
          {},
          {
            $oneKeyGuardedWalletRequest: {
              expectedURL: origin + upload,
              admit: async () => () => true,
            },
          },
        ),
      ).rejects.toThrow();
      expect(primitiveFetch).toHaveBeenCalledTimes(1);
    },
  );

  test('keeps the ordinary app adapter and denies a rejected guarded send without fallback', async () => {
    const ordinary = jest.fn(async (config: InternalAxiosRequestConfig) => ({
      data: { ordinary: true },
      headers: {},
      status: 200,
      statusText: 'OK',
      config,
    }));
    const defaults = axios.defaults.adapter;
    axios.defaults.adapter = ordinary;
    try {
      const { appApiClient } = await import('../appApiClient/appApiClient');
      const prime = await appApiClient.getBasicClient({
        endpoint: origin,
        name: EServiceEndpointEnum.Prime,
      });
      await expect(prime.post(upload, {})).resolves.toMatchObject({
        data: { ordinary: true },
      });
      const admit = jest.fn(async () => undefined);
      await expect(
        prime.post(
          upload,
          {},
          {
            $oneKeyGuardedWalletRequest: {
              expectedURL: origin + upload,
              admit,
            },
          },
        ),
      ).rejects.toThrow();
      expect(admit).toHaveBeenCalledTimes(1);
      expect(primitiveFetch).not.toHaveBeenCalled();
      expect(ordinary).toHaveBeenCalledTimes(1);
    } finally {
      axios.defaults.adapter = defaults;
    }
  });

  test('does not issue a receipt if the source changes during the browser request', async () => {
    let current = true;
    primitiveFetch.mockImplementation(async () => {
      current = false;
      return onlineResponse(origin + upload);
    });
    await expect(
      client().post(
        upload,
        {},
        {
          $oneKeyGuardedWalletRequest: {
            expectedURL: origin + upload,
            admit: async () => () => current,
          },
        },
      ),
    ).rejects.toThrow();
    expect(primitiveFetch).toHaveBeenCalledTimes(1);
  });

  test.each(['isNative', 'isDesktop'] as const)(
    'skips unsupported %s',
    async (flag) => {
      jest.replaceProperty(platformEnv, flag, true);
      const admit = jest.fn(async () => () => true);
      await expect(
        client().post(
          upload,
          {},
          {
            $oneKeyGuardedWalletRequest: {
              expectedURL: origin + upload,
              admit,
            },
          },
        ),
      ).rejects.toThrow();
      expect(admit).not.toHaveBeenCalled();
      expect(primitiveFetch).not.toHaveBeenCalled();
    },
  );
});
