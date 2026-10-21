import { useCallback, useEffect, useMemo, useRef } from 'react';

import { buildKeyboardPressProps } from '@onekeyhq/kit/src/views/Earn/components/desktopHome/earnDesktopPressable';
import StakingFormWrapper from '@onekeyhq/kit/src/views/Staking/components/StakingFormWrapper';

import { useUniversalBorrowAction } from '../UniversalBorrowAction';

import { useAmountInput } from './hooks/useAmountInput';
import { useBorrowApproval } from './hooks/useBorrowApproval';
import { useManagePositionState } from './hooks/useManagePositionState';
import { useTokenSelector } from './hooks/useTokenSelector';
import { ManagePositionContext } from './ManagePositionContext';
import { ActionFooter } from './modules/ActionFooter';
import { AmountInputSection } from './modules/AmountInputSection';
import { InfoDisplaySection } from './modules/InfoDisplaySection';

import type {
  IManagePositionActions,
  IManagePositionContextValue,
  IManagePositionProps,
  IManagePositionState,
} from './types';

export function ManagePosition(props: IManagePositionProps) {
  const {
    accountId,
    networkId,
    providerName,
    borrowMarketAddress,
    borrowReserveAddress,
    action,
    isDisabled,
    onConfirm,
    onTokenSelect,
    decimals,
    balance,
    maxBalance,
    tokenSymbol,
    tokenImageUri,
    selectableAssets,
    selectableAssetsLoading,
    approveType,
    approveTarget,
    borrowDelegationApproveTarget,
    currentAllowance,
  } = props;

  // State management
  const {
    state: baseState,
    amountValue,
    setAmountValue,
    submitting,
    setSubmitting,
  } = useManagePositionState(props);

  // Amount input handlers
  const {
    onChangeAmountValue,
    onMax,
    onSelectPercentageStage,
    onBlurAmountValue,
  } = useAmountInput({
    action,
    decimals,
    balance,
    maxBalance,
    amountValue,
    setAmountValue,
  });

  // Token selector
  const { selectorMode, handleOpenTokenSelector, tokenSelectorTriggerProps } =
    useTokenSelector({
      action,
      accountId,
      networkId,
      providerName,
      borrowMarketAddress,
      borrowReserveAddress,
      tokenSymbol,
      tokenImageUri,
      networkLogoURI: baseState.networkLogoURI,
      selectableAssets,
      selectableAssetsLoading,
      onTokenSelect,
      setAmountValue,
    });

  // Action result (validation, transaction confirmation, etc.)
  const actionResult = useUniversalBorrowAction({
    action,
    accountId,
    networkId,
    provider: providerName,
    marketAddress: borrowMarketAddress,
    reserveAddress: borrowReserveAddress,
    amount: amountValue,
    isDisabled,
    withdrawAll: baseState.isWithdrawAll,
    repayAll: baseState.isRepayAll,
  });

  // Clear amount when the transaction reserve scope changes.
  useEffect(() => {
    setAmountValue('');
  }, [action, borrowReserveAddress, setAmountValue]);

  // Entered once, as soon as both it and the decimals are in. After the clear
  // above, which also runs on mount (effects run in order). The loading form
  // StakeSection shows first is this same instance, without either
  const { initialAmount, onAmountChange } = props;
  const isInitialAmountAppliedRef = useRef(false);
  // What is typed goes out as it changes; while the start amount is still
  // to come the box is only empty for now
  useEffect(() => {
    if (initialAmount && !isInitialAmountAppliedRef.current) {
      return;
    }
    onAmountChange?.(amountValue);
  }, [amountValue, initialAmount, onAmountChange]);
  useEffect(() => {
    if (
      isInitialAmountAppliedRef.current ||
      !initialAmount ||
      decimals === undefined
    ) {
      return;
    }
    isInitialAmountAppliedRef.current = true;
    onChangeAmountValue(initialAmount);
  }, [decimals, initialAmount, onChangeAmountValue]);

  // Submit handler
  const submitBorrowAction = useCallback(async () => {
    if (!onConfirm) return;

    const started = await onConfirm({
      amount: amountValue,
      withdrawAll: baseState.isWithdrawAll,
      repayAll: baseState.isRepayAll,
    });

    if (started === false) {
      return;
    }

    setAmountValue('');
  }, [
    onConfirm,
    amountValue,
    baseState.isWithdrawAll,
    baseState.isRepayAll,
    setAmountValue,
  ]);

  const approval = useBorrowApproval({
    action,
    providerName,
    amountValue,
    repayAll: baseState.isRepayAll,
    withdrawAll: baseState.isWithdrawAll,
    approveType,
    approveTarget,
    borrowDelegationApproveTarget,
    currentAllowance,
    onApprovedSubmit: submitBorrowAction,
  });

  const { onTokenSelectorPress } = props;
  const effectiveTokenSelectorTriggerProps = useMemo(() => {
    if (approval.isFormInteractionLocked) {
      return {
        ...tokenSelectorTriggerProps,
        disabled: true,
        onPress: undefined,
        popover: undefined,
      };
    }
    if (onTokenSelectorPress) {
      return {
        ...tokenSelectorTriggerProps,
        disabled: false,
        onPress: onTokenSelectorPress,
        popover: undefined,
        // Reachable from the keyboard, as a picker that opens on press
        ...buildKeyboardPressProps(onTokenSelectorPress),
      };
    }
    return tokenSelectorTriggerProps;
  }, [
    approval.isFormInteractionLocked,
    onTokenSelectorPress,
    tokenSelectorTriggerProps,
  ]);

  // Build complete state
  const state: IManagePositionState = useMemo(
    () => ({
      ...baseState,
      amountValue,
      submitting,
      tokenSelectorMode: selectorMode,
      tokenSelectorTriggerProps: effectiveTokenSelectorTriggerProps,
    }),
    [
      baseState,
      amountValue,
      submitting,
      selectorMode,
      effectiveTokenSelectorTriggerProps,
    ],
  );

  // Build actions
  const actions: IManagePositionActions = useMemo(
    () => ({
      setAmountValue,
      setSubmitting,
      onChangeAmountValue,
      onBlurAmountValue,
      onMax,
      onSelectPercentageStage,
      onTokenSelect,
      handleOpenTokenSelector,
      onSubmit: submitBorrowAction,
    }),
    [
      setAmountValue,
      setSubmitting,
      onChangeAmountValue,
      onBlurAmountValue,
      onMax,
      onSelectPercentageStage,
      onTokenSelect,
      handleOpenTokenSelector,
      submitBorrowAction,
    ],
  );

  // Build context value
  const contextValue: IManagePositionContextValue = useMemo(
    () => ({
      state,
      actions,
      actionResult,
      approval,
    }),
    [state, actions, actionResult, approval],
  );

  return (
    <ManagePositionContext.Provider value={contextValue}>
      <StakingFormWrapper>
        <AmountInputSection title={props.inputTitle} />
        {props.offerSwitch}
        <InfoDisplaySection showSwapOrBridge={props.showSwapOrBridge} />
        <ActionFooter />
      </StakingFormWrapper>
    </ManagePositionContext.Provider>
  );
}

// Re-export types and context hook for external use
export { useManagePositionContext } from './ManagePositionContext';
export type {
  IManagePositionProps,
  IManagePositionConfirmParams,
  IBorrowActionType,
} from './types';

// Re-export modules for custom composition
export { AmountInputSection } from './modules/AmountInputSection';
export { InfoDisplaySection } from './modules/InfoDisplaySection';
export { ActionFooter } from './modules/ActionFooter';
