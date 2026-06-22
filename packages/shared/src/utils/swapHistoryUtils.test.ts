import { privateSendProvider } from '../../types/swap/SwapProvider.constants';
import {
  EProtocolOfExchange,
  ESwapTabSwitchType,
  ESwapTxHistoryStatus,
  type ISwapToken,
  type ISwapTxHistory,
} from '../../types/swap/types';

import {
  SWAP_HISTORY_LONG_PENDING_WARNING_THRESHOLD_MS,
  buildSwapOrderLongPendingWarningPayload,
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

  it('builds the analytics payload with order context and second-level pending duration', () => {
    const payload = buildSwapOrderLongPendingWarningPayload({
      item: makeHistory({
        baseInfo: {
          fromToken: {
            ...token,
            contractAddress: '0xeth',
            price: '2000',
          },
          toToken: {
            ...token,
            networkId: 'evm--137',
            contractAddress: '0xusdc',
            symbol: 'USDC',
          },
          fromAmount: '1.5',
          toAmount: '3000',
          fromNetwork: {
            networkId: 'evm--1',
            name: 'Ethereum',
            symbol: 'ETH',
          },
          toNetwork: {
            networkId: 'evm--137',
            name: 'Polygon',
            symbol: 'POL',
          },
        },
        txInfo: {
          sender: '0xsender',
          receiver: '0xreceiver',
          txId: '0xtx',
          gasFeeFiatValue: '1.23',
        },
        swapInfo: {
          provider: {
            provider: 'lifi',
            providerName: 'LI.FI',
          },
          instantRate: '2000',
          orderId: 'order-analytics',
          oneKeyFee: 0.875,
        },
      }),
      now: now + 30_000,
    });

    expect(payload).toMatchObject({
      orderId: 'order-analytics',
      pendingDuration:
        SWAP_HISTORY_LONG_PENDING_WARNING_THRESHOLD_MS / 1000 + 30,
      swapTxHash: '0xtx',
      createdTime: now - SWAP_HISTORY_LONG_PENDING_WARNING_THRESHOLD_MS,
      swapType: ESwapTabSwitchType.BRIDGE,
      provider: 'lifi',
      fromNetwork: 'evm--1',
      toNetwork: 'evm--137',
      fromTokenSymbol: 'ETH',
      fromTokenAddress: '0xeth',
      fromTokenAmount: '1.5',
      fromTokenFiatValue: '3000',
      toTokenSymbol: 'USDC',
      toTokenAddress: '0xusdc',
      toTokenAmount: '3000',
      feeFiatValue: '1.23',
      protocol: EProtocolOfExchange.SWAP,
      status: ESwapTxHistoryStatus.PENDING,
      sourceChain: 'evm--1',
      receivedChain: 'evm--137',
      sourceTokenSymbol: 'ETH',
      receivedTokenSymbol: 'USDC',
      swapProvider: 'lifi',
      swapProviderName: 'LI.FI',
      orderType: EProtocolOfExchange.SWAP,
      quoteToTokenAmount: '3000',
      feeType: '0.875',
      duration: SWAP_HISTORY_LONG_PENDING_WARNING_THRESHOLD_MS / 1000 + 30,
    });
  });

  it('does not build the analytics payload without an order id', () => {
    expect(
      buildSwapOrderLongPendingWarningPayload({
        item: makeHistory({
          txInfo: {
            sender: '0xsender',
            receiver: '0xreceiver',
            txId: '0xtx',
          },
          swapInfo: {
            provider: {
              provider: 'test-provider',
              providerName: 'Test Provider',
            },
            instantRate: '1',
          },
        }),
        now,
      }),
    ).toBeUndefined();
  });

  it('does not build the analytics payload before the warning is visible', () => {
    expect(
      buildSwapOrderLongPendingWarningPayload({
        item: makeHistory({
          date: {
            created: now - SWAP_HISTORY_LONG_PENDING_WARNING_THRESHOLD_MS + 1,
            updated: now - SWAP_HISTORY_LONG_PENDING_WARNING_THRESHOLD_MS + 1,
          },
        }),
        now,
      }),
    ).toBeUndefined();
  });
});
