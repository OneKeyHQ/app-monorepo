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
  it('uses the native-token lookup for an empty native contract address', async () => {
    const getNativeToken = jest.fn(async () => ({
      logoURI: 'https://onekey.example/native.png',
      name: 'OneKey Native',
      symbol: 'NATIVE',
    }));
    const getToken = jest.fn(async () => ({
      logoURI: 'https://onekey.example/token.png',
      name: 'OneKey Token',
      symbol: 'ERC20',
    }));
    const service = new ServiceSwap({
      backgroundApi: {
        serviceToken: { getNativeToken, getToken },
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

    expect(getNativeToken).toHaveBeenCalledWith({
      accountId: '',
      networkId: 'evm--1',
      tokenInfoOnly: true,
    });
    expect(result.fromTokenInfo).toMatchObject({
      contractAddress: '',
      isNative: true,
      name: 'OneKey Native',
      symbol: 'NATIVE',
    });
  });

  it('deduplicates token lookups and caps network concurrency', async () => {
    let activeRequests = 0;
    let maxActiveRequests = 0;
    const getToken = jest.fn(async ({ tokenIdOnNetwork }) => {
      activeRequests += 1;
      maxActiveRequests = Math.max(maxActiveRequests, activeRequests);
      await new Promise((resolve) => {
        setTimeout(resolve, 5);
      });
      activeRequests -= 1;
      return {
        name: tokenIdOnNetwork,
        symbol: tokenIdOnNetwork,
      };
    });
    const service = new ServiceSwap({
      backgroundApi: {
        serviceToken: { getToken },
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

    expect(getToken).toHaveBeenCalledTimes(7);
    expect(maxActiveRequests).toBeLessThanOrEqual(5);
  });
});
