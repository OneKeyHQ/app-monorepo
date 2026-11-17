import ServiceSwap from './ServiceSwap';

describe('ServiceSwap native token config', () => {
  const previousBackgroundScope = globalThis.$onekeyIsInBackground;

  beforeAll(() => {
    globalThis.$onekeyIsInBackground = true;
  });

  afterAll(() => {
    globalThis.$onekeyIsInBackground = previousBackgroundScope;
  });

  it('preserves the zero-reserve fallback for existing callers', async () => {
    const service = new ServiceSwap({ backgroundApi: {} });
    const error = new Error('native token config unavailable');
    jest
      .spyOn(service, 'fetchSwapNativeTokenConfigMemo')
      .mockRejectedValue(error);
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    await expect(
      service.fetchSwapNativeTokenConfig({ networkId: 'evm--1' }),
    ).resolves.toEqual({
      networkId: 'evm--1',
      reserveGas: 0,
    });
    expect(consoleErrorSpy).toHaveBeenCalledWith(error);

    consoleErrorSpy.mockRestore();
  });

  it('rejects failed strict queries so callers do not treat fallback data as ready', async () => {
    const service = new ServiceSwap({ backgroundApi: {} });
    const error = new Error('native token config unavailable');
    jest
      .spyOn(service, 'fetchSwapNativeTokenConfigMemo')
      .mockRejectedValue(error);
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    await expect(
      service.fetchSwapNativeTokenConfig({
        networkId: 'evm--1',
        throwOnError: true,
      }),
    ).rejects.toBe(error);
    expect(consoleErrorSpy).toHaveBeenCalledWith(error);

    consoleErrorSpy.mockRestore();
  });
});
