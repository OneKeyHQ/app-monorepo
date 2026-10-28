import { EEarnProviderEnum } from '../../types/earn';
import { normalizeToEarnProvider } from '../../types/earn/earnProvider.constants';
import { EApproveType } from '../../types/staking';
import { getNetworkIdsMap } from '../config/networkIds';
import {
  EtherFiLiquidReferContract,
  MorphoBaseBundlerContract,
  MorphoBundlerContract,
  MorphoKatanaBundlerContract,
} from '../consts/addresses';

import earnUtils from './earnUtils';

describe('earnUtils Spark provider integration', () => {
  it('normalizes Spark provider identity for Earn routes and config lookup', () => {
    expect(normalizeToEarnProvider('spark')).toBe(EEarnProviderEnum.Spark);
    expect(earnUtils.getEarnProviderEnumKey('spark')).toBe(
      EEarnProviderEnum.Spark,
    );
    expect(earnUtils.getEarnProviderName({ providerName: 'spark' })).toBe(
      EEarnProviderEnum.Spark,
    );
  });

  it('uses the protocol vault for Spark requests and ERC20 approval', () => {
    const protocolVault = '0x28B3a8fb53B741A8Fd78c0fb9A6B2393d896a43d';

    expect(
      earnUtils.shouldSendEarnProtocolVault({ providerName: 'spark' }),
    ).toBe(true);
    expect(
      earnUtils.resolveEarnApproveSpenderAddress({
        providerName: 'spark',
        protocolVault,
      }),
    ).toBe(protocolVault);
  });

  it('fails closed until Spark returns a withdrawal path', () => {
    expect(
      earnUtils.isEarnWithdrawPathReady({
        providerName: 'Spark',
        isLoading: false,
      }),
    ).toBe(false);
    expect(
      earnUtils.isEarnWithdrawPathReady({
        providerName: 'Spark',
        isLoading: false,
        withdrawType: 'instant',
      }),
    ).toBe(true);
  });
});

describe('earnUtils permit allowance spender', () => {
  const approveSpenderAddress = '0x1111111111111111111111111111111111111111';

  it.each([
    [getNetworkIdsMap().eth, MorphoBundlerContract],
    [getNetworkIdsMap().base, MorphoBaseBundlerContract],
    [getNetworkIdsMap().katana, MorphoKatanaBundlerContract],
  ])(
    'uses the network-specific Morpho bundler on %s',
    (networkId, expected) => {
      expect(
        earnUtils.resolveEarnAllowanceSpenderAddress({
          providerName: 'Morpho',
          networkId,
          approveType: EApproveType.Permit,
          approveSpenderAddress,
        }),
      ).toBe(expected);
    },
  );

  it('keeps legacy Morpho and Spark approvals on their actual target', () => {
    for (const providerName of ['Morpho', 'Spark']) {
      expect(
        earnUtils.resolveEarnAllowanceSpenderAddress({
          providerName,
          networkId: getNetworkIdsMap().eth,
          approveType: EApproveType.Legacy,
          approveSpenderAddress,
        }),
      ).toBe(approveSpenderAddress);
    }
  });

  it('does not apply Morpho routing to other Permit providers', () => {
    expect(
      earnUtils.resolveEarnAllowanceSpenderAddress({
        providerName: 'EtherFi',
        networkId: getNetworkIdsMap().eth,
        approveType: EApproveType.Permit,
        approveSpenderAddress: EtherFiLiquidReferContract,
      }),
    ).toBe(EtherFiLiquidReferContract);
    expect(
      earnUtils.resolveEarnAllowanceSpenderAddress({
        providerName: 'Spark',
        networkId: getNetworkIdsMap().eth,
        approveType: EApproveType.Permit,
        approveSpenderAddress,
      }),
    ).toBe(approveSpenderAddress);
  });

  it('does not invent a missing target or a Morpho spender on another chain', () => {
    expect(
      earnUtils.resolveEarnAllowanceSpenderAddress({
        providerName: 'Morpho',
        networkId: getNetworkIdsMap().eth,
        approveType: EApproveType.Permit,
      }),
    ).toBe('');
    expect(
      earnUtils.resolveEarnAllowanceSpenderAddress({
        providerName: 'Morpho',
        networkId: getNetworkIdsMap().arbitrum,
        approveType: EApproveType.Permit,
        approveSpenderAddress,
      }),
    ).toBe('');
  });
});

