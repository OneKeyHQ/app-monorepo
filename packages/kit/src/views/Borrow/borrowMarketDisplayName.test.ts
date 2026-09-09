import { getBorrowMarketLabel } from './borrowMarketDisplayName';

describe('getBorrowMarketLabel', () => {
  it.each([
    ['Kamino Main Market', 'Kamino Main'],
    ['Aave Core Instance', 'Aave Core'],
    ['Aave Base Market', 'Aave Base'],
    ['Aave Prime Instance', 'Aave Prime'],
    ['Market Neutral Instance', 'Market Neutral'],
    ['Kamino JLP Market Instance', 'Kamino JLP'],
    ['Market', 'Market'],
    ['  Aave  Core  Instance ', 'Aave Core'],
    ['', ''],
  ])('formats "%s" as "%s"', (name, expected) => {
    expect(getBorrowMarketLabel({ name })).toBe(expected);
  });
});
