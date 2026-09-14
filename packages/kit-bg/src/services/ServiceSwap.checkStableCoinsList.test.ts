import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import type { AxiosInstance } from 'axios';

let ServiceSwap: typeof import('./ServiceSwap').default;

describe('ServiceSwap.checkStableCoinsList', () => {
  const previousBackgroundScope = globalThis.$onekeyIsInBackground;

  beforeAll(async () => {
    jest.useFakeTimers();
    ({ default: ServiceSwap } = await import('./ServiceSwap'));
    globalThis.$onekeyIsInBackground = true;
  });

  afterAll(() => {
    globalThis.$onekeyIsInBackground = previousBackgroundScope;
    jest.useRealTimers();
  });

  it('caches the same request for 12 hours', async () => {
    jest.setSystemTime(new Date('2026-07-21T00:00:00.000Z'));

    const responseData = [
      {
        networkId: 'evm--1',
        results: [
          {
            contractAddress: '0xaaa',
            isStableCoin: true,
          },
        ],
      },
    ];
    const post = jest.fn().mockResolvedValue({
      data: {
        data: responseData,
      },
    });
    const service = new ServiceSwap({ backgroundApi: {} });
    jest
      .spyOn(service, 'getRawDataClient')
      .mockResolvedValue({ post } as unknown as AxiosInstance);
    const params = {
      list: [
        {
          networkId: 'evm--1',
          contractAddressList: ['0xaaa'],
        },
      ],
    };

    await expect(service.checkStableCoinsList(params)).resolves.toEqual(
      responseData,
    );
    await expect(
      service.checkStableCoinsList({
        list: params.list.map((item) => ({
          ...item,
          contractAddressList: [...item.contractAddressList],
        })),
      }),
    ).resolves.toEqual(responseData);
    expect(post).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(timerUtils.getTimeDurationMs({ hour: 12 }) - 1);
    await expect(service.checkStableCoinsList(params)).resolves.toEqual(
      responseData,
    );
    expect(post).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(2);
    await expect(service.checkStableCoinsList(params)).resolves.toEqual(
      responseData,
    );
    expect(post).toHaveBeenCalledTimes(2);
  });

  it('does not share results across different request identities', async () => {
    const post = jest.fn().mockResolvedValue({ data: { data: [] } });
    const service = new ServiceSwap({ backgroundApi: {} });
    jest
      .spyOn(service, 'getRawDataClient')
      .mockResolvedValue({ post } as unknown as AxiosInstance);

    await service.checkStableCoinsList({
      list: [
        {
          networkId: 'evm--1',
          contractAddressList: ['0xaaa'],
        },
      ],
    });
    await service.checkStableCoinsList({
      list: [
        {
          networkId: 'evm--1',
          contractAddressList: ['0xbbb'],
        },
      ],
    });

    expect(post).toHaveBeenCalledTimes(2);
  });
});
