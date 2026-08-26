/** @jest-environment jsdom */

import { type ReactNode, useMemo } from 'react';

import { act, renderHook, waitFor } from '@testing-library/react';
import { createStore } from 'jotai';

import {
  ProviderJotaiContextSwap,
  swapStepNetFeeLevelAtom,
  swapStepsAtom,
  useSwapStepsAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap/atoms';
import { ESwapReviewRebuildPhase } from '@onekeyhq/kit/src/views/Swap/utils/swapReviewRebuildStateMachine';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  IFetchQuoteResult,
  ISwapPreSwapData,
  ISwapStep,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';
import {
  EProtocolOfExchange,
  ESwapApproveTransactionStatus,
  ESwapNetworkFeeLevel,
  ESwapStepStatus,
  ESwapStepType,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';

import { useMarketSwapReviewActions } from './useMarketSwapReviewActions';

import type { IMarketSwapReviewAdapter } from './useSpeedSwapActions';
import type { IMarketSwapReviewState } from '../MarketSwapReviewInitializer';

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

let inAppNotificationAtomState: {
  speedSwapApprovingTransaction?: {
    txId?: string;
    status?: ESwapApproveTransactionStatus | string;
  };
} = {};

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useInAppNotificationAtom: () => [inAppNotificationAtomState, jest.fn()],
}));

