import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Alert, Stack, YStack } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useBrowserAction } from '@onekeyhq/kit/src/states/jotai/contexts/discovery';
import { EarnText } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnText';
import { StakingAmountInput } from '@onekeyhq/kit/src/views/Staking/components/StakingAmountInput';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useManagePositionContext } from '../ManagePositionContext';

import type { IAmountInputSectionProps, IBorrowActionType } from '../types';

const ACTION_LABEL_MAP: Record<IBorrowActionType, ETranslations> = {
  supply: ETranslations.defi_supply,
  withdraw: ETranslations.global_withdraw,
  borrow: ETranslations.global_borrow,
  repay: ETranslations.defi_repay,
};

export function AmountInputSection({ title }: IAmountInputSectionProps) {
  const { state, actions, actionResult } = useManagePositionContext();
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { handleOpenWebSite } = useBrowserAction().current;

  const {
    action,
    actionLabel: actionLabelProp,
    amountValue,
    balance,
    maxBalance,
    isDisabled,
    isInsufficientBalance,
    currentValue,
    currencySymbol,
    tokenSelectorTriggerProps,
  } = state;

  const { checkAmountMessage, checkAmountAlerts, isCheckAmountMessageError } =
    actionResult;

  const {
    onChangeAmountValue,
    onMax,
    onSelectPercentageStage,
    onBlurAmountValue,
  } = actions;

  // Action label
  const actionLabel = useMemo(
    () =>
      title ??
      actionLabelProp ??
      intl.formatMessage({ id: ACTION_LABEL_MAP[action] }),
    [title, actionLabelProp, action, intl],
  );

  const amountInputDisabled = isDisabled;

  // Borrow action doesn't check isInsufficientBalance for hasError
  // because borrow is borrowing from the protocol, not spending wallet balance
  const hasError = useMemo(() => {
    if (action === 'borrow') {
      return isCheckAmountMessageError;
    }
    return isInsufficientBalance || isCheckAmountMessageError;
  }, [action, isInsufficientBalance, isCheckAmountMessageError]);

  // Only withdraw/repay need the overlay mask when disabled
  const showOverlayMask =
    amountInputDisabled && (action === 'withdraw' || action === 'repay');

  // Input props
  const inputProps = useMemo(
    () => ({
      placeholder: '0',
      autoFocus: !amountInputDisabled,
    }),
    [amountInputDisabled],
  );

  // Balance props
  const balanceIconText = useMemo(
    () => intl.formatMessage({ id: ETranslations.global_available }),
    [intl],
  );

  const balanceProps = useMemo(
    () => ({
      value: balance,
      iconText: maxBalance ? undefined : balanceIconText,
      onPress: amountInputDisabled ? undefined : onMax,
    }),
    [balance, maxBalance, balanceIconText, amountInputDisabled, onMax],
  );

  // Value props
  const valueProps = useMemo(
    () => ({
      value: currentValue,
      currency: currentValue ? currencySymbol : undefined,
    }),
    [currentValue, currencySymbol],
  );

  // Max amount text
  const maxAmountText = useMemo(
    () => intl.formatMessage({ id: ETranslations.global_max }),
    [intl],
  );

  return (
    <YStack gap="$3">
      {/* Amount Input */}
      <Stack position="relative" opacity={amountInputDisabled ? 0.7 : 1}>
        <StakingAmountInput
          title={actionLabel}
          disabled={amountInputDisabled}
          hasError={hasError}
          value={amountValue}
          onChange={onChangeAmountValue}
          onBlur={onBlurAmountValue}
          tokenSelectorTriggerProps={tokenSelectorTriggerProps}
          inputProps={inputProps}
          balanceProps={balanceProps}
          valueProps={valueProps}
          enableMaxAmount
          maxAmountText={maxAmountText}
          onSelectPercentageStage={onSelectPercentageStage}
        />
        {showOverlayMask ? (
          <Stack position="absolute" w="100%" h="100%" zIndex={1} />
        ) : null}
      </Stack>

      {/* Error Alert */}
      {isCheckAmountMessageError ? (
        <Alert
          icon="InfoCircleOutline"
          type="critical"
          title={checkAmountMessage}
        />
      ) : null}

      {/* Warning Alerts */}
      {checkAmountAlerts.length > 0 ? (
        <>
          {checkAmountAlerts.map((alert, index) => (
            <Alert
              key={index}
              type="warning"
              renderTitle={() => (
                <YStack>
                  <EarnText text={alert?.title} size="$bodyMdMedium" />
                  <EarnText text={alert.text} size="$bodyMdMedium" />
                  <EarnText text={alert?.description} size="$bodyMdMedium" />
                </YStack>
              )}
              action={
                alert.button
                  ? {
                      primary: alert.button.text.text,
                      onPrimaryPress: () => {
                        if (alert.button?.data?.link) {
                          handleOpenWebSite({
                            navigation,
                            useCurrentWindow: false,
                            webSite: {
                              url: alert.button.data.link,
                              title: alert.button.data.link,
                              logo: undefined,
                              sortIndex: undefined,
                            },
                          });
                        }
                      },
                    }
                  : undefined
              }
            />
          ))}
        </>
      ) : null}
    </YStack>
  );
}
