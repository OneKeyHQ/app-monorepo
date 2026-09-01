import {
  clearUsdcWithdrawRouteCacheForTest,
  getUsdcWithdrawRoute,
} from './usdcWithdrawRoute';

const requestMock = jest.fn<Promise<unknown>, unknown[]>();

jest.mock('@nktkas/hyperliquid', () => ({
  HttpTransport: jest.fn().mockImplementation(() => ({
    request: (...args: unknown[]) => requestMock(...args),
  })),
}));

describe('usdc withdraw route resolution', () => {
  beforeEach(() => {
    clearUsdcWithdrawRouteCacheForTest();
    requestMock.mockReset();
  });

  it('follows the rail Hyperliquid is serving', async () => {
    requestMock.mockResolvedValue({
      depositRoute: 'cctp',
      withdrawalRoute: 'cctp',
    });
    await expect(getUsdcWithdrawRoute()).resolves.toBe('cctp');
    expect(requestMock).toHaveBeenCalledWith('info', { type: 'usdcRouting' });
  });

  it('follows a switch back to the legacy bridge', async () => {
    requestMock.mockResolvedValue({ withdrawalRoute: 'bridge' });
    await expect(getUsdcWithdrawRoute()).resolves.toBe('bridge');
  });

  // A rail we do not implement must not be forwarded to the exchange call.
  it('falls back to the legacy bridge for an unrecognized rail', async () => {
    requestMock.mockResolvedValue({ withdrawalRoute: 'something-new' });
    await expect(getUsdcWithdrawRoute()).resolves.toBe('bridge');
  });

  it('falls back to the legacy bridge when the request fails', async () => {
    requestMock.mockRejectedValue(new Error('network down'));
    await expect(getUsdcWithdrawRoute()).resolves.toBe('bridge');
  });

  it('caches the resolved rail instead of asking on every withdrawal', async () => {
    requestMock.mockResolvedValue({ withdrawalRoute: 'cctp' });
    await getUsdcWithdrawRoute();
    await getUsdcWithdrawRoute();
    expect(requestMock).toHaveBeenCalledTimes(1);
  });

  // A failure must not be cached, or one flaky response would pin every later
  // withdrawal to the more expensive rail for the whole cache window.
  it('retries after a failed lookup', async () => {
    requestMock.mockRejectedValueOnce(new Error('network down'));
    await expect(getUsdcWithdrawRoute()).resolves.toBe('bridge');
    requestMock.mockResolvedValue({ withdrawalRoute: 'cctp' });
    await expect(getUsdcWithdrawRoute()).resolves.toBe('cctp');
    expect(requestMock).toHaveBeenCalledTimes(2);
  });

  // Downgrading a user to the deprecated rail because one lookup failed would
  // silently quadruple their fee.
  it('keeps the last confirmed rail when a later lookup fails', async () => {
    requestMock.mockResolvedValue({ withdrawalRoute: 'cctp' });
    await expect(getUsdcWithdrawRoute()).resolves.toBe('cctp');

    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 10 * 60 * 1000);
    requestMock.mockRejectedValue(new Error('network down'));
    await expect(getUsdcWithdrawRoute()).resolves.toBe('cctp');
    jest.spyOn(Date, 'now').mockRestore();
  });

  it('shares one in-flight lookup between concurrent callers', async () => {
    requestMock.mockResolvedValue({ withdrawalRoute: 'cctp' });
    const [first, second] = await Promise.all([
      getUsdcWithdrawRoute(),
      getUsdcWithdrawRoute(),
    ]);
    expect([first, second]).toEqual(['cctp', 'cctp']);
    expect(requestMock).toHaveBeenCalledTimes(1);
  });
});
