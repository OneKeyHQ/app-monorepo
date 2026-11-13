import {
  EOnChainHistoryTransferType,
  type IAccountHistoryTx,
  type IOnChainHistoryTxTransfer,
} from '../../types/history';

import {
  convertHistoryTxsFiatCurrency,
  getOnChainHistoryTransferDisplayAddress,
  getUtxoHistoryDisplayValue,
} from './historyUtils';

import type { ICurrencyItem } from '../../types/currency';
import type { IDecodedTxTransferInfo } from '../../types/tx';

function transfer(
  values: Partial<IOnChainHistoryTxTransfer>,
): IOnChainHistoryTxTransfer {
  return {
    type: EOnChainHistoryTransferType.Transfer,
    from: 't-from',
    to: 't-to',
    token: '',
    key: '',
    amount: '1',
    label: 'Transfer',
    ...values,
  };
}

describe('getOnChainHistoryTransferDisplayAddress', () => {
  it('never returns a shielded label as an address', () => {
    for (const shielded of [
      transfer({
        type: EOnChainHistoryTransferType.Shielded,
        address: '',
        label: 'Shielded',
      }),
      // The indexer may repeat the label as the address.
      transfer({
        type: EOnChainHistoryTransferType.Shielded,
        address: 'Shielded',
        label: 'Shielded',
      }),
    ]) {
      expect(
        getOnChainHistoryTransferDisplayAddress({
          transfer: shielded,
          endpoint: 'from',
        }),
      ).toBe('');
      expect(
        getOnChainHistoryTransferDisplayAddress({
          transfer: shielded,
          endpoint: 'to',
        }),
      ).toBe('');
    }
  });

  it('keeps the real address of a shielded output', () => {
    const shielded = transfer({
      type: EOnChainHistoryTransferType.Shielded,
      address: 'u1recipient',
      label: '',
    });
    expect(
      getOnChainHistoryTransferDisplayAddress({
        transfer: shielded,
        endpoint: 'to',
      }),
    ).toBe('u1recipient');
  });

  it('keeps normal transparent endpoints unchanged', () => {
    const transparent = transfer({});

    expect(
      getOnChainHistoryTransferDisplayAddress({
        transfer: transparent,
        endpoint: 'from',
      }),
    ).toBe('t-from');
    expect(
      getOnChainHistoryTransferDisplayAddress({
        transfer: transparent,
        endpoint: 'to',
      }),
    ).toBe('t-to');
  });
});

describe('getUtxoHistoryDisplayValue', () => {
  // Captured from /wallet/v1/account/history/detail for a BTC transfer between
  // two addresses of the same account (OK-66077): net value is 0 while both
  // legs are owned.
  const selfTransfer = {
    value: '0.00000000',
    sends: [
      transfer({ from: 'bc1q-a', to: '', amount: '0.00001000', isOwn: true }),
    ],
    receives: [
      transfer({ from: '', to: 'bc1q-b', amount: '0.00001000', isOwn: true }),
    ],
  };

  it('shows the moved amount for a transfer between the account own addresses', () => {
    expect(getUtxoHistoryDisplayValue(selfTransfer)).toBe('0.00001');
  });

  it('keeps the server value whenever it is non-zero', () => {
    expect(
      getUtxoHistoryDisplayValue({ ...selfTransfer, value: '0.00001000' }),
    ).toBe('0.00001000');
  });

  it('keeps a zero value when a leg is external', () => {
    expect(
      getUtxoHistoryDisplayValue({
        ...selfTransfer,
        receives: [
          transfer({ to: 'bc1q-other', amount: '0.00001000', isOwn: false }),
        ],
      }),
    ).toBe('0.00000000');
    expect(
      getUtxoHistoryDisplayValue({
        ...selfTransfer,
        receives: [transfer({ to: 'bc1q-b', amount: '0.00001000' })],
      }),
    ).toBe('0.00000000');
  });

  it('excludes outputs the server marks as change', () => {
    expect(
      getUtxoHistoryDisplayValue({
        ...selfTransfer,
        receives: [
          transfer({ to: 'bc1q-b', amount: '0.00001000', isOwn: true }),
          transfer({
            to: 'bc1q-a2',
            amount: '0.00003500',
            isOwn: true,
            isChange: true,
          }),
        ],
      }),
    ).toBe('0.00001');
  });

  it('keeps the value when there is nothing to sum', () => {
    expect(getUtxoHistoryDisplayValue({ ...selfTransfer, receives: [] })).toBe(
      '0.00000000',
    );
  });

  it('keeps a zero value when every owned output is change', () => {
    // Change-only spend (consolidation into the change path): there is no
    // recipient, so the change must not be presented as a payment.
    expect(
      getUtxoHistoryDisplayValue({
        ...selfTransfer,
        receives: [
          transfer({
            to: 'bc1q-a2',
            amount: '0.00001000',
            isOwn: true,
            isChange: true,
          }),
        ],
      }),
    ).toBe('0.00000000');
  });
});

