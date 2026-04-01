import { useCallback, useEffect, useRef } from 'react';

import { useIntl } from 'react-intl';

import {
  useSwapStepNetFeeLevelAtom,
  useSwapStepsAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap/atoms';
import { useInAppNotificationAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  IFetchQuoteResult,
  ISwapPreSwapData,
  ISwapStep,
} from '@onekeyhq/shared/types/swap/types';
import {
  ESwapApproveTransactionStatus,
  ESwapStepStatus,
  ESwapStepType,
} from '@onekeyhq/shared/types/swap/types';

import {
  ESwapReviewApproveTransactionSource,
  getSwapReviewApproveTransaction,
} from '../utils/swapReviewState';

import type {
  ISwapReviewAdapter,
  ISwapReviewState,
} from '../utils/swapReviewState';

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
      reviewState: ISwapReviewState,
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

export function useSwapReviewActions({
  adapter,
  approveTransactionSource = ESwapReviewApproveTransactionSource.None,
}: {
  adapter: ISwapReviewAdapter;
  approveTransactionSource?: ESwapReviewApproveTransactionSource;
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
    (stepIndex: number, errorMessage?: string) => {
      updateStep(stepIndex, {
        status: ESwapStepStatus.FAILED,
        errorMessage,
        stepSubTitle: undefined,
      });
    },
    [updateStep],
  );

  const preSwapBeforeStepActions = useCallback(
    async (
      data?: IFetchQuoteResult,
      currentFromToken?: IFetchQuoteResult['fromTokenInfo'],
      currentToToken?: IFetchQuoteResult['toTokenInfo'],
    ) => {
      setBeforeActionsLoading(true);
      try {
        const reviewState = await adapter.prepareReview({
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

              await adapter.sendApproveTx({
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
              await adapter.sendWrappedTx({
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
              await adapter.sendSwapTx({
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
              await adapter.sendSignMessage({
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

              await adapter.sendSwapTx({
                approvesInfo: adapter.buildApproveInfos(quoteResult),
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
          } catch (error) {
            markStepFailed(
              i,
              error instanceof Error ? error.message : undefined,
            );
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

  const approveTransaction = getSwapReviewApproveTransaction({
    source: approveTransactionSource,
    inAppNotificationAtom,
  });

  useEffect(() => {
    if (approveTransactionSource === ESwapReviewApproveTransactionSource.None) {
      return;
    }

    if (approveTransaction?.txId) {
      latestApproveTxIdRef.current = approveTransaction.txId;
    }

    const trackedApproveTxId =
      approveTransaction?.txId ?? latestApproveTxIdRef.current ?? '';
    const approveStatusKey = `${trackedApproveTxId || 'no-tx'}:${
      approveTransaction?.status ?? 'idle'
    }`;

    if (
      approveTransaction?.status === undefined ||
      approveTransaction.status === ESwapApproveTransactionStatus.PENDING ||
      handledApproveStatusRef.current === approveStatusKey
    ) {
      return;
    }

    handledApproveStatusRef.current = approveStatusKey;

    const approveStepStatus =
      approveTransaction.status === ESwapApproveTransactionStatus.SUCCESS
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
    approveTransaction,
    approveTransactionSource,
    clearPreSwapGasInfos,
    inAppNotificationAtom,
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
