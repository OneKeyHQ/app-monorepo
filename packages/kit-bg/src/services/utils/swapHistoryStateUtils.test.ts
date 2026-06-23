import type { ISwapTxHistory } from '@onekeyhq/shared/types/swap/types';

import { getSwapHistoryStateTxIdParam } from './swapHistoryStateUtils';

function createHistoryWithTxInfo(
  txInfo: Partial<ISwapTxHistory['txInfo']>,
): Pick<ISwapTxHistory, 'txInfo'> {
  return {
    txInfo: txInfo as ISwapTxHistory['txInfo'],
  };
}

describe('swapHistoryStateUtils', () => {
  it('uses the chain txid for normal status polling', () => {
    expect(
      getSwapHistoryStateTxIdParam(
        createHistoryWithTxInfo({
          txId: '0xtx',
          orderId: 'stock-order-1',
        }),
      ),
    ).toBe('0xtx');
  });

  it('falls back to order id for Stock no-send history rows', () => {
    expect(
      getSwapHistoryStateTxIdParam(
        createHistoryWithTxInfo({
          orderId: 'stock-order-1',
          useOrderId: true,
        }),
      ),
    ).toBe('stock-order-1');
  });

  it('keeps the legacy empty-string fallback when no identity exists', () => {
    expect(getSwapHistoryStateTxIdParam(createHistoryWithTxInfo({}))).toBe('');
  });
});
