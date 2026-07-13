import type {
  IFetchLimitOrderRes,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

import ServiceSwap from './ServiceSwap';

const previousBackgroundFlag = globalThis.$onekeyIsInBackground;

beforeAll(() => {
  globalThis.$onekeyIsInBackground = true;
});

afterAll(() => {
  globalThis.$onekeyIsInBackground = previousBackgroundFlag;
});

function buildToken(overrides: Partial<ISwapToken>): ISwapToken {
  return {
    networkId: 'evm--1',
    contractAddress: '0x1',
    decimals: 18,
    name: 'Provider Token',
    symbol: 'TOKEN',
    ...overrides,
  };
}

function buildOrder({
  orderId,
  fromTokenInfo,
  toTokenInfo,
}: {
  orderId: string;
  fromTokenInfo: ISwapToken;
  toTokenInfo: ISwapToken;
}): IFetchLimitOrderRes {
  return {
    orderId,
    networkId: fromTokenInfo.networkId,
    fromTokenInfo,
    toTokenInfo,
  } as IFetchLimitOrderRes;
}

describe('ServiceSwap.enrichLimitOrderTokenMetadata', () => {
  it('uses Market detail metadata for an empty native contract address', async () => {
    const fetchMarketTokenDetailByTokenAddress = jest.fn(async () => ({
      code: 0,
      data: {
        token: {
          logoUrl: 'https://market.example/native.png',
          name: 'Market Native',
          symbol: 'NATIVE',
        },
      },
    }));
    const service = new ServiceSwap({
      backgroundApi: {
        serviceMarketV2: { fetchMarketTokenDetailByTokenAddress },
      },
    });

    const [result] = await service.enrichLimitOrderTokenMetadata([
      buildOrder({
        orderId: 'native-order',
        fromTokenInfo: buildToken({
          contractAddress: '',
          isNative: true,
        }),
        toTokenInfo: buildToken({ contractAddress: '0x2' }),
      }),
    ]);

    expect(fetchMarketTokenDetailByTokenAddress).toHaveBeenCalledWith(
      '',
      'evm--1',
      {
        autoHandleError: false,
        skipConvertCurrency: true,
      },
    );
    expect(result.fromTokenInfo).toMatchObject({
      contractAddress: '',
      isNative: true,
      logoURI: 'https://market.example/native.png',
      name: 'Market Native',
      symbol: 'NATIVE',
    });
  });

  it('deduplicates token lookups and caps network concurrency', async () => {
    let activeRequests = 0;
    let maxActiveRequests = 0;
    const fetchMarketTokenDetailByTokenAddress = jest.fn(
      async (contractAddress: string) => {
        activeRequests += 1;
        maxActiveRequests = Math.max(maxActiveRequests, activeRequests);
        await new Promise((resolve) => {
          setTimeout(resolve, 5);
        });
        activeRequests -= 1;
        return {
          code: 0,
          data: {
            token: {
              logoUrl: `https://market.example/${contractAddress}.png`,
              name: contractAddress,
              symbol: contractAddress,
            },
          },
        };
      },
    );
    const service = new ServiceSwap({
      backgroundApi: {
        serviceMarketV2: { fetchMarketTokenDetailByTokenAddress },
      },
    });
    const repeatedToken = buildToken({ contractAddress: '0x1' });
    const orders = Array.from({ length: 4 }, (_, index) =>
      buildOrder({
        orderId: `order-${index}`,
        fromTokenInfo:
          index === 1
            ? repeatedToken
            : buildToken({ contractAddress: `0x${index * 2 + 1}` }),
        toTokenInfo: buildToken({
          contractAddress: `0x${index * 2 + 2}`,
        }),
      }),
    );

    await service.enrichLimitOrderTokenMetadata(orders);

    expect(fetchMarketTokenDetailByTokenAddress).toHaveBeenCalledTimes(7);
    expect(maxActiveRequests).toBeLessThanOrEqual(5);
  });
});
