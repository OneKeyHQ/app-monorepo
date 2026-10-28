import { useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Alert,
  HeightTransition,
  SizableText,
  Stack,
  YStack,
} from '@onekeyhq/components';
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

export function AmountInputSection({
  title,
  afterInput,
}: IAmountInputSectionProps) {
  const { state, actions, actionResult, approval } = useManagePositionContext();
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
    isEarnForm,
    amountBoxBottom,
    amountBoxTestID,
    onRefreshBalance,
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

  const amountInputDisabled = isDisabled || approval.isFormInteractionLocked;

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

  // A supply spends the wallet's own balance, so it keeps the wallet icon
  // while the market's cap is still loading rather than reading "Available"
  // for a moment
  const balanceProps = useMemo(
    () => ({
      value: balance,
      iconText: maxBalance || action === 'supply' ? undefined : balanceIconText,
      onPress: amountInputDisabled ? undefined : onMax,
    }),
    [balance, maxBalance, action, balanceIconText, amountInputDisabled, onMax],
  );

  // Value props. The Earn forms show "$0.00" before an amount, as Swap does
  const valueProps = useMemo(
    () => ({
      value: currentValue,
      currency: currentValue || isEarnForm ? currencySymbol : undefined,
    }),
    [currentValue, currencySymbol, isEarnForm],
  );

  // The Earn forms say what is wrong with the amount in one red line under
  // the box: the server's check, else more than the balance
  let amountErrorText: string | undefined;
  if (isEarnForm && new BigNumber(amountValue).gt(0)) {
    if (isCheckAmountMessageError) {
      amountErrorText = checkAmountMessage;
    } else if (isInsufficientBalance) {
      amountErrorText = intl.formatMessage({
        id: ETranslations.earn_insufficient_balance,
      });
    }
  }

  // A warning that says what the red line already says (the server's own
  // check of the balance) would say it twice, and push the form down as it
  // comes in a moment later
  const lineText = amountErrorText?.trim().toLowerCase();
  const shownAlerts = lineText
    ? checkAmountAlerts.filter(
        (alert) =>
          ![alert.title?.text, alert.text?.text, alert.description?.text].some(
            (text) => text?.trim().toLowerCase() === lineText,
          ),
      )
    : checkAmountAlerts;

  // Max amount text
  const maxAmountText = useMemo(
    () => intl.formatMessage({ id: ETranslations.global_max }),
    [intl],
  );

  const amountBox = (
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
        bottomContent={amountBoxBottom}
        boxTestID={amountBoxTestID}
        onRefreshBalance={onRefreshBalance}
      />
      {showOverlayMask ? (
        <Stack position="absolute" w="100%" h="100%" zIndex={1} />
      ) : null}
    </Stack>
  );

  // The line brings its own space, so no line leaves no gap
  const amountErrorLine = (
    <HeightTransition duration={200}>
      {amountErrorText ? (
        <YStack pt="$2" px="$3.5">
          <SizableText
            testID="earn-amount-error"
            size="$bodyMd"
            color="$textCritical"
          >
            {amountErrorText}
          </SizableText>
        </YStack>
      ) : null}
    </HeightTransition>
  );

  return (
    // With a card under the box, the section spaces as the deposit forms do
    <YStack gap={afterInput ? '$4' : '$3'}>
      {isEarnForm ? (
        <YStack>
          {amountBox}
          {afterInput ? null : amountErrorLine}
        </YStack>
      ) : (
        amountBox
      )}
      {afterInput}
      {/* Under the card (a phone's list of protocols), so the red line
          coming and going doesn't move it; where the protocols are beside
          the form, right under the box */}
      {isEarnForm && afterInput ? (
        <YStack mt="$-4">{amountErrorLine}</YStack>
      ) : null}

      {/* Error Alert */}
      {isCheckAmountMessageError && !isEarnForm ? (
        <Alert
          icon="InfoCircleOutline"
          type="critical"
          title={checkAmountMessage}
        />
      ) : null}

      {/* Warning Alerts */}
      {shownAlerts.length > 0 ? (
        <>
          {shownAlerts.map((alert, index) => (
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
