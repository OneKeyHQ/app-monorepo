import { ESwapDirectionType } from '@onekeyhq/shared/types/swap/types';

import {
  type ISwapKLineToken,
  fetchSwapKLineTokenAddressesStableStatus,
  getDefaultSwapKLineSide,
  getResolvableDefaultSwapKLineSide,
  getSwapKLineStableTokenKey,
  haveSameSwapKLineTokenSymbol,
  prefetchSwapKLineMetadata,
  prefetchSwapKLineTokenInfo,
} from './swapKLineTokenUtils';

const mockFetchTokenInfoOnly = jest.fn<
  Promise<unknown>,
  [{ networkId: string; tokenAddress: string }]
>();
const mockCheckStableCoinsList = jest.fn<
  Promise<unknown>,
  [
    {
      list: {
        networkId: string;
        contractAddressList: string[];
      }[];
    },
  ]
>();

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceSwap: {
      checkStableCoinsList: (params: {
        list: {
          networkId: string;
          contractAddressList: string[];
        }[];
      }) => mockCheckStableCoinsList(params),
    },
    serviceToken: {
      fetchTokenInfoOnly: (params: {
        networkId: string;
        tokenAddress: string;
      }) => mockFetchTokenInfoOnly(params),
    },
  },
}));

const buildToken = (symbol: string, overrides: Partial<ISwapKLineToken> = {}) =>
  ({ symbol, ...overrides }) as ISwapKLineToken;

