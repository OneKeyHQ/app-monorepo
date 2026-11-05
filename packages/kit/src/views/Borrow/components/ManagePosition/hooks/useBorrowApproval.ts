import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

import { useIntl } from 'react-intl';
import { Keyboard } from 'react-native';

import { Dialog, Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useSignatureConfirm } from '@onekeyhq/kit/src/hooks/useSignatureConfirm';
import { waitForTxFinalStatus } from '@onekeyhq/kit/src/utils/waitForTxFinalStatus';
import { borrowApprovalTaskRegistry } from '@onekeyhq/kit/src/views/Borrow/hooks/borrowApprovalTaskRegistry';
import type { IBorrowApprovalScope } from '@onekeyhq/kit/src/views/Borrow/hooks/borrowApprovalTaskRegistry';
import { createBorrowApprovalWorkflow } from '@onekeyhq/kit/src/views/Borrow/hooks/borrowApprovalWorkflow';
import type {
  IBorrowWorkflowHandoff,
  IBorrowWorkflowTransactionStep,
} from '@onekeyhq/kit/src/views/Borrow/hooks/borrowConfirmationTask';
import { createEarnConfirmationTaskAdapter } from '@onekeyhq/kit/src/views/Earn/tasks/confirmationTaskAdapter';
import type { IEarnTaskScope } from '@onekeyhq/kit/src/views/Earn/tasks/earnTaskPlan';
import {
  getTaskAccountAddress,
  isTaskAccountAddress,
  isTaskAccountCurrent,
  normalizeTaskAccountAddress,
} from '@onekeyhq/kit/src/views/Earn/tasks/taskAccount';
import { useEarnRiskWarningGate } from '@onekeyhq/kit/src/views/Staking/components/EarnRiskWarningDialog';
import { useTrackTokenAllowance } from '@onekeyhq/kit/src/views/Staking/hooks/useUtilsHooks';
import type { IApproveInfo } from '@onekeyhq/kit-bg/src/vaults/types';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import { EOnChainHistoryTxStatus } from '@onekeyhq/shared/types/history';
import type {
  EApproveType,
  IStakingInfo,
} from '@onekeyhq/shared/types/staking';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';

