import type {
  IFetchSwapTxHistoryStatusResponse,
  ISwapToken,
  ISwapTxHistory,
} from '@onekeyhq/shared/types/swap/types';
import {
  ESwapCrossChainStatus,
  ESwapTxHistoryStatus,
} from '@onekeyhq/shared/types/swap/types';

import {
  shouldEmitSwapHistoryBalanceUpdate,
  shouldUpdateSwapHistoryAfterTxState,
} from './swapHistoryStatusUtils';

const fromToken: ISwapToken = {
  networkId: 'evm--1',
  contractAddress: '',
  symbol: 'ETH',
  decimals: 18,
  isNative: true,
};

const toToken: ISwapToken = {
  networkId: 'evm--1',
  contractAddress: '0xto',
  symbol: 'USDC',
  decimals: 6,
  isNative: false,
};

function createSwapHistory({
  provider = 'SwapHoudi',
  crossChainStatus,
  stateDetail,
}: {
  provider?: string;
  crossChainStatus?: ESwapCrossChainStatus;
  stateDetail?: string;
} = {}): ISwapTxHistory {
  return {
    status: ESwapTxHistoryStatus.PENDING,
    crossChainStatus,
    stateDetail,
    accountInfo: {
      sender: { networkId: 'evm--1' },
      receiver: { networkId: 'evm--1' },
    },
    baseInfo: {
      fromToken,
      toToken,
      fromAmount: '1',
      toAmount: '100',
    },
    txInfo: {
      txId: '0xtx',
      sender: '0xsender',
      receiver: '0xreceiver',
    },
    swapInfo: {
      provider: {
        provider,
        providerName: provider,
      },
      instantRate: '100',
    },
    date: {
      created: 1,
      updated: 1,
    },
  };
}

function createTxStatus(
  txStatus: Partial<IFetchSwapTxHistoryStatusResponse>,
): IFetchSwapTxHistoryStatusResponse {
  return {
    state: ESwapTxHistoryStatus.PENDING,
    ...txStatus,
  };
}

describe('swapHistoryStatusUtils', () => {
  it('does not update unchanged pending history', () => {
    expect(
      shouldUpdateSwapHistoryAfterTxState({
        swapTxHistory: createSwapHistory(),
        txStatusRes: createTxStatus({}),
      }),
    ).toBe(false);
  });

  it('tracks Houdini pending stateDetail changes', () => {
    expect(
      shouldUpdateSwapHistoryAfterTxState({
        swapTxHistory: createSwapHistory({ stateDetail: 'WAITING' }),
        txStatusRes: createTxStatus({ stateDetail: 'CONFIRMING' }),
      }),
    ).toBe(true);
  });

  it('ignores provider stateDetail changes for non-Houdini pending orders', () => {
    expect(
      shouldUpdateSwapHistoryAfterTxState({
        swapTxHistory: createSwapHistory({
          provider: 'SwapChangelly',
          stateDetail: 'WAITING',
        }),
        txStatusRes: createTxStatus({ stateDetail: 'CONFIRMING' }),
      }),
    ).toBe(false);
  });

  it('emits once when Houdini source token sent state is first detected', () => {
    expect(
      shouldEmitSwapHistoryBalanceUpdate({
        swapTxHistory: createSwapHistory({ stateDetail: 'CONFIRMING' }),
        txStatusRes: createTxStatus({ stateDetail: 'CONFIRMING' }),
        previousStateDetail: 'WAITING',
      }),
    ).toBe(true);

    expect(
      shouldEmitSwapHistoryBalanceUpdate({
        swapTxHistory: createSwapHistory({ stateDetail: 'EXCHANGING' }),
        txStatusRes: createTxStatus({ stateDetail: 'EXCHANGING' }),
        previousStateDetail: 'CONFIRMING',
      }),
    ).toBe(false);
  });

  it('emits for Houdini refunded transition without crossChainStatus', () => {
    expect(
      shouldEmitSwapHistoryBalanceUpdate({
        swapTxHistory: createSwapHistory({ stateDetail: 'REFUNDED' }),
        txStatusRes: createTxStatus({
          state: ESwapTxHistoryStatus.FAILED,
          stateDetail: 'REFUNDED',
        }),
        previousStateDetail: 'EXCHANGING',
      }),
    ).toBe(true);
  });

  it('keeps existing cross-chain and final same-chain refresh semantics', () => {
    expect(
      shouldEmitSwapHistoryBalanceUpdate({
        swapTxHistory: createSwapHistory({
          crossChainStatus: ESwapCrossChainStatus.FROM_SUCCESS,
        }),
        txStatusRes: createTxStatus({
          crossChainStatus: ESwapCrossChainStatus.FROM_SUCCESS,
        }),
      }),
    ).toBe(true);

    expect(
      shouldEmitSwapHistoryBalanceUpdate({
        swapTxHistory: createSwapHistory(),
        txStatusRes: createTxStatus({ state: ESwapTxHistoryStatus.SUCCESS }),
      }),
    ).toBe(true);
  });
});
