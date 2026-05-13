import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { Keyboard } from 'react-native';

import { Dialog } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useSignatureConfirm } from '@onekeyhq/kit/src/hooks/useSignatureConfirm';
import { useTrackTokenAllowance } from '@onekeyhq/kit/src/views/Staking/hooks/useUtilsHooks';
import type { IApproveInfo } from '@onekeyhq/kit-bg/src/vaults/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import type { EApproveType } from '@onekeyhq/shared/types/staking';

import {
  isBorrowTokenApprovalEnabled,
  isBorrowTokenApprovalRequired,
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
  const allowanceAbortRef = useRef<AbortController | null>(null);
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
      if (!approvalEnabled || !requiredAmount) {
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
      onSuccess() {
        setApproving(false);
      },
      onFail() {
        setApproving(false);
      },
      onCancel() {
        setApproving(false);
      },
    });
  }, [approveTarget, navigationToTxConfirm]);

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

  const onApprove = useCallback(async () => {
    if (!approvalEnabled || !approveTarget?.token) {
      return;
    }

    Keyboard.dismiss();
    setApproving(true);

    let approveAllowance = allowance;
    try {
      const allowanceInfo = await fetchAllowanceResponse();
      approveAllowance = allowanceInfo.allowanceParsed;
    } catch {
      approveAllowance = allowance;
    }

    const allowanceBN = new BigNumber(approveAllowance || '0');
    const amountBN = new BigNumber(amountValue || '0');

    if (
      earnUtils.isUSDTonETHNetwork(approveTarget.token) &&
      allowanceBN.gt(0) &&
      amountBN.gt(allowanceBN)
    ) {
      showResetUSDTApproveValueDialog();
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

        allowanceAbortRef.current?.abort();
        const abortController = new AbortController();
        allowanceAbortRef.current = abortController;
        void (async () => {
          try {
            const allowanceReady = await waitForAllowanceAfterApprove({
              requiredAmount: amountValue,
              signal: abortController.signal,
            });
            if (allowanceReady) {
              await onApprovedSubmit();
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
  }, [
    allowance,
    amountValue,
    approvalEnabled,
    approveTarget,
    fetchAllowanceResponse,
    navigationToTxConfirm,
    onApprovedSubmit,
    showResetUSDTApproveValueDialog,
    trackAllowance,
    waitForAllowanceAfterApprove,
  ]);

  return {
    approveType,
    approving,
    loadingAllowance: !!loadingAllowance,
    shouldApprove,
    onApprove,
  };
}
