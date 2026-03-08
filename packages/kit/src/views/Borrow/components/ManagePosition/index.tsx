import { useCallback, useEffect, useMemo } from 'react';

import StakingFormWrapper from '@onekeyhq/kit/src/views/Staking/components/StakingFormWrapper';

import { useUniversalBorrowAction } from '../UniversalBorrowAction';

import { useAmountInput } from './hooks/useAmountInput';
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
    repayAll: baseState.isRepayAll,
  });

  // Clear amount when reserve address changes (only for supply/borrow which use navigation)
  useEffect(() => {
    if (action === 'supply' || action === 'borrow') {
      setAmountValue('');
    }
  }, [action, borrowReserveAddress, setAmountValue]);

  // Submit handler
  const onSubmit = useCallback(async () => {
    if (!onConfirm) return;

    await onConfirm({
      amount: amountValue,
      withdrawAll: baseState.isWithdrawAll,
      repayAll: baseState.isRepayAll,
    });

    setAmountValue('');
  }, [
    onConfirm,
    amountValue,
    baseState.isWithdrawAll,
    baseState.isRepayAll,
    setAmountValue,
  ]);

  // Build complete state
  const state: IManagePositionState = useMemo(
    () => ({
      ...baseState,
      amountValue,
      submitting,
      tokenSelectorMode: selectorMode,
      tokenSelectorTriggerProps,
    }),
    [
      baseState,
      amountValue,
      submitting,
      selectorMode,
      tokenSelectorTriggerProps,
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
      onSubmit,
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
      onSubmit,
    ],
  );

  // Build context value
  const contextValue: IManagePositionContextValue = useMemo(
    () => ({
      state,
      actions,
      actionResult,
    }),
    [state, actions, actionResult],
  );

  return (
    <ManagePositionContext.Provider value={contextValue}>
      <StakingFormWrapper>
        <AmountInputSection />
        <InfoDisplaySection />
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
