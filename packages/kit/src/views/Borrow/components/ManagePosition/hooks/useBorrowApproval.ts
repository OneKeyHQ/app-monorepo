import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';
import { Keyboard } from 'react-native';

import { Dialog, Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useSignatureConfirm } from '@onekeyhq/kit/src/hooks/useSignatureConfirm';
import { useTrackTokenAllowance } from '@onekeyhq/kit/src/views/Staking/hooks/useUtilsHooks';
import type { IApproveInfo } from '@onekeyhq/kit-bg/src/vaults/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { EApproveType } from '@onekeyhq/shared/types/staking';

import {
  isBorrowAllowanceEnough,
  isBorrowAllowanceZero,
  isBorrowTokenApprovalEnabled,
  isBorrowTokenApprovalRequired,
  resolveBorrowApprovalActionStep,
} from '../borrowApproval.utils';

import type {
  IBorrowActionType,
  IBorrowApproveTarget,
  IManagePositionApproval,
} from '../types';

function getBorrowApprovalSubmitErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === 'string' && error) {
    return error;
  }

  return undefined;
}

function buildBorrowApproveInfo({
  owner,
  spenderAddress,
  token,
  amount,
  isMax,
}: {
  owner: string;
  spenderAddress: string;
  token: NonNullable<IBorrowApproveTarget['token']>;
  amount: string;
  isMax?: boolean;
}): IApproveInfo {
  return {
    owner,
    spender: spenderAddress,
    amount,
    isMax,
    tokenInfo: {
      ...token,
      isNative: !!token.isNative,
      name: token.name ?? token.symbol,
    },
  };
}

