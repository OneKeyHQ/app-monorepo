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
  resolveBorrowApprovalType,
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

type IBorrowAllowancePollingResult = 'ready' | 'aborted' | 'timedOut';
/**
 * `continue` means the ready-handler has taken the request over (it opened the
 * next confirm screen), so the polling wrapper must leave it in flight rather
 * than finish it. `void` so a handler that just does its work can stay
 * return-less.
 */
type IBorrowAllowanceReadyResult = 'continue' | void;

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
  withdrawAll,
  approveType,
  approveTarget,
  borrowDelegationApproveTarget,
  currentAllowance = '0',
  stakingInfo,
  onApprovedSubmit,
  onBeforeNavigateConfirm,
  allowApprovalContinuationAfterUnmount = false,
}: {
  action: IBorrowActionType;
  amountValue: string;
  repayAll?: boolean;
  withdrawAll?: boolean;
  approveType?: EApproveType;
  approveTarget?: IBorrowApproveTarget;
  borrowDelegationApproveTarget?: IBorrowDelegationApproveTarget;
  currentAllowance?: string;
  stakingInfo?: IStakingInfo;
  onApprovedSubmit: () => Promise<void>;
  // Runs right before any approval confirm screen opens, so modal hosts (the
  // DeFi portfolio dialog) can dismiss themselves instead of stacking under it.
  onBeforeNavigateConfirm?: () => void | Promise<void>;
  // Opt-in for modal hosts that intentionally unmount in
  // onBeforeNavigateConfirm. The request is detached only at that boundary;
  // arbitrary earlier unmounts and stale scopes still abort.
  allowApprovalContinuationAfterUnmount?: boolean;
}): IManagePositionApproval {
  const intl = useIntl();
  const effectiveApproveType = resolveBorrowApprovalType(approveType);
  // repay-all builds Pool.repay(MaxUint) and withdraw-all (native gateway)
  // builds withdrawETH(MaxUint): both pull the LIVE debt/aToken balance at
  // execution, which accrues past any exact snapshot approved moments earlier,
  // so these flows must hold an effectively-unlimited allowance.
  const requiresMaxApproval =
    (action === 'repay' && !!repayAll) ||
    (action === 'withdraw' && !!withdrawAll);
  const [approving, setApproving] = useState(false);
  const mountedRef = useRef(false);
  const allowanceAbortRef = useRef<AbortController | undefined>(undefined);
  const approvalInFlightRef = useRef(false);
  const detachedApprovalRequestRef = useRef<IBorrowApprovalRequest | undefined>(
    undefined,
  );
  const approvalScopeKey = JSON.stringify([
    action,
    amountValue,
    repayAll,
    withdrawAll,
    effectiveApproveType,
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
    allowApprovalContinuationAfterUnmount,
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
      const detachedRequest = detachedApprovalRequestRef.current;
      const shouldContinueDetachedRequest =
        detachedRequest !== undefined &&
        latestApprovalRequestRef.current.scopeKey ===
          detachedRequest.scopeKey &&
        latestApprovalRequestRef.current.submit === detachedRequest.submit;
      if (!shouldContinueDetachedRequest) {
        detachedApprovalRequestRef.current = undefined;
        approvalInFlightRef.current = false;
        allowanceAbortRef.current?.abort();
        allowanceAbortRef.current = undefined;
      }
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
      detachedApprovalRequestRef.current = undefined;
      approvalInFlightRef.current = false;
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
      (mountedRef.current || detachedApprovalRequestRef.current === request) &&
      latestApprovalRequestRef.current.scopeKey === request.scopeKey &&
      latestApprovalRequestRef.current.submit === request.submit,
    [],
  );

  // Only ever clears this request's own detachment; a later request that has
  // since taken the slot must keep it.
  const clearDetachedApprovalRequest = useCallback(
    (request: IBorrowApprovalRequest) => {
      if (detachedApprovalRequestRef.current === request) {
        detachedApprovalRequestRef.current = undefined;
      }
    },
    [],
  );

  const finishApprovalRequest = useCallback(
    (request: IBorrowApprovalRequest) => {
      if (!isCurrentApprovalRequest(request)) {
        return false;
      }
      clearDetachedApprovalRequest(request);
      approvalInFlightRef.current = false;
      stopAllowancePolling();
      setApprovingSafe(false);
      return true;
    },
    [
      clearDetachedApprovalRequest,
      isCurrentApprovalRequest,
      setApprovingSafe,
      stopAllowancePolling,
    ],
  );

  const beginApprovalRequest = useCallback(
    (request: IBorrowApprovalRequest) => {
      if (approvalInFlightRef.current || !isCurrentApprovalRequest(request)) {
        return false;
      }
      approvalInFlightRef.current = true;
      return true;
    },
    [isCurrentApprovalRequest],
  );

  const prepareApprovalConfirmNavigation = useCallback(
    async (request: IBorrowApprovalRequest) => {
      if (!isCurrentApprovalRequest(request)) {
        return false;
      }
      const shouldDetach =
        allowApprovalContinuationAfterUnmount &&
        onBeforeNavigateConfirm !== undefined;
      if (shouldDetach) {
        detachedApprovalRequestRef.current = request;
      }
      try {
        await onBeforeNavigateConfirm?.();
      } catch (error) {
        clearDetachedApprovalRequest(request);
        throw error;
      }
      if (!isCurrentApprovalRequest(request)) {
        clearDetachedApprovalRequest(request);
        return false;
      }
      return true;
    },
    [
      allowApprovalContinuationAfterUnmount,
      clearDetachedApprovalRequest,
      isCurrentApprovalRequest,
      onBeforeNavigateConfirm,
    ],
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

  const showAllowancePollingTimeout = useCallback(() => {
    Toast.warning({
      title: intl.formatMessage({
        id: ETranslations.swap_page_toast_approve_failed,
      }),
      message: intl.formatMessage({
        id: ETranslations.global_try_again,
      }),
    });
  }, [intl]);

  const approvalEnabled = useMemo(
    () =>
      isBorrowTokenApprovalEnabled({
        action,
        approveType: effectiveApproveType,
        approveTarget,
      }),
    [action, approveTarget, effectiveApproveType],
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
    approveType: effectiveApproveType,
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
      requiresMaxApproval,
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
    allowance,
    amountValue,
    approvalEnabled,
    borrowDelegationApproveTarget?.allowance,
    delegationApprovalEnabled,
    requiresMaxApproval,
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
    }): Promise<IBorrowAllowancePollingResult> => {
      if (!enabled) {
        return 'ready';
      }

      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        if (signal?.aborted) {
          return 'aborted';
        }

        try {
          const nextAllowance = await fetchAllowance();
          if (signal?.aborted) {
            return 'aborted';
          }
          if (isReady(nextAllowance)) {
            return 'ready';
          }
        } catch {
          // Keep polling until timeout. The approval tx may be indexed later.
        }

        if (signal?.aborted) {
          return 'aborted';
        }

        if (attempt < maxAttempts - 1) {
          await timerUtils.wait(intervalMs);
        }
      }

      return 'timedOut';
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
      onReady?: (signal: AbortSignal) => Promise<IBorrowAllowanceReadyResult>;
    }) => {
      if (!isCurrentApprovalRequest(request)) {
        return;
      }
      const abortController = startAllowancePolling();
      void (async () => {
        let shouldContinueRequest = false;
        try {
          const pollingResult = await waitForAllowance({
            enabled,
            isReady,
            fetchAllowance,
            signal: abortController.signal,
          });
          if (
            pollingResult === 'aborted' ||
            abortController.signal.aborted ||
            !isCurrentApprovalRequest(request)
          ) {
            return;
          }
          if (pollingResult === 'timedOut') {
            showAllowancePollingTimeout();
            return;
          }
          shouldContinueRequest =
            (await onReady?.(abortController.signal)) === 'continue';
        } finally {
          if (!abortController.signal.aborted && !shouldContinueRequest) {
            finishApprovalRequest(request);
          }
        }
      })();
    },
    [
      finishApprovalRequest,
      isCurrentApprovalRequest,
      showAllowancePollingTimeout,
      startAllowancePolling,
      waitForAllowance,
    ],
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

  const navigateToTokenApproval = useCallback(
    async (request: IBorrowApprovalRequest) => {
      if (!approveTarget?.token || !isCurrentApprovalRequest(request)) {
        finishApprovalRequest(request);
        return false;
      }
      try {
        const account = await backgroundApiProxy.serviceAccount.getAccount({
          accountId: approveTarget.accountId,
          networkId: approveTarget.networkId,
        });
        if (!isCurrentApprovalRequest(request)) {
          return false;
        }
        if (!(await prepareApprovalConfirmNavigation(request))) {
          return false;
        }
        await navigationToTxConfirm({
          approvesInfo: [
            buildBorrowApproveInfo({
              owner: account.address,
              spenderAddress: approveTarget.spenderAddress,
              token: approveTarget.token,
              amount: amountValue,
              isMax: requiresMaxApproval,
            }),
          ],
          stakingInfo,
          onSuccess(data) {
            if (!isCurrentApprovalRequest(request)) {
              return;
            }
            const txid =
              data?.[0]?.decodedTx?.txid || data?.[0]?.signedTx?.txid || '';
            if (txid && mountedRef.current) {
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
                  requiresMaxApproval,
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
        return true;
      } catch (error) {
        if (finishApprovalRequest(request)) {
          showApprovalError({ error, scope: 'onApprove' });
        }
        return false;
      }
    },
    [
      amountValue,
      approvalEnabled,
      approveTarget,
      fetchTokenAllowanceParsed,
      finishApprovalRequest,
      isCurrentApprovalRequest,
      navigationToTxConfirm,
      pollAllowanceThen,
      prepareApprovalConfirmNavigation,
      requiresMaxApproval,
      showApprovalError,
      stakingInfo,
      submitApprovedAction,
      trackAllowance,
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

        if (!(await prepareApprovalConfirmNavigation(request))) {
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
            if (txid && mountedRef.current) {
              trackAllowance(txid);
            }

            pollAllowanceThen({
              request,
              enabled: approvalEnabled,
              fetchAllowance: fetchTokenAllowanceParsed,
              isReady: isBorrowAllowanceZero,
              onReady: allowApprovalContinuationAfterUnmount
                ? async () =>
                    (await navigateToTokenApproval(request))
                      ? 'continue'
                      : undefined
                : undefined,
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
      allowApprovalContinuationAfterUnmount,
      approveTarget,
      approvalEnabled,
      fetchTokenAllowanceParsed,
      finishApprovalRequest,
      isCurrentApprovalRequest,
      navigateToTokenApproval,
      navigationToTxConfirm,
      pollAllowanceThen,
      prepareApprovalConfirmNavigation,
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

  const onApprove = useCallback(async () => {
    if (delegationApprovalEnabled && borrowDelegationApproveTarget) {
      const request = getApprovalRequest();
      if (!beginApprovalRequest(request)) {
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

        if (!(await prepareApprovalConfirmNavigation(request))) {
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
    if (!beginApprovalRequest(request)) {
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
          requiresMaxApproval,
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
        requiresMaxApproval,
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

      await navigateToTokenApproval(request);
    } catch (error) {
      if (finishApprovalRequest(request)) {
        showApprovalError({ error, scope: 'onApprove' });
      }
    }
  }, [
    allowance,
    amountValue,
    approvalEnabled,
    approveTarget,
    beginApprovalRequest,
    borrowDelegationApproveTarget,
    delegationApprovalEnabled,
    fetchBorrowDelegationAllowance,
    fetchTokenAllowanceParsed,
    finishApprovalRequest,
    getApprovalRequest,
    isCurrentApprovalRequest,
    navigationToTxConfirm,
    navigateToTokenApproval,
    pollAllowanceThen,
    prepareApprovalConfirmNavigation,
    requiresMaxApproval,
    setApprovingSafe,
    showApprovalError,
    showResetUSDTApproveValueDialog,
    stakingInfo,
    stopAllowancePolling,
    submitApprovedAction,
  ]);

  const ensureReadyToSubmit = useCallback(async () => {
    const request = getApprovalRequest();
    if (!isCurrentApprovalRequest(request)) {
      return false;
    }
    if (shouldApprove) {
      await onApprove();
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
          requiresMaxApproval,
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
    requiresMaxApproval,
    shouldApprove,
    showApprovalError,
  ]);

  return {
    approveType: effectiveApproveType,
    approving,
    loadingAllowance: !!loadingAllowance,
    shouldApprove,
    ensureReadyToSubmit,
    onApprove,
  };
}
