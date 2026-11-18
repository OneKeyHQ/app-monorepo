import type { IUnifoldSupportedAsset } from '@onekeyhq/shared/types/unifoldDeposit';

import {
  filterUnifoldSupportedAssetsByWallets,
  findMatchingUnifoldSourceSelection,
  hasUsableUnifoldSupportedAssets,
  isSameUnifoldChain,
  pickUnifoldChainForAsset,
} from './unifoldDestination';

const mkAsset = (
  chains: Array<{
    chain_id: string;
    chain_type?: string;
    token_address?: string;
  }>,
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

describe('findMatchingUnifoldSourceSelection', () => {
  const assets = [
    mkAsset([
      {
        chain_id: '42161',
        chain_type: 'evm',
        token_address: '0x1234',
      },
    ]),
  ];
  const selection = {
    asset: { symbol: 'USDC' },
    chain: {
      chain_id: '42161',
      chain_type: 'evm',
      token_address: '0x1234',
    },
  };
  const unsupportedSelectionCases: Array<
    [
      string,
      {
        asset?: Partial<(typeof selection)['asset']>;
        chain?: Partial<(typeof selection)['chain']>;
      },
    ]
  > = [
    ['symbol', { asset: { symbol: 'USDT' } }],
    ['chain id', { chain: { chain_id: '1' } }],
    ['chain type', { chain: { chain_type: 'solana' } }],
    ['token address', { chain: { token_address: '0xremoved' } }],
  ];

  it('returns the current catalog objects for an exact selection', () => {
    expect(findMatchingUnifoldSourceSelection(assets, selection)).toEqual({
      asset: assets[0],
      chain: assets[0].chains[0],
    });
  });

  it.each(unsupportedSelectionCases)(
    'fails closed when the cached %s is no longer in the catalog',
    (_field, override) => {
      expect(
        findMatchingUnifoldSourceSelection(assets, {
          asset: {
            ...selection.asset,
            ...override.asset,
          },
          chain: {
            ...selection.chain,
            ...override.chain,
          },
        }),
      ).toBeNull();
    },
  );
});

// Every non-EVM chain in the Unifold catalog uses chain_id 'mainnet'.
const arbitrum = { chain_id: '42161', chain_type: 'ethereum' };
const solana = { chain_id: 'mainnet', chain_type: 'solana' };
const tron = { chain_id: 'mainnet', chain_type: 'tron' };
const bitcoin = { chain_id: 'mainnet', chain_type: 'bitcoin' };

describe('isSameUnifoldChain', () => {
  it('matches on chain type and chain id together', () => {
    expect(isSameUnifoldChain(tron, { ...tron })).toBe(true);
    expect(isSameUnifoldChain(arbitrum, { ...arbitrum })).toBe(true);
  });

  it('tells apart non-EVM chains that share the mainnet chain id', () => {
    expect(isSameUnifoldChain(tron, solana)).toBe(false);
    expect(isSameUnifoldChain(bitcoin, solana)).toBe(false);
  });

  it('is false when either side is missing', () => {
    expect(isSameUnifoldChain(undefined, tron)).toBe(false);
    expect(isSameUnifoldChain(tron, null)).toBe(false);
  });
});

describe('pickUnifoldChainForAsset', () => {
  it('keeps the current chain when the token offers it', () => {
    const usdt0 = mkAsset([arbitrum, solana, tron]);
    expect(pickUnifoldChainForAsset(usdt0, tron)).toBe(usdt0.chains[2]);
    expect(pickUnifoldChainForAsset(usdt0, solana)).toBe(usdt0.chains[1]);
  });

  it('snaps to the first chain rather than another mainnet chain', () => {
    // Tron → a token with Solana but no Tron must not land on Solana.
    const usdc = mkAsset([arbitrum, solana]);
    expect(pickUnifoldChainForAsset(usdc, tron)).toBe(usdc.chains[0]);
    // Bitcoin → USDT0 likewise.
    const usdt0 = mkAsset([arbitrum, solana, tron]);
    expect(pickUnifoldChainForAsset(usdt0, bitcoin)).toBe(usdt0.chains[0]);
  });

  it('falls back to the first chain without a current chain', () => {
    const usdc = mkAsset([arbitrum, solana]);
    expect(pickUnifoldChainForAsset(usdc, undefined)).toBe(usdc.chains[0]);
  });

  it('returns undefined for a token without chains', () => {
    expect(pickUnifoldChainForAsset(mkAsset([]), tron)).toBeUndefined();
  });
});
