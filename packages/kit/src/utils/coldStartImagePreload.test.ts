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
});
