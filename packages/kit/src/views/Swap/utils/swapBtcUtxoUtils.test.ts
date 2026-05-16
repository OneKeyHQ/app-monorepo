import { EUtxoSelectionStrategy } from '@onekeyhq/shared/types/send';

import {
  buildBtcSingleAddressUtxoPlanFromUtxos,
  pickBtcSwapFeeRateSatPerVByte,
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

  it('picks the smallest single UTXO that covers amount and estimated fee', () => {
    const plan = buildBtcSingleAddressUtxoPlanFromUtxos({
      amount: '0.001',
      decimals: 8,
      feeRateSatPerVByte: '20',
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
      refundAddress: 'bc1p-b',
      selectedUtxoKeys: ['tx-b:1'],
      utxoSelectionStrategy: EUtxoSelectionStrategy.ForceSelected,
    });
  });

  it('returns undefined when nominal amount is covered but estimated fee is not', () => {
    const plan = buildBtcSingleAddressUtxoPlanFromUtxos({
      amount: '0.001',
      decimals: 8,
      feeRateSatPerVByte: '20',
      utxos: [
        {
          txid: 'tx-a',
          vout: 0,
          value: '100500',
          address: 'bc1p-a',
        },
      ],
    });

    expect(plan).toBeUndefined();
  });

  it('can select multiple UTXOs from the same address', () => {
    const plan = buildBtcSingleAddressUtxoPlanFromUtxos({
      amount: '0.001',
      decimals: 8,
      feeRateSatPerVByte: '20',
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
      refundAddress: 'bc1p-a',
      selectedUtxoKeys: ['tx-a:0', 'tx-b:1'],
      utxoSelectionStrategy: EUtxoSelectionStrategy.ForceSelected,
    });
  });

  it('uses the fee rate when choosing between same-address candidates', () => {
    const plan = buildBtcSingleAddressUtxoPlanFromUtxos({
      amount: '0.001',
      decimals: 8,
      feeRateSatPerVByte: '50',
      utxos: [
        {
          txid: 'tx-a',
          vout: 0,
          value: '112000',
          address: 'bc1p-a',
        },
        {
          txid: 'tx-b',
          vout: 0,
          value: '120000',
          address: 'bc1p-b',
        },
      ],
    });

    expect(plan).toEqual({
      userAddress: 'bc1p-b',
      refundAddress: 'bc1p-b',
      selectedUtxoKeys: ['tx-b:0'],
      utxoSelectionStrategy: EUtxoSelectionStrategy.ForceSelected,
    });
  });

  it('returns undefined when no one address can cover the amount', () => {
    const plan = buildBtcSingleAddressUtxoPlanFromUtxos({
      amount: '0.001',
      decimals: 8,
      feeRateSatPerVByte: '20',
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

  it('picks the medium BTC fee rate from fee estimates', () => {
    expect(
      pickBtcSwapFeeRateSatPerVByte([
        { feeRate: '10' },
        { feeRate: '20' },
        { feeRate: '30' },
      ]),
    ).toBe('20');

    expect(pickBtcSwapFeeRateSatPerVByte([{ feeRate: '10' }])).toBe('10');
  });
});
