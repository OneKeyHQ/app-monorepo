import { useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { Keyboard } from 'react-native';

import { Page, YStack } from '@onekeyhq/components';
import { PercentageStageOnKeyboard } from '@onekeyhq/kit/src/components/PercentageStageOnKeyboard';
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
  const { approving, loadingAllowance, shouldApprove, onApprove } = approval;

  const isInModalContext = isInModalContextProp ?? isInModalContextState;

  // Action label
  const actionLabel = useMemo(
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
      await onSubmit();
    } finally {
      setSubmitting(false);
    }
  }, [confirmBorrowLiquidationRisk, onSubmit, setSubmitting]);

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

  return (
    <>
      {beforeFooter ?? state.beforeFooter}
      {isInModalContext ? (
        <Page.Footer>
          {footerContent}
          <PercentageStageOnKeyboard
            onSelectPercentageStage={
              approving ? undefined : onSelectPercentageStage
            }
          />
        </Page.Footer>
      ) : (
        <YStack>{footerContent}</YStack>
      )}
    </>
  );
}