describe('earnUtils EtherFi vault and Permit targets', () => {
  const protocolVault = '0xf0bb20865277abd641a307ece5ee04e79073416c';

  it.each(['etherfi', 'EtherFi', 'ETHERFI'])(
    'forwards the vault while keeping the deposit spender separate for %s',
    (providerName) => {
      expect(earnUtils.isEtherFiProvider({ providerName })).toBe(true);
      expect(earnUtils.shouldSendEarnProtocolVault({ providerName })).toBe(
        true,
      );
      expect(
        earnUtils.resolveEarnApproveSpenderAddress({
          providerName,
          protocolVault,
          backendApproveTarget: EtherFiLiquidReferContract,
        }),
      ).toBe(EtherFiLiquidReferContract);
      expect(
        earnUtils.resolveEarnApproveType({
          providerName,
          networkId: getNetworkIdsMap().eth,
          approveSpenderAddress: EtherFiLiquidReferContract,
          backendApproveType: EApproveType.Permit,
        }),
      ).toBe(EApproveType.Permit);
    },
  );

  it('never substitutes the EtherFi receipt vault for missing approval data', () => {
    expect(
      earnUtils.resolveEarnApproveSpenderAddress({
        providerName: 'etherfi',
        protocolVault,
      }),
    ).toBe('');
    expect(
      earnUtils.resolveEarnApproveSpenderAddress({
        providerName: 'Morpho',
        protocolVault,
        backendApproveTarget: MorphoBundlerContract,
      }),
    ).toBe(protocolVault);
  });

  it.each([
    ['EtherFi', getNetworkIdsMap().eth, EtherFiLiquidReferContract],
    ['Morpho', getNetworkIdsMap().eth, MorphoBundlerContract],
    ['Morpho', getNetworkIdsMap().base, MorphoBaseBundlerContract],
    ['Morpho', getNetworkIdsMap().katana, MorphoKatanaBundlerContract],
  ])(
    'resolves a known Permit spender for %s on %s',
    (providerName, networkId, expected) => {
      expect(
        earnUtils.resolveEarnPermitSpenderAddress({ providerName, networkId }),
      ).toBe(expected);
    },
  );

  it.each([
    ['EtherFi', getNetworkIdsMap().base],
    ['EtherFi', getNetworkIdsMap().katana],
    ['Morpho', getNetworkIdsMap().arbitrum],
    ['Spark', getNetworkIdsMap().eth],
    ['unknown', getNetworkIdsMap().eth],
    ['', getNetworkIdsMap().eth],
  ])(
    'rejects an unregistered Permit pair %s on %s',
    (providerName, networkId) => {
      expect(
        earnUtils.resolveEarnPermitSpenderAddress({ providerName, networkId }),
      ).toBeUndefined();
    },
  );
});

describe('earnUtils Permit cache identity', () => {
  const keyPayload = {
    accountId: 'account-1',
    networkId: getNetworkIdsMap().eth,
    providerName: 'Morpho',
    approveSpenderAddress: MorphoBundlerContract,
    tokenAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    amount: '1',
  };

  it('isolates signatures for the same account, token and amount by provider', () => {
    expect(earnUtils.getEarnPermitCacheKey(keyPayload)).not.toBe(
      earnUtils.getEarnPermitCacheKey({
        ...keyPayload,
        providerName: 'EtherFi',
      }),
    );
  });

  it('isolates signatures when the same provider changes its spender', () => {
    expect(earnUtils.getEarnPermitCacheKey(keyPayload)).not.toBe(
      earnUtils.getEarnPermitCacheKey({
        ...keyPayload,
        approveSpenderAddress: EtherFiLiquidReferContract,
      }),
    );
  });

  it('normalizes provider and EVM spender casing for lookup and removal', () => {
    expect(earnUtils.getEarnPermitCacheKey(keyPayload)).toBe(
      earnUtils.getEarnPermitCacheKey({
        ...keyPayload,
        providerName: 'MORPHO',
        approveSpenderAddress: MorphoBundlerContract.toUpperCase(),
      }),
    );
  });

  it('cannot reuse a cache entry created without provider and spender identity', () => {
    const legacyKey = `${keyPayload.accountId}_${keyPayload.networkId}_${keyPayload.tokenAddress}_${keyPayload.amount}`;
    expect(earnUtils.getEarnPermitCacheKey(keyPayload)).not.toBe(legacyKey);
  });
});

describe('earnUtils Bitway provider behavior', () => {
  it('normalizes Bitway and forwards its vault-scoped contract identity', () => {
    expect(earnUtils.getEarnProviderEnumKey('bitway')).toBe('Bitway');
    expect(earnUtils.isBitwayProvider({ providerName: 'BITWAY' })).toBe(true);
    expect(
      earnUtils.shouldSendEarnProtocolVault({ providerName: 'Bitway' }),
    ).toBe(true);
    expect(
      earnUtils.isEarnWithdrawPathReady({
        providerName: 'Bitway',
        isLoading: true,
      }),
    ).toBe(false);
    expect(
      earnUtils.isEarnWithdrawPathReady({
        providerName: 'Bitway',
        isLoading: false,
      }),
    ).toBe(false);
    expect(
      earnUtils.isEarnWithdrawPathReady({
        providerName: 'Bitway',
        isLoading: false,
        withdrawType: 'queued',
      }),
    ).toBe(true);
    expect(
      earnUtils.isEarnWithdrawPathReady({
        providerName: 'Native',
        isLoading: false,
      }),
    ).toBe(true);
    expect(earnUtils.getEarnProviderName({ providerName: 'bitway' })).toBe(
      'Bitway',
    );
  });
});

