import { useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { Keyboard } from 'react-native';

import { Page, Stack, YStack } from '@onekeyhq/components';
import { PercentageStageOnKeyboard } from '@onekeyhq/kit/src/components/PercentageStageOnKeyboard';
import {
  EStakeProgressStep,
  StakeProgress,
} from '@onekeyhq/kit/src/views/Staking/components/StakeProgress';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { BorrowTestIDs } from '../../../testIDs';
import { showLiquidationRiskDialog } from '../../showLiquidationRiskDialog';
import { useManagePositionContext } from '../ManagePositionContext';

import type { IActionFooterProps, IBorrowActionType } from '../types';

const ACTION_LABEL_MAP: Record<IBorrowActionType, ETranslations> = {
  supply: ETranslations.defi_supply,
  withdraw: ETranslations.global_withdraw,
  borrow: ETranslations.global_borrow,
  repay: ETranslations.defi_repay,
};

export function ActionFooter({
  isInModalContext: isInModalContextProp,
  beforeFooter,
}: IActionFooterProps) {
  const intl = useIntl();
  const { state, actions, actionResult, approval } = useManagePositionContext();
  const {
    action,
    actionLabel: actionLabelProp,
    amountValue,
    submitting,
    isDisabled,
    isInsufficientBalance,
    isAmountInvalid,
    isInModalContext: isInModalContextState,
  } = state;

  const {
    checkAmountLoading,
    isCheckAmountMessageError,
    checkAmountResult,
    riskOfLiquidationAlert,
  } = actionResult;

  const { onSubmit, onSelectPercentageStage, setSubmitting } = actions;
  const {
    approving,
    approvalProgressStarted,
    loadingAllowance,
    shouldApprove,
    ensureReadyToSubmit,
    onApprove,
  } = approval;

  const isInModalContext = isInModalContextProp ?? isInModalContextState;

  const businessActionLabel = useMemo(
    () =>
      actionLabelProp ?? intl.formatMessage({ id: ACTION_LABEL_MAP[action] }),
    [actionLabelProp, action, intl],
  );

  const actionLabel = useMemo(() => {
    if (shouldApprove) {
      return intl.formatMessage({ id: ETranslations.global_approve });
    }
    return businessActionLabel;
  }, [businessActionLabel, intl, shouldApprove]);

  // Disable state
  // Borrow action doesn't check isInsufficientBalance because it's borrowing from protocol
  const isButtonDisabled = useMemo(() => {
    const baseDisabled =
      isDisabled ||
      isAmountInvalid ||
      BigNumber(amountValue).isLessThanOrEqualTo(0) ||
      isCheckAmountMessageError ||
      checkAmountResult === false ||
      checkAmountLoading;

    // Borrow doesn't need to check wallet balance
    if (action === 'borrow') {
      return baseDisabled;
    }

    return baseDisabled || isInsufficientBalance;
  }, [
    action,
    isDisabled,
    isAmountInvalid,
    amountValue,
    isInsufficientBalance,
    isCheckAmountMessageError,
    checkAmountResult,
    checkAmountLoading,
  ]);

  const confirmBorrowLiquidationRisk = useCallback(async () => {
    if (action !== 'borrow' || !riskOfLiquidationAlert) {
      return true;
    }

    return showLiquidationRiskDialog(intl);
  }, [action, intl, riskOfLiquidationAlert]);

  // Handle submit with liquidation risk check for borrow
  const handleSubmit = useCallback(async () => {
    try {
      Keyboard.dismiss();

      const confirmed = await confirmBorrowLiquidationRisk();
      if (!confirmed) {
        return;
      }

      setSubmitting(true);
      const readyToSubmit = await ensureReadyToSubmit();
      if (!readyToSubmit) {
        return;
      }
      await onSubmit();
    } finally {
      setSubmitting(false);
    }
  }, [
    confirmBorrowLiquidationRisk,
    ensureReadyToSubmit,
    onSubmit,
    setSubmitting,
  ]);

  const handleConfirm = useCallback(async () => {
    if (shouldApprove) {
      Keyboard.dismiss();
      const confirmed = await confirmBorrowLiquidationRisk();
      if (!confirmed) {
        return;
      }
      await onApprove();
      return;
    }
    await handleSubmit();
  }, [confirmBorrowLiquidationRisk, handleSubmit, onApprove, shouldApprove]);

  const confirmText = useMemo(() => {
    if (shouldApprove) {
      return intl.formatMessage(
        { id: ETranslations.global_approve },
        { amount: amountValue, symbol: state.tokenSymbol ?? '' },
      );
    }
    return actionLabel;
  }, [actionLabel, amountValue, intl, shouldApprove, state.tokenSymbol]);

  const footerContent = (
    <Page.FooterActions
      $gtMd={{
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
      }}
      onConfirmText={confirmText}
      confirmButtonProps={{
        testID: BorrowTestIDs.actionConfirmBtn,
        onPress: handleConfirm,
        loading:
          submitting || checkAmountLoading || loadingAllowance || approving,
        disabled: isButtonDisabled,
      }}
    />
  );

  const isShowStakeProgress =
    !!amountValue && (shouldApprove || approvalProgressStarted);

  const progressContent = isShowStakeProgress ? (
    <StakeProgress
      currentStep={
        shouldApprove ? EStakeProgressStep.approve : EStakeProgressStep.deposit
      }
      step1LabelId={ETranslations.global_approve}
      step2Label={businessActionLabel}
    />
  ) : null;

  return (
    <>
      {beforeFooter ?? state.beforeFooter}
      {isInModalContext ? (
        <Page.Footer>
          <Stack
            bg="$bgApp"
            flexDirection="column"
            $gtMd={{
              flexDirection: 'row',
              alignItems: 'center',
              jc: 'space-between',
            }}
          >
            {progressContent ? (
              <Stack pl="$5" $md={{ pt: '$5' }}>
                {progressContent}
              </Stack>
            ) : null}
            {footerContent}
          </Stack>
          <PercentageStageOnKeyboard
            onSelectPercentageStage={
              approving ? undefined : onSelectPercentageStage
            }
          />
        </Page.Footer>
      ) : (
        <YStack bg="$bgApp" gap="$5">
          {progressContent}
          {footerContent}
        </YStack>
      )}
    </>
  );
}
