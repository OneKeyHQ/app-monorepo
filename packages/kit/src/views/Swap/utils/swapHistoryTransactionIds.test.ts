import type { ISwapTxHistory } from '@onekeyhq/shared/types/swap/types';
import {
  EProtocolOfExchange,
  ESwapCrossChainStatus,
  ESwapTxHistoryStatus,
} from '@onekeyhq/shared/types/swap/types';

import { getSwapHistoryTransactionIdRows } from './swapHistoryTransactionIds';

function createHistory({
  provider = 'Swap1inch',
  protocol = EProtocolOfExchange.SWAP,
  status = ESwapTxHistoryStatus.PENDING,
  fromNetworkId = 'evm--1',
  toNetworkId = 'evm--1',
  txId = '0xsource',
  receiverTransactionId,
  swapOrderHash,
  crossChainStatus,
}: {
  provider?: string;
  protocol?: EProtocolOfExchange;
  status?: ESwapTxHistoryStatus;
  fromNetworkId?: string;
  toNetworkId?: string;
  txId?: string | null;
  receiverTransactionId?: string;
  swapOrderHash?: ISwapTxHistory['swapOrderHash'];
  crossChainStatus?: ESwapCrossChainStatus;
} = {}): ISwapTxHistory {
  return {
    protocol,
    status,
    crossChainStatus,
    swapOrderHash,
    baseInfo: {
      fromToken: { networkId: fromNetworkId },
      toToken: { networkId: toNetworkId },
      fromAmount: '1',
      toAmount: '1',
    },
    txInfo: {
      txId: txId ?? undefined,
      receiverTransactionId,
      sender: '0xsender',
      receiver: '0xreceiver',
    },
    swapInfo: {
      instantRate: '1',
      provider: { provider },
    },
  } as ISwapTxHistory;
}

describe('getSwapHistoryTransactionIdRows', () => {
  it('keeps an ordinary single-hash swap unchanged', () => {
    expect(getSwapHistoryTransactionIdRows(createHistory())).toEqual([
      {
        kind: 'transaction',
        transactionId: '0xsource',
        networkId: 'evm--1',
        showExplorer: false,
      },
    ]);
  });

  it('renders pending sent and received rows for a known same-chain provider', () => {
    expect(
      getSwapHistoryTransactionIdRows(
        createHistory({ provider: 'SwapHifiSwap' }),
      ),
    ).toEqual([
      {
        kind: 'sent',
        transactionId: '0xsource',
        networkId: 'evm--1',
        showExplorer: true,
      },
      {
        kind: 'received',
        transactionId: undefined,
        networkId: 'evm--1',
        showExplorer: false,
        showPendingNote: true,
      },
    ]);
  });

  it('reads structured hashes for a completed same-chain swap', () => {
    expect(
      getSwapHistoryTransactionIdRows(
        createHistory({
          provider: 'SwapHifiSwap',
          status: ESwapTxHistoryStatus.SUCCESS,
          swapOrderHash: {
            fromTxHash: '0xstructured-source',
            toTxHash: '0xtarget',
          },
        }),
      ),
    ).toEqual([
      {
        kind: 'sent',
        transactionId: '0xstructured-source',
        networkId: 'evm--1',
        showExplorer: true,
      },
      {
        kind: 'received',
        transactionId: '0xtarget',
        networkId: 'evm--1',
        showExplorer: true,
        showPendingNote: false,
      },
    ]);
  });

  it('uses source and target labels for cross-chain swaps', () => {
    expect(
      getSwapHistoryTransactionIdRows(
        createHistory({
          fromNetworkId: 'evm--56',
          toNetworkId: 'evm--1',
          receiverTransactionId: '0xtarget',
        }),
      ),
    ).toEqual([
      {
        kind: 'source',
        transactionId: '0xsource',
        networkId: 'evm--56',
        showExplorer: true,
      },
      {
        kind: 'target',
        transactionId: '0xtarget',
        networkId: 'evm--1',
        showExplorer: true,
        showPendingNote: false,
      },
    ]);
  });

  it('falls back to legacy transaction IDs when structured hashes are empty', () => {
    expect(
      getSwapHistoryTransactionIdRows(
        createHistory({
          fromNetworkId: 'evm--56',
          toNetworkId: 'evm--1',
          receiverTransactionId: '0xtarget',
          swapOrderHash: {
            fromTxHash: '',
            toTxHash: '',
          },
        }),
      ),
    ).toEqual([
      {
        kind: 'source',
        transactionId: '0xsource',
        networkId: 'evm--56',
        showExplorer: true,
      },
      {
        kind: 'target',
        transactionId: '0xtarget',
        networkId: 'evm--1',
        showExplorer: true,
        showPendingNote: false,
      },
    ]);
  });

  it('falls back to one transaction row when only the target hash exists', () => {
    expect(
      getSwapHistoryTransactionIdRows(
        createHistory({
          fromNetworkId: 'evm--56',
          toNetworkId: 'evm--1',
          txId: null,
          receiverTransactionId: '0xtarget',
        }),
      ),
    ).toEqual([
      {
        kind: 'transaction',
        transactionId: '0xtarget',
        networkId: 'evm--1',
        showExplorer: true,
      },
    ]);
  });

  it.each([
    ESwapTxHistoryStatus.FAILED,
    ESwapTxHistoryStatus.CANCELED,
    ESwapTxHistoryStatus.CANCELING,
  ])('hides the second row for %s orders', (status) => {
    expect(
      getSwapHistoryTransactionIdRows(
        createHistory({
          provider: 'SwapHifiSwap',
          status,
          receiverTransactionId: '0xtarget',
        }),
      ),
    ).toEqual([
      {
        kind: 'sent',
        transactionId: '0xsource',
        networkId: 'evm--1',
        showExplorer: true,
      },
    ]);
  });

  it('renders the refund hash as the second row', () => {
    expect(
      getSwapHistoryTransactionIdRows(
        createHistory({
          status: ESwapTxHistoryStatus.FAILED,
          fromNetworkId: 'evm--56',
          toNetworkId: 'evm--1',
          crossChainStatus: ESwapCrossChainStatus.REFUNDED,
          swapOrderHash: {
            fromTxHash: '0xsource',
            refundHash: '0xrefund',
          },
        }),
      ),
    ).toEqual([
      {
        kind: 'source',
        transactionId: '0xsource',
        networkId: 'evm--56',
        showExplorer: true,
      },
      {
        kind: 'refund',
        transactionId: '0xrefund',
        networkId: 'evm--56',
        showExplorer: true,
      },
    ]);
  });

  it('does not change private-send transaction rendering', () => {
    expect(
      getSwapHistoryTransactionIdRows(
        createHistory({
          provider: 'SwapRocketXPrivateSend',
          protocol: EProtocolOfExchange.PRIVATE_SEND,
          fromNetworkId: 'evm--56',
          toNetworkId: 'evm--1',
          receiverTransactionId: '0xtarget',
        }),
      ),
    ).toEqual([
      {
        kind: 'transaction',
        transactionId: '0xsource',
        networkId: 'evm--56',
        showExplorer: false,
      },
    ]);
  });
});
