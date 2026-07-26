import type { IUnifoldSupportedAsset } from '@onekeyhq/shared/types/unifoldDeposit';

import {
  filterUnifoldSupportedAssetsByWallets,
  hasUsableUnifoldSupportedAssets,
} from './unifoldDestination';

const mkAsset = (
  chains: Array<{ chain_id: string; chain_type?: string }>,
): IUnifoldSupportedAsset =>
  ({
    symbol: 'USDC',
    name: 'USD Coin',
    icon_url: '',
    is_newly_added: false,
    is_stablecoin: true,
    chains,
  }) as unknown as IUnifoldSupportedAsset;

describe('hasUsableUnifoldSupportedAssets', () => {
  it('passes when at least one asset has a source chain', () => {
    expect(
      hasUsableUnifoldSupportedAssets([mkAsset([{ chain_id: '42161' }])]),
    ).toBe(true);
  });

  it('fails when every asset has an empty chain list', () => {
    expect(hasUsableUnifoldSupportedAssets([mkAsset([])])).toBe(false);
  });

  it('fails closed on empty/undefined catalog', () => {
    expect(hasUsableUnifoldSupportedAssets([])).toBe(false);
    expect(hasUsableUnifoldSupportedAssets(undefined)).toBe(false);
  });
});

describe('filterUnifoldSupportedAssetsByWallets', () => {
  it('keeps only source chains backed by a returned deposit wallet', () => {
    const assets = [
      mkAsset([
        { chain_id: '42161', chain_type: 'evm' },
        { chain_id: '0', chain_type: 'bitcoin' },
        { chain_id: '101', chain_type: 'solana' },
      ]),
    ];

    expect(
      filterUnifoldSupportedAssetsByWallets(assets, [
        {
          chainType: 'EVM',
          address: '0x1234',
          isPrimary: true,
        },
      ]),
    ).toEqual([
      expect.objectContaining({
        chains: [expect.objectContaining({ chain_type: 'evm' })],
      }),
    ]);
  });

  it('fails closed when the address response has no usable wallets', () => {
    expect(filterUnifoldSupportedAssetsByWallets([mkAsset([])], [])).toEqual(
      [],
    );
  });
});
