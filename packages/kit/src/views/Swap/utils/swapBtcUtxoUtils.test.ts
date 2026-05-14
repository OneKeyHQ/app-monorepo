import { EUtxoSelectionStrategy } from '@onekeyhq/shared/types/send';

import {
  buildBtcSingleAddressUtxoPlanFromUtxos,
  shouldUseBtcSingleAddressUtxoPlan,
} from './swapBtcUtxoUtils';

describe('swapBtcUtxoUtils', () => {
  it('only enables single-address UTXO planning for SWFT BTC routes', () => {
    expect(
      shouldUseBtcSingleAddressUtxoPlan({
        networkId: 'btc--0',
        provider: 'SWFT',
      }),
    ).toBe(true);

    expect(
      shouldUseBtcSingleAddressUtxoPlan({
        networkId: 'evm--1',
        provider: 'SWFT',
      }),
    ).toBe(false);

    expect(
      shouldUseBtcSingleAddressUtxoPlan({
        networkId: 'btc--0',
        provider: 'OKX',
      }),
    ).toBe(false);
  });

  it('selects the smallest single UTXO that covers the amount plus fee buffer', () => {
    const plan = buildBtcSingleAddressUtxoPlanFromUtxos({
      amount: '0.001',
      decimals: 8,
      utxos: [
        {
          txid: 'tx-a',
          vout: 0,
          value: '100500',
          address: 'bc1p-a',
        },
        {
          txid: 'tx-b',
          vout: 1,
          value: '120000',
          address: 'bc1p-b',
        },
        {
          txid: 'tx-c',
          vout: 0,
          value: '200000',
          address: 'bc1p-c',
        },
      ],
    });

    expect(plan).toEqual({
      userAddress: 'bc1p-b',
      selectedUtxoKeys: ['tx-b:1'],
      utxoSelectionStrategy: EUtxoSelectionStrategy.ForceSelected,
    });
  });

  it('falls back to nominal amount coverage when the buffer is not available', () => {
    const plan = buildBtcSingleAddressUtxoPlanFromUtxos({
      amount: '0.001',
      decimals: 8,
      utxos: [
        {
          txid: 'tx-a',
          vout: 0,
          value: '100500',
          address: 'bc1p-a',
        },
      ],
    });

    expect(plan).toEqual({
      userAddress: 'bc1p-a',
      selectedUtxoKeys: ['tx-a:0'],
      utxoSelectionStrategy: EUtxoSelectionStrategy.ForceSelected,
    });
  });

  it('can select multiple UTXOs from the same address', () => {
    const plan = buildBtcSingleAddressUtxoPlanFromUtxos({
      amount: '0.001',
      decimals: 8,
      utxos: [
        {
          txid: 'tx-a',
          vout: 0,
          value: '60000',
          address: 'bc1p-a',
        },
        {
          txid: 'tx-b',
          vout: 1,
          value: '60000',
          address: 'bc1p-a',
        },
        {
          txid: 'tx-c',
          vout: 0,
          value: '90000',
          address: 'bc1p-b',
        },
      ],
    });

    expect(plan).toEqual({
      userAddress: 'bc1p-a',
      selectedUtxoKeys: ['tx-a:0', 'tx-b:1'],
      utxoSelectionStrategy: EUtxoSelectionStrategy.ForceSelected,
    });
  });

  it('returns undefined when no one address can cover the amount', () => {
    const plan = buildBtcSingleAddressUtxoPlanFromUtxos({
      amount: '0.001',
      decimals: 8,
      utxos: [
        {
          txid: 'tx-a',
          vout: 0,
          value: '50000',
          address: 'bc1p-a',
        },
        {
          txid: 'tx-b',
          vout: 0,
          value: '50000',
          address: 'bc1p-b',
        },
      ],
    });

    expect(plan).toBeUndefined();
  });
});
