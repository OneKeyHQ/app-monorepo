import { useEffect, useMemo, useRef } from 'react';

import { isEqual } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Button,
  Divider,
  HeightTransition,
  Icon,
  Popover,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  useSwapStepNetFeeLevelAtom,
  useSwapStepsAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { useInAppNotificationAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type {
  IFetchLimitOrderRes,
  IFetchQuoteResult,
  ISwapPreSwapData,
  ISwapStep,
  ISwapTxHistory,
} from '@onekeyhq/shared/types/swap/types';
import {
  ESwapApproveTransactionStatus,
  ESwapLimitOrderStatus,
  ESwapStepStatus,
  ESwapTabSwitchType,
  ESwapTxHistoryStatus,
} from '@onekeyhq/shared/types/swap/types';

import PreSwapConfirmResult from '../../components/PreSwapConfirmResult';
import PreSwapInfoGroup from '../../components/PreSwapInfoGroup';
import PreSwapStep from '../../components/PreSwapStep';
import PreSwapTokenItem from '../../components/PreSwapTokenItem';
import { useSwapBuildTx } from '../../hooks/useSwapBuiltTx';

interface IPreSwapDialogContentProps {
  onConfirm: () => void;
  onDone: () => void;
}

const PreSwapDialogContent = ({
  onDone,
  onConfirm,
}: IPreSwapDialogContentProps) => {
  const intl = useIntl();
  const [swapSteps, setSwapSteps] = useSwapStepsAtom();
  const { preSwapBeforeStepActions } = useSwapBuildTx();
  const [swapStepNetFeeLevel, setSwapStepNetFeeLevel] =
    useSwapStepNetFeeLevelAtom();
  const swapStepsRef = useRef(swapSteps);
  if (!isEqual(swapStepsRef.current, swapSteps)) {
    swapStepsRef.current = swapSteps;
  }
  const { preSwapData, quoteResult } = useMemo(() => {
    return {
      preSwapData: swapSteps.preSwapData,
      quoteResult: swapSteps.quoteResult,
    };
  }, [swapSteps]);
  const { fromAmount, toAmount } = useMemo(() => {
    return {
      fromAmount: preSwapData?.fromTokenAmount || '0',
      toAmount: preSwapData?.toTokenAmount || '0',
    };
  }, [preSwapData]);
  const { activeAccount } = useActiveAccount({ num: 0 });
  const isHwWallet = useMemo(
    () =>
      accountUtils.isHwWallet({
        walletId: activeAccount?.wallet?.id ?? '',
      }),
    [activeAccount?.wallet?.id],
  );

  const [inAppNotificationAtom, setInAppNotificationAtom] =
    useInAppNotificationAtom();
  const { preSwapStepsStart } = useSwapBuildTx();

  useEffect(() => {
    if (
      inAppNotificationAtom.swapApprovingTransaction &&
      inAppNotificationAtom.swapApprovingTransaction.status !==
        ESwapApproveTransactionStatus.PENDING
    ) {
      const approveStepStatus =
        inAppNotificationAtom.swapApprovingTransaction.status ===
        ESwapApproveTransactionStatus.SUCCESS
          ? ESwapStepStatus.SUCCESS
          : ESwapStepStatus.FAILED;
      let updatedSteps: ISwapStep[] = [...swapSteps.steps];
      setSwapSteps(
        (prevSteps: { steps: ISwapStep[]; preSwapData: ISwapPreSwapData }) => {
          const newSteps = [...prevSteps.steps];
          const txId = inAppNotificationAtom.swapApprovingTransaction?.txId;

          const stepIndex = newSteps.findIndex((step) => step.txHash === txId);

          if (stepIndex !== -1) {
            newSteps[stepIndex] = {
              ...newSteps[stepIndex],
              status: approveStepStatus,
            };
            updatedSteps = [...newSteps];
          }

          return {
            ...prevSteps,
            steps: newSteps,
          };
        },
      );
      setInAppNotificationAtom((prev) => {
        return {
          ...prev,
          swapApprovingTransaction: undefined,
        };
      });
      void preSwapStepsStart({
        steps: [...updatedSteps],
        preSwapData: swapSteps.preSwapData,
        quoteResult: swapSteps.quoteResult as IFetchQuoteResult,
      });
    }
  }, [
    inAppNotificationAtom.swapApprovingTransaction,
    setSwapSteps,
    preSwapStepsStart,
    setInAppNotificationAtom,
    swapSteps,
  ]);

  useEffect(() => {
    if (
      swapStepsRef.current.preSwapData.supportNetworkFeeLevel &&
      swapStepsRef.current.preSwapData.supportPreBuild
    ) {
      void preSwapBeforeStepActions(
        swapStepsRef.current.quoteResult,
        swapStepsRef.current.preSwapData.fromToken,
        swapStepsRef.current.preSwapData.toToken,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [swapStepNetFeeLevel.networkFeeLevel]);

  const lastStep = useMemo(() => {
    return swapSteps.steps[swapSteps.steps.length - 1];
  }, [swapSteps]);

  useEffect(() => {
    if (lastStep?.txHash || lastStep?.orderId) {
      let findStepItem: ISwapTxHistory | IFetchLimitOrderRes | undefined;
      if (preSwapData?.swapType !== ESwapTabSwitchType.LIMIT) {
        findStepItem = inAppNotificationAtom.swapHistoryPendingList.find(
          (item) =>
            item.txInfo.useOrderId
              ? item.txInfo.orderId === lastStep?.orderId
              : item.txInfo.txId === lastStep?.txHash,
        );
      } else {
        findStepItem = inAppNotificationAtom.swapLimitOrders.find(
          (item) => item.orderId === lastStep?.orderId,
        );
      }
      if (
        findStepItem &&
        preSwapData?.swapType !== ESwapTabSwitchType.LIMIT &&
        findStepItem.status !== ESwapTxHistoryStatus.PENDING
      ) {
        let stepStatus = ESwapStepStatus.PENDING;
        if (findStepItem.status === ESwapTxHistoryStatus.SUCCESS) {
          stepStatus = ESwapStepStatus.SUCCESS;
        } else if (findStepItem.status === ESwapTxHistoryStatus.FAILED) {
          stepStatus = ESwapStepStatus.FAILED;
        }
        setSwapSteps(
          (prevSteps: {
            steps: ISwapStep[];
            preSwapData: ISwapPreSwapData;
          }) => {
            const newSteps = [...prevSteps.steps];
            newSteps[newSteps.length - 1] = {
              ...newSteps[newSteps.length - 1],
              status: stepStatus,
            };
            return {
              ...prevSteps,
              steps: newSteps,
            };
          },
        );
      } else if (
        findStepItem &&
        preSwapData?.swapType === ESwapTabSwitchType.LIMIT &&
        findStepItem.status !== ESwapLimitOrderStatus.OPEN &&
        findStepItem.status !== ESwapLimitOrderStatus.PRESIGNATURE_PENDING
      ) {
        let stepStatus = ESwapStepStatus.PENDING;
        if (
          findStepItem.status === ESwapLimitOrderStatus.FULFILLED ||
          findStepItem.status === ESwapLimitOrderStatus.PARTIALLY_FILLED
        ) {
          stepStatus = ESwapStepStatus.SUCCESS;
        } else if (
          findStepItem.status === ESwapLimitOrderStatus.CANCELLED ||
          findStepItem.status === ESwapLimitOrderStatus.EXPIRED
        ) {
          stepStatus = ESwapStepStatus.FAILED;
        }
        setSwapSteps(
          (prevSteps: {
            steps: ISwapStep[];
            preSwapData: ISwapPreSwapData;
          }) => {
            const newSteps = [...prevSteps.steps];
            newSteps[newSteps.length - 1] = {
              ...newSteps[newSteps.length - 1],
              status: stepStatus,
            };
            return {
              ...prevSteps,
              steps: newSteps,
            };
          },
        );
      }
    }
  }, [
    inAppNotificationAtom.swapHistoryPendingList,
    inAppNotificationAtom.swapLimitOrders,
    lastStep?.orderId,
    lastStep?.txHash,
    preSwapData?.swapType,
    setSwapSteps,
  ]);

  const showResultContent = useMemo(() => {
    if (swapSteps.steps.length > 0) {
      return (
        lastStep?.status !== ESwapStepStatus.READY &&
        lastStep?.status !== ESwapStepStatus.LOADING
      );
    }
  }, [lastStep?.status, swapSteps.steps.length]);

  return (
    <HeightTransition initialHeight={355}>
      {showResultContent && swapSteps.steps.length > 0 ? (
        <PreSwapConfirmResult
          onConfirm={onDone}
          fromToken={preSwapData?.fromToken}
          supportUrl={quoteResult?.supportUrl}
          lastStep={swapSteps.steps[swapSteps.steps.length - 1]}
        />
      ) : (
        <YStack gap="$4">
          {/* You pay */}
          <YStack gap="$1">
            <SizableText size="$bodyMd" color="$textSubdued">
              {intl.formatMessage({ id: ETranslations.swap_review_you_pay })}
            </SizableText>

            {/* From token item */}
            <PreSwapTokenItem
              token={preSwapData?.fromToken}
              amount={fromAmount}
            />
          </YStack>
          {/* You received */}
          <YStack gap="$1">
            <XStack alignItems="center" gap="$1">
              <SizableText size="$bodyMd" color="$textSubdued">
                {intl.formatMessage({
                  id: ETranslations.provider_sort_item_received,
                })}
              </SizableText>
              <Popover
                title={intl.formatMessage({
                  id: ETranslations.provider_sort_item_received,
                })}
                renderTrigger={
                  <Icon
                    cursor="pointer"
                    name="InfoCircleOutline"
                    size="$3.5"
                    color="$iconSubdued"
                  />
                }
                renderContent={() => {
                  return (
                    <Stack p="$4">
                      {quoteResult?.isFloating ? (
                        <SizableText size="$bodyMd">
                          {intl.formatMessage({
                            id: ETranslations.provider_route_changelly_float,
                          })}
                        </SizableText>
                      ) : (
                        <SizableText size="$bodyMd">
                          {intl.formatMessage({
                            id: ETranslations.provider_ios_popover_onekey_fee_content_sub,
                          })}
                        </SizableText>
                      )}
                    </Stack>
                  );
                }}
              />
            </XStack>

            {/* To token item */}
            <PreSwapTokenItem
              token={preSwapData?.toToken}
              amount={toAmount}
              loading={preSwapData.swapBuildLoading}
              isFloating={quoteResult?.isFloating}
            />
          </YStack>

          <Divider />

          {swapSteps.steps.length > 0 &&
          swapSteps.steps[0].status === ESwapStepStatus.READY ? (
            <YStack gap="$4">
              {/* Info items */}
              <PreSwapInfoGroup
                preSwapData={swapSteps.preSwapData}
                onSelectNetworkFeeLevel={(value) => {
                  setSwapStepNetFeeLevel({
                    networkFeeLevel: value,
                  });
                }}
              />
              {/* Primary button */}
              <YStack gap="$2">
                {preSwapData?.isHWAndExBatchTransfer ? (
                  <XStack gap="$1" alignItems="center">
                    <Icon name="InfoCircleOutline" size="$4" />
                    <SizableText size="$bodyMd">
                      {intl.formatMessage({
                        id: quoteResult?.allowanceResult?.shouldResetApprove
                          ? ETranslations.swap_review_confirm_3_on_device
                          : ETranslations.swap_review_confirm_2_on_device,
                      })}
                    </SizableText>
                  </XStack>
                ) : null}
                <Button
                  variant="primary"
                  onPress={onConfirm}
                  size="medium"
                  disabled={
                    swapSteps.preSwapData.estimateNetworkFeeLoading ||
                    swapSteps.preSwapData.swapBuildLoading ||
                    swapSteps.preSwapData.stepBeforeActionsLoading
                  }
                >
                  {intl.formatMessage({
                    id: isHwWallet
                      ? ETranslations.global_confirm_on_device
                      : ETranslations.global_confirm,
                  })}
                </Button>
              </YStack>
            </YStack>
          ) : (
            <PreSwapStep steps={swapSteps.steps} onRetry={onConfirm} />
          )}
        </YStack>
      )}
    </HeightTransition>
  );
};

export default PreSwapDialogContent;
