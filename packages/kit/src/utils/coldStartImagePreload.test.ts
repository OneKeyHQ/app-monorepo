import { getColdStartImageUrisFromSnapshot } from './coldStartImagePreload';

describe('getColdStartImageUrisFromSnapshot', () => {
  it('prewarms both Stock token and network logos from the selected-token cache', () => {
    expect(
      getColdStartImageUrisFromSnapshot({
        'swap-store::ctx:swapStockSelectedTokenAtom': {
          networkId: 'evm--56',
          logoURI: 'https://example.com/aapl.png',
          networkLogoURI: 'https://example.com/bsc.png',
        },
      }),
    ).toEqual(
      expect.arrayContaining([
        'https://example.com/aapl.png',
        'https://example.com/bsc.png',
        'https://uni.onekey-asset.com/static/chain/bsc.png',
      ]),
    );
  });

  it('keeps the selected Swap pair ahead of wallet-list images under a tight limit', () => {
    expect(
      getColdStartImageUrisFromSnapshot(
        {
          'wallet-store::ctx:tokenListSlimColdCache': {
            compactMeta: {
              wallet: {
                logoURI: 'https://example.com/wallet-token.png',
              },
            },
          },
          'swap-store::ctx:swapSelectFromTokenAtom': {
            networkId: 'evm--1',
            logoURI: 'https://example.com/swap-token.png',
            networkLogoURI: 'https://example.com/swap-network.png',
          },
        },
        2,
      ),
    ).toEqual([
      'https://example.com/swap-token.png',
      'https://example.com/swap-network.png',
    ]);
  });
});
