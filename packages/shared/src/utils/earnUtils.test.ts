import { EEarnProviderEnum } from '../../types/earn';
import { normalizeToEarnProvider } from '../../types/earn/earnProvider.constants';
import { getNetworkIdsMap } from '../config/networkIds';
import {
  EtherFiLiquidReferContract,
  MorphoBundlerContract,
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
    expect(
      earnUtils.shouldSendEarnProtocolVault({ providerName: 'spark' }),
    ).toBe(true);
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
