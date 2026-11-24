import requestHelper from '../requestHelper';

import {
  resetAdapterFailoverStatesForTesting,
  setReportRequestFailureCallback,
  uploadFileViaIpTable,
} from './ipTableAdapter';
import {
  isProxyActiveForUrl,
  isSniSupported,
  isSniUploadFileSupported,
  sniUploadFile,
} from './sniRequest';

jest.mock('../availabilityAggregator', () => ({
  recordAvailabilityOutcome: jest.fn(),
}));

jest.mock('../requestHelper', () => ({
  __esModule: true,
  default: {
    getDevSettingsPersistAtom: jest.fn(),
    getIpTableConfig: jest.fn(),
  },
}));

jest.mock('../Interceptor', () => ({
  getRequestHeaders: jest.fn(),
}));

jest.mock('../../logger/logger', () => ({
  defaultLogger: {
    ipTable: {
      request: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
      metrics: {
        endpointSwitched: jest.fn(),
        adapterFailover: jest.fn(),
        configVerifyFailed: jest.fn(),
      },
    },
  },
}));

jest.mock('./sniRequest', () => ({
  isProxyActiveForUrl: jest.fn(),
  isSniSupported: jest.fn(),
  isSniUploadFileSupported: jest.fn(),
  sniRequest: jest.fn(),
  sniUploadFile: jest.fn(),
}));

const mockedRequestHelper = requestHelper as jest.Mocked<typeof requestHelper>;
const mockedIsProxyActiveForUrl = isProxyActiveForUrl as jest.Mock;
const mockedIsSniSupported = isSniSupported as jest.Mock;
const mockedIsSniUploadFileSupported = isSniUploadFileSupported as jest.Mock;
const mockedSniUploadFile = sniUploadFile as jest.Mock;

const SELECTED_IP = '93.184.216.34';
const UPLOAD_URL = 'https://wallet.example.com/wallet/v1/client/log';

function uploadParams() {
  return {
    url: UPLOAD_URL,
    filePath: 'file:///cache/logs_zip/OneKeyLogs.zip',
    headers: { 'content-type': 'application/zip' },
    timeout: 90_000,
  };
}

function mockIpTableSelection(selection: string | undefined) {
  mockedRequestHelper.getIpTableConfig.mockResolvedValue({
    config: {
      version: 1,
      ttl_sec: 60,
      generated_at: '2026-10-26T00:00:00.000Z',
      signature: '',
      domains: {
        'example.com': {
          endpoints: [
            { ip: SELECTED_IP, provider: 'test', region: 'ALL', weight: 1 },
          ],
        },
      },
    },
    runtime: {
      enabled: true,
      lastUpdated: 0,
      lastRegionCheck: 0,
      selections: selection === undefined ? {} : { 'example.com': selection },
    },
  } as never);
}

describe('uploadFileViaIpTable', () => {
  beforeEach(() => {
    resetAdapterFailoverStatesForTesting();
    mockedIsSniSupported.mockReturnValue(true);
    mockedIsSniUploadFileSupported.mockReturnValue(true);
    mockedIsProxyActiveForUrl.mockResolvedValue(false);
    mockedSniUploadFile.mockReset();
    mockedRequestHelper.getDevSettingsPersistAtom.mockResolvedValue({
      settings: {},
    } as never);
    mockIpTableSelection(SELECTED_IP);
  });

  afterEach(() => {
    setReportRequestFailureCallback(undefined as never);
    jest.clearAllMocks();
  });

  test('uploads the file to the selected IP with the hostname as SNI', async () => {
    const response = {
      statusCode: 200,
      status: 200,
      headers: {},
      body: '{"code":0}',
      data: '{"code":0}',
    };
    mockedSniUploadFile.mockResolvedValue(response);

    const result = await uploadFileViaIpTable(uploadParams());

    expect(result).toMatchObject({ route: 'sni', response });
    expect(mockedSniUploadFile).toHaveBeenCalledWith(
      {
        ip: SELECTED_IP,
        hostname: 'wallet.example.com',
        path: '/wallet/v1/client/log',
        headers: { 'content-type': 'application/zip' },
        method: 'POST',
        filePath: 'file:///cache/logs_zip/OneKeyLogs.zip',
        timeout: 90_000,
      },
      { signal: undefined },
    );
  });

  test('skips without sending when the native binary lacks uploadFile', async () => {
    mockedIsSniUploadFileSupported.mockReturnValue(false);

    await expect(uploadFileViaIpTable(uploadParams())).resolves.toEqual({
      route: 'skipped',
      reason: 'upload_unsupported',
    });
    expect(mockedSniUploadFile).not.toHaveBeenCalled();
  });

  test('skips when a proxy is active for the upload URL', async () => {
    mockedIsProxyActiveForUrl.mockResolvedValue(true);

    await expect(uploadFileViaIpTable(uploadParams())).resolves.toEqual({
      route: 'skipped',
      reason: 'proxy_active',
    });
    expect(mockedSniUploadFile).not.toHaveBeenCalled();
  });

  test('skips when the IP table selects the domain', async () => {
    mockIpTableSelection('');

    await expect(uploadFileViaIpTable(uploadParams())).resolves.toEqual({
      route: 'skipped',
      reason: 'no_selected_ip',
    });
    expect(mockedSniUploadFile).not.toHaveBeenCalled();
  });

  test('skips non-https URLs', async () => {
    await expect(
      uploadFileViaIpTable({
        ...uploadParams(),
        url: 'http://wallet.example.com/wallet/v1/client/log',
      }),
    ).resolves.toEqual({ route: 'skipped', reason: 'invalid_url' });
    expect(mockedIsProxyActiveForUrl).not.toHaveBeenCalled();
  });

  test('rethrows SNI failures and reports them against the selected IP', async () => {
    const failures: unknown[] = [];
    setReportRequestFailureCallback((params) => {
      failures.push(params);
    });
    const error = Object.assign(new Error('Request timeout'), {
      code: 'SNI_REQUEST_TIMEOUT',
    });
    mockedSniUploadFile.mockRejectedValue(error);

    await expect(uploadFileViaIpTable(uploadParams())).rejects.toBe(error);
    expect(failures).toEqual([
      expect.objectContaining({
        domain: 'example.com',
        requestType: 'ip',
        target: SELECTED_IP,
      }),
    ]);
  });
});
