import {
  EOnChainHistoryTransferType,
  type IOnChainHistoryTxTransfer,
} from '../../types/history';

import {
  getOnChainHistoryTransferDisplayAddress,
  getUtxoHistoryDisplayValue,
} from './historyUtils';

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
});
