import { createLazySdkLoader } from './lazySdkLoader';

describe('createLazySdkLoader', () => {
  it('caches the resolved module after the first load', async () => {
    const moduleValue = { sdk: 'ethers' };
    const factory = jest.fn().mockResolvedValue(moduleValue);
    const loadSdk = createLazySdkLoader(factory);

    await expect(loadSdk()).resolves.toBe(moduleValue);
    await expect(loadSdk()).resolves.toBe(moduleValue);

    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('deduplicates concurrent inflight requests', async () => {
    let resolveFactory: ((value: { sdk: string }) => void) | undefined;
    const factory = jest.fn(
      () =>
        new Promise<{ sdk: string }>((resolve) => {
          resolveFactory = resolve;
        }),
    );
    const loadSdk = createLazySdkLoader(factory);

    const requestA = loadSdk();
    const requestB = loadSdk();

    expect(factory).toHaveBeenCalledTimes(1);

    resolveFactory?.({ sdk: 'lightweight-charts' });

    await expect(requestA).resolves.toEqual({ sdk: 'lightweight-charts' });
    await expect(requestB).resolves.toEqual({ sdk: 'lightweight-charts' });
  });

  it('clears rejected inflight state so the next call can retry', async () => {
    const expectedError = new Error('chunk load failed');
    const factory = jest
      .fn()
      .mockRejectedValueOnce(expectedError)
      .mockResolvedValueOnce({ sdk: 'ethers' });
    const loadSdk = createLazySdkLoader(factory);

    await expect(loadSdk()).rejects.toThrow('chunk load failed');
    await expect(loadSdk()).resolves.toEqual({ sdk: 'ethers' });

    expect(factory).toHaveBeenCalledTimes(2);
  });
});
