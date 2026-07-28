import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { Keyboard } from 'react-native';

import { Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useRouteIsFocused as useIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import { useSignatureConfirm } from '@onekeyhq/kit/src/hooks/useSignatureConfirm';
import { useTrackTokenAllowance } from '@onekeyhq/kit/src/views/Staking/hooks/useUtilsHooks';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EApproveType } from '@onekeyhq/shared/types/staking';

import type { IManagePositionProps } from '../types';

export function useBorrowApproveAndSubmit({
  approveTarget,
  currentAllowance,
  amountValue,
  onSubmit,
  onBeforeNavigateConfirm,
}: {
  approveTarget?: IManagePositionProps['approveTarget'];
  currentAllowance?: string;
  amountValue: string;
  onSubmit: () => Promise<void>;
  onBeforeNavigateConfirm?: () => void | Promise<void>;
}): {
  needsApproval: boolean;
  approveLoading: boolean;
  onApprove: () => Promise<void>;
} {
  const intl = useIntl();

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
    initialValue: currentAllowance ?? '0',
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
  const approveSnapshotKey = useMemo(
    () =>
      [
        approveTarget?.accountId ?? '',
        approveTarget?.networkId ?? '',
        approveTarget?.spenderAddress ?? '',
        approveTarget?.token?.networkId ?? '',
        approveTarget?.token?.address ?? '',
        approveTarget?.token?.isNative ? 'native' : 'token',
        approveTarget?.token?.decimals ?? '',
        amountValue,
      ].join('|'),
    [
      amountValue,
      approveTarget?.accountId,
      approveTarget?.networkId,
      approveTarget?.spenderAddress,
      approveTarget?.token?.address,
      approveTarget?.token?.decimals,
      approveTarget?.token?.isNative,
      approveTarget?.token?.networkId,
    ],
  );
  const latestApproveRequestRef = useRef({
    snapshotKey: approveSnapshotKey,
    onSubmit,
  });

  useEffect(() => {
    const isSameRequest =
      latestApproveRequestRef.current.snapshotKey === approveSnapshotKey &&
      latestApproveRequestRef.current.onSubmit === onSubmit;
    latestApproveRequestRef.current = {
      snapshotKey: approveSnapshotKey,
      onSubmit,
    };
    if (!isSameRequest) {
      allowanceAbortRef.current?.abort();
      allowanceAbortRef.current = undefined;
      setApproving(false);
    }
  }, [approveSnapshotKey, onSubmit]);

  const isCurrentApproveRequest = useCallback(
    ({
      snapshotKey,
      submit,
    }: {
      snapshotKey: string;
      submit: () => Promise<void>;
    }) =>
      latestApproveRequestRef.current.snapshotKey === snapshotKey &&
      latestApproveRequestRef.current.onSubmit === submit,
    [],
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
          const shouldContinue = await new Promise<boolean>((resolve) => {
            if (signal?.aborted) {
              resolve(false);
              return;
            }
            const timerRef: {
              current?: ReturnType<typeof setTimeout>;
            } = {};
            const handleAbort = () => {
              if (timerRef.current) {
                clearTimeout(timerRef.current);
              }
              resolve(false);
            };
            timerRef.current = setTimeout(() => {
              signal?.removeEventListener('abort', handleAbort);
              resolve(true);
            }, intervalMs);
            signal?.addEventListener('abort', handleAbort, { once: true });
          });
          if (!shouldContinue) {
            return false;
          }
        }
      }
      return false;
    },
    [fetchAllowanceResponse, useApprove],
  );

  const onApprove = useCallback(async () => {
    if (!approveTarget?.token || !amountValue) return;
    const requestSnapshotKey = approveSnapshotKey;
    const requestOnSubmit = onSubmit;
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
      if (
        isCurrentApproveRequest({
          snapshotKey: requestSnapshotKey,
          submit: requestOnSubmit,
        })
      ) {
        await requestOnSubmit();
      }
      return;
    }

    try {
      const account = await backgroundApiProxy.serviceAccount.getAccount({
        accountId: approveTarget.accountId,
        networkId: approveTarget.networkId,
      });

      await onBeforeNavigateConfirm?.();
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
          if (
            !isCurrentApproveRequest({
              snapshotKey: requestSnapshotKey,
              submit: requestOnSubmit,
            })
          ) {
            setApproving(false);
            return;
          }
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
              if (abortController.signal.aborted) {
                return;
              }
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
              if (
                !isCurrentApproveRequest({
                  snapshotKey: requestSnapshotKey,
                  submit: requestOnSubmit,
                })
              ) {
                return;
              }
              await requestOnSubmit();
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
    approveSnapshotKey,
    approveTarget,
    fetchAllowanceResponse,
    intl,
    isCurrentApproveRequest,
    navigationToTxConfirm,
    onBeforeNavigateConfirm,
    onSubmit,
    trackAllowance,
    waitForAllowanceAfterApprove,
  ]);

  return {
    needsApproval,
    approveLoading: loadingAllowance || approving,
    onApprove,
  };
}
