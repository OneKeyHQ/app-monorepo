import { useCallback, useMemo, useState } from 'react';

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

function waitForTimeout(intervalMs: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, intervalMs);
  });
}

function getBorrowApprovalSubmitErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === 'string' && error) {
    return error;
  }

  return undefined;
}

export function useBorrowApproval({
  action,
  amountValue,
  approveType,
  approveTarget,
  currentAllowance = '0',
  onApprovedSubmit,
}: {
  action: IBorrowActionType;
  amountValue: string;
  approveType?: EApproveType;
  approveTarget?: IBorrowApproveTarget;
  currentAllowance?: string;
  onApprovedSubmit: () => Promise<void>;
}): IManagePositionApproval {
  const intl = useIntl();
  const [approving, setApproving] = useState(false);
  const { navigationToTxConfirm } = useSignatureConfirm({
    accountId: approveTarget?.accountId ?? '',
    networkId: approveTarget?.networkId ?? '',
  });

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
      }),
    [allowance, amountValue, approvalEnabled],
  );

  const waitForAllowance = useCallback(
    async ({
      isReady,
      maxAttempts = 15,
      intervalMs = 2000,
    }: {
      isReady: (allowance: string) => boolean;
      maxAttempts?: number;
      intervalMs?: number;
    }) => {
      if (!approvalEnabled) {
        return true;
      }

      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        try {
          const allowanceInfo = await fetchAllowanceResponse();
          if (isReady(allowanceInfo.allowanceParsed || '0')) {
            return true;
          }
        } catch {
          // Keep polling until timeout. The approval tx may be indexed later.
        }

        if (attempt < maxAttempts - 1) {
          await waitForTimeout(intervalMs);
        }
      }

      return false;
    },
    [approvalEnabled, fetchAllowanceResponse],
  );

  const resetApproveToZero = useCallback(async () => {
    if (!approveTarget?.token) {
      setApproving(false);
      return;
    }

    try {
      const account = await backgroundApiProxy.serviceAccount.getAccount({
        accountId: approveTarget.accountId,
        networkId: approveTarget.networkId,
      });

      const approveResetInfo: IApproveInfo = {
        owner: account.address,
        spender: approveTarget.spenderAddress,
        amount: '0',
        isMax: false,
        tokenInfo: {
          ...approveTarget.token,
          isNative: !!approveTarget.token.isNative,
          name: approveTarget.token.name ?? approveTarget.token.symbol,
        },
      };

      await navigationToTxConfirm({
        approvesInfo: [approveResetInfo],
        onSuccess(data) {
          const txid =
            data?.[0]?.decodedTx?.txid || data?.[0]?.signedTx?.txid || '';
          if (txid) {
            trackAllowance(txid);
          }

          void (async () => {
            try {
              await waitForAllowance({
                isReady: isBorrowAllowanceZero,
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
    } catch {
      setApproving(false);
    }
  }, [approveTarget, navigationToTxConfirm, trackAllowance, waitForAllowance]);

  const showResetUSDTApproveValueDialog = useCallback(() => {
    Dialog.show({
      onConfirmText: intl.formatMessage({
        id: ETranslations.global_continue,
      }),
      showExitButton: false,
      dismissOnOverlayPress: false,
      onCancel: () => {
        setApproving(false);
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
  }, [intl, resetApproveToZero]);

  const submitApprovedAction = useCallback(async () => {
    try {
      await onApprovedSubmit();
    } catch (error) {
      const errorMessage = getBorrowApprovalSubmitErrorMessage(error);
      defaultLogger.app.error.log(
        `useBorrowApproval onApprovedSubmit failed: ${
          errorMessage ?? String(error)
        }`,
      );
      Toast.error({
        title:
          errorMessage ??
          intl.formatMessage({
            id: ETranslations.global_failed,
          }),
      });
    }
  }, [intl, onApprovedSubmit]);

  const onApprove = useCallback(async () => {
    if (!approvalEnabled || !approveTarget?.token) {
      return;
    }

    Keyboard.dismiss();
    setApproving(true);

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
        shouldResetUSDT: earnUtils.isUSDTonETHNetwork(approveTarget.token),
      });

      if (approvalActionStep === 'submit') {
        try {
          await submitApprovedAction();
        } finally {
          setApproving(false);
        }
        return;
      }

      if (approvalActionStep === 'resetUSDT') {
        showResetUSDTApproveValueDialog();
        return;
      }

      if (approvalActionStep !== 'approve') {
        setApproving(false);
        return;
      }

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
          const txid =
            data?.[0]?.decodedTx?.txid || data?.[0]?.signedTx?.txid || '';
          if (txid) {
            trackAllowance(txid);
          }

          void (async () => {
            try {
              const allowanceReady = await waitForAllowance({
                isReady: (nextAllowance) =>
                  isBorrowAllowanceEnough({
                    amount: amountValue,
                    allowance: nextAllowance,
                  }),
              });
              if (allowanceReady) {
                await submitApprovedAction();
              }
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
    } catch {
      setApproving(false);
    }
  }, [
    allowance,
    amountValue,
    approvalEnabled,
    approveTarget,
    fetchAllowanceResponse,
    navigationToTxConfirm,
    showResetUSDTApproveValueDialog,
    submitApprovedAction,
    trackAllowance,
    waitForAllowance,
  ]);

  return {
    approveType,
    approving,
    loadingAllowance: !!loadingAllowance,
    shouldApprove,
    onApprove,
  };
}
