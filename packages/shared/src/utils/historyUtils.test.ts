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
  it('uses the backend shielded label when the address is intentionally empty', () => {
    const shielded = transfer({
      type: EOnChainHistoryTransferType.Shielded,
      address: '',
      label: 'Shielded',
    });

    expect(
      getOnChainHistoryTransferDisplayAddress({
        transfer: shielded,
        endpoint: 'from',
      }),
    ).toBe('Shielded');
    expect(
      getOnChainHistoryTransferDisplayAddress({
        transfer: shielded,
        endpoint: 'to',
      }),
    ).toBe('Shielded');
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
