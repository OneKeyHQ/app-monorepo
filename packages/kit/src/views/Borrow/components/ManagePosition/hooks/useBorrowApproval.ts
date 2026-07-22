import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

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
import type {
  EApproveType,
  IStakingInfo,
} from '@onekeyhq/shared/types/staking';

import {
  isBorrowAllowanceEnough,
  isBorrowAllowanceZero,
  isBorrowDelegationApprovalEnabled,
  isBorrowTokenApprovalEnabled,
  isBorrowTokenApprovalRequired,
  resolveBorrowApprovalActionStep,
} from '../borrowApproval.utils';

import type {
  IBorrowActionType,
  IBorrowApproveTarget,
  IBorrowDelegationApproveTarget,
  IManagePositionApproval,
} from '../types';

type IBorrowApprovalEncodedTx = NonNullable<
  Parameters<
    ReturnType<typeof useSignatureConfirm>['navigationToTxConfirm']
  >[0]['encodedTx']
>;

type IBorrowApprovalRequest = {
  scopeKey: string;
  submit: () => Promise<void>;
};

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

function parseBorrowApprovalEncodedTx(tx: string): IBorrowApprovalEncodedTx {
  try {
    const parsed = JSON.parse(tx) as unknown;
    if (parsed && typeof parsed === 'object') {
      return parsed as IBorrowApprovalEncodedTx;
    }
  } catch {
    // Ignore parsing errors and fallback to raw string
  }
  return tx;
}

