import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
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
  it('uses one Market batch request for an empty native contract address', async () => {
    const fetchMarketTokenListBatch = jest.fn(async () => ({
      list: [
        {
          logoUrl: 'https://market.example/native.png',
          name: 'Market Native',
          symbol: 'NATIVE',
        },
        {
          logoUrl: 'https://market.example/0x2.png',
          name: 'Market Token',
          symbol: 'MARKET',
        },
      ],
    }));
    const service = new ServiceSwap({
      backgroundApi: {
        serviceMarketV2: { fetchMarketTokenListBatch },
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

    expect(fetchMarketTokenListBatch).toHaveBeenCalledWith({
      tokenAddressList: [
        {
          chainId: 'evm--1',
          contractAddress: '',
          isNative: true,
        },
        {
          chainId: 'evm--1',
          contractAddress: '0x2',
          isNative: false,
        },
      ],
    });
    expect(result.fromTokenInfo).toMatchObject({
      contractAddress: '',
      isNative: true,
      logoURI: 'https://market.example/native.png',
      name: 'Market Native',
      symbol: 'NATIVE',
    });
  });

  it('deduplicates token identities into one batch request', async () => {
    const fetchMarketTokenListBatch = jest.fn(
      async ({
        tokenAddressList,
      }: {
        tokenAddressList: {
          chainId: string;
          contractAddress: string;
          isNative: boolean;
        }[];
      }) => ({
        list: tokenAddressList.map(({ contractAddress }) => ({
          logoUrl: `https://market.example/${contractAddress}.png`,
          name: contractAddress,
          symbol: contractAddress,
        })),
      }),
    );
    const service = new ServiceSwap({
      backgroundApi: {
        serviceMarketV2: { fetchMarketTokenListBatch },
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

    expect(fetchMarketTokenListBatch).toHaveBeenCalledTimes(1);
    expect(
      fetchMarketTokenListBatch.mock.calls[0][0].tokenAddressList,
    ).toHaveLength(7);
  });

  it('keeps provider data when optional Market enrichment fails', async () => {
    const fetchMarketTokenListBatch = jest.fn(async () => {
      throw new OneKeyLocalError('Market unavailable');
    });
    const service = new ServiceSwap({
      backgroundApi: {
        serviceMarketV2: { fetchMarketTokenListBatch },
      },
    });
    const orders = [
      buildOrder({
        orderId: 'order-1',
        fromTokenInfo: buildToken({ contractAddress: '0x1' }),
        toTokenInfo: buildToken({ contractAddress: '0x2' }),
      }),
    ];

    await expect(service.enrichLimitOrderTokenMetadata(orders)).resolves.toBe(
      orders,
    );
  });

  it('returns limit order status data without waiting for Market enrichment', async () => {
    const fetchMarketTokenListBatch = jest.fn();
    const service = new ServiceSwap({
      backgroundApi: {
        serviceMarketV2: { fetchMarketTokenListBatch },
      },
    });
    const orders = [
      buildOrder({
        orderId: 'order-1',
        fromTokenInfo: buildToken({ contractAddress: '0x1' }),
        toTokenInfo: buildToken({ contractAddress: '0x2' }),
      }),
    ];
    const post = jest.fn(async () => ({ data: { data: orders } }));
    service.getClient = jest.fn(async () => ({
      post,
    })) as unknown as typeof service.getClient;
    const accounts = [{ userAddress: '0xuser', networkId: 'evm--1' }];

    await expect(service.fetchLimitOrders(accounts)).resolves.toBe(orders);
    expect(post).toHaveBeenCalledWith('/swap/v1/limit-orders', { accounts });
    expect(fetchMarketTokenListBatch).not.toHaveBeenCalled();
  });
});
