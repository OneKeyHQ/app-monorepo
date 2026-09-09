import { mergeBatchCreateCustomNetworks } from './batchCreateCustomNetworks';

import type { IAccountDeriveTypes } from '../../vaults/types';

const btc = 'btc--0';

function item({
  networkId = btc,
  deriveType,
  indexes,
}: {
  networkId?: string;
  deriveType: string;
  indexes?: number[];
}) {
  return {
    networkId,
    deriveType: deriveType as IAccountDeriveTypes,
    indexes,
  };
}

describe('mergeBatchCreateCustomNetworks', () => {
  it('keeps first-wins order for distinct pairs (uniqBy compatible)', () => {
    const result = mergeBatchCreateCustomNetworks({
      defaultNetworks: [item({ deriveType: 'BIP86' })],
      customNetworks: [
        item({ deriveType: 'BIP84' }),
        item({ deriveType: 'BIP44' }),
      ],
    });
    expect(result.map((i) => i.deriveType)).toEqual([
      'BIP86',
      'BIP84',
      'BIP44',
    ]);
  });

  it('dedupes identical pairs keeping the first occurrence', () => {
    const result = mergeBatchCreateCustomNetworks({
      defaultNetworks: [item({ deriveType: 'BIP86' })],
      customNetworks: [item({ deriveType: 'BIP86' })],
    });
    expect(result).toHaveLength(1);
  });

  it('prefers the duplicate that carries indexes over the index-less seed', () => {
    const result = mergeBatchCreateCustomNetworks({
      defaultNetworks: [item({ deriveType: 'BIP86' })],
      customNetworks: [
        item({ deriveType: 'BIP86', indexes: [0, 1, 2] }),
        item({ deriveType: 'BIP44', indexes: [0] }),
      ],
    });
    expect(result).toEqual([
      item({ deriveType: 'BIP86', indexes: [0, 1, 2] }),
      item({ deriveType: 'BIP44', indexes: [0] }),
    ]);
    // Order preserved: the upgraded entry stays in the seed's position.
    expect(result[0].deriveType).toBe('BIP86');
  });

  it('does not replace an indexed entry with an index-less duplicate', () => {
    const result = mergeBatchCreateCustomNetworks({
      defaultNetworks: [item({ deriveType: 'BIP86', indexes: [5] })],
      customNetworks: [item({ deriveType: 'BIP86' })],
    });
    expect(result).toEqual([item({ deriveType: 'BIP86', indexes: [5] })]);
  });

  it('treats same deriveType on different networks as distinct pairs', () => {
    const result = mergeBatchCreateCustomNetworks({
      defaultNetworks: [item({ deriveType: 'BIP86' })],
      customNetworks: [
        item({ networkId: 'tbtc--0', deriveType: 'BIP86', indexes: [0] }),
      ],
    });
    expect(result).toHaveLength(2);
  });

  it('handles undefined customNetworks', () => {
    const result = mergeBatchCreateCustomNetworks({
      defaultNetworks: [item({ deriveType: 'BIP86' })],
      customNetworks: undefined,
    });
    expect(result).toEqual([item({ deriveType: 'BIP86' })]);
  });
});
