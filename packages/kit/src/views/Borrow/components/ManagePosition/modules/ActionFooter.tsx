import { useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { Keyboard } from 'react-native';

import { Page, YStack } from '@onekeyhq/components';
import { PercentageStageOnKeyboard } from '@onekeyhq/kit/src/components/PercentageStageOnKeyboard';
import { ETranslations } from '@onekeyhq/shared/src/locale';

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
  const { state, actions, actionResult } = useManagePositionContext();
  const intl = useIntl();

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

  // Handle submit with liquidation risk check for borrow
  const handleSubmit = useCallback(async () => {
    try {
      Keyboard.dismiss();

      // Check if liquidation risk alert is needed (only for borrow action)
      if (action === 'borrow' && riskOfLiquidationAlert) {
        const confirmed = await showLiquidationRiskDialog(intl);
        if (!confirmed) {
          return;
        }
      }

      setSubmitting(true);
      await onSubmit();
    } finally {
      setSubmitting(false);
    }
  }, [action, riskOfLiquidationAlert, intl, onSubmit, setSubmitting]);

  const footerContent = (
    <Page.FooterActions
      onConfirmText={actionLabel}
      confirmButtonProps={{
        onPress: handleSubmit,
        loading: submitting || checkAmountLoading,
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
            onSelectPercentageStage={onSelectPercentageStage}
          />
        </Page.Footer>
      ) : (
        <YStack>{footerContent}</YStack>
      )}
    </>
  );
}
