import { useCallback, useContext, useEffect, useMemo, useRef } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { Keyboard } from 'react-native';

import { Page, Stack, YStack } from '@onekeyhq/components';
import { PercentageStageOnKeyboard } from '@onekeyhq/kit/src/components/PercentageStageOnKeyboard';
import { EARN_DESKTOP_DEMO_COPY } from '@onekeyhq/kit/src/views/Earn/components/desktopHome/earnDesktopHomeCopy';
import { EarnFooterFade } from '@onekeyhq/kit/src/views/Staking/components/EarnFooterFade';
import {
  EStakeProgressStep,
  StakeProgress,
} from '@onekeyhq/kit/src/views/Staking/components/StakeProgress';
import { EarnFormSwitchingContext } from '@onekeyhq/kit/src/views/Staking/components/UniversalStake/EarnFormSummary';
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
  autoSubmitKey,
  onAutoSubmit,
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
    isEarnForm,
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
    isFormInteractionLocked,
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

  const isSwitchingOffer = useContext(EarnFormSwitchingContext);
  const handleConfirm = useCallback(async () => {
    // Picked another protocol a moment ago: this form is the one being left
    if (isSwitchingOffer) {
      return;
    }
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
  }, [
    confirmBorrowLiquidationRisk,
    handleSubmit,
    isSwitchingOffer,
    onApprove,
    shouldApprove,
  ]);

  const isConfirmLoading =
    submitting ||
    checkAmountLoading ||
    loadingAllowance ||
    isFormInteractionLocked;
  const autoSubmittedKeyRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (
      autoSubmitKey === undefined ||
      autoSubmittedKeyRef.current === autoSubmitKey ||
      checkAmountResult === undefined ||
      isButtonDisabled ||
      isConfirmLoading
    ) {
      return;
    }
    autoSubmittedKeyRef.current = autoSubmitKey;
    onAutoSubmit?.();
    void handleConfirm();
  }, [
    autoSubmitKey,
    checkAmountResult,
    handleConfirm,
    isButtonDisabled,
    isConfirmLoading,
    onAutoSubmit,
  ]);

  // The press approves, then carries on with the action by itself
  const confirmText = shouldApprove
    ? EARN_DESKTOP_DEMO_COPY.approveAnd(businessActionLabel)
    : businessActionLabel;

  const footerContent = (
    <Page.FooterActions
      $gtMd={{
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
      }}
      // Inline (the Earn Router page) the button spans the form, as the
      // staking form's inline footer does
      {...(isInModalContext
        ? undefined
        : { p: 0, buttonContainerProps: { $gtMd: { ml: '0' }, w: '100%' } })}
      onConfirmText={confirmText}
      confirmButtonProps={{
        testID: BorrowTestIDs.actionConfirmBtn,
        onPress: handleConfirm,
        loading: isConfirmLoading,
        disabled: isButtonDisabled,
        ...(isInModalContext ? undefined : { w: '100%' }),
      }}
    />
  );

  // The Earn forms show the steps once pressed, not before: the button
  // already names them ("Approve and Supply")
  const isShowStakeProgress =
    !!amountValue &&
    (isEarnForm
      ? approvalProgressStarted
      : shouldApprove || approvalProgressStarted);

  const progressContent = isShowStakeProgress ? (
    <StakeProgress
      currentStep={
        shouldApprove ? EStakeProgressStep.approve : EStakeProgressStep.deposit
      }
      step1LabelId={ETranslations.global_approve}
      step2Label={businessActionLabel}
      isRunning={
        isEarnForm && (approving || submitting || isFormInteractionLocked)
      }
    />
  ) : null;

  return (
    <>
      {beforeFooter ?? state.beforeFooter}
      {isInModalContext ? (
        <Page.Footer>
          <EarnFooterFade>
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
                isFormInteractionLocked ? undefined : onSelectPercentageStage
              }
            />
          </EarnFooterFade>
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
