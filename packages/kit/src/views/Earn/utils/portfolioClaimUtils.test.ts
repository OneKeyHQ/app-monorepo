import type { IEarnAvailableAssetV2 } from '@onekeyhq/shared/types/earn';

import {
  buildPortfolioClaimSymbolMap,
  getPortfolioProtocolIdentityKey,
  resolvePortfolioClaimProtocolIdentity,
  resolveUniquePortfolioClaimSourceIdentity,
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
    ).toEqual({ status: 'matched', symbol: 'USDC' });
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
    ).toEqual({ status: 'matched', symbol: 'USDT' });
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
      {
        type: 'normal',
        networkId: 'evm--1',
        provider: 'morpho',
        symbol: 'USDC',
        vault: 'shared-vault',
      },
    ];

    expect(
      buildPortfolioClaimSymbolMap(assets).get(
        getPortfolioProtocolIdentityKey(assets[0]),
      ),
    ).toEqual({ status: 'ambiguous' });
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
        isAirdrop: true,
        providerName: 'Morpho',
        assetSymbol: 'MORPHO',
        assetVault: '0x1401d1271c47648ac70cbcdfa3776d4a87ce006b',
        claimSymbol: 'USDC',
        claimSymbolStatus: 'matched',
        sourceIdentity: {
          symbol: 'WRONG_SOURCE',
          vault: 'wrong-source-vault',
        },
      }),
    ).toEqual({
      symbol: 'USDC',
      vault: '0x1401d1271c47648ac70cbcdfa3776d4a87ce006b',
    });
  });

  it('preserves the existing Ethereum Morpho claim request identity', () => {
    expect(
      resolvePortfolioClaimProtocolIdentity({
        isAirdrop: true,
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
        isAirdrop: false,
        providerName: 'Morpho',
        assetSymbol: 'USDT',
        assetVault: 'morpho-usdt-vault',
      }),
    ).toEqual({
      symbol: 'USDT',
      vault: 'morpho-usdt-vault',
    });
  });

  it('fails closed when the claim identity is ambiguous', () => {
    expect(
      resolvePortfolioClaimProtocolIdentity({
        isAirdrop: true,
        providerName: 'Morpho',
        assetSymbol: 'MORPHO',
        assetVault: 'shared-vault',
        claimSymbolStatus: 'ambiguous',
        sourceIdentity: {
          symbol: 'USDC',
          vault: 'shared-vault',
        },
      }),
    ).toBeNull();
  });

  it('preserves Pendle reward protocol identity', () => {
    expect(
      resolvePortfolioClaimProtocolIdentity({
        isAirdrop: true,
        providerName: 'Pendle',
        assetSymbol: 'USDe',
        assetVault: 'pendle-reward-vault',
        claimSymbol: 'sUSDe',
        claimSymbolStatus: 'ambiguous',
        sourceIdentity: null,
      }),
    ).toEqual({
      symbol: 'USDe',
      vault: 'pendle-reward-vault',
    });
  });

  it('keeps a unique Lista source position identity', () => {
    const sourceIdentity = resolveUniquePortfolioClaimSourceIdentity({
      networkId: 'evm--56',
      providerName: 'Lista',
      candidates: [
        {
          networkId: 'evm--56',
          providerName: 'Lista',
          symbol: 'slisBNB',
          vault: 'position-vault',
        },
        {
          networkId: 'evm--56',
          providerName: 'Lista',
          symbol: 'slisBNB',
          vault: 'POSITION-VAULT',
        },
        {
          networkId: 'evm--56',
          providerName: 'Lista',
          symbol: '   ',
          vault: 'invalid-position-vault',
        },
        {
          networkId: 'evm--1',
          providerName: 'Lista',
          symbol: 'OTHER_NETWORK',
          vault: 'other-vault',
        },
      ],
    });

    expect(
      resolvePortfolioClaimProtocolIdentity({
        isAirdrop: true,
        providerName: 'Lista',
        assetSymbol: 'LISTA',
        assetVault: 'reward-vault',
        claimSymbolStatus: 'unmatched',
        sourceIdentity,
      }),
    ).toEqual({
      symbol: 'slisBNB',
      vault: 'position-vault',
    });
  });

  it('fails closed for unmatched airdrops with multiple source positions', () => {
    const sourceIdentity = resolveUniquePortfolioClaimSourceIdentity({
      networkId: 'evm--56',
      providerName: 'Lista',
      candidates: [
        {
          networkId: 'evm--56',
          providerName: 'Lista',
          symbol: 'slisBNB',
          vault: 'first-position-vault',
        },
        {
          networkId: 'evm--56',
          providerName: 'Lista',
          symbol: 'lisUSD',
          vault: 'second-position-vault',
        },
      ],
    });

    expect(sourceIdentity).toBeNull();
    expect(
      resolvePortfolioClaimProtocolIdentity({
        isAirdrop: true,
        providerName: 'Lista',
        assetSymbol: 'LISTA',
        assetVault: 'reward-vault',
        claimSymbolStatus: 'unmatched',
        sourceIdentity,
      }),
    ).toBeNull();
  });

  it('fails closed for unmatched airdrops without a source position', () => {
    expect(
      resolvePortfolioClaimProtocolIdentity({
        isAirdrop: true,
        providerName: 'Morpho',
        assetSymbol: 'MORPHO',
        assetVault: 'reward-vault',
        claimSymbolStatus: 'unmatched',
        sourceIdentity: null,
      }),
    ).toBeNull();
  });
});