export function useBorrowApproval({
  action,
  amountValue,
  repayAll,
  approveType,
  approveTarget,
  borrowDelegationApproveTarget,
  currentAllowance = '0',
  stakingInfo,
  onApprovedSubmit,
}: {
  action: IBorrowActionType;
  amountValue: string;
  repayAll?: boolean;
  approveType?: EApproveType;
  approveTarget?: IBorrowApproveTarget;
  borrowDelegationApproveTarget?: IBorrowDelegationApproveTarget;
  currentAllowance?: string;
  stakingInfo?: IStakingInfo;
  onApprovedSubmit: () => Promise<void>;
}): IManagePositionApproval {
  const intl = useIntl();
  const [approving, setApproving] = useState(false);
  const mountedRef = useRef(false);
  const allowanceAbortRef = useRef<AbortController | undefined>(undefined);
  const approvalScopeKey = JSON.stringify([
    action,
    amountValue,
    repayAll,
    approveType,
    approveTarget?.accountId,
    approveTarget?.networkId,
    approveTarget?.spenderAddress,
    approveTarget?.token?.networkId,
    approveTarget?.token?.address,
    approveTarget?.token?.decimals,
    approveTarget?.token?.isNative,
    borrowDelegationApproveTarget?.accountId,
    borrowDelegationApproveTarget?.networkId,
    borrowDelegationApproveTarget?.provider,
    borrowDelegationApproveTarget?.marketAddress,
    borrowDelegationApproveTarget?.reserveAddress,
    stakingInfo?.protocol,
    stakingInfo?.label,
    stakingInfo?.tags,
    stakingInfo?.orderId,
    stakingInfo?.send?.amount,
    stakingInfo?.send?.token.networkId,
    stakingInfo?.send?.token.address,
    stakingInfo?.send?.token.decimals,
    stakingInfo?.send?.token.isNative,
    stakingInfo?.receive?.amount,
    stakingInfo?.receive?.token.networkId,
    stakingInfo?.receive?.token.address,
    stakingInfo?.receive?.token.decimals,
    stakingInfo?.receive?.token.isNative,
  ]);
  const latestApprovalRequestRef = useRef<IBorrowApprovalRequest>({
    scopeKey: approvalScopeKey,
    submit: onApprovedSubmit,
  });
  const { navigationToTxConfirm } = useSignatureConfirm({
    accountId:
      approveTarget?.accountId ??
      borrowDelegationApproveTarget?.accountId ??
      '',
    networkId:
      approveTarget?.networkId ??
      borrowDelegationApproveTarget?.networkId ??
      '',
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

  useLayoutEffect(() => {
    const isSameRequest =
      latestApprovalRequestRef.current.scopeKey === approvalScopeKey &&
      latestApprovalRequestRef.current.submit === onApprovedSubmit;
    latestApprovalRequestRef.current = {
      scopeKey: approvalScopeKey,
      submit: onApprovedSubmit,
    };
    if (!isSameRequest) {
      stopAllowancePolling();
      setApprovingSafe(false);
    }
  }, [
    approvalScopeKey,
    onApprovedSubmit,
    setApprovingSafe,
    stopAllowancePolling,
  ]);

  const getApprovalRequest = useCallback(
    (): IBorrowApprovalRequest => ({
      scopeKey: approvalScopeKey,
      submit: onApprovedSubmit,
    }),
    [approvalScopeKey, onApprovedSubmit],
  );

  const isCurrentApprovalRequest = useCallback(
    (request: IBorrowApprovalRequest) =>
      mountedRef.current &&
      latestApprovalRequestRef.current.scopeKey === request.scopeKey &&
      latestApprovalRequestRef.current.submit === request.submit,
    [],
  );

  const finishApprovalRequest = useCallback(
    (request: IBorrowApprovalRequest) => {
      if (!isCurrentApprovalRequest(request)) {
        return false;
      }
      stopAllowancePolling();
      setApprovingSafe(false);
      return true;
    },
    [isCurrentApprovalRequest, setApprovingSafe, stopAllowancePolling],
  );

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
  const delegationApprovalEnabled = useMemo(
    () =>
      isBorrowDelegationApprovalEnabled({
        action,
        approveTarget: borrowDelegationApproveTarget,
      }),
    [action, borrowDelegationApproveTarget],
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

  const fetchTokenAllowanceParsed = useCallback(async () => {
    const allowanceInfo = await fetchAllowanceResponse();
    return allowanceInfo.allowanceParsed || '0';
  }, [fetchAllowanceResponse]);

  const fetchBorrowDelegationAllowance = useCallback(async () => {
    if (!borrowDelegationApproveTarget) {
      return '0';
    }

    const managePageData =
      await backgroundApiProxy.serviceStaking.getBorrowManagePage({
        accountId: borrowDelegationApproveTarget.accountId,
        networkId: borrowDelegationApproveTarget.networkId,
        provider: borrowDelegationApproveTarget.provider,
        marketAddress: borrowDelegationApproveTarget.marketAddress,
        reserveAddress: borrowDelegationApproveTarget.reserveAddress,
        type: 'borrow',
      });

    return managePageData.borrowAllowance ?? '0';
  }, [borrowDelegationApproveTarget]);

  const shouldApprove = useMemo(() => {
    const tokenApprovalRequired = isBorrowTokenApprovalRequired({
      enabled: approvalEnabled,
      amount: amountValue,
      allowance,
      requiresMaxApproval: action === 'repay' && repayAll,
    });
    if (tokenApprovalRequired) {
      return true;
    }

    return isBorrowTokenApprovalRequired({
      enabled: delegationApprovalEnabled,
      amount: amountValue,
      allowance: borrowDelegationApproveTarget?.allowance ?? '0',
    });
  }, [
    action,
    allowance,
    amountValue,
    approvalEnabled,
    borrowDelegationApproveTarget?.allowance,
    delegationApprovalEnabled,
    repayAll,
  ]);

  const waitForAllowance = useCallback(
    async ({
      enabled,
      isReady,
      fetchAllowance,
      maxAttempts = 15,
      intervalMs = 2000,
      signal,
    }: {
      enabled: boolean;
      isReady: (allowance: string) => boolean;
      fetchAllowance: () => Promise<string>;
      maxAttempts?: number;
      intervalMs?: number;
      signal?: AbortSignal;
    }) => {
      if (!enabled) {
        return true;
      }

      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        if (signal?.aborted) {
          return false;
        }

        try {
          const nextAllowance = await fetchAllowance();
          if (signal?.aborted) {
            return false;
          }
          if (isReady(nextAllowance)) {
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
    [],
  );

  const pollAllowanceThen = useCallback(
    ({
      request,
      enabled,
      isReady,
      fetchAllowance,
      onReady,
    }: {
      request: IBorrowApprovalRequest;
      enabled: boolean;
      isReady: (allowance: string) => boolean;
      fetchAllowance: () => Promise<string>;
      onReady?: (signal: AbortSignal) => Promise<void>;
    }) => {
      if (!isCurrentApprovalRequest(request)) {
        return;
      }
      const abortController = startAllowancePolling();
      void (async () => {
        try {
          const allowanceReady = await waitForAllowance({
            enabled,
            isReady,
            fetchAllowance,
            signal: abortController.signal,
          });
          if (
            allowanceReady &&
            !abortController.signal.aborted &&
            isCurrentApprovalRequest(request)
          ) {
            await onReady?.(abortController.signal);
          }
        } finally {
          if (!abortController.signal.aborted) {
            finishApprovalRequest(request);
          }
        }
      })();
    },
    [
      finishApprovalRequest,
      isCurrentApprovalRequest,
      startAllowancePolling,
      waitForAllowance,
    ],
  );

  const resetApproveToZero = useCallback(
    async (request: IBorrowApprovalRequest) => {
      if (!isCurrentApprovalRequest(request)) {
        return;
      }
      if (!approveTarget?.token) {
        finishApprovalRequest(request);
        return;
      }

      try {
        const account = await backgroundApiProxy.serviceAccount.getAccount({
          accountId: approveTarget.accountId,
          networkId: approveTarget.networkId,
        });
        if (!isCurrentApprovalRequest(request)) {
          return;
        }

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
          stakingInfo,
          onSuccess(data) {
            if (!isCurrentApprovalRequest(request)) {
              return;
            }
            const txid =
              data?.[0]?.decodedTx?.txid || data?.[0]?.signedTx?.txid || '';
            if (txid) {
              trackAllowance(txid);
            }

            pollAllowanceThen({
              request,
              enabled: approvalEnabled,
              fetchAllowance: fetchTokenAllowanceParsed,
              isReady: isBorrowAllowanceZero,
            });
          },
          onFail() {
            finishApprovalRequest(request);
          },
          onCancel() {
            finishApprovalRequest(request);
          },
        });
      } catch (error) {
        if (finishApprovalRequest(request)) {
          showApprovalError({ error, scope: 'resetApproveToZero' });
        }
      }
    },
    [
      approveTarget,
      approvalEnabled,
      fetchTokenAllowanceParsed,
      finishApprovalRequest,
      isCurrentApprovalRequest,
      navigationToTxConfirm,
      pollAllowanceThen,
      showApprovalError,
      stakingInfo,
      trackAllowance,
    ],
  );

  const showResetUSDTApproveValueDialog = useCallback(
    (request: IBorrowApprovalRequest) => {
      if (!isCurrentApprovalRequest(request)) {
        return;
      }
      Dialog.show({
        onConfirmText: intl.formatMessage({
          id: ETranslations.global_continue,
        }),
        showExitButton: false,
        dismissOnOverlayPress: false,
        onCancel: () => {
          finishApprovalRequest(request);
        },
        onConfirm: () => {
          if (isCurrentApprovalRequest(request)) {
            void resetApproveToZero(request);
          }
        },
        title: intl.formatMessage({
          id: ETranslations.swap_page_provider_approve_usdt_dialog_title,
        }),
        description: intl.formatMessage({
          id: ETranslations.swap_page_provider_approve_usdt_dialog_content,
        }),
        icon: 'ErrorOutline',
      });
    },
    [finishApprovalRequest, intl, isCurrentApprovalRequest, resetApproveToZero],
  );

  const submitApprovedAction = useCallback(
    async (request: IBorrowApprovalRequest, signal?: AbortSignal) => {
      if (signal?.aborted || !isCurrentApprovalRequest(request)) {
        return;
      }

      try {
        await request.submit();
      } catch (error) {
        if (isCurrentApprovalRequest(request)) {
          showApprovalError({ error, scope: 'onApprovedSubmit' });
        }
      }
    },
    [isCurrentApprovalRequest, showApprovalError],
  );

  const onApprove = useCallback(async () => {
    if (delegationApprovalEnabled && borrowDelegationApproveTarget) {
      const request = getApprovalRequest();
      if (!isCurrentApprovalRequest(request)) {
        return;
      }
      Keyboard.dismiss();
      stopAllowancePolling();
      setApprovingSafe(true);

      try {
        let approveAllowance = borrowDelegationApproveTarget.allowance;
        try {
          approveAllowance = await fetchBorrowDelegationAllowance();
        } catch (error) {
          const staleAllowanceRequiresApproval = isBorrowTokenApprovalRequired({
            enabled: delegationApprovalEnabled,
            amount: amountValue,
            allowance: approveAllowance || '0',
          });
          if (!staleAllowanceRequiresApproval) {
            throw error;
          }
        }
        if (!isCurrentApprovalRequest(request)) {
          return;
        }

        const approvalActionStep = resolveBorrowApprovalActionStep({
          enabled: delegationApprovalEnabled,
          amount: amountValue,
          allowance: approveAllowance || '0',
          shouldResetUSDT: false,
        });

        if (approvalActionStep === 'submit') {
          try {
            await submitApprovedAction(request);
          } finally {
            finishApprovalRequest(request);
          }
          return;
        }

        if (approvalActionStep !== 'approve') {
          finishApprovalRequest(request);
          return;
        }

        const resp =
          await backgroundApiProxy.serviceStaking.borrowBuildApproveDelegationTransaction(
            {
              accountId: borrowDelegationApproveTarget.accountId,
              networkId: borrowDelegationApproveTarget.networkId,
              provider: borrowDelegationApproveTarget.provider,
              marketAddress: borrowDelegationApproveTarget.marketAddress,
              reserveAddress: borrowDelegationApproveTarget.reserveAddress,
            },
          );
        if (!isCurrentApprovalRequest(request)) {
          return;
        }

        await navigationToTxConfirm({
          encodedTx: parseBorrowApprovalEncodedTx(resp.tx),
          stakingInfo,
          onSuccess() {
            if (!isCurrentApprovalRequest(request)) {
              return;
            }
            pollAllowanceThen({
              request,
              enabled: delegationApprovalEnabled,
              fetchAllowance: fetchBorrowDelegationAllowance,
              isReady: (nextAllowance) =>
                isBorrowAllowanceEnough({
                  amount: amountValue,
                  allowance: nextAllowance,
                }),
              onReady: (signal) => submitApprovedAction(request, signal),
            });
          },
          onFail() {
            finishApprovalRequest(request);
          },
          onCancel() {
            finishApprovalRequest(request);
          },
        });
      } catch (error) {
        if (finishApprovalRequest(request)) {
          showApprovalError({ error, scope: 'borrowDelegationApprove' });
        }
      }
      return;
    }

    if (!approvalEnabled || !approveTarget?.token) {
      return;
    }
    const request = getApprovalRequest();
    if (!isCurrentApprovalRequest(request)) {
      return;
    }

    Keyboard.dismiss();
    stopAllowancePolling();
    setApprovingSafe(true);

    try {
      let approveAllowance = allowance;
      try {
        approveAllowance = await fetchTokenAllowanceParsed();
      } catch (error) {
        const staleAllowanceRequiresApproval = isBorrowTokenApprovalRequired({
          enabled: approvalEnabled,
          amount: amountValue,
          allowance: approveAllowance || '0',
          requiresMaxApproval: action === 'repay' && repayAll,
        });
        if (!staleAllowanceRequiresApproval) {
          throw error;
        }
      }
      if (!isCurrentApprovalRequest(request)) {
        return;
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
          await submitApprovedAction(request);
        } finally {
          finishApprovalRequest(request);
        }
        return;
      }

      if (approvalActionStep === 'resetUSDT') {
        showResetUSDTApproveValueDialog(request);
        return;
      }

      if (approvalActionStep !== 'approve') {
        finishApprovalRequest(request);
        return;
      }

      const account = await backgroundApiProxy.serviceAccount.getAccount({
        accountId: approveTarget.accountId,
        networkId: approveTarget.networkId,
      });
      if (!isCurrentApprovalRequest(request)) {
        return;
      }

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
        stakingInfo,
        onSuccess(data) {
          if (!isCurrentApprovalRequest(request)) {
            return;
          }
          const txid =
            data?.[0]?.decodedTx?.txid || data?.[0]?.signedTx?.txid || '';
          if (txid) {
            trackAllowance(txid);
          }

          pollAllowanceThen({
            request,
            enabled: approvalEnabled,
            fetchAllowance: fetchTokenAllowanceParsed,
            isReady: (nextAllowance) =>
              isBorrowAllowanceEnough({
                amount: amountValue,
                allowance: nextAllowance,
                requiresMaxApproval: action === 'repay' && repayAll,
              }),
            onReady: (signal) => submitApprovedAction(request, signal),
          });
        },
        onFail() {
          finishApprovalRequest(request);
        },
        onCancel() {
          finishApprovalRequest(request);
        },
      });
    } catch (error) {
      if (finishApprovalRequest(request)) {
        showApprovalError({ error, scope: 'onApprove' });
      }
    }
  }, [
    allowance,
    action,
    amountValue,
    approvalEnabled,
    approveTarget,
    borrowDelegationApproveTarget,
    delegationApprovalEnabled,
    fetchBorrowDelegationAllowance,
    fetchTokenAllowanceParsed,
    finishApprovalRequest,
    getApprovalRequest,
    isCurrentApprovalRequest,
    navigationToTxConfirm,
    pollAllowanceThen,
    repayAll,
    setApprovingSafe,
    showApprovalError,
    showResetUSDTApproveValueDialog,
    stakingInfo,
    stopAllowancePolling,
    submitApprovedAction,
    trackAllowance,
  ]);

  const ensureReadyToSubmit = useCallback(async () => {
    const request = getApprovalRequest();
    if (!isCurrentApprovalRequest(request)) {
      return false;
    }
    try {
      if (approvalEnabled) {
        const approveAllowance = await fetchTokenAllowanceParsed();
        if (!isCurrentApprovalRequest(request)) {
          return false;
        }
        const approvalActionStep = resolveBorrowApprovalActionStep({
          enabled: approvalEnabled,
          amount: amountValue,
          allowance: approveAllowance || '0',
          requiresMaxApproval: action === 'repay' && repayAll,
          shouldResetUSDT: approveTarget?.token
            ? earnUtils.isUSDTonETHNetwork(approveTarget.token)
            : false,
        });

        if (approvalActionStep === 'submit') {
          return isCurrentApprovalRequest(request);
        }

        if (!isCurrentApprovalRequest(request)) {
          return false;
        }
        await onApprove();
        return false;
      }

      if (delegationApprovalEnabled && borrowDelegationApproveTarget) {
        const approveAllowance = await fetchBorrowDelegationAllowance();
        if (!isCurrentApprovalRequest(request)) {
          return false;
        }
        const approvalActionStep = resolveBorrowApprovalActionStep({
          enabled: delegationApprovalEnabled,
          amount: amountValue,
          allowance: approveAllowance || '0',
          shouldResetUSDT: false,
        });

        if (approvalActionStep === 'submit') {
          return isCurrentApprovalRequest(request);
        }

        if (!isCurrentApprovalRequest(request)) {
          return false;
        }
        await onApprove();
        return false;
      }

      return isCurrentApprovalRequest(request);
    } catch (error) {
      if (isCurrentApprovalRequest(request)) {
        showApprovalError({ error, scope: 'ensureReadyToSubmit' });
      }
      return false;
    }
  }, [
    action,
    amountValue,
    approvalEnabled,
    approveTarget?.token,
    borrowDelegationApproveTarget,
    delegationApprovalEnabled,
    fetchBorrowDelegationAllowance,
    fetchTokenAllowanceParsed,
    getApprovalRequest,
    isCurrentApprovalRequest,
    onApprove,
    repayAll,
    showApprovalError,
  ]);

  return {
    approveType,
    approving,
    loadingAllowance: !!loadingAllowance,
    shouldApprove,
    ensureReadyToSubmit,
    onApprove,
  };
}
