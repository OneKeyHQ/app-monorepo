import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { Keyboard } from 'react-native';

import { PercentageStageOnKeyboard } from '@onekeyhq/kit/src/components/PercentageStageOnKeyboard';
import { EARN_DESKTOP_DEMO_COPY } from '@onekeyhq/kit/src/views/Earn/components/desktopHome/earnDesktopHomeCopy';
import { EarnFormFooter } from '@onekeyhq/kit/src/views/Staking/components/EarnFormFooter';
import {
  EStakeProgressStep,
  StakeProgress,
} from '@onekeyhq/kit/src/views/Staking/components/StakeProgress';
import {
  EarnFormCompactContext,
  EarnFormSwitchingContext,
} from '@onekeyhq/kit/src/views/Staking/components/UniversalStake/EarnFormSummary';
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
  const isCompact = useContext(EarnFormCompactContext);
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
    transactionConfirmationLoading,
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
  // In the Earn forms the button keeps its look while the amount is checked
  // (no spinner, no grey that comes and goes with each keystroke), as the
  // staking forms' does; a press in that moment goes once the check is in
  const keepsLookWhileChecking = Boolean(isEarnForm);
  const [isPressWaitingCheck, setIsPressWaitingCheck] = useState(false);

  const businessActionLabel = useMemo(
    () =>
      actionLabelProp ?? intl.formatMessage({ id: ACTION_LABEL_MAP[action] }),
    [actionLabelProp, action, intl],
  );

  // In the Earn forms it stays off while this amount's figures are on their
  // way, and turns on as they land; an answer that fails lets it go, as the
  // rows go to dashes
  const isFiguresComing =
    keepsLookWhileChecking && transactionConfirmationLoading;

  // Disable state
  // Borrow action doesn't check isInsufficientBalance because it's borrowing from protocol
  const isButtonDisabled = useMemo(() => {
    const baseDisabled =
      isDisabled ||
      isAmountInvalid ||
      BigNumber(amountValue).isLessThanOrEqualTo(0) ||
      isCheckAmountMessageError ||
      checkAmountResult === false ||
      (checkAmountLoading && !keepsLookWhileChecking) ||
      isFiguresComing;

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
    keepsLookWhileChecking,
    isFiguresComing,
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
    if (keepsLookWhileChecking && checkAmountLoading) {
      setIsPressWaitingCheck(true);
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
    checkAmountLoading,
    confirmBorrowLiquidationRisk,
    handleSubmit,
    isSwitchingOffer,
    keepsLookWhileChecking,
    onApprove,
    shouldApprove,
  ]);

  const isBusy = submitting || loadingAllowance || isFormInteractionLocked;
  const isConfirmLoading =
    isBusy ||
    (keepsLookWhileChecking ? isPressWaitingCheck : checkAmountLoading);
  useEffect(() => {
    if (!isPressWaitingCheck || checkAmountLoading) {
      return;
    }
    setIsPressWaitingCheck(false);
    if (!isButtonDisabled && !isBusy) {
      void handleConfirm();
    }
  }, [
    checkAmountLoading,
    handleConfirm,
    isBusy,
    isButtonDisabled,
    isPressWaitingCheck,
  ]);
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

  // The steps show as soon as the button names them ("Approve and
  // Supply"), before the press as well as while it runs. A window that
  // keeps its form short leaves them to the button until the press
  const hasStartedSteps =
    approving ||
    submitting ||
    isFormInteractionLocked ||
    approvalProgressStarted;
  const isShowStakeProgress =
    !!amountValue &&
    (shouldApprove || approvalProgressStarted) &&
    (!isCompact || hasStartedSteps);

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
      {/* As every Earn form's: one button the form's full width, in the
          modal's footer or under the form, the steps above it */}
      <EarnFormFooter
        isInModalContext={Boolean(isInModalContext)}
        progress={progressContent}
        confirmText={confirmText}
        confirmButtonProps={{
          testID: BorrowTestIDs.actionConfirmBtn,
          onPress: handleConfirm,
          loading: isConfirmLoading,
          disabled: isButtonDisabled,
        }}
        keyboardStage={
          <PercentageStageOnKeyboard
            onSelectPercentageStage={
              isFormInteractionLocked ? undefined : onSelectPercentageStage
            }
          />
        }
      />
    </>
  );
}