describe('swapKLineTokenUtils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCheckStableCoinsList.mockResolvedValue([]);
    mockFetchTokenInfoOnly.mockResolvedValue(undefined);
  });

  describe('haveSameSwapKLineTokenSymbol', () => {
    it('matches token symbols without case or surrounding whitespace', () => {
      expect(
        haveSameSwapKLineTokenSymbol({
          fromToken: { symbol: ' ETH ' },
          toToken: { symbol: 'eth' },
        }),
      ).toBe(true);
    });

    it('does not match missing or different symbols', () => {
      expect(
        haveSameSwapKLineTokenSymbol({
          fromToken: { symbol: 'ETH' },
          toToken: { symbol: 'WETH' },
        }),
      ).toBe(false);
      expect(
        haveSameSwapKLineTokenSymbol({
          fromToken: { symbol: 'ETH' },
        }),
      ).toBe(false);
    });
  });

  it('normalizes stable-token identities returned by the service', async () => {
    mockCheckStableCoinsList.mockResolvedValue([
      {
        networkId: 'evm--1',
        results: [
          {
            contractAddress: '0xABC',
            isStableCoin: true,
          },
        ],
      },
    ]);
    const token = buildToken('USDC', {
      contractAddress: '0xabc',
      networkId: 'evm--1',
    });

    const stableStatusMap = await fetchSwapKLineTokenAddressesStableStatus([
      token,
      { ...token },
    ]);

    expect(mockCheckStableCoinsList).toHaveBeenCalledWith({
      list: [
        {
          networkId: 'evm--1',
          contractAddressList: ['0xabc'],
        },
      ],
    });
    expect(stableStatusMap.get(getSwapKLineStableTokenKey(token))).toBe(true);
  });

  it('falls back to non-stable status when classification fails', async () => {
    mockCheckStableCoinsList.mockRejectedValueOnce(new Error('unavailable'));

    await expect(
      fetchSwapKLineTokenAddressesStableStatus([
        buildToken('USDC', {
          contractAddress: '0xabc',
          networkId: 'evm--1',
        }),
      ]),
    ).resolves.toEqual(new Map());
  });

  it('selects the to token when both token symbols are the same', () => {
    expect(
      getDefaultSwapKLineSide({
        fromToken: buildToken('ETH'),
        toToken: buildToken('eth'),
      }),
    ).toBe(ESwapDirectionType.TO);
  });

  it('prefers the non-stable side when supported tokens share a symbol', () => {
    const fromToken = buildToken('USDT');
    const toToken = buildToken('usdt');

    expect(
      getDefaultSwapKLineSide({
        fromToken,
        fromTokenIsStable: false,
        toToken,
        toTokenIsStable: true,
      }),
    ).toBe(ESwapDirectionType.FROM);
    expect(
      getResolvableDefaultSwapKLineSide({
        fromToken,
        fromTokenIsStable: false,
        isStableTokenCheckLoading: false,
        toToken,
        toTokenIsStable: true,
      }),
    ).toBe(ESwapDirectionType.FROM);
  });

  it.each([
    {
      expectedSide: ESwapDirectionType.FROM,
      fromToken: buildToken('ETH'),
      toToken: buildToken('eth', { defiMarked: true }),
    },
    {
      expectedSide: ESwapDirectionType.TO,
      fromToken: buildToken('ETH', { defiMarked: true }),
      toToken: buildToken('eth'),
    },
  ])(
    'selects the supported $expectedSide side for same-symbol tokens',
    ({ expectedSide, fromToken, toToken }) => {
      expect(
        getDefaultSwapKLineSide({
          fromToken,
          toToken,
        }),
      ).toBe(expectedSide);
      expect(
        getResolvableDefaultSwapKLineSide({
          fromToken,
          isStableTokenCheckLoading: true,
          toToken,
        }),
      ).toBe(expectedSide);
    },
  );

  it('prefetches supported chart token info once per request identity', async () => {
    const fromToken = buildToken('ETH', {
      contractAddress: '',
      isNative: true,
      networkId: 'evm--1',
    });
    const toToken = buildToken('USDC', {
      contractAddress: '0xabc',
      networkId: 'evm--1',
    });

    const prefetchPromise = prefetchSwapKLineTokenInfo([
      fromToken,
      toToken,
      { ...toToken },
    ]);

    expect(mockFetchTokenInfoOnly).toHaveBeenCalledTimes(2);
    expect(mockFetchTokenInfoOnly).toHaveBeenNthCalledWith(1, {
      networkId: 'evm--1',
      tokenAddress: '',
    });
    expect(mockFetchTokenInfoOnly).toHaveBeenNthCalledWith(2, {
      networkId: 'evm--1',
      tokenAddress: '0xabc',
    });
    await prefetchPromise;
  });

  it('prefetches token info and stable status in parallel', async () => {
    let resolveTokenInfo: (() => void) | undefined;
    let resolveStableStatus: (() => void) | undefined;
    const tokenInfoPromise = new Promise<unknown>((resolve) => {
      resolveTokenInfo = () => resolve(undefined);
    });
    const stableStatusPromise = new Promise<unknown>((resolve) => {
      resolveStableStatus = () => resolve([]);
    });
    mockFetchTokenInfoOnly.mockReturnValue(tokenInfoPromise);
    mockCheckStableCoinsList.mockReturnValue(stableStatusPromise);
    const fromToken = buildToken('ETH', {
      contractAddress: '',
      isNative: true,
      networkId: 'evm--1',
    });
    const toToken = buildToken('USDC', {
      contractAddress: '0xabc',
      networkId: 'evm--1',
    });

    const prefetchPromise = prefetchSwapKLineMetadata([fromToken, toToken]);

    expect(mockFetchTokenInfoOnly).toHaveBeenCalledTimes(2);
    expect(mockCheckStableCoinsList).toHaveBeenCalledWith({
      list: [
        {
          networkId: 'evm--1',
          contractAddressList: ['0xabc'],
        },
      ],
    });

    resolveTokenInfo?.();
    resolveStableStatus?.();
    await expect(prefetchPromise).resolves.toBeUndefined();
  });

  it('skips unsupported tokens and contains prefetch failures', async () => {
    mockFetchTokenInfoOnly.mockRejectedValueOnce(new Error('unavailable'));

    await expect(
      prefetchSwapKLineTokenInfo([
        buildToken('ETH', {
          contractAddress: '',
          isNative: true,
          networkId: 'evm--1',
        }),
        buildToken('LP', {
          contractAddress: '0xdef',
          defiMarked: true,
          networkId: 'evm--1',
        }),
      ]),
    ).resolves.toBeUndefined();

    expect(mockFetchTokenInfoOnly).toHaveBeenCalledTimes(1);
    expect(mockFetchTokenInfoOnly).toHaveBeenCalledWith({
      networkId: 'evm--1',
      tokenAddress: '',
    });
  });
});
