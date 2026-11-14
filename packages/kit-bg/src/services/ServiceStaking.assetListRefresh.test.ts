import ServiceStaking from './ServiceStaking';

import type { AxiosInstance } from 'axios';

const params = {
  accountId: 'account-a',
  networkId: 'evm--1',
  provider: 'etherfi',
  symbol: 'USDT',
  vault: 'vault-a',
  action: 'stake' as const,
};

const response = (balance: string) => ({
  data: { data: { assets: [{ balanceParsed: balance }] } },
});

type IResponse = ReturnType<typeof response>;

function createHarness() {
  const get = jest.fn<Promise<IResponse>, [string, unknown]>();
  const getAccountAddressForApi = jest.fn(
    async ({ accountId }: { accountId: string }) => accountId,
  );
  const service = new ServiceStaking({
    backgroundApi: { serviceAccount: { getAccountAddressForApi } },
  });
  jest.spyOn(service, 'getClient').mockResolvedValue({
    get,
  } as unknown as AxiosInstance);
  return { service, get };
}

describe('Earn asset list refresh', () => {
  const previousBackgroundScope = globalThis.$onekeyIsInBackground;

  beforeAll(() => {
    globalThis.$onekeyIsInBackground = true;
  });

  afterAll(() => {
    globalThis.$onekeyIsInBackground = previousBackgroundScope;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('refreshes the matching cache entry without invalidating another account', async () => {
    const { service, get } = createHarness();
    const other = { ...params, accountId: 'account-b' };
    get
      .mockResolvedValueOnce(response('24.271469'))
      .mockResolvedValueOnce(response('8'))
      .mockResolvedValueOnce(response('23.271469'));

    await service.getEarnAssetsList(params);
    await service.getEarnAssetsList(other);
    expect(
      (await service.getEarnAssetsList(params)).assets[0].balanceParsed,
    ).toBe('24.271469');
    expect(get).toHaveBeenCalledTimes(2);

    expect(
      (await service.getEarnAssetsList({ ...params, forceRefresh: true }))
        .assets[0].balanceParsed,
    ).toBe('23.271469');
    expect(
      (await service.getEarnAssetsList(params)).assets[0].balanceParsed,
    ).toBe('23.271469');
    expect(
      (await service.getEarnAssetsList(other)).assets[0].balanceParsed,
    ).toBe('8');
    expect(get).toHaveBeenCalledTimes(3);
    expect(get.mock.calls[2][1]).toEqual({
      params: expect.not.objectContaining({ forceRefresh: expect.anything() }),
    });
  });

  it('does not reuse or restore an in-flight stale entry after a forced refresh', async () => {
    const { service, get } = createHarness();
    let resolveOld: (value: IResponse) => void = () => undefined;
    get
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveOld = resolve;
        }),
      )
      .mockResolvedValueOnce(response('23.271469'));

    const oldRequest = service.getEarnAssetsList(params);
    await Promise.resolve();
    await Promise.resolve();
    const refreshed = await service.getEarnAssetsList({
      ...params,
      forceRefresh: true,
    });
    expect(refreshed.assets[0].balanceParsed).toBe('23.271469');
    expect(get).toHaveBeenCalledTimes(2);
    resolveOld(response('24.271469'));
    await oldRequest;
    expect(
      (await service.getEarnAssetsList(params)).assets[0].balanceParsed,
    ).toBe('23.271469');
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('keeps the refreshed cache when an invalidated request fails late', async () => {
    const { service, get } = createHarness();
    let rejectOld: (reason: Error) => void = () => undefined;
    get
      .mockReturnValueOnce(
        new Promise((_resolve, reject) => {
          rejectOld = reject;
        }),
      )
      .mockResolvedValueOnce(response('23.271469'));

    const oldRequest = service.getEarnAssetsList(params);
    const oldResult = oldRequest.then(
      () => undefined,
      (error: unknown) => error,
    );
    await Promise.resolve();
    await Promise.resolve();
    await service.getEarnAssetsList({ ...params, forceRefresh: true });
    rejectOld(new Error('offline'));
    expect(await oldResult).toEqual(
      expect.objectContaining({ message: 'offline' }),
    );
    expect(
      (await service.getEarnAssetsList(params)).assets[0].balanceParsed,
    ).toBe('23.271469');
    expect(get).toHaveBeenCalledTimes(2);
  });
});
