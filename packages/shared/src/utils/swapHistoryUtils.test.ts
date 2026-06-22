import { privateSendProvider } from '../../types/swap/SwapProvider.constants';
import {
  EProtocolOfExchange,
  ESwapTxHistoryStatus,
  type ISwapToken,
  type ISwapTxHistory,
} from '../../types/swap/types';

import {
  SWAP_HISTORY_LONG_PENDING_WARNING_THRESHOLD_MS,
  getSwapHistoryLongPendingWarningDelayMs,
  shouldShowSwapHistoryLongPendingWarning,
} from './swapHistoryUtils';

const now = 1_000_000_000;

const token: ISwapToken = {
  networkId: 'evm--1',
  contractAddress: '',
  symbol: 'ETH',
  decimals: 18,
};

function makeHistory(overrides: Partial<ISwapTxHistory> = {}): ISwapTxHistory {
  return {
    protocol: EProtocolOfExchange.SWAP,
    status: ESwapTxHistoryStatus.PENDING,
    accountInfo: {
      sender: {
        networkId: 'evm--1',
      },
      receiver: {
        networkId: 'evm--1',
      },
    },
    baseInfo: {
      fromToken: token,
      toToken: token,
      fromAmount: '1',
      toAmount: '1',
    },
    txInfo: {
      sender: '0xsender',
      receiver: '0xreceiver',
    },
    swapInfo: {
      provider: {
        provider: 'test-provider',
        providerName: 'Test Provider',
      },
      instantRate: '1',
      orderId: 'order-1',
    },
    date: {
      created: now - SWAP_HISTORY_LONG_PENDING_WARNING_THRESHOLD_MS,
      updated: now - SWAP_HISTORY_LONG_PENDING_WARNING_THRESHOLD_MS,
    },
    ...overrides,
  };
}

describe('swapHistoryUtils long pending warning', () => {
  it('shows the warning at the 90 minute boundary', () => {
    expect(
      shouldShowSwapHistoryLongPendingWarning({
        item: makeHistory(),
        now,
      }),
    ).toBe(true);
  });

  it('does not show before the 90 minute boundary', () => {
    expect(
      shouldShowSwapHistoryLongPendingWarning({
        item: makeHistory({
          date: {
            created: now - SWAP_HISTORY_LONG_PENDING_WARNING_THRESHOLD_MS + 1,
            updated: now - SWAP_HISTORY_LONG_PENDING_WARNING_THRESHOLD_MS + 1,
          },
        }),
        now,
      }),
    ).toBe(false);
  });

  it('returns the remaining delay before the warning boundary', () => {
    expect(
      getSwapHistoryLongPendingWarningDelayMs({
        item: makeHistory({
          date: {
            created:
              now - SWAP_HISTORY_LONG_PENDING_WARNING_THRESHOLD_MS + 12_345,
            updated:
              now - SWAP_HISTORY_LONG_PENDING_WARNING_THRESHOLD_MS + 12_345,
          },
        }),
        now,
      }),
    ).toBe(12_345);
  });

  it('does not show for terminal or canceling statuses', () => {
    expect(
      shouldShowSwapHistoryLongPendingWarning({
        item: makeHistory({ status: ESwapTxHistoryStatus.SUCCESS }),
        now,
      }),
    ).toBe(false);
    expect(
      shouldShowSwapHistoryLongPendingWarning({
        item: makeHistory({ status: ESwapTxHistoryStatus.CANCELING }),
        now,
      }),
    ).toBe(false);
  });

  it('does not show for Private Send histories', () => {
    expect(
      shouldShowSwapHistoryLongPendingWarning({
        item: makeHistory({ protocol: EProtocolOfExchange.PRIVATE_SEND }),
        now,
      }),
    ).toBe(false);
    expect(
      shouldShowSwapHistoryLongPendingWarning({
        item: makeHistory({
          swapInfo: {
            provider: {
              provider: privateSendProvider,
              providerName: 'Private Send',
            },
            instantRate: '1',
            orderId: 'order-1',
          },
        }),
        now,
      }),
    ).toBe(false);
  });

  it('does not show when the creation timestamp is invalid', () => {
    expect(
      shouldShowSwapHistoryLongPendingWarning({
        item: makeHistory({
          date: {
            created: 0,
            updated: 0,
          },
        }),
        now,
      }),
    ).toBe(false);
  });
});
