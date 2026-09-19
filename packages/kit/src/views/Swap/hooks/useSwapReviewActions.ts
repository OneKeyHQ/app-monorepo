import { useCallback, useEffect, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  useSwapStepNetFeeLevelAtom,
  useSwapStepsAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap/atoms';
import { useInAppNotificationAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { stableStringify } from '@onekeyhq/shared/src/utils/stringUtils';
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
  buildSwapReviewSessionFingerprint,
  canRebuildSwapReviewBeforeConfirm,
} from '../utils/swapReviewPreparationV2';
import {
  ESwapReviewRebuildPhase,
  isSwapReviewConfirmBlocked,
} from '../utils/swapReviewRebuildStateMachine';
import {
  ESwapReviewApproveTransactionSource,
  getSwapReviewApproveTransaction,
} from '../utils/swapReviewState';

import { useSwapReviewRebuildStateMachine } from './useSwapReviewRebuildStateMachine';

import type {
  ISwapReviewAdapter,
  ISwapReviewState,
} from '../utils/swapReviewState';

function buildReviewFeeSelectionFingerprint({
  networkFeeLevel,
  customPriorityFee,
}: {
  networkFeeLevel?: unknown;
  customPriorityFee?: unknown;
}): string {
  return stableStringify({
    customPriorityFee: customPriorityFee ?? null,
    networkFeeLevel: networkFeeLevel ?? null,
  });
}

export type ISwapReviewRebuildOptions = {
  onExecutionReady?: () => void;
};

type IPendingApprovalExecution = {
  expectedQuoteResult?: IFetchQuoteResult;
  expectedSession?: ISwapReviewState['preSwapData']['reviewSession'];
  expectedSessionFingerprint?: string;
  expectedFeeSelectionFingerprint: string;
  approvalAttemptId: string;
  approvalStepIndex: number;
  isResetApprove: boolean;
  txId?: string;
};

type IActiveApprovalAttempt = IPendingApprovalExecution;

function canPreserveReviewStepMetadata({
  previousState,
  nextState,
}: {
  previousState: ISwapReviewState;
  nextState: ISwapReviewState;
}) {
  const previousSession = previousState.preSwapData.reviewSession;
  const nextSession = nextState.preSwapData.reviewSession;

  if (previousSession || nextSession) {
    if (
      !previousSession ||
      !nextSession ||
      previousSession.sessionId !== nextSession.sessionId ||
      previousSession.revision !== nextSession.revision
    ) {
      return false;
    }

    return (
      buildSwapReviewSessionFingerprint(previousSession) ===
      buildSwapReviewSessionFingerprint(nextSession)
    );
  }

  return previousState.quoteResult === nextState.quoteResult;
}

function mergeReviewStateSteps({
  prevSteps,
  nextSteps,
  preserveMetadata,
}: {
  prevSteps: ISwapStep[];
  nextSteps: ISwapStep[];
  preserveMetadata: boolean;
}) {
  return nextSteps.map((nextStep, index) => {
    const prevStep = prevSteps[index];

    if (
      !preserveMetadata ||
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
        isCurrent?: (state: ISwapReviewState) => boolean;
      },
    ) => {
      setSwapSteps((prev) => {
        if (options?.isCurrent && !options.isCurrent(prev)) {
          return prev;
        }
        const nextState = {
          steps: reviewState.steps,
          preSwapData: reviewState.preSwapData,
          quoteResult: reviewState.quoteResult,
        };
        return {
          steps:
            options?.preserveActiveSteps &&
            canPreserveReviewStepMetadata({
              previousState: prev,
              nextState,
            })
              ? mergeReviewStateSteps({
                  prevSteps: prev.steps,
                  nextSteps: nextState.steps,
                  preserveMetadata: true,
                })
              : nextState.steps,
          preSwapData: nextState.preSwapData,
          quoteResult: nextState.quoteResult,
        };
      });
    },
    [setSwapSteps],
  );

  const updateStep = useCallback(
    (
      stepIndex: number,
      partialStep: Partial<ISwapStep>,
      isCurrent?: (state: ISwapReviewState) => boolean,
    ) => {
      setSwapSteps((prev) => {
        if (isCurrent && !isCurrent(prev)) {
          return prev;
        }
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
    (loading: boolean, isCurrent?: (state: ISwapReviewState) => boolean) => {
      setSwapSteps((prev) => {
        if (isCurrent && !isCurrent(prev)) {
          return prev;
        }
        return {
          ...prev,
          preSwapData: {
            ...prev.preSwapData,
            stepBeforeActionsLoading: loading,
            stepBeforeActionsError: loading
              ? undefined
              : prev.preSwapData.stepBeforeActionsError,
          },
        };
      });
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
  const adapterRef = useRef(adapter);
  const intlRef = useRef(intl);
  const networkFeeLevelRef = useRef(swapStepNetFeeLevel.networkFeeLevel);
  const customPriorityFeeRef = useRef(swapStepNetFeeLevel.customPriorityFee);
  const swapStepsStateRef = useRef(swapStepsState);
  const pendingApprovalExecutionRef = useRef<
    IPendingApprovalExecution | undefined
  >(undefined);
  const activeApprovalAttemptRef = useRef<IActiveApprovalAttempt | undefined>(
    undefined,
  );
  const approvalAttemptSequenceRef = useRef(0);
  const confirmInFlightRef = useRef(false);
  const [approvalExecutionVersion, setApprovalExecutionVersion] = useState(0);
  const { replaceReviewState, setBeforeActionsLoading, updateStep } =
    useReviewStepStateActions();
  const {
    state: reviewRebuildState,
    stateRef: reviewRebuildStateRef,
    begin: beginReviewRebuild,
    resetUncommittedError: resetUncommittedReviewRebuildError,
  } = useSwapReviewRebuildStateMachine();

  adapterRef.current = adapter;
  intlRef.current = intl;
  networkFeeLevelRef.current = swapStepNetFeeLevel.networkFeeLevel;
  customPriorityFeeRef.current = swapStepNetFeeLevel.customPriorityFee;
  swapStepsStateRef.current = swapStepsState;

  const clearPreSwapGasInfos = useCallback(
    (
      preSwapData: ISwapPreSwapData,
      isCurrent?: (state: ISwapReviewState) => boolean,
    ) => {
      if (!preSwapData.netWorkFee?.gasInfos?.length) {
        return preSwapData;
      }

      setSwapSteps((prev) => {
        if (isCurrent && !isCurrent(prev)) {
          return prev;
        }
        if (!prev.preSwapData.netWorkFee?.gasInfos?.length) {
          return prev;
        }
        return {
          ...prev,
          preSwapData: {
            ...prev.preSwapData,
            netWorkFee: {
              ...prev.preSwapData.netWorkFee,
              gasInfos: undefined,
            },
          },
        };
      });
    },
    [setSwapSteps],
  );

  const markStepFailed = useCallback(
    (
      stepIndex: number,
      errorMessage?: string,
      isCurrent?: (state: ISwapReviewState) => boolean,
    ) => {
      updateStep(
        stepIndex,
        {
          status: ESwapStepStatus.FAILED,
          errorMessage,
          stepSubTitle: undefined,
        },
        isCurrent,
      );
    },
    [updateStep],
  );

  const preSwapBeforeStepActions = useCallback(
    async (
      data?: IFetchQuoteResult,
      currentFromToken?: IFetchQuoteResult['fromTokenInfo'],
      currentToToken?: IFetchQuoteResult['toTokenInfo'],
    ) => {
      const reviewStateAtStart = swapStepsStateRef.current;
      const expectedQuoteResult = data ?? reviewStateAtStart.quoteResult;
      const expectedSession = reviewStateAtStart.preSwapData.reviewSession;
      const expectedSessionFingerprint = expectedSession
        ? buildSwapReviewSessionFingerprint(expectedSession)
        : undefined;
      const expectedFeeSelectionFingerprint =
        buildReviewFeeSelectionFingerprint({
          networkFeeLevel: networkFeeLevelRef.current,
          customPriorityFee: customPriorityFeeRef.current,
        });
      const isCurrentReview = (current: ISwapReviewState) => {
        const currentSession = current.preSwapData.reviewSession;
        return (
          current.quoteResult === expectedQuoteResult &&
          buildReviewFeeSelectionFingerprint({
            networkFeeLevel: networkFeeLevelRef.current,
            customPriorityFee: customPriorityFeeRef.current,
          }) === expectedFeeSelectionFingerprint &&
          (expectedSession || currentSession
            ? Boolean(
                expectedSession &&
                currentSession &&
                currentSession.sessionId === expectedSession.sessionId &&
                currentSession.revision === expectedSession.revision &&
                expectedSessionFingerprint &&
                buildSwapReviewSessionFingerprint(currentSession) ===
                  expectedSessionFingerprint,
              )
            : true)
        );
      };
      setBeforeActionsLoading(true, isCurrentReview);
      try {
        const reviewState = await adapterRef.current.prepareReview({
          fromAmount: data?.fromAmount,
          fromToken: currentFromToken,
          toToken: currentToToken,
          isWrap: data?.isWrapped,
          quoteResult: data,
          networkFeeLevel: networkFeeLevelRef.current,
          customPriorityFee: customPriorityFeeRef.current,
        });
        replaceReviewState(
          {
            ...reviewState,
            preSwapData: {
              ...reviewState.preSwapData,
              stepBeforeActionsLoading: false,
              stepBeforeActionsError: undefined,
            },
          },
          {
            preserveActiveSteps: true,
            isCurrent: isCurrentReview,
          },
        );
      } catch {
        setSwapSteps((prev) => {
          if (!isCurrentReview(prev)) {
            return prev;
          }
          return {
            ...prev,
            preSwapData: {
              ...prev.preSwapData,
              stepBeforeActionsLoading: false,
              stepBeforeActionsError: true,
              netWorkFee: undefined,
            },
          };
        });
      }
    },
    [replaceReviewState, setBeforeActionsLoading, setSwapSteps],
  );

  const rebuildReviewWithSlippage = useCallback(
    async (slippagePercentage: number, options?: ISwapReviewRebuildOptions) => {
      let expectedQuoteResult = swapStepsStateRef.current.quoteResult;
      let expectedSession = swapStepsStateRef.current.preSwapData.reviewSession;
      let expectedSessionFingerprint = expectedSession
        ? buildSwapReviewSessionFingerprint(expectedSession)
        : undefined;
      const expectedFeeSelectionFingerprint =
        buildReviewFeeSelectionFingerprint({
          networkFeeLevel: networkFeeLevelRef.current,
          customPriorityFee: customPriorityFeeRef.current,
        });
      const rebuildReview = adapterRef.current.rebuildReview;
      if (!expectedQuoteResult || !rebuildReview) {
        throw new OneKeyLocalError(
          'Current swap quote does not support rebuilding',
        );
      }

      const operation = beginReviewRebuild(slippagePercentage);
      let executionReady = false;
      const isCurrentReview = (
        current: ISwapReviewState = swapStepsStateRef.current,
      ) => {
        const currentSession = current.preSwapData.reviewSession;
        return (
          operation.isCurrent() &&
          current.quoteResult === expectedQuoteResult &&
          buildReviewFeeSelectionFingerprint({
            networkFeeLevel: networkFeeLevelRef.current,
            customPriorityFee: customPriorityFeeRef.current,
          }) === expectedFeeSelectionFingerprint &&
          (expectedSession || currentSession
            ? Boolean(
                expectedSession &&
                currentSession &&
                currentSession.sessionId === expectedSession.sessionId &&
                currentSession.revision === expectedSession.revision &&
                expectedSessionFingerprint &&
                buildSwapReviewSessionFingerprint(currentSession) ===
                  expectedSessionFingerprint,
              )
            : true)
        );
      };
      const assertCurrentReview = () => {
        if (!isCurrentReview()) {
          throw new OneKeyLocalError('Swap review changed while rebuilding');
        }
      };
      const commitExecutionReview = (reviewState: ISwapReviewState) => {
        if (executionReady) {
          return;
        }
        assertCurrentReview();
        executionReady = true;
        expectedQuoteResult = reviewState.quoteResult;
        operation.advance(ESwapReviewRebuildPhase.EstimatingFee);
        const coreReviewState = {
          ...reviewState,
          preSwapData: {
            ...reviewState.preSwapData,
            swapBuildLoading: false,
            estimateNetworkFeeLoading: true,
            stepBeforeActionsError: undefined,
          },
        };
        swapStepsStateRef.current = coreReviewState;
        expectedSession = coreReviewState.preSwapData.reviewSession;
        expectedSessionFingerprint = expectedSession
          ? buildSwapReviewSessionFingerprint(expectedSession)
          : undefined;
        replaceReviewState(coreReviewState);
        options?.onExecutionReady?.();
      };

      setSwapSteps((prev) => {
        if (!isCurrentReview(prev)) {
          return prev;
        }
        return {
          ...prev,
          preSwapData: {
            ...prev.preSwapData,
            swapBuildLoading: true,
            estimateNetworkFeeLoading: false,
            stepBeforeActionsError: undefined,
          },
        };
      });

      try {
        const reviewState = await rebuildReview({
          slippagePercentage,
          networkFeeLevel: networkFeeLevelRef.current,
          customPriorityFee: customPriorityFeeRef.current,
          isCurrent: isCurrentReview,
          onPhaseChange: (phase) => {
            assertCurrentReview();
            operation.advance(phase);
          },
          onExecutionReady: commitExecutionReview,
        });
        assertCurrentReview();
        if (!executionReady) {
          commitExecutionReview(reviewState);
        }
        const finalReviewState = {
          ...reviewState,
          preSwapData: {
            ...reviewState.preSwapData,
            swapBuildLoading: false,
            estimateNetworkFeeLoading: false,
            stepBeforeActionsError: undefined,
          },
        };
        if (!isCurrentReview()) {
          throw new OneKeyLocalError('Swap review changed while rebuilding');
        }
        swapStepsStateRef.current = finalReviewState;
        replaceReviewState(finalReviewState, {
          isCurrent: isCurrentReview,
        });
        operation.resolve();
      } catch (error) {
        if (isCurrentReview()) {
          setSwapSteps((prev) => {
            if (!isCurrentReview(prev)) {
              return prev;
            }
            return {
              ...prev,
              preSwapData: {
                ...prev.preSwapData,
                swapBuildLoading: false,
                estimateNetworkFeeLoading: false,
              },
            };
          });
          operation.reject();
        }
        throw error;
      }
    },
    [beginReviewRebuild, replaceReviewState, setSwapSteps],
  );

  const preSwapStepsStart = useCallback(
    async (swapStepsValues?: {
      steps: ISwapStep[];
      preSwapData: ISwapPreSwapData;
      quoteResult?: IFetchQuoteResult;
    }) => {
      const currentSwapStepsState = swapStepsStateRef.current;
      const steps = swapStepsValues?.steps ?? currentSwapStepsState.steps;
      const preSwapData =
        swapStepsValues?.preSwapData ?? currentSwapStepsState.preSwapData;
      const quoteResult =
        swapStepsValues?.quoteResult ?? currentSwapStepsState.quoteResult;
      const expectedQuoteResult = quoteResult;
      const expectedSession = preSwapData.reviewSession;
      const expectedSessionFingerprint = expectedSession
        ? buildSwapReviewSessionFingerprint(expectedSession)
        : undefined;
      const expectedFeeSelectionFingerprint =
        buildReviewFeeSelectionFingerprint({
          networkFeeLevel: networkFeeLevelRef.current,
          customPriorityFee: customPriorityFeeRef.current,
        });
      const isCurrentReview = (
        current: ISwapReviewState = swapStepsStateRef.current,
      ) => {
        const currentSession = current.preSwapData.reviewSession;
        if (
          current.quoteResult !== expectedQuoteResult ||
          buildReviewFeeSelectionFingerprint({
            networkFeeLevel: networkFeeLevelRef.current,
            customPriorityFee: customPriorityFeeRef.current,
          }) !== expectedFeeSelectionFingerprint
        ) {
          return false;
        }
        if (expectedSession || currentSession) {
          return Boolean(
            expectedSession &&
            currentSession &&
            currentSession.sessionId === expectedSession.sessionId &&
            currentSession.revision === expectedSession.revision &&
            expectedSessionFingerprint &&
            buildSwapReviewSessionFingerprint(currentSession) ===
              expectedSessionFingerprint,
          );
        }
        return true;
      };
      const assertCurrentReview = () => {
        if (!isCurrentReview()) {
          throw new OneKeyLocalError('Swap review changed while executing');
        }
      };

      if (!steps.length || !isCurrentReview()) {
        return;
      }

      const currentAdapter = adapterRef.current;
      const currentIntl = intlRef.current;
      const networkFeeLevel = networkFeeLevelRef.current;
      const customPriorityFee = customPriorityFeeRef.current;

      for (let i = 0; i < steps.length; i += 1) {
        if (!isCurrentReview()) {
          return;
        }
        const step = steps[i];
        const canStart =
          step.status === ESwapStepStatus.READY ||
          (step.canRetry && step.status === ESwapStepStatus.FAILED);

        if (canStart) {
          try {
            assertCurrentReview();
            updateStep(
              i,
              {
                status: ESwapStepStatus.LOADING,
                errorMessage: undefined,
                stepSubTitle: undefined,
              },
              isCurrentReview,
            );
            assertCurrentReview();

            if (step.type === ESwapStepType.APPROVE_TX) {
              if (!quoteResult) {
                markStepFailed(i, undefined, isCurrentReview);
                break;
              }

              approvalAttemptSequenceRef.current += 1;
              const approvalAttempt: IActiveApprovalAttempt = {
                approvalAttemptId: `${expectedSession?.sessionId ?? 'swap'}:${
                  expectedSession?.revision ?? 0
                }:${i}:${approvalAttemptSequenceRef.current}`,
                approvalStepIndex: i,
                isResetApprove: Boolean(step.isResetApprove),
                expectedQuoteResult,
                expectedSession,
                expectedSessionFingerprint,
                expectedFeeSelectionFingerprint,
              };
              activeApprovalAttemptRef.current = approvalAttempt;

              await currentAdapter.sendApproveTx({
                amount:
                  quoteResult.fromAmount ?? preSwapData.fromTokenAmount ?? '0',
                gasInfos: preSwapData.netWorkFee?.gasInfos,
                isResetApprove: step.isResetApprove,
                networkFeeLevel,
                customPriorityFee,
                quoteResult,
                onBroadcast: ({ txHash }) => {
                  if (isCurrentReview()) {
                    activeApprovalAttemptRef.current = {
                      ...approvalAttempt,
                      txId: txHash,
                    };
                  }
                  updateStep(
                    i,
                    {
                      status: ESwapStepStatus.PENDING,
                      txHash,
                      stepSubTitle: currentIntl.formatMessage({
                        id: ETranslations.swap_btn_approving,
                      }),
                    },
                    isCurrentReview,
                  );
                },
                onCancel: () => {
                  if (
                    activeApprovalAttemptRef.current?.approvalAttemptId ===
                    approvalAttempt.approvalAttemptId
                  ) {
                    activeApprovalAttemptRef.current = undefined;
                  }
                  markStepFailed(i, undefined, isCurrentReview);
                },
              });
              assertCurrentReview();
              break;
            }

            if (step.type === ESwapStepType.WRAP_TX) {
              await currentAdapter.sendWrappedTx({
                gasInfos: preSwapData.netWorkFee?.gasInfos,
                networkFeeLevel,
                customPriorityFee,
                onBroadcast: ({ txHash, orderId }) => {
                  updateStep(
                    i,
                    {
                      status: ESwapStepStatus.PENDING,
                      txHash,
                      orderId,
                    },
                    isCurrentReview,
                  );
                },
                onCancel: () => {
                  markStepFailed(i, undefined, isCurrentReview);
                },
              });
              assertCurrentReview();
              break;
            }

            if (step.type === ESwapStepType.SEND_TX) {
              await currentAdapter.sendSwapTx({
                gasInfos: preSwapData.netWorkFee?.gasInfos,
                networkFeeLevel,
                customPriorityFee,
                onBroadcast: ({ txHash, orderId }) => {
                  updateStep(
                    i,
                    {
                      status: ESwapStepStatus.PENDING,
                      txHash,
                      orderId,
                    },
                    isCurrentReview,
                  );
                },
                onCancel: () => {
                  markStepFailed(i, undefined, isCurrentReview);
                },
              });
              assertCurrentReview();
              break;
            }

            if (step.type === ESwapStepType.SIGN_MESSAGE) {
              await currentAdapter.sendSignMessage({
                networkFeeLevel,
                customPriorityFee,
                onBroadcast: ({ txHash, orderId }) => {
                  updateStep(
                    i,
                    {
                      status: ESwapStepStatus.PENDING,
                      txHash,
                      orderId,
                    },
                    isCurrentReview,
                  );
                },
                onCancel: () => {
                  markStepFailed(i, undefined, isCurrentReview);
                },
              });
              assertCurrentReview();
              break;
            }

            if (step.type === ESwapStepType.BATCH_APPROVE_SWAP) {
              if (!quoteResult) {
                markStepFailed(i, undefined, isCurrentReview);
                break;
              }

              await currentAdapter.sendSwapTx({
                approvesInfo: currentAdapter.buildApproveInfos(quoteResult),
                gasInfos: preSwapData.netWorkFee?.gasInfos,
                networkFeeLevel,
                customPriorityFee,
                onBroadcast: ({ txHash, orderId }) => {
                  updateStep(
                    i,
                    {
                      status: ESwapStepStatus.PENDING,
                      txHash,
                      orderId,
                    },
                    isCurrentReview,
                  );
                },
                onCancel: () => {
                  markStepFailed(i, undefined, isCurrentReview);
                },
              });
              assertCurrentReview();
              break;
            }
          } catch (error) {
            if (!isCurrentReview()) {
              break;
            }
            if (
              step.type === ESwapStepType.APPROVE_TX &&
              activeApprovalAttemptRef.current?.approvalStepIndex === i
            ) {
              activeApprovalAttemptRef.current = undefined;
            }
            markStepFailed(
              i,
              error instanceof Error ? error.message : undefined,
              isCurrentReview,
            );
            break;
          }
        }
      }
    },
    [markStepFailed, updateStep],
  );

  const approveTransaction = getSwapReviewApproveTransaction({
    source: approveTransactionSource,
    inAppNotificationAtom,
  });

  useEffect(() => {
    if (approveTransactionSource === ESwapReviewApproveTransactionSource.None) {
      return;
    }

    const activeApprovalAttempt = activeApprovalAttemptRef.current;
    if (!activeApprovalAttempt) {
      return;
    }

    const trackedApproveTxId =
      approveTransaction?.txId ?? activeApprovalAttempt.txId ?? '';
    if (
      approveTransaction?.txId &&
      activeApprovalAttempt.txId &&
      approveTransaction.txId !== activeApprovalAttempt.txId
    ) {
      return;
    }
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

    const approveStepStatus =
      approveTransaction.status === ESwapApproveTransactionStatus.SUCCESS
        ? ESwapStepStatus.SUCCESS
        : ESwapStepStatus.FAILED;
    const currentSwapStepsState = swapStepsStateRef.current;
    const approvalStep =
      currentSwapStepsState.steps[activeApprovalAttempt.approvalStepIndex];
    if (
      !approvalStep ||
      approvalStep.type !== ESwapStepType.APPROVE_TX ||
      Boolean(approvalStep.isResetApprove) !==
        activeApprovalAttempt.isResetApprove ||
      (activeApprovalAttempt.txId &&
        approvalStep.txHash !== activeApprovalAttempt.txId) ||
      (!activeApprovalAttempt.txId &&
        approvalStep.status !== ESwapStepStatus.PENDING)
    ) {
      return;
    }
    const expectedQuoteResult = currentSwapStepsState.quoteResult;
    const expectedSession = currentSwapStepsState.preSwapData.reviewSession;
    const expectedSessionFingerprint = expectedSession
      ? buildSwapReviewSessionFingerprint(expectedSession)
      : undefined;
    const expectedFeeSelectionFingerprint = buildReviewFeeSelectionFingerprint({
      networkFeeLevel: networkFeeLevelRef.current,
      customPriorityFee: customPriorityFeeRef.current,
    });
    const isCurrentApprovalReview = (state: ISwapReviewState) => {
      const currentSession = state.preSwapData.reviewSession;
      return (
        state.quoteResult === expectedQuoteResult &&
        buildReviewFeeSelectionFingerprint({
          networkFeeLevel: networkFeeLevelRef.current,
          customPriorityFee: customPriorityFeeRef.current,
        }) === expectedFeeSelectionFingerprint &&
        (expectedSession || currentSession
          ? Boolean(
              expectedSession &&
              currentSession &&
              currentSession.sessionId === expectedSession.sessionId &&
              currentSession.revision === expectedSession.revision &&
              expectedSessionFingerprint &&
              buildSwapReviewSessionFingerprint(currentSession) ===
                expectedSessionFingerprint,
            )
          : true)
      );
    };
    const stepIndex = activeApprovalAttempt.approvalStepIndex;

    if (stepIndex === -1) {
      return;
    }

    handledApproveStatusRef.current = approveStatusKey;

    updateStep(
      stepIndex,
      {
        status: approveStepStatus,
        stepSubTitle: undefined,
      },
      isCurrentApprovalReview,
    );

    if (approveStepStatus !== ESwapStepStatus.SUCCESS) {
      activeApprovalAttemptRef.current = undefined;
      return;
    }

    clearPreSwapGasInfos(
      currentSwapStepsState.preSwapData,
      isCurrentApprovalReview,
    );
    pendingApprovalExecutionRef.current = {
      expectedQuoteResult,
      expectedSession,
      expectedSessionFingerprint,
      expectedFeeSelectionFingerprint,
      approvalAttemptId: activeApprovalAttempt.approvalAttemptId,
      approvalStepIndex: activeApprovalAttempt.approvalStepIndex,
      isResetApprove: activeApprovalAttempt.isResetApprove,
      txId: trackedApproveTxId || activeApprovalAttempt.txId,
    };
    activeApprovalAttemptRef.current = undefined;
    setApprovalExecutionVersion((version) => version + 1);
  }, [
    approveTransaction,
    approveTransactionSource,
    clearPreSwapGasInfos,
    updateStep,
  ]);

  useEffect(() => {
    const pendingApprovalExecution = pendingApprovalExecutionRef.current;
    if (!pendingApprovalExecution) {
      return;
    }
    pendingApprovalExecutionRef.current = undefined;

    const currentReviewState = swapStepsStateRef.current;
    const currentSession = currentReviewState.preSwapData.reviewSession;
    const approvalStep =
      currentReviewState.steps[pendingApprovalExecution.approvalStepIndex];
    if (
      !approvalStep ||
      approvalStep.type !== ESwapStepType.APPROVE_TX ||
      approvalStep.status !== ESwapStepStatus.SUCCESS ||
      Boolean(approvalStep.isResetApprove) !==
        pendingApprovalExecution.isResetApprove ||
      (pendingApprovalExecution.txId &&
        approvalStep.txHash !== pendingApprovalExecution.txId)
    ) {
      return;
    }
    const hasCurrentSessionMismatch =
      pendingApprovalExecution.expectedSession || currentSession
        ? !pendingApprovalExecution.expectedSession ||
          !currentSession ||
          currentSession.sessionId !==
            pendingApprovalExecution.expectedSession.sessionId ||
          currentSession.revision !==
            pendingApprovalExecution.expectedSession.revision ||
          buildSwapReviewSessionFingerprint(currentSession) !==
            pendingApprovalExecution.expectedSessionFingerprint
        : false;

    if (
      currentReviewState.quoteResult !==
        pendingApprovalExecution.expectedQuoteResult ||
      hasCurrentSessionMismatch ||
      buildReviewFeeSelectionFingerprint({
        networkFeeLevel: networkFeeLevelRef.current,
        customPriorityFee: customPriorityFeeRef.current,
      }) !== pendingApprovalExecution.expectedFeeSelectionFingerprint
    ) {
      return;
    }

    void preSwapStepsStart();
  }, [approvalExecutionVersion, preSwapStepsStart]);

  const onConfirm = useCallback(
    (onConfirmStart?: () => void) => {
      if (isSwapReviewConfirmBlocked(reviewRebuildStateRef.current.phase)) {
        return;
      }
      if (confirmInFlightRef.current) {
        return;
      }
      confirmInFlightRef.current = true;

      const confirm = async () => {
        const currentReviewState = swapStepsStateRef.current;
        if (
          canRebuildSwapReviewBeforeConfirm({
            requiresSlippageRebuildOnConfirm:
              currentReviewState.preSwapData.requiresSlippageRebuildOnConfirm,
            capability: currentReviewState.preSwapData.preparationCapability,
          })
        ) {
          const slippagePercentage = currentReviewState.preSwapData.slippage;
          if (typeof slippagePercentage !== 'number') {
            throw new OneKeyLocalError(
              'Invalidated swap review is missing slippage',
            );
          }
          await rebuildReviewWithSlippage(slippagePercentage);
        }

        onConfirmStart?.();
        await preSwapStepsStart();
      };

      void confirm()
        .catch((error) => {
          errorToastUtils.toastIfError(error);
          errorToastUtils.showToastOfError(error);
        })
        .finally(() => {
          confirmInFlightRef.current = false;
        });
    },
    [preSwapStepsStart, rebuildReviewWithSlippage, reviewRebuildStateRef],
  );

  return {
    onConfirm,
    preSwapBeforeStepActions,
    preSwapStepsStart,
    rebuildReviewWithSlippage,
    reviewRebuildState,
    resetUncommittedReviewRebuildError,
  };
}
