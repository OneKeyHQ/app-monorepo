import { useEffect, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  AnimatePresence,
  Button,
  Divider,
  HeightTransition,
  SizableText,
  YStack,
} from '@onekeyhq/components';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useSwapStepsAtom } from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { useInAppNotificationAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type {
  ESwapSlippageSegmentKey,
  IFetchQuoteResult,
  ISwapStep,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';
import {
  ESwapApproveTransactionStatus,
  ESwapStepStatus,
  ESwapTxHistoryStatus,
} from '@onekeyhq/shared/types/swap/types';

import PreSwapConfirmResult from '../../components/PreSwapConfirmResult';
import PreSwapInfoGroup from '../../components/PreSwapInfoGroup';
import PreSwapStep from '../../components/PreSwapStep';
import PreSwapTokenItem from '../../components/PreSwapTokenItem';
import { useSwapBuildTx } from '../../hooks/useSwapBuiltTx';

interface IPreSwapDialogContentProps {
  quoteResult: IFetchQuoteResult;
  fromTokenInfo?: ISwapToken;
  toTokenInfo?: ISwapToken;
  onConfirm: () => void;
  slippageItem: {
    key: ESwapSlippageSegmentKey;
    value: number;
  };
}

const PreSwapDialogContent = ({
  onConfirm,
  quoteResult,
  slippageItem,
  fromTokenInfo,
  toTokenInfo,
}: IPreSwapDialogContentProps) => {
  const intl = useIntl();

  const fromAmount = quoteResult?.fromAmount || '0';
  const toAmount = quoteResult?.toAmount || '0';
  const [swapSteps, setSwapSteps] = useSwapStepsAtom();
  const { activeAccount } = useActiveAccount({ num: 0 });
  const isHwWallet = useMemo(
    () =>
      accountUtils.isHwWallet({
        walletId: activeAccount?.wallet?.id ?? '',
      }),
    [activeAccount?.wallet?.id],
  );
  const handleConfirm = () => {
    onConfirm();
  };

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

      setSwapSteps((prevSteps: ISwapStep[]) => {
        const newSteps = [...prevSteps];
        const txId = inAppNotificationAtom.swapApprovingTransaction?.txId;

        const stepIndex = newSteps.findIndex((step) => step.txHash === txId);

        if (stepIndex !== -1) {
          newSteps[stepIndex] = {
            ...newSteps[stepIndex],
            status: approveStepStatus,
          };
        }

        return newSteps;
      });
      setInAppNotificationAtom((prev) => {
        return {
          ...prev,
          swapApprovingTransaction: undefined,
        };
      });
      void preSwapStepsStart(swapSteps);
    }
  }, [
    inAppNotificationAtom.swapApprovingTransaction,
    setSwapSteps,
    preSwapStepsStart,
    setInAppNotificationAtom,
    swapSteps,
  ]);

  const lastStep = useMemo(() => {
    return swapSteps[swapSteps.length - 1];
  }, [swapSteps]);

  useEffect(() => {
    if (lastStep?.txHash || lastStep?.orderId) {
      const findStepItem = inAppNotificationAtom.swapHistoryPendingList.find(
        (item) =>
          item.txInfo.useOrderId
            ? item.txInfo.orderId === lastStep?.orderId
            : item.txInfo.txId === lastStep?.txHash,
      );
      if (
        findStepItem &&
        findStepItem.status !== ESwapTxHistoryStatus.PENDING
      ) {
        let stepStatus = ESwapStepStatus.PENDING;
        if (findStepItem.status === ESwapTxHistoryStatus.SUCCESS) {
          stepStatus = ESwapStepStatus.SUCCESS;
        } else if (findStepItem.status === ESwapTxHistoryStatus.FAILED) {
          stepStatus = ESwapStepStatus.FAILED;
        }

        setSwapSteps((prevSteps: ISwapStep[]) => {
          const newSteps = [...prevSteps];
          newSteps[newSteps.length - 1] = {
            ...newSteps[newSteps.length - 1],
            status: stepStatus,
          };
          return newSteps;
        });
      }
    }
  }, [
    inAppNotificationAtom.swapHistoryPendingList,
    lastStep?.orderId,
    lastStep?.txHash,
    setSwapSteps,
  ]);

  const showResultContent = useMemo(() => {
    if (swapSteps.length > 0) {
      return (
        lastStep?.status !== ESwapStepStatus.READY &&
        lastStep?.status !== ESwapStepStatus.LOADING
      );
    }
  }, [lastStep?.status, swapSteps.length]);

  // if (showResultContent && swapSteps.length > 0) {
  //   return <PreSwapConfirmResult lastStep={swapSteps[swapSteps.length - 1]} />;
  // }
  return (
    <HeightTransition initialHeight={355}>
      {showResultContent && swapSteps.length > 0 ? (
        <PreSwapConfirmResult lastStep={swapSteps[swapSteps.length - 1]} />
      ) : (
        <YStack gap="$4">
          {/* You pay */}
          <YStack gap="$1">
            <SizableText size="$bodyMd" color="$textSubdued">
              {intl.formatMessage({ id: ETranslations.swap_review_you_pay })}
            </SizableText>

            {/* From token item */}
            <PreSwapTokenItem token={fromTokenInfo} amount={fromAmount} />
          </YStack>
          {/* You received */}
          <YStack gap="$1">
            <SizableText size="$bodyMd" color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.swap_review_you_receive,
              })}
            </SizableText>

            {/* To token item */}
            <PreSwapTokenItem token={toTokenInfo} amount={toAmount} />
          </YStack>

          <Divider />

          {swapSteps.length > 0 &&
          swapSteps[0].status === ESwapStepStatus.READY ? (
            <YStack gap="$4">
              {/* Info items */}
              <PreSwapInfoGroup
                quoteResult={quoteResult}
                slippageItem={slippageItem}
              />
              {/* Primary button */}
              <Button variant="primary" onPress={handleConfirm} size="medium">
                {intl.formatMessage({
                  id: isHwWallet
                    ? ETranslations.global_confirm_on_device
                    : ETranslations.global_confirm,
                })}
              </Button>
            </YStack>
          ) : (
            <PreSwapStep steps={swapSteps} onRetry={handleConfirm} />
          )}
        </YStack>
      )}
    </HeightTransition>
  );
};

export default PreSwapDialogContent;
