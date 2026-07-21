import type { IUnifoldSupportedAsset } from '@onekeyhq/shared/types/unifoldDeposit';

import { hasUsableUnifoldSupportedAssets } from './unifoldDestination';

const mkAsset = (chains: Array<{ chain_id: string }>): IUnifoldSupportedAsset =>
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
