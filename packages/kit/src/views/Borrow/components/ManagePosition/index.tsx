import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { Keyboard } from 'react-native';

import { Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useRouteIsFocused as useIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import { useSignatureConfirm } from '@onekeyhq/kit/src/hooks/useSignatureConfirm';
import StakingFormWrapper from '@onekeyhq/kit/src/views/Staking/components/StakingFormWrapper';
import { useTrackTokenAllowance } from '@onekeyhq/kit/src/views/Staking/hooks/useUtilsHooks';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EApproveType } from '@onekeyhq/shared/types/staking';

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
  const intl = useIntl();
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
    approveTarget,
    currentAllowance = '0',
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
  const submitBorrowAction = useCallback(async () => {
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

  const useApprove =
    !!approveTarget?.spenderAddress && !approveTarget?.token?.isNative;
  const [approving, setApproving] = useState(false);
  const allowanceAbortRef = useRef<AbortController | undefined>(undefined);
  const { navigationToTxConfirm } = useSignatureConfirm({
    accountId: approveTarget?.accountId ?? '',
    networkId: approveTarget?.networkId ?? '',
  });
  const {
    allowance,
    loading: loadingAllowance,
    trackAllowance,
    fetchAllowanceResponse,
  } = useTrackTokenAllowance({
    accountId: approveTarget?.accountId ?? '',
    networkId: approveTarget?.networkId ?? '',
    tokenAddress: approveTarget?.token?.address ?? '',
    spenderAddress: approveTarget?.spenderAddress ?? '',
    initialValue: currentAllowance,
    approveType: EApproveType.Legacy,
  });
  const isFocus = useIsFocused();

  const needsApproval = useMemo(() => {
    if (!useApprove) return false;
    if (!isFocus) return true;
    const amountBN = new BigNumber(amountValue || '0');
    const allowanceBN = new BigNumber(allowance || '0');
    return !amountBN.isNaN() && amountBN.gt(0) && allowanceBN.lt(amountBN);
  }, [allowance, amountValue, isFocus, useApprove]);

  useEffect(
    () => () => {
      allowanceAbortRef.current?.abort();
    },
    [],
  );

  const waitForAllowanceAfterApprove = useCallback(
    async ({
      requiredAmount,
      maxAttempts = 15,
      intervalMs = 2000,
      signal,
    }: {
      requiredAmount: string;
      maxAttempts?: number;
      intervalMs?: number;
      signal?: AbortSignal;
    }) => {
      if (!useApprove || !requiredAmount) {
        return true;
      }
      const requiredAmountBN = new BigNumber(requiredAmount);
      if (requiredAmountBN.isNaN() || requiredAmountBN.lte(0)) {
        return true;
      }
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        if (signal?.aborted) {
          return false;
        }
        try {
          const allowanceInfo = await fetchAllowanceResponse();
          const allowanceBN = new BigNumber(
            allowanceInfo.allowanceParsed || '0',
          );
          if (!allowanceBN.isNaN() && allowanceBN.gte(requiredAmountBN)) {
            return true;
          }
        } catch (error) {
          defaultLogger.staking.page.permitSignError({
            error: error instanceof Error ? error.message : String(error),
          });
        }
        if (attempt < maxAttempts - 1) {
          await new Promise<void>((resolve) => {
            setTimeout(resolve, intervalMs);
          });
        }
      }
      return false;
    },
    [fetchAllowanceResponse, useApprove],
  );

  const onApprove = useCallback(async () => {
    if (!approveTarget?.token || !amountValue) return;
    Keyboard.dismiss();
    setApproving(true);

    let approveAllowance = allowance;
    try {
      const allowanceInfo = await fetchAllowanceResponse();
      approveAllowance = allowanceInfo.allowanceParsed;
    } catch (_e) {
      // Use cached allowance.
    }

    const allowanceBN = new BigNumber(approveAllowance || '0');
    const amountBN = new BigNumber(amountValue || '0');
    if (!amountBN.isNaN() && allowanceBN.gte(amountBN)) {
      setApproving(false);
      await submitBorrowAction();
      return;
    }

    try {
      const account = await backgroundApiProxy.serviceAccount.getAccount({
        accountId: approveTarget.accountId,
        networkId: approveTarget.networkId,
      });

      await navigationToTxConfirm({
        approvesInfo: [
          {
            owner: account.address,
            spender: approveTarget.spenderAddress,
            amount: amountValue,
            tokenInfo: approveTarget.token,
          },
        ],
        onSuccess(data) {
          trackAllowance(data[0].decodedTx.txid);
          allowanceAbortRef.current?.abort();
          const abortController = new AbortController();
          allowanceAbortRef.current = abortController;
          void (async () => {
            try {
              const allowanceReady = await waitForAllowanceAfterApprove({
                requiredAmount: amountValue,
                signal: abortController.signal,
              });
              if (!allowanceReady) {
                Toast.warning({
                  title: intl.formatMessage({
                    id: ETranslations.swap_page_toast_approve_failed,
                  }),
                  message: intl.formatMessage({
                    id: ETranslations.global_try_again,
                  }),
                });
                return;
              }
              await submitBorrowAction();
            } catch (error) {
              Toast.error({
                title:
                  error instanceof Error
                    ? error.message
                    : intl.formatMessage({
                        id: ETranslations.swap_page_toast_approve_failed,
                      }),
              });
            } finally {
              setApproving(false);
            }
          })();
        },
        onFail() {
          setApproving(false);
        },
        onCancel() {
          setApproving(false);
        },
      });
    } catch (error) {
      setApproving(false);
      throw error;
    }
  }, [
    allowance,
    amountValue,
    approveTarget,
    fetchAllowanceResponse,
    intl,
    navigationToTxConfirm,
    submitBorrowAction,
    trackAllowance,
    waitForAllowanceAfterApprove,
  ]);

  // Build complete state
  const state: IManagePositionState = useMemo(
    () => ({
      ...baseState,
      amountValue,
      submitting,
      shouldApprove: needsApproval,
      approveLoading: loadingAllowance || approving,
      tokenSelectorMode: selectorMode,
      tokenSelectorTriggerProps,
    }),
    [
      baseState,
      amountValue,
      submitting,
      needsApproval,
      loadingAllowance,
      approving,
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
      onSubmit: submitBorrowAction,
      onApprove,
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
      onApprove,
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