describe('convertHistoryTxsFiatCurrency', () => {
  const currencyMap = {
    usd: { id: 'usd', value: '1' },
    cny: { id: 'cny', value: '6.5' },
  } as unknown as Record<string, ICurrencyItem>;

  function assetTransfer(price?: string): IDecodedTxTransferInfo {
    return { amount: '2', price } as IDecodedTxTransferInfo;
  }

  function historyTx(values: Partial<IAccountHistoryTx>): IAccountHistoryTx {
    return {
      id: 'tx',
      decodedTx: {
        totalFeeFiatValue: '0.5',
        actions: [
          {
            assetTransfer: {
              sends: [assetTransfer('2')],
              receives: [assetTransfer(undefined)],
            },
          },
        ],
        outputActions: [
          { assetTransfer: { sends: [], receives: [assetTransfer('4')] } },
        ],
      },
      ...values,
    } as unknown as IAccountHistoryTx;
  }

  function fiatOf(tx: IAccountHistoryTx) {
    return {
      fiatCurrency: tx.fiatCurrency,
      fee: tx.decodedTx.totalFeeFiatValue,
      send: tx.decodedTx.actions[0].assetTransfer?.sends[0].price,
      receive: tx.decodedTx.actions[0].assetTransfer?.receives[0].price,
      output: tx.decodedTx.outputActions?.[0].assetTransfer?.receives[0].price,
    };
  }

  it('converts a row priced in another currency to the display currency', () => {
    const [converted] = convertHistoryTxsFiatCurrency({
      txs: [historyTx({ fiatCurrency: 'usd' })],
      targetCurrency: 'cny',
      currencyMap,
    });
    expect(fiatOf(converted)).toEqual({
      fiatCurrency: 'cny',
      fee: '3.25',
      send: '13',
      receive: undefined,
      output: '26',
    });
  });

  it('converts back with the inverse rate', () => {
    const [converted] = convertHistoryTxsFiatCurrency({
      txs: [historyTx({ fiatCurrency: 'cny' })],
      targetCurrency: 'usd',
      currencyMap,
    });
    expect(converted.fiatCurrency).toBe('usd');
    expect(Number(converted.decodedTx.totalFeeFiatValue)).toBeCloseTo(
      0.5 / 6.5,
      10,
    );
    expect(
      Number(converted.decodedTx.actions[0].assetTransfer?.sends[0].price),
    ).toBeCloseTo(2 / 6.5, 10);
  });

  it('returns rows already in the display currency untouched', () => {
    const tx = historyTx({ fiatCurrency: 'cny' });
    const txs = [tx];
    expect(
      convertHistoryTxsFiatCurrency({
        txs,
        targetCurrency: 'cny',
        currencyMap,
      }),
    ).toBe(txs);
  });

  it('leaves rows without a recorded currency as stored', () => {
    const tx = historyTx({});
    const [result] = convertHistoryTxsFiatCurrency({
      txs: [tx],
      targetCurrency: 'cny',
      currencyMap,
    });
    expect(result).toBe(tx);
  });

  it('drops the fiat snapshot when a rate is unavailable', () => {
    const [converted] = convertHistoryTxsFiatCurrency({
      txs: [historyTx({ fiatCurrency: 'eur' })],
      targetCurrency: 'cny',
      currencyMap,
    });
    expect(fiatOf(converted)).toEqual({
      fiatCurrency: undefined,
      fee: undefined,
      send: undefined,
      receive: undefined,
      output: undefined,
    });
  });
});
