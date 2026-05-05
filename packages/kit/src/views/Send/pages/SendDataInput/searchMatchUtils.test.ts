import {
  normalizeSearchKey,
  prioritizeNameThenAddressMatches,
} from './searchMatchUtils';

describe('searchMatchUtils', () => {
  it('normalizes search key with trim and lowercase', () => {
    expect(normalizeSearchKey('  AbC  ')).toBe('abc');
    expect(normalizeSearchKey(undefined)).toBe('');
  });

  it('prioritizes name matches before address-only matches', () => {
    const items = [
      { id: '1', name: 'Alice Wallet', address: '0x111' },
      { id: '2', name: 'Bob', address: 'alice-addr-222' },
      { id: '3', name: 'Carol', address: '0x333' },
    ];

    const { nameMatched, addressOnlyMatched, sorted } =
      prioritizeNameThenAddressMatches({
        items,
        isNameMatch: (item) => item.name.toLowerCase().includes('alice'),
        isAddressMatch: (item) => item.address.toLowerCase().includes('alice'),
      });

    expect(nameMatched.map((item) => item.id)).toEqual(['1']);
    expect(addressOnlyMatched.map((item) => item.id)).toEqual(['2']);
    expect(sorted.map((item) => item.id)).toEqual(['1', '2']);
  });

  it('does not duplicate items when name and address both match', () => {
    const items = [{ id: '1', name: 'Alice', address: 'alice-address' }];
    const { nameMatched, addressOnlyMatched, sorted } =
      prioritizeNameThenAddressMatches({
        items,
        isNameMatch: (item) => item.name.toLowerCase().includes('alice'),
        isAddressMatch: (item) => item.address.toLowerCase().includes('alice'),
      });

    expect(nameMatched.map((item) => item.id)).toEqual(['1']);
    expect(addressOnlyMatched).toHaveLength(0);
    expect(sorted.map((item) => item.id)).toEqual(['1']);
  });
});
