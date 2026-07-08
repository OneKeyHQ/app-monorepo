import earnUtils from './earnUtils';

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
});
