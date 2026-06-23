import axios from 'axios';

import { DEFAULT_IP_TABLE_CONFIG } from '../constants/ipTableDefaults';
import requestHelper from '../requestHelper';

import {
  clearInMemoryQuarantinedIps,
  clearSelectedIpForHostCache,
  createAxiosWithIpTable,
  createIpTableAdapter,
  getSelectedIpForHost,
  setReportRequestFailureCallback,
  testIpHostSpeed,
} from './ipTableAdapter';
import { sniRequest } from './sniRequest';

import type { IIpTableConfigWithRuntime } from '../types/ipTable';

jest.mock('../Interceptor', () => ({
  getRequestHeaders: jest.fn().mockResolvedValue({}),
}));

jest.mock('../../logger/logger', () => ({
  defaultLogger: {
    ipTable: {
      request: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
    },
  },
}));

jest.mock('./sniRequest', () => ({
  isSniSupported: jest.fn(() => true),
  sniRequest: jest.fn(),
}));

const sniRequestMock = sniRequest as jest.MockedFunction<typeof sniRequest>;

type ITestDevSettingsPersistAtom = Awaited<
  ReturnType<typeof requestHelper.getDevSettingsPersistAtom>
>;
type ITestSettingsPersistAtom = Awaited<
  ReturnType<typeof requestHelper.getSettingsPersistAtom>
>;
type ITestSettingsValuePersistAtom = Awaited<
  ReturnType<typeof requestHelper.getSettingsValuePersistAtom>
>;

let devSettingsPersistAtomMock: ITestDevSettingsPersistAtom;
let ipTableConfigMock: IIpTableConfigWithRuntime | null;
const originalAxiosDefaultAdapter = axios.defaults.adapter;

beforeAll(() => {
  requestHelper.overrideMethods({
    checkIsOneKeyDomain: async () => false,
    getDevSettingsPersistAtom: async () => devSettingsPersistAtomMock,
    getSettingsPersistAtom: async () => ({}) as ITestSettingsPersistAtom,
    getSettingsValuePersistAtom: async () =>
      ({}) as ITestSettingsValuePersistAtom,
    getIpTableConfig: async () => ipTableConfigMock,
  });
});

