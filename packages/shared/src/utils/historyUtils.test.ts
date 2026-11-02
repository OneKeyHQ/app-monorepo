import {
  EOnChainHistoryTransferType,
  type IOnChainHistoryTxTransfer,
} from '../../types/history';

import { getOnChainHistoryTransferDisplayAddress } from './historyUtils';

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
