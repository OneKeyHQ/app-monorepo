import { getSelectedDeriveTypeForNetwork } from './marketDeriveType';

describe('getSelectedDeriveTypeForNetwork', () => {
  const selection = {
    networkId: 'btc--0',
    deriveType: 'BIP84' as const,
  };

  it('returns the selected derive type for the matching network', () => {
    expect(getSelectedDeriveTypeForNetwork(selection, 'btc--0')).toBe('BIP84');
  });

  it('ignores a selected derive type from another network', () => {
    expect(
      getSelectedDeriveTypeForNetwork(selection, 'evm--1'),
    ).toBeUndefined();
  });

  it('ignores an empty selection and network', () => {
    expect(
      getSelectedDeriveTypeForNetwork(undefined, undefined),
    ).toBeUndefined();
  });
});
