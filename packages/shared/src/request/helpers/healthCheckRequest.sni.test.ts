import { healthCheckRequest } from './healthCheckRequest.sni';
import { getSelectedIpForHost } from './ipTableAdapter';
import { isProxyActiveForUrl, isSniSupported, sniRequest } from './sniRequest';

jest.mock('./ipTableAdapter', () => ({
  getSelectedIpForHost: jest.fn(),
}));

jest.mock('./sniRequest', () => ({
  isProxyActiveForUrl: jest.fn(),
  isSniSupported: jest.fn(),
  sniRequest: jest.fn(),
}));

const mockedGetSelectedIpForHost = getSelectedIpForHost as unknown as jest.Mock;
const mockedIsProxyActiveForUrl = isProxyActiveForUrl as jest.Mock;
const mockedIsSniSupported = isSniSupported as jest.Mock;
const mockedSniRequest = sniRequest as jest.Mock;

describe('healthCheckRequest.sni proxy preflight and fail-closed behavior', () => {
  const fetchMock = jest.fn();
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleLogSpy = jest
      .spyOn(console, 'log')
      .mockImplementation(() => undefined);
    globalThis.fetch = fetchMock as never;
    fetchMock.mockResolvedValue({
      status: 204,
      ok: true,
    });
    mockedIsSniSupported.mockReturnValue(true);
    mockedIsProxyActiveForUrl.mockResolvedValue(false);
    mockedGetSelectedIpForHost.mockResolvedValue('93.184.216.34');
    mockedSniRequest.mockResolvedValue({
      statusCode: 200,
      headers: {},
      body: '',
    });
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    jest.clearAllMocks();
  });

  test('falls back before IP selection when proxy preflight is active', async () => {
    mockedIsProxyActiveForUrl.mockResolvedValue(true);

    await expect(
      healthCheckRequest({ url: 'https://api.example.com/health' }),
    ).resolves.toEqual({
      status: 204,
      ok: true,
    });

    expect(mockedGetSelectedIpForHost).not.toHaveBeenCalled();
    expect(mockedSniRequest).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('keeps legacy SNI path when proxy preflight capability is missing', async () => {
    mockedIsProxyActiveForUrl.mockResolvedValue(null);

    await expect(
      healthCheckRequest({ url: 'https://api.example.com/health' }),
    ).resolves.toEqual({
      status: 200,
      ok: true,
    });

    expect(mockedGetSelectedIpForHost).toHaveBeenCalledWith('api.example.com');
    expect(mockedSniRequest).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('falls back before IP selection when proxy preflight errors', async () => {
    mockedIsProxyActiveForUrl.mockRejectedValue(new Error('preflight failed'));

    await expect(
      healthCheckRequest({ url: 'https://api.example.com/health' }),
    ).resolves.toEqual({
      status: 204,
      ok: true,
    });

    expect(mockedGetSelectedIpForHost).not.toHaveBeenCalled();
    expect(mockedSniRequest).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('does not fallback when SNI returns a fail-closed error', async () => {
    mockedSniRequest.mockRejectedValue(
      Object.assign(new Error('TLS failed'), {
        code: 'SNI_TLS_FAILED',
      }),
    );

    await expect(
      healthCheckRequest({ url: 'https://api.example.com/health' }),
    ).rejects.toMatchObject({
      code: 'SNI_TLS_FAILED',
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