describe('testIpHostSpeed', () => {
  afterEach(() => {
    axios.defaults.adapter = originalAxiosDefaultAdapter;
  });

  beforeEach(() => {
    jest.restoreAllMocks();
    sniRequestMock.mockReset();
    clearInMemoryQuarantinedIps();
    clearSelectedIpForHostCache();
    devSettingsPersistAtomMock = {
      enabled: true,
      settings: {},
    } as ITestDevSettingsPersistAtom;
    ipTableConfigMock = {
      config: DEFAULT_IP_TABLE_CONFIG,
      runtime: {
        enabled: true,
        lastUpdated: 0,
        lastRegionCheck: 0,
        selections: {},
      },
    };
  });

  it('returns latency when the SNI host probe returns 2xx', async () => {
    jest.spyOn(Date, 'now').mockReturnValueOnce(1000).mockReturnValueOnce(1234);
    sniRequestMock.mockResolvedValue({
      statusCode: 200,
      headers: {},
      body: '',
    });

    await expect(
      testIpHostSpeed(
        '216.19.4.106',
        'utility.onekeycn.com',
        '/utility/v1/app-update',
        3000,
      ),
    ).resolves.toBe(234);

    expect(sniRequestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        ip: '216.19.4.106',
        hostname: 'utility.onekeycn.com',
        path: '/utility/v1/app-update',
        method: 'GET',
        timeout: 3000,
      }),
    );
  });

  it('rejects non-2xx SNI host probe responses', async () => {
    sniRequestMock.mockResolvedValue({
      statusCode: 404,
      headers: {},
      body: '',
    });

    await expect(
      testIpHostSpeed(
        '216.19.4.106',
        'utility.onekeycn.com',
        '/utility/v1/app-update',
        3000,
      ),
    ).resolves.toBe(Infinity);
  });

  it('overrides explicit domain selection in strict mode', async () => {
    devSettingsPersistAtomMock = {
      enabled: true,
      settings: {
        forceIpTableStrict: true,
      },
    } as ITestDevSettingsPersistAtom;
    ipTableConfigMock = {
      config: DEFAULT_IP_TABLE_CONFIG,
      runtime: {
        enabled: true,
        lastUpdated: 0,
        lastRegionCheck: 0,
        selections: {
          'onekeycn.com': '',
        },
      },
    };

    await expect(getSelectedIpForHost('wallet.onekeycn.com')).resolves.toBe(
      '104.18.20.233',
    );
  });

  it('uses runtime IP selections', async () => {
    ipTableConfigMock = {
      config: DEFAULT_IP_TABLE_CONFIG,
      runtime: {
        enabled: true,
        lastUpdated: 0,
        lastRegionCheck: 0,
        selections: {
          'onekeycn.com': '104.18.20.233',
        },
      },
    };

    await expect(getSelectedIpForHost('wallet.onekeycn.com')).resolves.toBe(
      '104.18.20.233',
    );
  });

  it('ignores quarantined runtime IP selections', async () => {
    ipTableConfigMock = {
      config: DEFAULT_IP_TABLE_CONFIG,
      runtime: {
        enabled: true,
        lastUpdated: 0,
        lastRegionCheck: 0,
        selections: {
          'onekeycn.com': '216.19.4.106',
        },
        quarantinedIps: {
          'onekeycn.com': {
            '216.19.4.106': {
              lastFailureTime: Date.now(),
              hostname: 'utility.onekeycn.com',
              error: 'Request timeout',
            },
          },
        },
      },
    };

    await expect(
      getSelectedIpForHost('utility.onekeycn.com'),
    ).resolves.toBeNull();
  });

  it('uses mapped lookup domain when a shared-domain SNI request fails', async () => {
    const requestFailureCallback = jest.fn();
    const fallbackAdapter = jest.fn(async (config) => ({
      data: { ok: true },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
      request: {},
    }));
    axios.defaults.adapter = fallbackAdapter;
    setReportRequestFailureCallback(requestFailureCallback);
    ipTableConfigMock = {
      config: DEFAULT_IP_TABLE_CONFIG,
      runtime: {
        enabled: true,
        lastUpdated: 0,
        lastRegionCheck: 0,
        selections: {
          'onekeycn.com': '216.19.4.106',
        },
      },
    };
    sniRequestMock.mockRejectedValue(new Error('Request timeout'));

    const client = axios.create({
      adapter: createIpTableAdapter({}),
      baseURL: 'https://swap.onekey.so',
    });

    await expect(client.get('/swap/v1/quote')).resolves.toMatchObject({
      status: 200,
      data: { ok: true },
    });

    expect(requestFailureCallback).toHaveBeenCalledWith(
      expect.objectContaining({
        domain: 'onekeycn.com',
        requestType: 'ip',
        target: '216.19.4.106',
        hostname: 'swap.onekey.so',
        error: 'Request timeout',
      }),
    );
  });

  it('adds failed SNI IPs to in-memory quarantine before background persistence completes', async () => {
    const fallbackAdapter = jest.fn(async (config) => ({
      data: { ok: true },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
      request: {},
    }));
    axios.defaults.adapter = fallbackAdapter;
    setReportRequestFailureCallback(jest.fn());
    ipTableConfigMock = {
      config: DEFAULT_IP_TABLE_CONFIG,
      runtime: {
        enabled: true,
        lastUpdated: 0,
        lastRegionCheck: 0,
        selections: {
          'onekeycn.com': '216.19.4.106',
        },
      },
    };
    sniRequestMock.mockRejectedValue(new Error('Request timeout'));

    const client = axios.create({
      adapter: createIpTableAdapter({}),
      baseURL: 'https://utility.onekeycn.com',
    });

    await client.get('/utility/v1/app-update');

    await expect(
      getSelectedIpForHost('utility.onekeycn.com'),
    ).resolves.toBeNull();
  });

  it('reports null SNI responses for quarantine', async () => {
    const requestFailureCallback = jest.fn();
    const fallbackAdapter = jest.fn(async (config) => ({
      data: { ok: true },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
      request: {},
    }));
    axios.defaults.adapter = fallbackAdapter;
    setReportRequestFailureCallback(requestFailureCallback);
    ipTableConfigMock = {
      config: DEFAULT_IP_TABLE_CONFIG,
      runtime: {
        enabled: true,
        lastUpdated: 0,
        lastRegionCheck: 0,
        selections: {
          'onekeycn.com': '216.19.4.106',
        },
      },
    };
    sniRequestMock.mockResolvedValue(null);

    const client = axios.create({
      adapter: createIpTableAdapter({}),
      baseURL: 'https://utility.onekeycn.com',
    });

    await client.get('/utility/v1/app-update');

    expect(requestFailureCallback).toHaveBeenCalledWith(
      expect.objectContaining({
        domain: 'onekeycn.com',
        requestType: 'ip',
        target: '216.19.4.106',
        hostname: 'utility.onekeycn.com',
        error: 'SNI response null',
      }),
    );
  });

  it('skips quarantined strict-mode fallback IPs', async () => {
    devSettingsPersistAtomMock = {
      enabled: true,
      settings: {
        forceIpTableStrict: true,
      },
    } as ITestDevSettingsPersistAtom;
    ipTableConfigMock = {
      config: DEFAULT_IP_TABLE_CONFIG,
      runtime: {
        enabled: true,
        lastUpdated: 0,
        lastRegionCheck: 0,
        selections: {},
        quarantinedIps: {
          'onekeycn.com': {
            '104.18.20.233': {
              lastFailureTime: Date.now(),
              hostname: 'utility.onekeycn.com',
              error: 'Request timeout',
            },
          },
        },
      },
    };

    await expect(getSelectedIpForHost('wallet.onekeycn.com')).resolves.toBe(
      '104.18.21.233',
    );
  });

  it('rejects real SNI adapter HTTP errors with axios validateStatus semantics', async () => {
    ipTableConfigMock = {
      config: DEFAULT_IP_TABLE_CONFIG,
      runtime: {
        enabled: true,
        lastUpdated: 0,
        lastRegionCheck: 0,
        selections: {
          'onekeycn.com': '104.18.20.233',
        },
      },
    };
    sniRequestMock.mockResolvedValue({
      statusCode: 500,
      headers: {},
      body: '{"error":"server error"}',
    });

    const client = createAxiosWithIpTable({
      baseURL: 'https://utility.onekeycn.com',
    });

    const request = client.get('/utility/v1/app-update');

    await expect(request).rejects.toMatchObject({
      code: 'ERR_BAD_RESPONSE',
      response: {
        status: 500,
        data: {
          error: 'server error',
        },
      },
    });

    await request.catch((error: unknown) => {
      expect(axios.isAxiosError(error)).toBe(true);
    });
  });
});
