import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import {
  resolveSwapHeaderMarketDetail,
  resolveSwapStockMarketDetailTarget,
  resolveSwapToTokenMarketDetail,
} from './swapHeaderMarketDetail';

function buildToken(overrides: Partial<ISwapToken> = {}): ISwapToken {
  return {
    networkId: 'evm--1',
    contractAddress: '0xabc',
    symbol: 'ETH',
    decimals: 18,
    name: 'Ethereum',
    logoURI: 'https://logo',
    ...overrides,
  };
}

describe('resolveSwapHeaderMarketDetail', () => {
  const fromToken = buildToken({ symbol: 'PAY', contractAddress: '0xpay' });
  const toToken = buildToken({
    symbol: 'RECEIVE',
    contractAddress: '0xreceive',
  });

  it('opens the receive token when both swap tokens are selected', () => {
    expect(resolveSwapHeaderMarketDetail(toToken, fromToken)).toMatchObject({
      kind: 'token',
      target: { symbol: 'RECEIVE', tokenAddress: '0xreceive' },
    });
  });

  it('keeps the chart available with only a pay token or an invalid receive token', () => {
    for (const receiveToken of [undefined, buildToken({ networkId: '' })]) {
      expect(
        resolveSwapHeaderMarketDetail(receiveToken, fromToken),
      ).toMatchObject({
        kind: 'token',
        target: { symbol: 'PAY', tokenAddress: '0xpay' },
      });
    }
  });

  it('opens the stock listing for a tokenized stock selected in Swap or Pro', () => {
    expect(
      resolveSwapHeaderMarketDetail(
        buildToken({
          isStock: true,
          stock: { stockId: 'NVDA', subtitle: '', sourceLogoUri: '' },
        }),
        fromToken,
      ),
    ).toMatchObject({ kind: 'stock', target: { stockId: 'NVDA' } });
  });

  it('opens the selected Pro token and disables the button without a valid target', () => {
    expect(resolveSwapHeaderMarketDetail(fromToken)).toMatchObject({
      kind: 'token',
      target: { symbol: 'PAY' },
    });
    expect(resolveSwapHeaderMarketDetail(undefined)).toBeUndefined();
    expect(
      resolveSwapHeaderMarketDetail(buildToken({ symbol: '' })),
    ).toBeUndefined();
  });
});

describe('resolveSwapToTokenMarketDetail', () => {
  it('keeps the receive token identity for market detail', () => {
    expect(resolveSwapToTokenMarketDetail(buildToken())).toEqual({
      tokenAddress: '0xabc',
      address: '0xabc',
      networkId: 'evm--1',
      symbol: 'ETH',
      name: 'Ethereum',
      decimals: 18,
      isNative: undefined,
      tokenImageUri: 'https://logo',
    });
  });

  it('allows a native receive token without a contract address', () => {
    expect(
      resolveSwapToTokenMarketDetail(
        buildToken({
          contractAddress: ' ',
          isNative: true,
          name: ' ',
        }),
      ),
    ).toMatchObject({
      tokenAddress: '',
      isNative: true,
      name: 'ETH',
    });
  });

  it('returns undefined when the receive token cannot be opened', () => {
    expect(
      resolveSwapToTokenMarketDetail(buildToken({ symbol: ' ' })),
    ).toBeUndefined();
    expect(
      resolveSwapToTokenMarketDetail(buildToken({ networkId: '' })),
    ).toBeUndefined();
    expect(
      resolveSwapToTokenMarketDetail(
        buildToken({ contractAddress: '', isNative: false }),
      ),
    ).toBeUndefined();
    expect(
      resolveSwapToTokenMarketDetail(buildToken({ isStock: true })),
    ).toBeUndefined();
    expect(resolveSwapToTokenMarketDetail(undefined)).toBeUndefined();
  });
});

describe('resolveSwapStockMarketDetailTarget', () => {
  it('prefers the market stock id and keeps the wrapped token', () => {
    expect(
      resolveSwapStockMarketDetailTarget(
        buildToken({
          isStock: true,
          symbol: 'AAPLon',
          name: 'Apple (Ondo)',
          contractAddress: '0xondo',
          networkId: 'evm--1',
          stock: {
            stockId: 'aapl',
            underlyingAssetName: 'Apple Inc.',
            underlyingAssetTicker: 'AAPL',
            subtitle: '',
            sourceLogoUri: '',
          },
        }),
      ),
    ).toEqual({
      stockId: 'AAPL',
      symbol: 'AAPL',
      name: 'Apple Inc.',
      logoUrl: '',
      tokenAddress: '0xondo',
      networkId: 'evm--1',
      isNative: undefined,
    });
  });

  it('falls back to the underlying ticker when stockId is missing', () => {
    expect(
      resolveSwapStockMarketDetailTarget(
        buildToken({
          isStock: true,
          symbol: ' ',
          name: undefined,
          logoURI: undefined,
          contractAddress: '',
          networkId: '',
          stock: {
            underlyingAssetTicker: ' nvda ',
            underlyingAssetName: 'NVIDIA',
            subtitle: '',
            sourceLogoUri: '',
          },
        }),
      ),
    ).toEqual({
      stockId: 'NVDA',
      symbol: 'NVDA',
      name: 'NVIDIA',
      logoUrl: '',
      isNative: undefined,
    });
  });

  it('returns undefined without a stock identity', () => {
    expect(
      resolveSwapStockMarketDetailTarget(buildToken({ isStock: true })),
    ).toBeUndefined();
    expect(
      resolveSwapStockMarketDetailTarget(
        buildToken({
          isStock: false,
          stock: {
            stockId: 'AAPL',
            subtitle: '',
            sourceLogoUri: '',
          },
        }),
      ),
    ).toBeUndefined();
    expect(resolveSwapStockMarketDetailTarget(undefined)).toBeUndefined();
  });
});