export function useBorrowApproval({
  action,
  amountValue,
  repayAll,
  approveType,
  approveTarget,
  currentAllowance = '0',
  onApprovedSubmit,
}: {
  action: IBorrowActionType;
  amountValue: string;
  repayAll?: boolean;
  approveType?: EApproveType;
  approveTarget?: IBorrowApproveTarget;
  currentAllowance?: string;
  onApprovedSubmit: () => Promise<void>;
}): IManagePositionApproval {
  const intl = useIntl();
  const [approving, setApproving] = useState(false);
  const mountedRef = useRef(false);
  const allowanceAbortRef = useRef<AbortController | undefined>(undefined);
  const { navigationToTxConfirm } = useSignatureConfirm({
    accountId: approveTarget?.accountId ?? '',
    networkId: approveTarget?.networkId ?? '',
  });

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      allowanceAbortRef.current?.abort();
      allowanceAbortRef.current = undefined;
    };
  }, []);

  const setApprovingSafe = useCallback((value: boolean) => {
    if (mountedRef.current) {
      setApproving(value);
    }
  }, []);

  const stopAllowancePolling = useCallback(() => {
    allowanceAbortRef.current?.abort();
    allowanceAbortRef.current = undefined;
  }, []);

  const startAllowancePolling = useCallback(() => {
    stopAllowancePolling();
    const abortController = new AbortController();
    allowanceAbortRef.current = abortController;
    return abortController;
  }, [stopAllowancePolling]);

  const showApprovalError = useCallback(
    ({ error, scope }: { error: unknown; scope: string }) => {
      const errorMessage = getBorrowApprovalSubmitErrorMessage(error);
      defaultLogger.app.error.log(
        `useBorrowApproval ${scope} failed: ${errorMessage ?? String(error)}`,
      );
      Toast.error({
        title:
          errorMessage ??
          intl.formatMessage({
            id: ETranslations.global_failed,
          }),
      });
    },
    [intl],
  );

  const approvalEnabled = useMemo(
    () =>
      isBorrowTokenApprovalEnabled({
        action,
        approveType,
        approveTarget,
      }),
    [action, approveTarget, approveType],
  );

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
    approveType,
  });

  const shouldApprove = useMemo(
    () =>
      isBorrowTokenApprovalRequired({
        enabled: approvalEnabled,
        amount: amountValue,
        allowance,
        requiresMaxApproval: action === 'repay' && repayAll,
      }),
    [action, allowance, amountValue, approvalEnabled, repayAll],
  );

  const waitForAllowance = useCallback(
    async ({
      isReady,
      maxAttempts = 15,
      intervalMs = 2000,
      signal,
    }: {
      isReady: (allowance: string) => boolean;
      maxAttempts?: number;
      intervalMs?: number;
      signal?: AbortSignal;
    }) => {
      if (!approvalEnabled) {
        return true;
      }

      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        if (signal?.aborted) {
          return false;
        }

        try {
          const allowanceInfo = await fetchAllowanceResponse();
          if (signal?.aborted) {
            return false;
          }
          if (isReady(allowanceInfo.allowanceParsed || '0')) {
            return true;
          }
        } catch {
          // Keep polling until timeout. The approval tx may be indexed later.
        }

        if (attempt < maxAttempts - 1) {
          await timerUtils.wait(intervalMs);
        }
      }

      return false;
    },
    [approvalEnabled, fetchAllowanceResponse],
  );

  const pollAllowanceThen = useCallback(
    ({
      isReady,
      onReady,
    }: {
      isReady: (allowance: string) => boolean;
      onReady?: (signal: AbortSignal) => Promise<void>;
    }) => {
      const abortController = startAllowancePolling();
      void (async () => {
        try {
          const allowanceReady = await waitForAllowance({
            isReady,
            signal: abortController.signal,
          });
          if (allowanceReady && !abortController.signal.aborted) {
            await onReady?.(abortController.signal);
          }
        } finally {
          if (!abortController.signal.aborted) {
            setApprovingSafe(false);
          }
        }
      })();
    },
    [setApprovingSafe, startAllowancePolling, waitForAllowance],
  );

  const resetApproveToZero = useCallback(async () => {
    if (!approveTarget?.token) {
      setApprovingSafe(false);
      return;
    }

    try {
      const account = await backgroundApiProxy.serviceAccount.getAccount({
        accountId: approveTarget.accountId,
        networkId: approveTarget.networkId,
      });

      await navigationToTxConfirm({
        approvesInfo: [
          buildBorrowApproveInfo({
            owner: account.address,
            spenderAddress: approveTarget.spenderAddress,
            token: approveTarget.token,
            amount: '0',
            isMax: false,
          }),
        ],
        onSuccess(data) {
          const txid =
            data?.[0]?.decodedTx?.txid || data?.[0]?.signedTx?.txid || '';
          if (txid) {
            trackAllowance(txid);
          }

          pollAllowanceThen({ isReady: isBorrowAllowanceZero });
        },
        onFail() {
          stopAllowancePolling();
          setApprovingSafe(false);
        },
        onCancel() {
          stopAllowancePolling();
          setApprovingSafe(false);
        },
      });
    } catch (error) {
      stopAllowancePolling();
      setApprovingSafe(false);
      showApprovalError({ error, scope: 'resetApproveToZero' });
    }
  }, [
    approveTarget,
    navigationToTxConfirm,
    pollAllowanceThen,
    setApprovingSafe,
    showApprovalError,
    stopAllowancePolling,
    trackAllowance,
  ]);

  const showResetUSDTApproveValueDialog = useCallback(() => {
    Dialog.show({
      onConfirmText: intl.formatMessage({
        id: ETranslations.global_continue,
      }),
      showExitButton: false,
      dismissOnOverlayPress: false,
      onCancel: () => {
        setApprovingSafe(false);
      },
      onConfirm: () => {
        void resetApproveToZero();
      },
      title: intl.formatMessage({
        id: ETranslations.swap_page_provider_approve_usdt_dialog_title,
      }),
      description: intl.formatMessage({
        id: ETranslations.swap_page_provider_approve_usdt_dialog_content,
      }),
      icon: 'ErrorOutline',
    });
  }, [intl, resetApproveToZero, setApprovingSafe]);

  const submitApprovedAction = useCallback(
    async (signal?: AbortSignal) => {
      if (signal?.aborted) {
        return;
      }

      try {
        await onApprovedSubmit();
      } catch (error) {
        showApprovalError({ error, scope: 'onApprovedSubmit' });
      }
    },
    [onApprovedSubmit, showApprovalError],
  );

  const onApprove = useCallback(async () => {
    if (!approvalEnabled || !approveTarget?.token) {
      return;
    }

    Keyboard.dismiss();
    stopAllowancePolling();
    setApprovingSafe(true);

    try {
      let approveAllowance = allowance;
      try {
        const allowanceInfo = await fetchAllowanceResponse();
        approveAllowance = allowanceInfo.allowanceParsed;
      } catch {
        approveAllowance = allowance;
      }

      const approvalActionStep = resolveBorrowApprovalActionStep({
        enabled: approvalEnabled,
        amount: amountValue,
        allowance: approveAllowance || '0',
        requiresMaxApproval: action === 'repay' && repayAll,
        shouldResetUSDT: earnUtils.isUSDTonETHNetwork(approveTarget.token),
      });

      if (approvalActionStep === 'submit') {
        try {
          await submitApprovedAction();
        } finally {
          setApprovingSafe(false);
        }
        return;
      }

      if (approvalActionStep === 'resetUSDT') {
        showResetUSDTApproveValueDialog();
        return;
      }

      if (approvalActionStep !== 'approve') {
        setApprovingSafe(false);
        return;
      }

      const account = await backgroundApiProxy.serviceAccount.getAccount({
        accountId: approveTarget.accountId,
        networkId: approveTarget.networkId,
      });

      await navigationToTxConfirm({
        approvesInfo: [
          buildBorrowApproveInfo({
            owner: account.address,
            spenderAddress: approveTarget.spenderAddress,
            token: approveTarget.token,
            amount: amountValue,
            isMax: action === 'repay' && repayAll,
          }),
        ],
        onSuccess(data) {
          const txid =
            data?.[0]?.decodedTx?.txid || data?.[0]?.signedTx?.txid || '';
          if (txid) {
            trackAllowance(txid);
          }

          pollAllowanceThen({
            isReady: (nextAllowance) =>
              isBorrowAllowanceEnough({
                amount: amountValue,
                allowance: nextAllowance,
                requiresMaxApproval: action === 'repay' && repayAll,
              }),
            onReady: submitApprovedAction,
          });
        },
        onFail() {
          stopAllowancePolling();
          setApprovingSafe(false);
        },
        onCancel() {
          stopAllowancePolling();
          setApprovingSafe(false);
        },
      });
    } catch (error) {
      stopAllowancePolling();
      setApprovingSafe(false);
      showApprovalError({ error, scope: 'onApprove' });
    }
  }, [
    allowance,
    action,
    amountValue,
    approvalEnabled,
    approveTarget,
    fetchAllowanceResponse,
    navigationToTxConfirm,
    pollAllowanceThen,
    repayAll,
    setApprovingSafe,
    showApprovalError,
    showResetUSDTApproveValueDialog,
    stopAllowancePolling,
    submitApprovedAction,
    trackAllowance,
  ]);

  return {
    approveType,
    approving,
    loadingAllowance: !!loadingAllowance,
    shouldApprove,
    onApprove,
  };
}
