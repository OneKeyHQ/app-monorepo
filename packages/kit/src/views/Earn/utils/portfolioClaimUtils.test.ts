import type { IEarnAvailableAssetV2 } from '@onekeyhq/shared/types/earn';

import {
  buildPortfolioClaimSymbolMap,
  getPortfolioProtocolIdentityKey,
  resolvePortfolioClaimProtocolIdentity,
} from './portfolioClaimUtils';

describe('buildPortfolioClaimSymbolMap', () => {
  it('resolves the claim symbol from the normal protocol with the same identity', () => {
    const airdropAsset: IEarnAvailableAssetV2 = {
      type: 'airdrop',
      networkId: 'evm--8453',
      provider: 'morpho',
      symbol: 'MORPHO',
      vault: '0x1401d1271c47648ac70cbcdfa3776d4a87ce006b',
    };
    const claimSymbolMap = buildPortfolioClaimSymbolMap([
      {
        type: 'normal',
        networkId: 'evm--8453',
        provider: 'morpho',
        symbol: 'USDC',
        vault: '0x1401D1271C47648AC70CBCdfA3776D4A87CE006B',
      },
      airdropAsset,
    ]);

    expect(
      claimSymbolMap.get(getPortfolioProtocolIdentityKey(airdropAsset)),
    ).toBe('USDC');
  });

  it('resolves non-USDC claim symbols without provider-specific rules', () => {
    const airdropAsset: IEarnAvailableAssetV2 = {
      type: 'airdrop',
      networkId: 'evm--56',
      provider: 'lista',
      symbol: 'LISTA',
      vault: 'lista-usdt-vault',
    };
    const claimSymbolMap = buildPortfolioClaimSymbolMap([
      {
        type: 'normal',
        networkId: 'evm--56',
        provider: 'lista',
        symbol: 'USDT',
        vault: 'lista-usdt-vault',
      },
      airdropAsset,
    ]);

    expect(
      claimSymbolMap.get(getPortfolioProtocolIdentityKey(airdropAsset)),
    ).toBe('USDT');
  });

  it('does not guess when the same protocol identity has conflicting symbols', () => {
    const assets: IEarnAvailableAssetV2[] = [
      {
        type: 'normal',
        networkId: 'evm--1',
        provider: 'morpho',
        symbol: 'USDC',
        vault: 'shared-vault',
      },
      {
        type: 'normal',
        networkId: 'evm--1',
        provider: 'morpho',
        symbol: 'USDT',
        vault: 'shared-vault',
      },
    ];

    expect(buildPortfolioClaimSymbolMap(assets).size).toBe(0);
  });

  it('keeps non-EVM vault identities case-sensitive', () => {
    const normalAsset: IEarnAvailableAssetV2 = {
      type: 'normal',
      networkId: 'sol--101',
      provider: 'native',
      symbol: 'USDC',
      vault: 'CaseSensitiveVault',
    };
    const airdropAsset: IEarnAvailableAssetV2 = {
      type: 'airdrop',
      networkId: 'sol--101',
      provider: 'native',
      symbol: 'REWARD',
      vault: 'casesensitivevault',
    };
    const claimSymbolMap = buildPortfolioClaimSymbolMap([normalAsset]);

    expect(
      claimSymbolMap.get(getPortfolioProtocolIdentityKey(airdropAsset)),
    ).toBeUndefined();
  });
});

describe('resolvePortfolioClaimProtocolIdentity', () => {
  it('uses the server-derived Base Morpho claim identity', () => {
    expect(
      resolvePortfolioClaimProtocolIdentity({
        providerName: 'Morpho',
        assetSymbol: 'MORPHO',
        assetVault: '0x1401d1271c47648ac70cbcdfa3776d4a87ce006b',
        claimSymbol: 'USDC',
      }),
    ).toEqual({
      symbol: 'USDC',
      vault: '0x1401d1271c47648ac70cbcdfa3776d4a87ce006b',
    });
  });

  it('preserves the existing Ethereum Morpho claim request identity', () => {
    expect(
      resolvePortfolioClaimProtocolIdentity({
        providerName: 'Morpho',
        assetSymbol: 'MORPHO',
        assetVault: '0x974c8fbf4fd795f66b85b73ebc988a51f1a040a9',
        claimSymbol: 'USDC',
      }),
    ).toEqual({
      symbol: 'USDC',
      vault: '0x974c8fbf4fd795f66b85b73ebc988a51f1a040a9',
    });
  });

  it('keeps a normal Morpho asset symbol without a provider hardcode', () => {
    expect(
      resolvePortfolioClaimProtocolIdentity({
        providerName: 'Morpho',
        assetSymbol: 'USDT',
        assetVault: 'morpho-usdt-vault',
      }),
    ).toEqual({
      symbol: 'USDT',
      vault: 'morpho-usdt-vault',
    });
  });

  it('preserves Pendle reward protocol identity', () => {
    expect(
      resolvePortfolioClaimProtocolIdentity({
        providerName: 'Pendle',
        assetSymbol: 'USDe',
        assetVault: 'pendle-reward-vault',
        stakedSymbol: 'sUSDe',
        stakedVault: 'pendle-position-vault',
      }),
    ).toEqual({
      symbol: 'USDe',
      vault: 'pendle-reward-vault',
    });
  });

  it('keeps the source position identity for other providers', () => {
    expect(
      resolvePortfolioClaimProtocolIdentity({
        providerName: 'Lista',
        assetSymbol: 'LISTA',
        assetVault: 'reward-vault',
        stakedSymbol: 'slisBNB',
        stakedVault: 'position-vault',
      }),
    ).toEqual({
      symbol: 'slisBNB',
      vault: 'position-vault',
    });
  });
});