import {
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

type IBorrowApprovalTaskConfirmation<T> = ReturnType<
  typeof createEarnConfirmationTaskAdapter<
    IEarnTaskScope & { action: string },
    IBorrowWorkflowTransactionStep,
    T,
    ISendTxOnSuccessData[],
    Error
  >
>;

type IBorrowApprovalRequest = {
  scopeKey: string;
  submit: (
    accountAddress?: string,
    workflowHandoff?: IBorrowWorkflowHandoff,
  ) => Promise<void>;
  accountAddress?: string;
  accountId?: string;
  networkId?: string;
};

type IBorrowApprovalPhase = 'idle' | 'preparing' | 'confirming' | 'settling';

/**
 * `continue` means the success-handler has taken the request over (it opened
 * the next confirm screen), so settlement must leave it in flight rather than
 * finish it. `void` lets a handler that just does its work stay return-less.
 */
type IBorrowApprovalSettlementResult = 'continue' | void;

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

function getBorrowApprovalTxid(
  data: ISendTxOnSuccessData[] | undefined,
): string {
  if (!Array.isArray(data)) {
    return '';
  }
  for (let index = data.length - 1; index >= 0; index -= 1) {
    const txid = data[index]?.signedTx?.txid || data[index]?.decodedTx?.txid;
    if (txid) {
      return txid;
    }
  }
  return '';
}

export function useBorrowApproval({
  action,
  providerName,
  amountValue,
  repayAll,
  withdrawAll,
  approveType,
  approveTarget,
  borrowDelegationApproveTarget,
  currentAllowance = '0',
  refreshAllowanceOnMount = false,
  stakingInfo,
  onApprovedSubmit,
  onApprovedTaskSubmit,
  onBeforeNavigateConfirm,
  allowApprovalContinuationAfterUnmount = false,
  accountAddress,
}: {
  action: IBorrowActionType;
  // Only used to label the risk-disclaimer analytics; the approve target itself
  // carries no provider.
  providerName?: string;
  amountValue: string;
  repayAll?: boolean;
  withdrawAll?: boolean;
  approveType?: EApproveType;
  approveTarget?: IBorrowApproveTarget;
  borrowDelegationApproveTarget?: IBorrowDelegationApproveTarget;
  currentAllowance?: string;
  /** Reconcile a seeded allowance with the latest chain value on mount. */
  refreshAllowanceOnMount?: boolean;
  stakingInfo?: IStakingInfo;
  onApprovedSubmit: (
    accountAddress?: string,
    workflowHandoff?: IBorrowWorkflowHandoff,
  ) => Promise<void>;
  onApprovedTaskSubmit?: (
    accountAddress: string,
    workflowHandoff: IBorrowWorkflowHandoff,
  ) => Promise<void>;
  accountAddress?: string;
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
  const [approvalPhase, setApprovalPhase] =
    useState<IBorrowApprovalPhase>('idle');
  const [approvalTask, setApprovalTask] = useState<
    ReturnType<typeof createBorrowApprovalWorkflow<unknown>> | undefined
  >(undefined);
  const approvalPhaseRef = useRef<IBorrowApprovalPhase>('idle');
  const [approvalProgressScopeKey, setApprovalProgressScopeKey] = useState<
    string | undefined
  >(undefined);
  const mountedRef = useRef(false);
  const subscribeApprovalTask = useCallback(
    (listener: () => void) => approvalTask?.subscribe(listener) ?? (() => {}),
    [approvalTask],
  );
  const getApprovalTaskSnapshot = useCallback(
    () => approvalTask?.getTask(),
    [approvalTask],
  );
  const taskSnapshot = useSyncExternalStore(
    subscribeApprovalTask,
    getApprovalTaskSnapshot,
    getApprovalTaskSnapshot,
  );
  const approvalSettlementAbortRef = useRef<AbortController | undefined>(
    undefined,
  );
  const approvalInFlightRef = useRef(false);
  const detachedApprovalRequestRef = useRef<IBorrowApprovalRequest | undefined>(
    undefined,
  );
  const activeApprovalRequestRef = useRef<IBorrowApprovalRequest | undefined>(
    undefined,
  );
  const pausedApprovalRef = useRef<
    | {
        request: IBorrowApprovalRequest;
        resume: () => boolean;
        cancel: () => void;
      }
    | undefined
  >(undefined);
  const approvalScopeKey = JSON.stringify([
    action,
    amountValue,
    repayAll,
    withdrawAll,
    effectiveApproveType,
    approveTarget?.accountId,
    approveTarget?.networkId,
    accountAddress
      ? normalizeTaskAccountAddress(
          approveTarget?.networkId ??
            borrowDelegationApproveTarget?.networkId ??
            '',
          accountAddress,
        )
      : undefined,
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
  const ensureRiskAccepted = useEarnRiskWarningGate();
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

  const setApprovalPhaseSafe = useCallback((phase: IBorrowApprovalPhase) => {
    approvalPhaseRef.current = phase;
    if (mountedRef.current) {
      setApprovalPhase(phase);
    }
  }, []);

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
        pausedApprovalRef.current?.cancel();
        pausedApprovalRef.current = undefined;
        detachedApprovalRequestRef.current = undefined;
        activeApprovalRequestRef.current = undefined;
        approvalInFlightRef.current = false;
        approvalPhaseRef.current = 'idle';
        approvalSettlementAbortRef.current?.abort();
        approvalSettlementAbortRef.current = undefined;
      }
    };
  }, []);

  const stopApprovalSettlement = useCallback(() => {
    approvalSettlementAbortRef.current?.abort();
    approvalSettlementAbortRef.current = undefined;
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
      pausedApprovalRef.current?.cancel();
      pausedApprovalRef.current = undefined;
      detachedApprovalRequestRef.current = undefined;
      activeApprovalRequestRef.current = undefined;
      approvalInFlightRef.current = false;
      setApprovalProgressScopeKey(undefined);
      setApprovalTask(undefined);
      stopApprovalSettlement();
      setApprovalPhaseSafe('idle');
    }
  }, [
    approvalScopeKey,
    onApprovedSubmit,
    setApprovalPhaseSafe,
    stopApprovalSettlement,
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

  const isActiveApprovalRequest = useCallback(
    (request: IBorrowApprovalRequest) =>
      activeApprovalRequestRef.current === request &&
      isCurrentApprovalRequest(request),
    [isCurrentApprovalRequest],
  );

  const bindApprovalAccount = useCallback(
    async (
      request: IBorrowApprovalRequest,
      accountId: string,
      networkId: string,
    ) => {
      const resolved = await getTaskAccountAddress({ accountId, networkId });
      if (!isActiveApprovalRequest(request)) return false;
      if (
        accountAddress &&
        !isTaskAccountAddress({ accountAddress, networkId }, resolved)
      ) {
        throw new OneKeyLocalError('Borrow approval account changed');
      }
      request.accountId = accountId;
      request.networkId = networkId;
      request.accountAddress = accountAddress ?? resolved;
      return true;
    },
    [accountAddress, isActiveApprovalRequest],
  );

  const verifyApprovalAccount = useCallback(
    async (request: IBorrowApprovalRequest) => {
      if (
        !isActiveApprovalRequest(request) ||
        !request.accountId ||
        !request.networkId ||
        !request.accountAddress
      ) {
        throw new OneKeyLocalError('Borrow approval account changed');
      }
      const current = await isTaskAccountCurrent({
        accountId: request.accountId,
        networkId: request.networkId,
        accountAddress: request.accountAddress,
      });
      if (!current || !isActiveApprovalRequest(request)) {
        throw new OneKeyLocalError('Borrow approval account changed');
      }
    },
    [isActiveApprovalRequest],
  );

  const getApprovalTaskScope = useCallback(
    (address: string): IBorrowApprovalScope | undefined => {
      if (action === 'borrow' && borrowDelegationApproveTarget)
        return {
          accountId: borrowDelegationApproveTarget.accountId,
          networkId: borrowDelegationApproveTarget.networkId,
          accountAddress: address,
          kind: 'delegation',
          target: borrowDelegationApproveTarget.marketAddress,
          asset: borrowDelegationApproveTarget.reserveAddress,
        };
      if (approveTarget?.token)
        return {
          accountId: approveTarget.accountId,
          networkId: approveTarget.networkId,
          accountAddress: address,
          kind: 'token',
          target: approveTarget.spenderAddress,
          asset: approveTarget.token.address,
        };
      return undefined;
    },
    [action, approveTarget, borrowDelegationApproveTarget],
  );

  const transitionApprovalPhase = useCallback(
    (
      request: IBorrowApprovalRequest,
      from: IBorrowApprovalPhase,
      to: IBorrowApprovalPhase,
    ) => {
      if (
        !isActiveApprovalRequest(request) ||
        approvalPhaseRef.current !== from
      ) {
        return false;
      }
      setApprovalPhaseSafe(to);
      return true;
    },
    [isActiveApprovalRequest, setApprovalPhaseSafe],
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
      if (!isActiveApprovalRequest(request)) {
        return false;
      }
      clearDetachedApprovalRequest(request);
      activeApprovalRequestRef.current = undefined;
      approvalInFlightRef.current = false;
      stopApprovalSettlement();
      setApprovalPhaseSafe('idle');
      if (mountedRef.current) setApprovalTask(undefined);
      return true;
    },
    [
      clearDetachedApprovalRequest,
      isActiveApprovalRequest,
      setApprovalPhaseSafe,
      stopApprovalSettlement,
    ],
  );

  const beginApprovalRequest = useCallback(
    (request: IBorrowApprovalRequest) => {
      if (approvalInFlightRef.current || !isCurrentApprovalRequest(request)) {
        return false;
      }
      activeApprovalRequestRef.current = request;
      approvalInFlightRef.current = true;
      setApprovalProgressScopeKey(request.scopeKey);
      setApprovalPhaseSafe('preparing');
      return true;
    },
    [isCurrentApprovalRequest, setApprovalPhaseSafe],
  );

  const prepareApprovalConfirmNavigation = useCallback(
    async (request: IBorrowApprovalRequest, taskPreparing = false) => {
      if (!isActiveApprovalRequest(request)) {
        return false;
      }
      if (!taskPreparing && approvalPhaseRef.current === 'settling') {
        transitionApprovalPhase(request, 'settling', 'preparing');
      }
      if (!taskPreparing && approvalPhaseRef.current !== 'preparing') {
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
      if (!isActiveApprovalRequest(request)) {
        clearDetachedApprovalRequest(request);
        return false;
      }
      return true;
    },
    [
      allowApprovalContinuationAfterUnmount,
      clearDetachedApprovalRequest,
      isActiveApprovalRequest,
      onBeforeNavigateConfirm,
      transitionApprovalPhase,
    ],
  );

  const startApprovalSettlement = useCallback(() => {
    stopApprovalSettlement();
    const abortController = new AbortController();
    approvalSettlementAbortRef.current = abortController;
    return abortController;
  }, [stopApprovalSettlement]);

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

  const showApprovalFailed = useCallback(() => {
    Toast.warning({
      title: intl.formatMessage({
        id: ETranslations.swap_page_toast_approve_failed,
      }),
      message: intl.formatMessage({
        id: ETranslations.global_try_again,
      }),
    });
  }, [intl]);

  const showApprovalPending = useCallback(() => {
    Toast.success({
      title: intl.formatMessage({
        id: ETranslations.feedback_transaction_submitted,
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
    fetchAllowanceResponse,
  } = useTrackTokenAllowance({
    providerName: providerName ?? borrowDelegationApproveTarget?.provider ?? '',
    accountId: approveTarget?.accountId ?? '',
    networkId: approveTarget?.networkId ?? '',
    tokenAddress: approveTarget?.token?.address ?? '',
    spenderAddress: approveTarget?.spenderAddress ?? '',
    initialValue: currentAllowance,
    refreshOnMount: refreshAllowanceOnMount,
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

  const recoverPendingApproval = useCallback(
    async (request: IBorrowApprovalRequest, scope: IBorrowApprovalScope) => {
      const entry = borrowApprovalTaskRegistry.find(scope);
      if (!entry) return false;
      if (entry.type === 'conflict') {
        if (isCurrentApprovalRequest(request)) showApprovalPending();
        return true;
      }
      const lease = borrowApprovalTaskRegistry.acquireRecovery(
        scope,
        entry.token,
      );
      if (!lease) {
        if (isCurrentApprovalRequest(request)) showApprovalPending();
        return true;
      }
      try {
        const task = entry.controller.getTask();
        const step = task.steps[task.currentStepIndex];
        if (
          step?.status.type === 'unknown' &&
          'txid' in step.status &&
          step.status.txid &&
          step.attemptId
        ) {
          const { txid } = step.status;
          const ownerCurrent = await isTaskAccountCurrent({
            accountId: scope.accountId,
            networkId: scope.networkId,
            accountAddress: scope.accountAddress,
          });
          if (!ownerCurrent || !isCurrentApprovalRequest(request)) return true;
          const status = await waitForTxFinalStatus({
            accountId: scope.accountId,
            networkId: scope.networkId,
            expectedAccountAddress: scope.accountAddress,
            txid,
          });
          if (
            !isCurrentApprovalRequest(request) ||
            !(await isTaskAccountCurrent({
              accountId: scope.accountId,
              networkId: scope.networkId,
              accountAddress: scope.accountAddress,
            })) ||
            !isCurrentApprovalRequest(request)
          )
            return true;
          if (
            status === EOnChainHistoryTxStatus.Success ||
            status === EOnChainHistoryTxStatus.Failed
          ) {
            if (status === EOnChainHistoryTxStatus.Success) {
              if (scope.kind === 'delegation')
                await fetchBorrowDelegationAllowance();
              else await fetchTokenAllowanceParsed();
              if (!isCurrentApprovalRequest(request)) return true;
            }
            const recorded = entry.controller.recordRecovery({
              stepId: step.id,
              attemptId: step.attemptId,
              txid,
              status:
                status === EOnChainHistoryTxStatus.Success
                  ? 'confirmed'
                  : 'failed',
            });
            if (
              recorded &&
              borrowApprovalTaskRegistry.release(scope, entry.token)
            ) {
              if (status === EOnChainHistoryTxStatus.Failed)
                showApprovalFailed();
              else
                Toast.success({
                  title: intl.formatMessage({ id: ETranslations.global_done }),
                });
              return true;
            }
          }
        }
        if (isCurrentApprovalRequest(request)) showApprovalPending();
        return true;
      } finally {
        borrowApprovalTaskRegistry.releaseRecovery(scope, entry.token, lease);
      }
    },
    [
      fetchBorrowDelegationAllowance,
      fetchTokenAllowanceParsed,
      intl,
      isCurrentApprovalRequest,
      showApprovalFailed,
      showApprovalPending,
    ],
  );

  const shouldApprove = useMemo(() => {
    // An unloaded allowance reads as zero downstream, which would announce an
    // approval the user may not need. Ported from useBorrowApproveAndSubmit,
    // which this hook replaced (OK-58984).
    if (loadingAllowance) {
      return false;
    }
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
    loadingAllowance,
    requiresMaxApproval,
  ]);

  const settleApprovalTransaction = useCallback(
    ({
      request,
      accountId,
      networkId,
      txid,
      reconcileAllowance,
      onSuccess,
    }: {
      request: IBorrowApprovalRequest;
      accountId: string;
      networkId: string;
      txid: string;
      reconcileAllowance?: () => Promise<unknown>;
      onSuccess?: (
        signal: AbortSignal,
      ) => Promise<IBorrowApprovalSettlementResult>;
    }) => {
      if (!isActiveApprovalRequest(request)) {
        return;
      }
      if (
        !transitionApprovalPhase(request, 'confirming', 'settling') &&
        !transitionApprovalPhase(request, 'preparing', 'settling')
      ) {
        return;
      }
      const abortController = startApprovalSettlement();
      void (async () => {
        let shouldContinueRequest = false;
        try {
          const finalStatus = txid
            ? await waitForTxFinalStatus({
                accountId,
                networkId,
                expectedAccountAddress: request.accountAddress,
                txid,
                signal: abortController.signal,
              })
            : undefined;
          if (
            abortController.signal.aborted ||
            !isActiveApprovalRequest(request)
          ) {
            return;
          }
          if (finalStatus === EOnChainHistoryTxStatus.Failed) {
            showApprovalFailed();
            return;
          }
          if (finalStatus !== EOnChainHistoryTxStatus.Success) {
            showApprovalPending();
            return;
          }

          // The receipt is the approval authority. Allowance is queried once
          // for server-side reconciliation, but an indexing lag must not turn a
          // mined approval into a failure or start another polling state machine.
          try {
            await reconcileAllowance?.();
          } catch (error) {
            const errorMessage = getBorrowApprovalSubmitErrorMessage(error);
            defaultLogger.app.error.log(
              `useBorrowApproval allowance reconciliation failed: ${
                errorMessage ?? String(error)
              }`,
            );
          }
          if (
            abortController.signal.aborted ||
            !isActiveApprovalRequest(request)
          ) {
            return;
          }
          shouldContinueRequest =
            (await onSuccess?.(abortController.signal)) === 'continue';
        } finally {
          if (!abortController.signal.aborted && !shouldContinueRequest) {
            finishApprovalRequest(request);
          }
        }
      })();
    },
    [
      finishApprovalRequest,
      isActiveApprovalRequest,
      showApprovalFailed,
      showApprovalPending,
      startApprovalSettlement,
      transitionApprovalPhase,
    ],
  );

  const submitApprovedAction = useCallback(
    async (
      request: IBorrowApprovalRequest,
      signal?: AbortSignal,
      workflowHandoff?: IBorrowWorkflowHandoff,
    ) => {
      if (signal?.aborted || !isActiveApprovalRequest(request)) {
        return;
      }

      try {
        await verifyApprovalAccount(request);
        if (workflowHandoff)
          await request.submit(request.accountAddress, workflowHandoff);
        else if (allowApprovalContinuationAfterUnmount)
          await request.submit(request.accountAddress);
        else await request.submit();
      } catch (error) {
        if (isActiveApprovalRequest(request)) {
          showApprovalError({ error, scope: 'onApprovedSubmit' });
        }
      }
    },
    [
      allowApprovalContinuationAfterUnmount,
      isActiveApprovalRequest,
      showApprovalError,
      verifyApprovalAccount,
    ],
  );

  const startApprovalTask = useCallback(
    async <T>({
      request,
      accountId,
      networkId,
      provider,
      approval,
      reset,
      pauseAfterReset = false,
      reconcileAllowance,
    }: {
      request: IBorrowApprovalRequest;
      accountId: string;
      networkId: string;
      provider: string;
      approval: IBorrowApprovalTaskConfirmation<T>;
      reset?: IBorrowApprovalTaskConfirmation<T>;
      pauseAfterReset?: boolean;
      reconcileAllowance: () => Promise<unknown>;
    }) => {
      if (!onApprovedTaskSubmit) return false;
      const withReceipt = (adapter: typeof approval.adapter) => ({
        ...adapter,
        waitForFinalStatus: async ({
          txid,
          signal,
        }: {
          txid: string;
          signal: AbortSignal;
        }) => {
          const status = await waitForTxFinalStatus({
            accountId,
            networkId,
            expectedAccountAddress: request.accountAddress,
            txid,
            signal,
          });
          if (status === EOnChainHistoryTxStatus.Success)
            return 'success' as const;
          return status === EOnChainHistoryTxStatus.Failed
            ? ('failed' as const)
            : ('unknown' as const);
        },
        verify: async () => {
          try {
            await reconcileAllowance();
          } catch (error) {
            const message = getBorrowApprovalSubmitErrorMessage(error);
            defaultLogger.app.error.log(
              `useBorrowApproval allowance reconciliation failed: ${message ?? String(error)}`,
            );
          }
          return true;
        },
      });
      let unsubscribe = () => {};
      const workflow = createBorrowApprovalWorkflow({
        identity: {
          action,
          accountId,
          networkId,
          accountAddress: request.accountAddress,
          provider,
        },
        approval: withReceipt(approval.adapter),
        reset: reset ? withReceipt(reset.adapter) : undefined,
        pauseAfterReset,
        submit: async (handoff) => {
          try {
            await verifyApprovalAccount(request);
            if (!request.accountAddress)
              throw new OneKeyLocalError('Borrow approval account changed');
            await onApprovedTaskSubmit(request.accountAddress, handoff);
          } catch (error) {
            if (isActiveApprovalRequest(request))
              showApprovalError({ error, scope: 'onApprovedSubmit' });
          } finally {
            finishApprovalRequest(request);
            unsubscribe();
          }
        },
        isCurrent: () => isActiveApprovalRequest(request),
        onAsyncError: (error) => {
          if (finishApprovalRequest(request))
            showApprovalError({ error, scope: 'onApprove' });
          unsubscribe();
        },
      });
      const scope = request.accountAddress
        ? getApprovalTaskScope(request.accountAddress)
        : undefined;
      if (!scope) throw new OneKeyLocalError('Borrow approval account changed');
      const reservation = borrowApprovalTaskRegistry.reserve(scope, workflow);
      if (!reservation) {
        showApprovalPending();
        finishApprovalRequest(request);
        return false;
      }
      if (mountedRef.current) setApprovalTask(workflow);
      unsubscribe = workflow.subscribe(() => {
        const state = workflow.getTask();
        const approvalStep = state.steps.find((item) => item.id === 'approve');
        if (approvalStep?.status.type === 'succeeded')
          borrowApprovalTaskRegistry.release(scope, reservation);
        const step = state.steps[state.currentStepIndex];
        const status = step?.status;
        if (
          step?.id === 'resumeApproval' &&
          (status?.type === 'ready' || status?.type === 'checking') &&
          !pausedApprovalRef.current
        ) {
          pausedApprovalRef.current = {
            request,
            resume: workflow.resumeApproval,
            cancel: () => {
              workflow.cancel();
              borrowApprovalTaskRegistry.release(scope, reservation);
            },
          };
          approvalInFlightRef.current = false;
          setApprovalPhaseSafe('idle');
          return;
        }
        if (
          status?.type === 'failed' &&
          'stage' in status &&
          status.stage === 'onChain'
        ) {
          borrowApprovalTaskRegistry.release(scope, reservation);
          if (isActiveApprovalRequest(request)) showApprovalFailed();
          finishApprovalRequest(request);
          unsubscribe();
        } else if (status?.type === 'unknown') {
          if (isActiveApprovalRequest(request)) showApprovalPending();
          finishApprovalRequest(request);
          unsubscribe();
        } else if (
          status?.type === 'cancelled' ||
          (status?.type === 'failed' &&
            'stage' in status &&
            status.stage === 'beforeSend')
        ) {
          borrowApprovalTaskRegistry.release(scope, reservation);
          unsubscribe();
        }
      });
      const result = await (reset ?? approval).start(workflow.run);
      return result === 'finished';
    },
    [
      action,
      finishApprovalRequest,
      isActiveApprovalRequest,
      onApprovedTaskSubmit,
      showApprovalError,
      showApprovalFailed,
      showApprovalPending,
      verifyApprovalAccount,
      setApprovalPhaseSafe,
      getApprovalTaskScope,
    ],
  );

  const navigateToTokenApproval = useCallback(
    async (request: IBorrowApprovalRequest, resetFirst = false) => {
      if (!approveTarget?.token || !isActiveApprovalRequest(request)) {
        finishApprovalRequest(request);
        return false;
      }
      try {
        const account = await backgroundApiProxy.serviceAccount.getAccount({
          accountId: approveTarget.accountId,
          networkId: approveTarget.networkId,
        });
        if (!isActiveApprovalRequest(request)) {
          return false;
        }
        await verifyApprovalAccount(request);
        if (
          !request.accountAddress ||
          !isTaskAccountAddress(
            {
              accountAddress: request.accountAddress,
              networkId: approveTarget.networkId,
            },
            account.address,
          )
        ) {
          throw new OneKeyLocalError('Borrow approval account changed');
        }
        if (!(await prepareApprovalConfirmNavigation(request))) {
          return false;
        }
        if (onApprovedTaskSubmit) {
          const token = approveTarget.token;
          const createConfirmation = (resetStep: boolean) => {
            let sendObserved = false;
            return createEarnConfirmationTaskAdapter<
              IEarnTaskScope & { action: string },
              IBorrowWorkflowTransactionStep,
              IApproveInfo[],
              ISendTxOnSuccessData[],
              Error
            >({
              prepare: async () => {
                if (
                  !resetStep &&
                  resetFirst &&
                  !(await prepareApprovalConfirmNavigation(request, true))
                )
                  throw new OneKeyLocalError('Borrow approval account changed');
                return [
                  buildBorrowApproveInfo({
                    owner: account.address,
                    spenderAddress: approveTarget.spenderAddress,
                    token,
                    amount: resetStep ? '0' : amountValue,
                    isMax: resetStep ? false : requiresMaxApproval,
                  }),
                ];
              },
              navigate: async (approvesInfo, callbacks) => {
                await navigationToTxConfirm({
                  approvesInfo,
                  stakingInfo,
                  onBeforeSend: async () => {
                    await verifyApprovalAccount(request);
                    callbacks.onSendObserved();
                    sendObserved = true;
                  },
                  onSuccess: callbacks.onSuccess,
                  onFail: callbacks.onFail,
                  onCancel: callbacks.onCancel,
                  onLateBroadcastAccepted: (fact) => {
                    if (
                      fact.accountId === approveTarget.accountId &&
                      fact.networkId === approveTarget.networkId &&
                      fact.uuid.trim() &&
                      fact.txid.trim()
                    )
                      callbacks.onLateBroadcastAccepted(fact.txid);
                  },
                });
              },
              onFail: () => {
                finishApprovalRequest(request);
              },
              onCancel: () => {
                finishApprovalRequest(request);
              },
              onObserverError: () =>
                console.error('Unable to update Borrow approval task'),
              getTxid: getBorrowApprovalTxid,
              failureCertainty: () => (sendObserved ? 'unknown' : 'beforeSend'),
              cancellationCertainty: () =>
                sendObserved ? 'unknown' : 'beforeSend',
            });
          };
          const confirmation = createConfirmation(false);
          const resetConfirmation = resetFirst
            ? createConfirmation(true)
            : undefined;
          return startApprovalTask({
            request,
            accountId: approveTarget.accountId,
            networkId: approveTarget.networkId,
            provider: providerName ?? '',
            approval: confirmation,
            reset: resetConfirmation,
            pauseAfterReset:
              resetFirst && !allowApprovalContinuationAfterUnmount,
            reconcileAllowance: fetchTokenAllowanceParsed,
          });
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
          onBeforeSend: () => verifyApprovalAccount(request),
          onSuccess(data) {
            if (!isActiveApprovalRequest(request)) {
              return;
            }
            const txid = getBorrowApprovalTxid(data);
            settleApprovalTransaction({
              request,
              accountId: approveTarget.accountId,
              networkId: approveTarget.networkId,
              txid,
              reconcileAllowance: fetchTokenAllowanceParsed,
              onSuccess: (signal) => submitApprovedAction(request, signal),
            });
          },
          onFail() {
            finishApprovalRequest(request);
          },
          onCancel() {
            finishApprovalRequest(request);
          },
        });
        transitionApprovalPhase(request, 'preparing', 'confirming');
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
      allowApprovalContinuationAfterUnmount,
      approveTarget,
      fetchTokenAllowanceParsed,
      finishApprovalRequest,
      isActiveApprovalRequest,
      navigationToTxConfirm,
      onApprovedTaskSubmit,
      prepareApprovalConfirmNavigation,
      providerName,
      requiresMaxApproval,
      showApprovalError,
      startApprovalTask,
      stakingInfo,
      settleApprovalTransaction,
      submitApprovedAction,
      transitionApprovalPhase,
      verifyApprovalAccount,
    ],
  );

  const resetApproveToZero = useCallback(
    async (request: IBorrowApprovalRequest) => {
      if (!isActiveApprovalRequest(request)) {
        return;
      }
      if (onApprovedTaskSubmit) {
        await navigateToTokenApproval(request, true);
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
        if (!isActiveApprovalRequest(request)) {
          return;
        }

        await verifyApprovalAccount(request);
        if (
          !request.accountAddress ||
          !isTaskAccountAddress(
            {
              accountAddress: request.accountAddress,
              networkId: approveTarget.networkId,
            },
            account.address,
          )
        ) {
          throw new OneKeyLocalError('Borrow approval account changed');
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
          onBeforeSend: () => verifyApprovalAccount(request),
          onSuccess(data) {
            if (!isActiveApprovalRequest(request)) {
              return;
            }
            const txid = getBorrowApprovalTxid(data);
            settleApprovalTransaction({
              request,
              accountId: approveTarget.accountId,
              networkId: approveTarget.networkId,
              txid,
              reconcileAllowance: fetchTokenAllowanceParsed,
              onSuccess: allowApprovalContinuationAfterUnmount
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
        transitionApprovalPhase(request, 'preparing', 'confirming');
      } catch (error) {
        if (finishApprovalRequest(request)) {
          showApprovalError({ error, scope: 'resetApproveToZero' });
        }
      }
    },
    [
      allowApprovalContinuationAfterUnmount,
      approveTarget,
      fetchTokenAllowanceParsed,
      finishApprovalRequest,
      isActiveApprovalRequest,
      navigateToTokenApproval,
      navigationToTxConfirm,
      onApprovedTaskSubmit,
      prepareApprovalConfirmNavigation,
      settleApprovalTransaction,
      showApprovalError,
      stakingInfo,
      transitionApprovalPhase,
      verifyApprovalAccount,
    ],
  );

  const showResetUSDTApproveValueDialog = useCallback(
    (request: IBorrowApprovalRequest) => {
      if (!isActiveApprovalRequest(request)) {
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
          if (isActiveApprovalRequest(request)) {
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
    [finishApprovalRequest, intl, isActiveApprovalRequest, resetApproveToZero],
  );

  const onApprove = useCallback(async () => {
    // OK-59196: the approve step is the user's first on-chain action in the
    // two-step borrow flow and never reaches the borrow hooks, so the one-time
    // risk disclaimer has to gate here too (mirrors the earn approve step).
    // Bails out silently: ensureReadyToSubmit already reports "not ready" after
    // calling this, so a rejection just leaves the form as it was.
    const riskGateProvider =
      borrowDelegationApproveTarget?.provider ?? providerName;
    if (!riskGateProvider && platformEnv.isDev) {
      // Fail open in production — a broken gate must not block a trade — but a
      // new call site that forgets `providerName` has to be loud, otherwise the
      // disclaimer is skipped here and nobody notices (that is exactly how the
      // lending action dialog and the eMode flow shipped without it).
      console.error(
        '[useBorrowApproval] risk disclaimer skipped: pass providerName from the call site',
      );
    }
    if (riskGateProvider) {
      const riskAccepted = await ensureRiskAccepted({
        provider: riskGateProvider,
        symbol:
          stakingInfo?.send?.token.symbol ?? stakingInfo?.receive?.token.symbol,
        networkId:
          approveTarget?.networkId ?? borrowDelegationApproveTarget?.networkId,
      });
      if (!riskAccepted) {
        return;
      }
    }

    const paused = pausedApprovalRef.current;
    if (paused && isActiveApprovalRequest(paused.request)) {
      approvalInFlightRef.current = true;
      setApprovalPhaseSafe('preparing');
      if (paused.resume()) {
        pausedApprovalRef.current = undefined;
        return;
      }
      approvalInFlightRef.current = false;
      setApprovalPhaseSafe('idle');
      return;
    }

    if (delegationApprovalEnabled && borrowDelegationApproveTarget) {
      const request = getApprovalRequest();
      if (!beginApprovalRequest(request)) {
        return;
      }
      Keyboard.dismiss();
      stopApprovalSettlement();

      try {
        if (
          !(await bindApprovalAccount(
            request,
            borrowDelegationApproveTarget.accountId,
            borrowDelegationApproveTarget.networkId,
          ))
        )
          return;
        const pendingScope = request.accountAddress
          ? getApprovalTaskScope(request.accountAddress)
          : undefined;
        if (
          pendingScope &&
          (await recoverPendingApproval(request, pendingScope))
        ) {
          finishApprovalRequest(request);
          return;
        }
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
        if (!isActiveApprovalRequest(request)) {
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
              expectedAccountAddress: request.accountAddress,
            },
          );
        if (!isActiveApprovalRequest(request)) {
          return;
        }

        if (!(await prepareApprovalConfirmNavigation(request))) {
          return;
        }
        if (onApprovedTaskSubmit) {
          let sendObserved = false;
          const confirmation = createEarnConfirmationTaskAdapter<
            IEarnTaskScope & { action: string },
            IBorrowWorkflowTransactionStep,
            IBorrowApprovalEncodedTx,
            ISendTxOnSuccessData[],
            Error
          >({
            prepare: async () => parseBorrowApprovalEncodedTx(resp.tx),
            navigate: async (encodedTx, callbacks) =>
              navigationToTxConfirm({
                encodedTx,
                stakingInfo,
                onBeforeSend: async () => {
                  await verifyApprovalAccount(request);
                  callbacks.onSendObserved();
                  sendObserved = true;
                },
                onSuccess: callbacks.onSuccess,
                onFail: callbacks.onFail,
                onCancel: callbacks.onCancel,
                onLateBroadcastAccepted: (fact) => {
                  if (
                    fact.accountId ===
                      borrowDelegationApproveTarget.accountId &&
                    fact.networkId ===
                      borrowDelegationApproveTarget.networkId &&
                    fact.uuid.trim() &&
                    fact.txid.trim()
                  )
                    callbacks.onLateBroadcastAccepted(fact.txid);
                },
              }),
            onFail: () => {
              finishApprovalRequest(request);
            },
            onCancel: () => {
              finishApprovalRequest(request);
            },
            onObserverError: () =>
              console.error('Unable to update Borrow approval task'),
            getTxid: getBorrowApprovalTxid,
            failureCertainty: () => (sendObserved ? 'unknown' : 'beforeSend'),
            cancellationCertainty: () =>
              sendObserved ? 'unknown' : 'beforeSend',
          });
          await startApprovalTask({
            request,
            accountId: borrowDelegationApproveTarget.accountId,
            networkId: borrowDelegationApproveTarget.networkId,
            provider: borrowDelegationApproveTarget.provider,
            approval: confirmation,
            reconcileAllowance: fetchBorrowDelegationAllowance,
          });
          return;
        }
        await navigationToTxConfirm({
          encodedTx: parseBorrowApprovalEncodedTx(resp.tx),
          stakingInfo,
          onBeforeSend: () => verifyApprovalAccount(request),
          onSuccess(data) {
            if (!isActiveApprovalRequest(request)) {
              return;
            }
            const txid = getBorrowApprovalTxid(data);
            settleApprovalTransaction({
              request,
              accountId: borrowDelegationApproveTarget.accountId,
              networkId: borrowDelegationApproveTarget.networkId,
              txid,
              reconcileAllowance: fetchBorrowDelegationAllowance,
              onSuccess: (signal) => submitApprovedAction(request, signal),
            });
          },
          onFail() {
            finishApprovalRequest(request);
          },
          onCancel() {
            finishApprovalRequest(request);
          },
        });
        transitionApprovalPhase(request, 'preparing', 'confirming');
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
    stopApprovalSettlement();

    try {
      if (
        !(await bindApprovalAccount(
          request,
          approveTarget.accountId,
          approveTarget.networkId,
        ))
      )
        return;
      const pendingScope = request.accountAddress
        ? getApprovalTaskScope(request.accountAddress)
        : undefined;
      if (
        pendingScope &&
        (await recoverPendingApproval(request, pendingScope))
      ) {
        finishApprovalRequest(request);
        return;
      }
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
      if (!isActiveApprovalRequest(request)) {
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
    ensureRiskAccepted,
    providerName,
    allowance,
    amountValue,
    approvalEnabled,
    approveTarget,
    beginApprovalRequest,
    bindApprovalAccount,
    borrowDelegationApproveTarget,
    delegationApprovalEnabled,
    fetchBorrowDelegationAllowance,
    fetchTokenAllowanceParsed,
    finishApprovalRequest,
    getApprovalRequest,
    getApprovalTaskScope,
    isActiveApprovalRequest,
    navigationToTxConfirm,
    navigateToTokenApproval,
    onApprovedTaskSubmit,
    prepareApprovalConfirmNavigation,
    recoverPendingApproval,
    requiresMaxApproval,
    settleApprovalTransaction,
    setApprovalPhaseSafe,
    showApprovalError,
    showResetUSDTApproveValueDialog,
    startApprovalTask,
    stakingInfo,
    stopApprovalSettlement,
    submitApprovedAction,
    transitionApprovalPhase,
    verifyApprovalAccount,
  ]);

  const ensureReadyToSubmit = useCallback(async () => {
    const request = getApprovalRequest();
    if (!isCurrentApprovalRequest(request)) {
      return false;
    }
    if (
      onApprovedTaskSubmit &&
      (approveTarget || borrowDelegationApproveTarget)
    ) {
      const accountId =
        approveTarget?.accountId ?? borrowDelegationApproveTarget?.accountId;
      const networkId =
        approveTarget?.networkId ?? borrowDelegationApproveTarget?.networkId;
      if (accountId && networkId) {
        try {
          const resolvedAddress =
            accountAddress ??
            (await getTaskAccountAddress({ accountId, networkId }));
          if (!isCurrentApprovalRequest(request)) return false;
          const pendingScope = getApprovalTaskScope(resolvedAddress);
          if (
            pendingScope &&
            (await recoverPendingApproval(request, pendingScope))
          )
            return false;
        } catch (error) {
          if (isCurrentApprovalRequest(request))
            showApprovalError({ error, scope: 'ensureReadyToSubmit' });
          return false;
        }
      }
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
    approveTarget,
    borrowDelegationApproveTarget,
    delegationApprovalEnabled,
    fetchBorrowDelegationAllowance,
    fetchTokenAllowanceParsed,
    getApprovalRequest,
    getApprovalTaskScope,
    isCurrentApprovalRequest,
    onApprove,
    onApprovedTaskSubmit,
    accountAddress,
    recoverPendingApproval,
    requiresMaxApproval,
    shouldApprove,
    showApprovalError,
  ]);

  const currentTaskStep = taskSnapshot?.steps[taskSnapshot.currentStepIndex];
  let taskPhase: IBorrowApprovalPhase = 'idle';
  if (currentTaskStep?.id === 'prepareBusiness') taskPhase = 'settling';
  else if (
    currentTaskStep &&
    currentTaskStep.kind !== 'wait' &&
    currentTaskStep.kind !== 'sign' &&
    currentTaskStep.kind !== 'external'
  ) {
    const status = currentTaskStep.status.type;
    if (status === 'ready' || status === 'preparing') taskPhase = 'preparing';
    else if (status === 'awaitingUser' || status === 'sending')
      taskPhase = 'confirming';
    else if (status === 'confirming' || status === 'verifying')
      taskPhase = 'settling';
  }
  const effectivePhase = approvalTask ? taskPhase : approvalPhase;
  const approving = effectivePhase !== 'idle';
  const isFormInteractionLocked =
    effectivePhase === 'preparing' || effectivePhase === 'settling';

  return {
    approveType: effectiveApproveType,
    approving,
    isFormInteractionLocked,
    approvalProgressStarted: approvalProgressScopeKey === approvalScopeKey,
    loadingAllowance: !!loadingAllowance,
    shouldApprove,
    ensureReadyToSubmit,
    onApprove,
  };
}
