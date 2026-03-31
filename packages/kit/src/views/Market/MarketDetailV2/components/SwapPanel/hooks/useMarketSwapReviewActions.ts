import { useCallback, useEffect, useRef } from 'react';

import { useIntl } from 'react-intl';

import {
  useSwapStepNetFeeLevelAtom,
  useSwapStepsAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap/atoms';
import { useInAppNotificationAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  ESwapApproveTransactionStatus,
  ESwapStepStatus,
  ESwapStepType,
  type IFetchQuoteResult,
  type ISwapPreSwapData,
  type ISwapStep,
  type ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

import type { IMarketSwapReviewAdapter } from './useSpeedSwapActions';
import type { IMarketSwapReviewState } from '../MarketSwapReviewInitializer';

function mergeReviewStateSteps(prevSteps: ISwapStep[], nextSteps: ISwapStep[]) {
  return nextSteps.map((nextStep, index) => {
    const prevStep = prevSteps[index];

    if (
      !prevStep ||
      prevStep.type !== nextStep.type ||
      prevStep.isResetApprove !== nextStep.isResetApprove ||
      prevStep.status === ESwapStepStatus.READY
    ) {
      return nextStep;
    }

    const mergedStep: ISwapStep = {
      ...nextStep,
      status: prevStep.status,
      txHash: prevStep.txHash,
      orderId: prevStep.orderId,
      stepSubTitle: prevStep.stepSubTitle,
      errorMessage: prevStep.errorMessage,
    };

    if (typeof prevStep.canRetry !== 'undefined') {
      mergedStep.canRetry = prevStep.canRetry;
    }

    return mergedStep;
  });
}

function useReviewStepStateActions() {
  const [, setSwapSteps] = useSwapStepsAtom();

  const replaceReviewState = useCallback(
    (
      reviewState: IMarketSwapReviewState,
      options?: {
        preserveActiveSteps?: boolean;
      },
    ) => {
      setSwapSteps((prev) => ({
        steps: options?.preserveActiveSteps
          ? mergeReviewStateSteps(prev.steps, reviewState.steps)
          : reviewState.steps,
        preSwapData: reviewState.preSwapData,
        quoteResult: reviewState.quoteResult,
      }));
    },
    [setSwapSteps],
  );

  const updateStep = useCallback(
    (stepIndex: number, partialStep: Partial<ISwapStep>) => {
      setSwapSteps((prev) => {
        const nextSteps = [...prev.steps];
        nextSteps[stepIndex] = {
          ...nextSteps[stepIndex],
          ...partialStep,
        };
        return {
          ...prev,
          steps: nextSteps,
        };
      });
    },
    [setSwapSteps],
  );

  const setBeforeActionsLoading = useCallback(
    (loading: boolean) => {
      setSwapSteps((prev) => ({
        ...prev,
        preSwapData: {
          ...prev.preSwapData,
          stepBeforeActionsLoading: loading,
        },
      }));
    },
    [setSwapSteps],
  );

  return {
    replaceReviewState,
    updateStep,
    setBeforeActionsLoading,
  };
}

export function useMarketSwapReviewActions({
  adapter,
}: {
  adapter: IMarketSwapReviewAdapter;
}) {
  const intl = useIntl();
  const [swapStepsState, setSwapSteps] = useSwapStepsAtom();
  const [swapStepNetFeeLevel] = useSwapStepNetFeeLevelAtom();
  const [inAppNotificationAtom] = useInAppNotificationAtom();
  const handledApproveStatusRef = useRef<string>('');
  const latestApproveTxIdRef = useRef<string>('');
  const { replaceReviewState, setBeforeActionsLoading, updateStep } =
    useReviewStepStateActions();

  const clearPreSwapGasInfos = useCallback(
    (preSwapData: ISwapPreSwapData) => {
      if (!preSwapData.netWorkFee?.gasInfos?.length) {
        return preSwapData;
      }

      const nextPreSwapData: ISwapPreSwapData = {
        ...preSwapData,
        netWorkFee: {
          ...preSwapData.netWorkFee,
          gasInfos: undefined,
        },
      };

      setSwapSteps((prev) => ({
        ...prev,
        preSwapData: nextPreSwapData,
      }));

      return nextPreSwapData;
    },
    [setSwapSteps],
  );

  const markStepFailed = useCallback(
    (stepIndex: number) => {
      updateStep(stepIndex, {
        status: ESwapStepStatus.FAILED,
        stepSubTitle: undefined,
      });
    },
    [updateStep],
  );

  const preSwapBeforeStepActions = useCallback(
    async (
      data?: IFetchQuoteResult,
      currentFromToken?: ISwapToken,
      currentToToken?: ISwapToken,
    ) => {
      setBeforeActionsLoading(true);
      try {
        const reviewState = await adapter.prepareMarketSwapReview({
          fromAmount: data?.fromAmount,
          fromToken: currentFromToken,
          toToken: currentToToken,
          isWrap: data?.isWrapped,
          quoteResult: data,
          networkFeeLevel: swapStepNetFeeLevel.networkFeeLevel,
        });
        replaceReviewState(
          {
            ...reviewState,
            preSwapData: {
              ...reviewState.preSwapData,
              stepBeforeActionsLoading: false,
            },
          },
          {
            preserveActiveSteps: true,
          },
        );
      } catch {
        setSwapSteps((prev) => ({
          ...prev,
          preSwapData: {
            ...prev.preSwapData,
            stepBeforeActionsLoading: false,
            netWorkFee: undefined,
          },
        }));
      }
    },
    [
      adapter,
      replaceReviewState,
      setBeforeActionsLoading,
      setSwapSteps,
      swapStepNetFeeLevel.networkFeeLevel,
    ],
  );

  const preSwapStepsStart = useCallback(
    async (swapStepsValues?: {
      steps: ISwapStep[];
      preSwapData: ISwapPreSwapData;
      quoteResult?: IFetchQuoteResult;
    }) => {
      const steps = swapStepsValues?.steps ?? swapStepsState.steps;
      const preSwapData =
        swapStepsValues?.preSwapData ?? swapStepsState.preSwapData;
      const quoteResult =
        swapStepsValues?.quoteResult ?? swapStepsState.quoteResult;

      if (!steps.length) {
        return;
      }

      for (let i = 0; i < steps.length; i += 1) {
        const step = steps[i];
        const canStart =
          step.status === ESwapStepStatus.READY ||
          (step.canRetry && step.status === ESwapStepStatus.FAILED);

        if (canStart) {
          try {
            updateStep(i, {
              status: ESwapStepStatus.LOADING,
              errorMessage: undefined,
              stepSubTitle: undefined,
            });

            if (step.type === ESwapStepType.APPROVE_TX) {
              if (!quoteResult) {
                markStepFailed(i);
                break;
              }

              await adapter.sendMarketApproveTx({
                amount:
                  quoteResult.fromAmount ?? preSwapData.fromTokenAmount ?? '0',
                gasInfos: preSwapData.netWorkFee?.gasInfos,
                isResetApprove: step.isResetApprove,
                networkFeeLevel: swapStepNetFeeLevel.networkFeeLevel,
                quoteResult,
                onBroadcast: ({ txHash }) => {
                  updateStep(i, {
                    status: ESwapStepStatus.PENDING,
                    txHash,
                    stepSubTitle: intl.formatMessage({
                      id: ETranslations.swap_btn_approving,
                    }),
                  });
                },
                onCancel: () => {
                  markStepFailed(i);
                },
              });
              break;
            }

            if (step.type === ESwapStepType.WRAP_TX) {
              await adapter.sendMarketWrappedTx({
                gasInfos: preSwapData.netWorkFee?.gasInfos,
                networkFeeLevel: swapStepNetFeeLevel.networkFeeLevel,
                onBroadcast: ({ txHash, orderId }) => {
                  updateStep(i, {
                    status: ESwapStepStatus.PENDING,
                    txHash,
                    orderId,
                  });
                },
                onCancel: () => {
                  markStepFailed(i);
                },
              });
              break;
            }

            if (step.type === ESwapStepType.SEND_TX) {
              await adapter.sendMarketSwapTx({
                gasInfos: preSwapData.netWorkFee?.gasInfos,
                networkFeeLevel: swapStepNetFeeLevel.networkFeeLevel,
                onBroadcast: ({ txHash, orderId }) => {
                  updateStep(i, {
                    status: ESwapStepStatus.PENDING,
                    txHash,
                    orderId,
                  });
                },
                onCancel: () => {
                  markStepFailed(i);
                },
              });
              break;
            }

            if (step.type === ESwapStepType.SIGN_MESSAGE) {
              await adapter.sendMarketSignMessage({
                networkFeeLevel: swapStepNetFeeLevel.networkFeeLevel,
                onBroadcast: ({ txHash, orderId }) => {
                  updateStep(i, {
                    status: ESwapStepStatus.PENDING,
                    txHash,
                    orderId,
                  });
                },
                onCancel: () => {
                  markStepFailed(i);
                },
              });
              break;
            }

            if (step.type === ESwapStepType.BATCH_APPROVE_SWAP) {
              if (!quoteResult) {
                markStepFailed(i);
                break;
              }

              await adapter.sendMarketSwapTx({
                approvesInfo: adapter.buildMarketApproveInfos(quoteResult),
                gasInfos: preSwapData.netWorkFee?.gasInfos,
                networkFeeLevel: swapStepNetFeeLevel.networkFeeLevel,
                onBroadcast: ({ txHash, orderId }) => {
                  updateStep(i, {
                    status: ESwapStepStatus.PENDING,
                    txHash,
                    orderId,
                  });
                },
                onCancel: () => {
                  markStepFailed(i);
                },
              });
              break;
            }
          } catch {
            markStepFailed(i);
            break;
          }
        }
      }
    },
    [
      adapter,
      intl,
      markStepFailed,
      swapStepNetFeeLevel.networkFeeLevel,
      swapStepsState,
      updateStep,
    ],
  );

  useEffect(() => {
    const speedApprove = inAppNotificationAtom.speedSwapApprovingTransaction;
    if (speedApprove?.txId) {
      latestApproveTxIdRef.current = speedApprove.txId;
    }

    const trackedApproveTxId =
      speedApprove?.txId ?? latestApproveTxIdRef.current ?? '';
    const speedApproveKey = `${trackedApproveTxId || 'no-tx'}:${
      speedApprove?.status ?? 'idle'
    }`;

    if (
      speedApprove?.status === undefined ||
      speedApprove.status === ESwapApproveTransactionStatus.PENDING ||
      handledApproveStatusRef.current === speedApproveKey
    ) {
      return;
    }

    handledApproveStatusRef.current = speedApproveKey;

    const approveStepStatus =
      speedApprove.status === ESwapApproveTransactionStatus.SUCCESS
        ? ESwapStepStatus.SUCCESS
        : ESwapStepStatus.FAILED;
    const stepIndex = swapStepsState.steps.findIndex(
      (step) =>
        step.txHash === trackedApproveTxId ||
        (!trackedApproveTxId &&
          step.type === ESwapStepType.APPROVE_TX &&
          step.status === ESwapStepStatus.PENDING),
    );

    if (stepIndex === -1) {
      return;
    }

    const nextSteps = [...swapStepsState.steps];
    nextSteps[stepIndex] = {
      ...nextSteps[stepIndex],
      status: approveStepStatus,
    };

    updateStep(stepIndex, {
      status: approveStepStatus,
      stepSubTitle: undefined,
    });

    if (approveStepStatus !== ESwapStepStatus.SUCCESS) {
      return;
    }

    const nextPreSwapData = clearPreSwapGasInfos(swapStepsState.preSwapData);

    void preSwapStepsStart({
      steps: nextSteps,
      preSwapData: nextPreSwapData,
      quoteResult: swapStepsState.quoteResult,
    });
  }, [
    clearPreSwapGasInfos,
    inAppNotificationAtom.speedSwapApprovingTransaction,
    preSwapStepsStart,
    swapStepsState.preSwapData,
    swapStepsState.quoteResult,
    swapStepsState.steps,
    updateStep,
  ]);

  const onConfirm = useCallback(() => {
    void preSwapStepsStart();
  }, [preSwapStepsStart]);

  return {
    onConfirm,
    preSwapBeforeStepActions,
    preSwapStepsStart,
  };
}