const fromToken: ISwapToken = {
  networkId: 'evm--1',
  contractAddress: '0xfrom',
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

function createQuoteResult(
  overrides: Partial<IFetchQuoteResult> = {},
): IFetchQuoteResult {
  return {
    protocol: EProtocolOfExchange.SWAP,
    info: {
      provider: 'onekey',
      providerName: 'OneKey',
    },
    fromTokenInfo: fromToken,
    toTokenInfo: toToken,
    fromAmount: '1',
    toAmount: '2500',
    ...overrides,
  };
}

function createReviewState({
  steps,
  quoteResult = createQuoteResult(),
  preSwapData,
}: {
  steps: ISwapStep[];
  quoteResult?: IFetchQuoteResult;
  preSwapData?: Partial<ISwapPreSwapData>;
}): IMarketSwapReviewState {
  return {
    steps,
    preSwapData: {
      fromToken,
      toToken,
      fromTokenAmount: quoteResult.fromAmount,
      toTokenAmount: quoteResult.toAmount,
      swapType: ESwapTabSwitchType.SWAP,
      ...preSwapData,
    } as ISwapPreSwapData,
    quoteResult,
  };
}

function createAdapter(): jest.Mocked<IMarketSwapReviewAdapter> {
  return {
    prepareReview: jest.fn(),
    rebuildReview: jest.fn(),
    sendApproveTx: jest.fn(),
    sendSwapTx: jest.fn(),
    sendWrappedTx: jest.fn(),
    sendSignMessage: jest.fn(),
    buildApproveInfos: jest.fn(),
  };
}

function createDeferred() {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

type ISendMarketSwapParams = Parameters<
  IMarketSwapReviewAdapter['sendSwapTx']
>[0];
type ISendMarketWrappedParams = Parameters<
  IMarketSwapReviewAdapter['sendWrappedTx']
>[0];

function createWrapper(
  reviewState: IMarketSwapReviewState,
  networkFeeLevel: ESwapNetworkFeeLevel = ESwapNetworkFeeLevel.MEDIUM,
) {
  return function Wrapper({ children }: { children?: ReactNode }) {
    const store = useMemo(() => {
      const nextStore = createStore();
      nextStore.set(swapStepsAtom(), {
        steps: reviewState.steps,
        preSwapData: reviewState.preSwapData,
        quoteResult: reviewState.quoteResult,
      } as never);
      nextStore.set(swapStepNetFeeLevelAtom(), {
        networkFeeLevel,
      } as never);
      return nextStore;
    }, []);

    return (
      <ProviderJotaiContextSwap store={store}>
        {children}
      </ProviderJotaiContextSwap>
    );
  };
}

describe('useMarketSwapReviewActions', () => {
  beforeEach(() => {
    inAppNotificationAtomState = {};
  });

  it('refreshes review state before step actions', async () => {
    const adapter = createAdapter();
    const nextReviewState = createReviewState({
      steps: [
        {
          type: ESwapStepType.SEND_TX,
          status: ESwapStepStatus.READY,
        },
      ],
      quoteResult: createQuoteResult({
        toAmount: '2600',
      }),
    });
    adapter.prepareReview.mockResolvedValue(nextReviewState);

    const { result } = renderHook(
      () => {
        const actions = useMarketSwapReviewActions({ adapter });
        const [swapSteps] = useSwapStepsAtom();
        return {
          actions,
          swapSteps,
        };
      },
      {
        wrapper: createWrapper(
          createReviewState({
            steps: [
              {
                type: ESwapStepType.SEND_TX,
                status: ESwapStepStatus.READY,
              },
            ],
            preSwapData: {
              stepBeforeActionsError: true,
            },
          }),
        ),
      },
    );

    await act(async () => {
      await result.current.actions.preSwapBeforeStepActions(
        createQuoteResult(),
        fromToken,
        toToken,
      );
    });

    expect(adapter.prepareReview).toHaveBeenCalledWith({
      fromAmount: '1',
      fromToken,
      toToken,
      isWrap: undefined,
      networkFeeLevel: ESwapNetworkFeeLevel.MEDIUM,
      quoteResult: expect.objectContaining({
        fromAmount: '1',
      }),
    });
    expect(result.current.swapSteps.quoteResult?.toAmount).toBe('2600');
    expect(result.current.swapSteps.preSwapData.stepBeforeActionsLoading).toBe(
      false,
    );
    expect(
      result.current.swapSteps.preSwapData.stepBeforeActionsError,
    ).toBeUndefined();
  });

  it('starts a send step through the market speed swap adapter', async () => {
    const adapter = createAdapter();
    adapter.sendSwapTx.mockImplementation(
      async (params: ISendMarketSwapParams) => {
        params?.onBroadcast?.({
          txHash: '0xswap',
          orderId: 'order-1',
        });
      },
    );

    const { result } = renderHook(
      () => {
        const actions = useMarketSwapReviewActions({ adapter });
        const [swapSteps] = useSwapStepsAtom();
        return {
          actions,
          swapSteps,
        };
      },
      {
        wrapper: createWrapper(
          createReviewState({
            steps: [
              {
                type: ESwapStepType.SEND_TX,
                status: ESwapStepStatus.READY,
              },
            ],
          }),
        ),
      },
    );

    await act(async () => {
      await result.current.actions.preSwapStepsStart();
    });

    await waitFor(() => {
      expect(result.current.swapSteps.steps[0].status).toBe(
        ESwapStepStatus.PENDING,
      );
    });
    expect(result.current.swapSteps.steps[0].txHash).toBe('0xswap');
    expect(adapter.sendSwapTx).toHaveBeenCalledWith(
      expect.objectContaining({
        networkFeeLevel: ESwapNetworkFeeLevel.MEDIUM,
      }),
    );
  });

  it('rebuilds an invalidated slippage review before starting confirmation', async () => {
    const adapter = createAdapter();
    const rebuildReview = jest.fn();
    adapter.rebuildReview = rebuildReview;
    const onConfirmStart = jest.fn();
    const rebuiltGasInfos = [
      {
        encodeTx: { data: '0xrebuilt' } as never,
        gasInfo: {} as never,
      },
    ];
    const rebuiltReviewState = createReviewState({
      steps: [
        {
          type: ESwapStepType.SEND_TX,
          status: ESwapStepStatus.READY,
        },
      ],
      quoteResult: createQuoteResult({
        slippage: 1,
      }),
      preSwapData: {
        slippage: 1,
        swapBuildResultData: {
          orderId: 'rebuilt-order',
        },
        netWorkFee: {
          gasFeeFiatValue: '1.23',
          gasInfos: rebuiltGasInfos,
        },
      },
    });
    rebuildReview.mockResolvedValue(rebuiltReviewState);
    adapter.sendSwapTx.mockImplementation(async (params) => {
      params?.onBroadcast?.({ txHash: '0xswap' });
    });

    const { result } = renderHook(
      () => {
        const actions = useMarketSwapReviewActions({ adapter });
        const [swapSteps] = useSwapStepsAtom();
        return {
          actions,
          swapSteps,
        };
      },
      {
        wrapper: createWrapper(
          createReviewState({
            steps: [
              {
                type: ESwapStepType.SEND_TX,
                status: ESwapStepStatus.READY,
              },
            ],
            quoteResult: createQuoteResult({
              slippage: 1,
            }),
            preSwapData: {
              slippage: 1,
              swapBuildResultData: undefined,
              netWorkFee: undefined,
              requiresSlippageRebuildOnConfirm: true,
            },
          }),
        ),
      },
    );

    act(() => {
      result.current.actions.onConfirm(onConfirmStart);
    });

    await waitFor(() => {
      expect(adapter.sendSwapTx).toHaveBeenCalledWith(
        expect.objectContaining({
          gasInfos: rebuiltGasInfos,
          networkFeeLevel: ESwapNetworkFeeLevel.MEDIUM,
        }),
      );
    });
    expect(rebuildReview).toHaveBeenCalledWith(
      expect.objectContaining({
        slippagePercentage: 1,
        networkFeeLevel: ESwapNetworkFeeLevel.MEDIUM,
        customPriorityFee: undefined,
      }),
    );
    expect(onConfirmStart).toHaveBeenCalledTimes(1);
    expect(onConfirmStart.mock.invocationCallOrder[0]).toBeLessThan(
      adapter.sendSwapTx.mock.invocationCallOrder[0],
    );
    expect(result.current.swapSteps.preSwapData).toEqual(
      expect.objectContaining({
        slippage: 1,
      }),
    );
    expect(
      result.current.swapSteps.preSwapData.requiresSlippageRebuildOnConfirm,
    ).toBeUndefined();
  });

  it('keeps preSwapStepsStart stable across swap step updates', async () => {
    const adapter = createAdapter();
    adapter.sendSwapTx.mockImplementation(
      async (params: ISendMarketSwapParams) => {
        params?.onBroadcast?.({
          txHash: '0xswap',
          orderId: 'order-1',
        });
      },
    );

    const { result } = renderHook(
      () => {
        const actions = useMarketSwapReviewActions({ adapter });
        const [swapSteps] = useSwapStepsAtom();
        return {
          actions,
          swapSteps,
        };
      },
      {
        wrapper: createWrapper(
          createReviewState({
            steps: [
              {
                type: ESwapStepType.SEND_TX,
                status: ESwapStepStatus.READY,
              },
            ],
          }),
        ),
      },
    );

    const initialPreSwapStepsStart = result.current.actions.preSwapStepsStart;

    await act(async () => {
      await result.current.actions.preSwapStepsStart();
    });

    await waitFor(() => {
      expect(result.current.swapSteps.steps[0].status).toBe(
        ESwapStepStatus.PENDING,
      );
    });

    expect(result.current.actions.preSwapStepsStart).toBe(
      initialPreSwapStepsStart,
    );
  });

  it('releases editing after execution rebuild and blocks confirm until fee is ready', async () => {
    const adapter = createAdapter();
    const feeEstimate = createDeferred();
    const onExecutionReady = jest.fn();
    const coreReviewState = createReviewState({
      steps: [
        {
          type: ESwapStepType.SEND_TX,
          status: ESwapStepStatus.READY,
        },
      ],
      quoteResult: createQuoteResult({
        toAmount: '2600',
        slippage: 2,
      }),
      preSwapData: {
        slippage: 2,
      },
    });
    const finalReviewState = createReviewState({
      steps: coreReviewState.steps,
      quoteResult: coreReviewState.quoteResult,
      preSwapData: {
        slippage: 2,
        netWorkFee: {
          gasFeeFiatValue: '0.01',
        },
      },
    });
    adapter.rebuildReview = jest.fn(async (params) => {
      expect(params.isCurrent()).toBe(true);
      params.onPhaseChange(ESwapReviewRebuildPhase.BuildingTransaction);
      params.onPhaseChange(ESwapReviewRebuildPhase.PreparingExecution);
      params.onExecutionReady(coreReviewState);
      await feeEstimate.promise;
      return finalReviewState;
    });
    adapter.sendSwapTx.mockResolvedValue();

    const { result } = renderHook(
      () => {
        const actions = useMarketSwapReviewActions({ adapter });
        const [swapSteps] = useSwapStepsAtom();
        return { actions, swapSteps };
      },
      {
        wrapper: createWrapper(
          createReviewState({
            steps: [
              {
                type: ESwapStepType.SEND_TX,
                status: ESwapStepStatus.READY,
              },
            ],
          }),
        ),
      },
    );

    let rebuildPromise: Promise<void> | undefined;
    act(() => {
      rebuildPromise = result.current.actions.rebuildReviewWithSlippage(2, {
        onExecutionReady,
      });
    });

    await waitFor(() => {
      expect(result.current.actions.reviewRebuildState.phase).toBe(
        ESwapReviewRebuildPhase.EstimatingFee,
      );
      expect(onExecutionReady).toHaveBeenCalledTimes(1);
    });
    expect(result.current.swapSteps.preSwapData.toTokenAmount).toBe('2600');
    expect(result.current.swapSteps.preSwapData.estimateNetworkFeeLoading).toBe(
      true,
    );

    act(() => {
      result.current.actions.onConfirm();
    });
    expect(adapter.sendSwapTx).not.toHaveBeenCalled();

    await act(async () => {
      feeEstimate.resolve();
      await rebuildPromise;
    });

    expect(result.current.actions.reviewRebuildState.phase).toBe(
      ESwapReviewRebuildPhase.Ready,
    );
    expect(result.current.swapSteps.preSwapData.estimateNetworkFeeLoading).toBe(
      false,
    );
    expect(
      result.current.swapSteps.preSwapData.netWorkFee?.gasFeeFiatValue,
    ).toBe('0.01');

    act(() => {
      result.current.actions.onConfirm();
    });
    await waitFor(() => {
      expect(adapter.sendSwapTx).toHaveBeenCalledTimes(1);
    });
  });

  it('uses the review store fee level when refreshing prebuild data', async () => {
    const adapter = createAdapter();
    adapter.prepareReview.mockResolvedValue(
      createReviewState({
        steps: [
          {
            type: ESwapStepType.SEND_TX,
            status: ESwapStepStatus.READY,
          },
        ],
      }),
    );

    const { result } = renderHook(
      () => ({
        actions: useMarketSwapReviewActions({ adapter }),
      }),
      {
        wrapper: createWrapper(
          createReviewState({
            steps: [
              {
                type: ESwapStepType.SEND_TX,
                status: ESwapStepStatus.READY,
              },
            ],
          }),
          ESwapNetworkFeeLevel.HIGH,
        ),
      },
    );

    await act(async () => {
      await result.current.actions.preSwapBeforeStepActions(
        createQuoteResult(),
        fromToken,
        toToken,
      );
    });

    expect(adapter.prepareReview).toHaveBeenCalledWith(
      expect.objectContaining({
        networkFeeLevel: ESwapNetworkFeeLevel.HIGH,
      }),
    );
  });

  it('preserves in-flight review steps while refreshing fee data', async () => {
    const adapter = createAdapter();
    adapter.prepareReview.mockResolvedValue(
      createReviewState({
        steps: [
          {
            type: ESwapStepType.APPROVE_TX,
            status: ESwapStepStatus.READY,
            shouldWaitApproved: true,
          },
          {
            type: ESwapStepType.SEND_TX,
            status: ESwapStepStatus.READY,
          },
        ],
        quoteResult: createQuoteResult({
          toAmount: '2600',
        }),
        preSwapData: {
          supportNetworkFeeLevel: true,
        },
      }),
    );

    const { result } = renderHook(
      () => {
        const actions = useMarketSwapReviewActions({ adapter });
        const [swapSteps] = useSwapStepsAtom();
        return {
          actions,
          swapSteps,
        };
      },
      {
        wrapper: createWrapper(
          createReviewState({
            steps: [
              {
                type: ESwapStepType.APPROVE_TX,
                status: ESwapStepStatus.PENDING,
                shouldWaitApproved: true,
                txHash: '0xapprove',
                stepSubTitle: ETranslations.swap_btn_approving,
              },
              {
                type: ESwapStepType.SEND_TX,
                status: ESwapStepStatus.READY,
              },
            ],
            preSwapData: {
              supportNetworkFeeLevel: true,
            },
            quoteResult: createQuoteResult({
              allowanceResult: {
                allowanceTarget: '0xspender',
                amount: '1',
              },
            }),
          }),
          ESwapNetworkFeeLevel.HIGH,
        ),
      },
    );

    await act(async () => {
      await result.current.actions.preSwapBeforeStepActions(
        createQuoteResult({
          allowanceResult: {
            allowanceTarget: '0xspender',
            amount: '1',
          },
        }),
        fromToken,
        toToken,
      );
    });

    expect(result.current.swapSteps.steps[0]).toEqual(
      expect.objectContaining({
        type: ESwapStepType.APPROVE_TX,
        status: ESwapStepStatus.PENDING,
        txHash: '0xapprove',
        stepSubTitle: ETranslations.swap_btn_approving,
      }),
    );
    expect(result.current.swapSteps.steps[1].status).toBe(
      ESwapStepStatus.READY,
    );
    expect(result.current.swapSteps.quoteResult?.toAmount).toBe('2600');
  });

  it('clears stale network fee data when fee refresh fails', async () => {
    const adapter = createAdapter();
    adapter.prepareReview.mockRejectedValue(new Error('prebuild failed'));

    const { result } = renderHook(
      () => {
        const actions = useMarketSwapReviewActions({ adapter });
        const [swapSteps] = useSwapStepsAtom();
        return {
          actions,
          swapSteps,
        };
      },
      {
        wrapper: createWrapper(
          createReviewState({
            steps: [
              {
                type: ESwapStepType.SEND_TX,
                status: ESwapStepStatus.READY,
              },
            ],
            preSwapData: {
              supportNetworkFeeLevel: true,
              netWorkFee: {
                gasFeeFiatValue: '12.34',
                gasInfos: [
                  {
                    encodeTx: {
                      data: '0xold',
                    } as never,
                    gasInfo: {} as never,
                  },
                ],
              },
            },
          }),
          ESwapNetworkFeeLevel.HIGH,
        ),
      },
    );

    await act(async () => {
      await result.current.actions.preSwapBeforeStepActions(
        createQuoteResult(),
        fromToken,
        toToken,
      );
    });

    expect(result.current.swapSteps.preSwapData.stepBeforeActionsLoading).toBe(
      false,
    );
    expect(result.current.swapSteps.preSwapData.stepBeforeActionsError).toBe(
      true,
    );
    expect(result.current.swapSteps.preSwapData.netWorkFee).toBeUndefined();
  });

  it('starts an approve step through the review-visible swap approving state', async () => {
    const adapter = createAdapter();
    adapter.sendApproveTx.mockImplementation(
      async ({ onBroadcast, quoteResult }) => {
        expect(quoteResult.fromAmount).toBe('1');
        onBroadcast?.({
          txHash: '0xapprove',
          amount: '1',
        });
      },
    );

    const { result } = renderHook(
      () => {
        const actions = useMarketSwapReviewActions({ adapter });
        const [swapSteps] = useSwapStepsAtom();
        return {
          actions,
          swapSteps,
        };
      },
      {
        wrapper: createWrapper(
          createReviewState({
            steps: [
              {
                type: ESwapStepType.APPROVE_TX,
                status: ESwapStepStatus.READY,
                shouldWaitApproved: true,
              },
            ],
            quoteResult: createQuoteResult({
              allowanceResult: {
                allowanceTarget: '0xspender',
                amount: '1',
              },
            }),
          }),
        ),
      },
    );

    await act(async () => {
      await result.current.actions.preSwapStepsStart();
    });

    await waitFor(() => {
      expect(result.current.swapSteps.steps[0].status).toBe(
        ESwapStepStatus.PENDING,
      );
    });
    expect(result.current.swapSteps.steps[0].txHash).toBe('0xapprove');
    expect(result.current.swapSteps.steps[0].stepSubTitle).toBe(
      ETranslations.swap_btn_approving,
    );
    expect(adapter.sendApproveTx).toHaveBeenCalledWith(
      expect.objectContaining({
        networkFeeLevel: ESwapNetworkFeeLevel.MEDIUM,
      }),
    );
  });

  it('continues the review flow from speed approve status updates without using the swap approve state', async () => {
    const adapter = createAdapter();
    const staleGasInfos = [
      {
        encodeTx: {
          data: '0xstale',
        } as never,
        gasInfo: {} as never,
      },
    ];
    adapter.sendApproveTx.mockImplementation(
      async ({ onBroadcast, quoteResult }) => {
        expect(quoteResult.fromAmount).toBe('1');
        onBroadcast?.({
          txHash: '0xapprove',
          amount: '1',
        });
      },
    );
    adapter.sendSwapTx.mockImplementation(
      async (params: ISendMarketSwapParams) => {
        params?.onBroadcast?.({
          txHash: '0xswap',
          orderId: 'order-1',
        });
      },
    );

    const { result, rerender } = renderHook(
      () => {
        const actions = useMarketSwapReviewActions({ adapter });
        const [swapSteps] = useSwapStepsAtom();
        return {
          actions,
          swapSteps,
        };
      },
      {
        wrapper: createWrapper(
          createReviewState({
            steps: [
              {
                type: ESwapStepType.APPROVE_TX,
                status: ESwapStepStatus.READY,
                shouldWaitApproved: true,
              },
              {
                type: ESwapStepType.SEND_TX,
                status: ESwapStepStatus.READY,
              },
            ],
            preSwapData: {
              netWorkFee: {
                gasFeeFiatValue: '8.88',
                gasInfos: staleGasInfos,
              },
            },
            quoteResult: createQuoteResult({
              allowanceResult: {
                allowanceTarget: '0xspender',
                amount: '1',
              },
            }),
          }),
          ESwapNetworkFeeLevel.HIGH,
        ),
      },
    );

    await act(async () => {
      await result.current.actions.preSwapStepsStart();
    });

    await waitFor(() => {
      expect(result.current.swapSteps.steps[0].status).toBe(
        ESwapStepStatus.PENDING,
      );
    });

    await act(async () => {
      inAppNotificationAtomState = {
        speedSwapApprovingTransaction: {
          txId: '0xapprove',
          status: ESwapApproveTransactionStatus.SUCCESS,
        },
      };
      rerender();
    });

    await waitFor(() => {
      expect(adapter.sendApproveTx).toHaveBeenCalledWith(
        expect.objectContaining({
          gasInfos: staleGasInfos,
          networkFeeLevel: ESwapNetworkFeeLevel.HIGH,
        }),
      );
      expect(adapter.sendSwapTx).toHaveBeenCalledWith(
        expect.objectContaining({
          gasInfos: undefined,
          networkFeeLevel: ESwapNetworkFeeLevel.HIGH,
        }),
      );
      expect(result.current.swapSteps.steps[0].status).toBe(
        ESwapStepStatus.SUCCESS,
      );
      expect(result.current.swapSteps.steps[1].status).toBe(
        ESwapStepStatus.PENDING,
      );
      expect(result.current.swapSteps.preSwapData.netWorkFee?.gasInfos).toBe(
        undefined,
      );
    });
  });

  it('marks the approve step failed when the speed approve status fails after txId is cleared', async () => {
    const adapter = createAdapter();
    adapter.sendApproveTx.mockImplementation(
      async ({ onBroadcast, quoteResult }) => {
        expect(quoteResult.fromAmount).toBe('1');
        onBroadcast?.({
          txHash: '0xapprove',
          amount: '1',
        });
      },
    );

    const { result, rerender } = renderHook(
      () => {
        const actions = useMarketSwapReviewActions({ adapter });
        const [swapSteps] = useSwapStepsAtom();
        return {
          actions,
          swapSteps,
        };
      },
      {
        wrapper: createWrapper(
          createReviewState({
            steps: [
              {
                type: ESwapStepType.APPROVE_TX,
                status: ESwapStepStatus.READY,
                shouldWaitApproved: true,
              },
              {
                type: ESwapStepType.SEND_TX,
                status: ESwapStepStatus.READY,
              },
            ],
            quoteResult: createQuoteResult({
              allowanceResult: {
                allowanceTarget: '0xspender',
                amount: '1',
              },
            }),
          }),
        ),
      },
    );

    await act(async () => {
      await result.current.actions.preSwapStepsStart();
    });

    await waitFor(() => {
      expect(result.current.swapSteps.steps[0].status).toBe(
        ESwapStepStatus.PENDING,
      );
    });

    await act(async () => {
      inAppNotificationAtomState = {
        speedSwapApprovingTransaction: {
          status: ESwapApproveTransactionStatus.FAILED,
        },
      };
      rerender();
    });

    await waitFor(() => {
      expect(result.current.swapSteps.steps[0].status).toBe(
        ESwapStepStatus.FAILED,
      );
    });
    expect(adapter.sendSwapTx).not.toHaveBeenCalled();
  });

  it('passes approve infos into batch approve and swap execution', async () => {
    const adapter = createAdapter();
    const approveInfos = [
      {
        owner: '0xuser',
      },
    ] as never[];
    adapter.buildApproveInfos.mockReturnValue(approveInfos as never);
    adapter.sendSwapTx.mockImplementation(
      async (params: ISendMarketSwapParams) => {
        params?.onBroadcast?.({
          txHash: '0xbatch',
          orderId: 'order-batch',
        });
      },
    );

    const quoteResult = createQuoteResult({
      allowanceResult: {
        allowanceTarget: '0xspender',
        amount: '1',
      },
    });

    const { result } = renderHook(
      () => {
        const actions = useMarketSwapReviewActions({ adapter });
        const [swapSteps] = useSwapStepsAtom();
        return {
          actions,
          swapSteps,
        };
      },
      {
        wrapper: createWrapper(
          createReviewState({
            steps: [
              {
                type: ESwapStepType.BATCH_APPROVE_SWAP,
                status: ESwapStepStatus.READY,
              },
            ],
            quoteResult,
          }),
        ),
      },
    );

    await act(async () => {
      await result.current.actions.preSwapStepsStart();
    });

    expect(adapter.buildApproveInfos).toHaveBeenCalledWith(quoteResult);
    expect(adapter.sendSwapTx).toHaveBeenCalledWith(
      expect.objectContaining({
        approvesInfo: approveInfos,
        networkFeeLevel: ESwapNetworkFeeLevel.MEDIUM,
      }),
    );
    expect(result.current.swapSteps.steps[0].txHash).toBe('0xbatch');
  });

  it('starts a wrap step through the wrapped adapter path', async () => {
    const adapter = createAdapter();
    adapter.sendWrappedTx.mockImplementation(
      async (params: ISendMarketWrappedParams) => {
        params?.onBroadcast?.({
          txHash: '0xwrap',
        });
      },
    );

    const { result } = renderHook(
      () => {
        const actions = useMarketSwapReviewActions({ adapter });
        const [swapSteps] = useSwapStepsAtom();
        return {
          actions,
          swapSteps,
        };
      },
      {
        wrapper: createWrapper(
          createReviewState({
            steps: [
              {
                type: ESwapStepType.WRAP_TX,
                status: ESwapStepStatus.READY,
              },
            ],
            quoteResult: createQuoteResult({
              isWrapped: true,
              toAmount: '1',
            }),
          }),
        ),
      },
    );

    await act(async () => {
      await result.current.actions.preSwapStepsStart();
    });

    expect(adapter.sendWrappedTx).toHaveBeenCalledWith(
      expect.objectContaining({
        networkFeeLevel: ESwapNetworkFeeLevel.MEDIUM,
      }),
    );
    expect(result.current.swapSteps.steps[0].txHash).toBe('0xwrap');
  });

  it('starts a sign step through the market review sign adapter path', async () => {
    const adapter = createAdapter();
    adapter.sendSignMessage.mockImplementation(
      async ({ networkFeeLevel, onBroadcast } = {}) => {
        expect(networkFeeLevel).toBe(ESwapNetworkFeeLevel.MEDIUM);
        onBroadcast?.({
          orderId: 'order-sign',
        });
      },
    );

    const { result } = renderHook(
      () => {
        const actions = useMarketSwapReviewActions({ adapter });
        const [swapSteps] = useSwapStepsAtom();
        return {
          actions,
          swapSteps,
        };
      },
      {
        wrapper: createWrapper(
          createReviewState({
            steps: [
              {
                type: ESwapStepType.SIGN_MESSAGE,
                status: ESwapStepStatus.READY,
              },
            ],
            quoteResult: createQuoteResult({
              swapShouldSignedData: {
                unSignedInfo: {},
              } as never,
            }),
          }),
        ),
      },
    );

    await act(async () => {
      await result.current.actions.preSwapStepsStart();
    });

    expect(adapter.sendSignMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        networkFeeLevel: ESwapNetworkFeeLevel.MEDIUM,
      }),
    );
    expect(result.current.swapSteps.steps[0].orderId).toBe('order-sign');
  });

  it('marks the step failed when the market adapter throws', async () => {
    const adapter = createAdapter();
    adapter.sendSwapTx.mockRejectedValue(new Error('send failed'));

    const { result } = renderHook(
      () => {
        const actions = useMarketSwapReviewActions({ adapter });
        const [swapSteps] = useSwapStepsAtom();
        return {
          actions,
          swapSteps,
        };
      },
      {
        wrapper: createWrapper(
          createReviewState({
            steps: [
              {
                type: ESwapStepType.SEND_TX,
                status: ESwapStepStatus.READY,
              },
            ],
          }),
        ),
      },
    );

    await act(async () => {
      await result.current.actions.preSwapStepsStart();
    });

    await waitFor(() => {
      expect(result.current.swapSteps.steps[0].status).toBe(
        ESwapStepStatus.FAILED,
      );
      expect(result.current.swapSteps.steps[0].errorMessage).toBe(
        'send failed',
      );
    });
  });
});