describe('earnUtils borrow address normalization', () => {
  describe('normalizeBorrowAddress', () => {
    it('lowercases checksum addresses on EVM networks', () => {
      expect(
        earnUtils.normalizeBorrowAddress({
          networkId: 'evm--1',
          address: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2',
        }),
      ).toBe('0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2');
    });

    it('leaves non-EVM (base58, case-sensitive) addresses untouched', () => {
      expect(
        earnUtils.normalizeBorrowAddress({
          networkId: 'sol--101',
          address: '7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF',
        }),
      ).toBe('7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF');
    });
  });

  describe('normalizeBorrowAddressParams', () => {
    it('lowercases marketAddress and reserveAddress on EVM networks', () => {
      expect(
        earnUtils.normalizeBorrowAddressParams({
          networkId: 'evm--1',
          provider: 'aave',
          marketAddress: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2',
          reserveAddress: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        }),
      ).toEqual({
        networkId: 'evm--1',
        provider: 'aave',
        marketAddress: '0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2',
        reserveAddress: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
      });
    });

    it('lowercases collateralReserveAddress on EVM networks (repay-with-collateral)', () => {
      expect(
        earnUtils.normalizeBorrowAddressParams({
          networkId: 'evm--1',
          provider: 'aave',
          marketAddress: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2',
          reserveAddress: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
          collateralReserveAddress:
            '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
        }),
      ).toEqual({
        networkId: 'evm--1',
        provider: 'aave',
        marketAddress: '0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2',
        reserveAddress: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
        collateralReserveAddress: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
      });
    });

    it('leaves base58 collateralReserveAddress untouched on non-EVM', () => {
      const params = {
        networkId: 'sol--101',
        collateralReserveAddress:
          '7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF',
      };
      expect(earnUtils.normalizeBorrowAddressParams(params)).toBe(params);
    });

    it('is a no-op for non-EVM networks', () => {
      const params = {
        networkId: 'sol--101',
        marketAddress: '7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF',
      };
      expect(earnUtils.normalizeBorrowAddressParams(params)).toBe(params);
    });

    it('tolerates missing address fields', () => {
      expect(
        earnUtils.normalizeBorrowAddressParams({ networkId: 'evm--1' }),
      ).toEqual({ networkId: 'evm--1' });
    });
  });

  describe('getDisplaySymbol', () => {
    it('prefers the server relabel when one is present', () => {
      expect(
        earnUtils.getDisplaySymbol({
          symbol: 'vbUSDC',
          displaySymbol: 'USDC for Katana (vbUSDC)',
        }),
      ).toBe('USDC for Katana (vbUSDC)');
    });

    it('falls back to symbol for the tokens that carry no relabel', () => {
      expect(earnUtils.getDisplaySymbol({ symbol: 'USDC' })).toBe('USDC');
      expect(
        earnUtils.getDisplaySymbol({ symbol: 'USDC', displaySymbol: '' }),
      ).toBe('USDC');
    });

    it('returns an empty string rather than throwing on a missing token', () => {
      expect(earnUtils.getDisplaySymbol(undefined)).toBe('');
      expect(earnUtils.getDisplaySymbol(null)).toBe('');
      expect(earnUtils.getDisplaySymbol({})).toBe('');
    });
  });

  describe('matchesSymbolKeyword', () => {
    const token = {
      symbol: 'vbUSDC',
      displaySymbol: 'USDC for Katana (vbUSDC)',
    };

    it('still finds a relabelled token by the symbol users already know', () => {
      expect(earnUtils.matchesSymbolKeyword(token, 'vbusdc')).toBe(true);
    });

    it('matches against the relabel too', () => {
      expect(earnUtils.matchesSymbolKeyword(token, 'katana')).toBe(true);
      expect(earnUtils.matchesSymbolKeyword(token, 'USDC FOR')).toBe(true);
    });

    it('does not match an unrelated keyword', () => {
      expect(earnUtils.matchesSymbolKeyword(token, 'weth')).toBe(false);
    });

    it('treats a blank keyword as no filter', () => {
      expect(earnUtils.matchesSymbolKeyword(token, '')).toBe(true);
      expect(earnUtils.matchesSymbolKeyword(token, '   ')).toBe(true);
      expect(earnUtils.matchesSymbolKeyword(undefined, '')).toBe(true);
    });

    it('does not match when the token has no labels', () => {
      expect(earnUtils.matchesSymbolKeyword(undefined, 'usdc')).toBe(false);
      expect(earnUtils.matchesSymbolKeyword({}, 'usdc')).toBe(false);
    });
  });
});
