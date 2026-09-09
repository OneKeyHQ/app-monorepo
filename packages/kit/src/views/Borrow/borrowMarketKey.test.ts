import { buildBorrowMarketKey } from './borrowMarketKey';

describe('buildBorrowMarketKey', () => {
  it('collapses EVM checksum casing variants', () => {
    const lowerCaseKey = buildBorrowMarketKey({
      provider: 'aave',
      networkId: 'evm--1',
      marketAddress: '0xabcdef1234567890abcdef1234567890abcdef12',
    });
    const checksumCaseKey = buildBorrowMarketKey({
      provider: 'AAVE',
      networkId: 'evm--1',
      marketAddress: '0xAbCdEf1234567890aBcDeF1234567890AbCdEf12',
    });

    expect(checksumCaseKey).toBe(lowerCaseKey);
  });

  it('keeps case-distinct Solana market addresses distinct', () => {
    const upperCaseKey = buildBorrowMarketKey({
      provider: 'kamino',
      networkId: 'sol--101',
      marketAddress: '7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF',
    });
    const lowerCaseKey = buildBorrowMarketKey({
      provider: 'kamino',
      networkId: 'sol--101',
      marketAddress: '7u3heHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF',
    });

    expect(upperCaseKey).not.toBe(lowerCaseKey);
    expect(upperCaseKey).toContain(
      '7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF',
    );
    expect(lowerCaseKey).toContain(
      '7u3heHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF',
    );
  });
});
