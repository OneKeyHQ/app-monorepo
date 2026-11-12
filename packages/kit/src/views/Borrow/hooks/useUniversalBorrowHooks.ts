import { useCallback, useEffect, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Toast } from '@onekeyhq/components';
import type { IEncodedTx } from '@onekeyhq/core/src/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useSignatureConfirm } from '@onekeyhq/kit/src/hooks/useSignatureConfirm';
import { createLateEarnOrderObserver } from '@onekeyhq/kit/src/views/Earn/tasks/lateEarnOrderRecorder';
import {
  getTaskAccountAddress,
  isTaskAccountCurrent,
  normalizeTaskAccountAddress,
} from '@onekeyhq/kit/src/views/Earn/tasks/taskAccount';
import { useEarnRiskWarningGate } from '@onekeyhq/kit/src/views/Staking/components/EarnRiskWarningDialog';
import { useCommittedEarnScopeGuard } from '@onekeyhq/kit/src/views/Staking/hooks/useCommittedEarnScopeGuard';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IModalSendParamList } from '@onekeyhq/shared/src/routes';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import {
  type IBorrowEModeSwitchCheck,
  type IBorrowTransactionConfirmation,
  type IStakingInfo,
} from '@onekeyhq/shared/types/staking';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';
import type {
  IBroadcastAcceptedFact,
  ISendTxOnSuccessData,
} from '@onekeyhq/shared/types/tx';

import { createBorrowCollateralRepayTask } from './borrowCollateralRepayTask';
import { runBorrowConfirmationTask } from './borrowConfirmationTask';
import { mapBorrowLutFinalizationToTxStatus } from './borrowLutFinalization';
import { createBorrowLutTaskRegistry } from './borrowLutTaskRegistry';
import {
  type IBorrowBuildTxParams,
  attachBorrowOrderId,
  handleBorrowSuccess,
  parseBorrowEncodedTx,
  useUniversalBorrowRepay,
  useUniversalBorrowWithdraw,
} from './useUniversalBorrowWithdrawRepayHooks';

import type { IBorrowCollateralRepayTaskOwner } from './borrowCollateralRepayTask';

export { useUniversalBorrowRepay, useUniversalBorrowWithdraw };

// The dialog logs which asset the user was about to trade; borrow params carry
// the token on stakingInfo rather than as a plain symbol.
const getRiskGateSymbol = (stakingInfo?: IStakingInfo) =>
  stakingInfo?.send?.token.symbol ?? stakingInfo?.receive?.token.symbol;

const attachRepayWithCollateralAmount = ({
  stakingInfo,
  amount,
}: {
  stakingInfo?: IStakingInfo;
  amount?: string;
}): IStakingInfo | undefined => {
  if (!stakingInfo?.send || !amount) {
    return stakingInfo;
  }

  return {
    ...stakingInfo,
    send: {
      ...stakingInfo.send,
      amount,
    },
  };
};

const buildBorrowTrackingStakingInfo = ({
  stakingInfo,
  orderId,
}: {
  stakingInfo?: IStakingInfo;
  orderId?: string;
}): IStakingInfo | undefined => {
  if (!stakingInfo?.tags?.length) {
    return undefined;
  }

  return attachBorrowOrderId({
    stakingInfo: {
      ...stakingInfo,
      send: undefined,
      receive: undefined,
    },
    orderId,
  });
};

const getEarnOrderTrackingInfo = (stakingInfo?: IStakingInfo) => ({
  stakingLabel: stakingInfo?.label,
  stakingProtocol: stakingInfo?.protocol,
  stakingTags: stakingInfo?.tags,
});

type ITxConfirmResult =
  | {
      status: 'success';
      data: ISendTxOnSuccessData[];
    }
  | {
      status: 'cancel';
    };

// React Navigation modal transitions take about 300ms on mobile. Waiting for
// that animation to settle avoids racing the second repay confirm with the
// closing setup modal.
const SIGNATURE_MODAL_SETTLE_WAIT_MS = 300;

const getLatestTxId = (data: ISendTxOnSuccessData[]) => {
  for (let index = data.length - 1; index >= 0; index -= 1) {
    const item = data[index];
    const txId = item?.signedTx?.txid || item?.decodedTx?.txid;
    if (txId) {
      return txId;
    }
  }

  return undefined;
};

// Buffer after RPC finalization to allow all RPC nodes to sync the LUT state
const LUT_PROPAGATION_BUFFER_MS = 5000;

type ICollateralRepayIntent = Pick<
  IBorrowBuildTxParams,
  | 'amount'
  | 'marketAddress'
  | 'reserveAddress'
  | 'repayAll'
  | 'slippageBps'
  | 'routeKey'
> & { collateralReserveAddress: string };

type ICollateralRepayTask = ReturnType<
  typeof createBorrowCollateralRepayTask<ICollateralRepayIntent>
>;

const borrowCollateralRepayRegistry =
  createBorrowLutTaskRegistry<ICollateralRepayTask>();

const hasReusableCollateralSetup = (task: ICollateralRepayTask) => {
  const snapshot = task.getSetupTask();
  const setup = snapshot.steps.find((step) => step.id === 'setup');
  const propagation = snapshot.steps.find((step) => step.id === 'propagation');
  return Boolean(
    setup?.status.type === 'handedOff' &&
    propagation?.status.type === 'completed' &&
    ['saved', 'remoteUnknown', 'notTracked'].includes(
      snapshot.facts?.recording ?? '',
    ) &&
    ['pending', 'confirmed'].includes(snapshot.facts?.finality ?? ''),
  );
};

/**
 * Resolves true once the flow has been handed to the transaction confirm page,
 * false when it never started — today only a declined risk disclaimer, but the
 * point is that no callback fires and nothing throws on that path. A caller
 * that took a lock (submit guard, spinner) before calling MUST release it on
 * false; `onSuccess` / `onFail` / `onCancel` are never invoked.
 */
export function useUniversalBorrowSupply({
  networkId,
  accountId,
  accountAddress,
}: {
  networkId: string;
  accountId: string;
  accountAddress?: string;
}) {
  const { navigationToTxConfirm } = useSignatureConfirm({
    accountId,
    networkId,
  });

  const ensureRiskAccepted = useEarnRiskWarningGate();
  const scope = useCommittedEarnScopeGuard(
    JSON.stringify([
      accountId,
      networkId,
      accountAddress
        ? normalizeTaskAccountAddress(networkId, accountAddress)
        : undefined,
    ]),
  );

  return useCallback(
    async ({
      amount,
      provider,
      marketAddress,
      reserveAddress,
      stakingInfo,
      accountAddress: approvalAccountAddress,
      workflowHandoff,
      onSuccess,
      onFail,
    }: IBorrowBuildTxParams): Promise<boolean> => {
      const isCurrent = scope.capture();
      if (!isCurrent()) return false;
      // OK-59196: one-time DeFi risk disclaimer, same gate the earn stake flow
      // uses. Returns false so the caller can tell a rejection apart from a
      // completed hand-off and leave the form untouched.
      if (
        !(await ensureRiskAccepted({
          provider,
          symbol: getRiskGateSymbol(stakingInfo),
          networkId,
        }))
      ) {
        return false;
      }
      if (!isCurrent()) return false;

      const frozenAddress =
        approvalAccountAddress ??
        accountAddress ??
        (await getTaskAccountAddress({ accountId, networkId }));
      if (!isCurrent()) return false;

      return runBorrowConfirmationTask({
        identity: {
          accountId,
          networkId,
          accountAddress: frozenAddress,
          provider,
          action: 'supply',
          intent: { marketAddress, reserveAddress, amount },
        },
        build: () =>
          backgroundApiProxy.serviceStaking.borrowBuildSupplyTransaction({
            networkId,
            accountId,
            expectedAccountAddress: frozenAddress,
            provider,
            marketAddress,
            reserveAddress,
            amount,
          }),
        stakingInfo,
        navigationToTxConfirm,
        isCurrent,
        onSuccess,
        onFail,
        workflowHandoff,
      });
    },
    [
      accountAddress,
      accountId,
      ensureRiskAccepted,
      networkId,
      navigationToTxConfirm,
      scope,
    ],
  );
}

/**
 * Resolves true once the flow has been handed to the transaction confirm page,
 * false when it never started — today only a declined risk disclaimer, but the
 * point is that no callback fires and nothing throws on that path. A caller
 * that took a lock (submit guard, spinner) before calling MUST release it on
 * false; `onSuccess` / `onFail` / `onCancel` are never invoked.
 */
export function useUniversalBorrowBorrow({
  networkId,
  accountId,
  accountAddress,
}: {
  networkId: string;
  accountId: string;
  accountAddress?: string;
}) {
  const { navigationToTxConfirm } = useSignatureConfirm({
    accountId,
    networkId,
  });

  const ensureRiskAccepted = useEarnRiskWarningGate();
  const scope = useCommittedEarnScopeGuard(
    JSON.stringify([
      accountId,
      networkId,
      accountAddress
        ? normalizeTaskAccountAddress(networkId, accountAddress)
        : undefined,
    ]),
  );

  return useCallback(
    async ({
      amount,
      provider,
      marketAddress,
      reserveAddress,
      unwrap,
      stakingInfo,
      accountAddress: approvalAccountAddress,
      workflowHandoff,
      onSuccess,
      onFail,
    }: IBorrowBuildTxParams): Promise<boolean> => {
      const isCurrent = scope.capture();
      if (!isCurrent()) return false;
      // OK-59196: one-time DeFi risk disclaimer, same gate the earn stake flow
      // uses. Returns false so the caller can tell a rejection apart from a
      // completed hand-off and leave the form untouched.
      if (
        !(await ensureRiskAccepted({
          provider,
          symbol: getRiskGateSymbol(stakingInfo),
          networkId,
        }))
      ) {
        return false;
      }
      if (!isCurrent()) return false;

      const frozenAddress =
        approvalAccountAddress ??
        accountAddress ??
        (await getTaskAccountAddress({ accountId, networkId }));
      if (!isCurrent()) return false;

      return runBorrowConfirmationTask({
        identity: {
          accountId,
          networkId,
          accountAddress: frozenAddress,
          provider,
          action: 'borrow',
          intent: { marketAddress, reserveAddress, amount, unwrap },
        },
        build: () =>
          backgroundApiProxy.serviceStaking.borrowBuildBorrowTransaction({
            networkId,
            accountId,
            expectedAccountAddress: frozenAddress,
            provider,
            marketAddress,
            reserveAddress,
            amount,
            ...(unwrap !== undefined ? { unwrap } : {}),
          }),
        stakingInfo,
        navigationToTxConfirm,
        isCurrent,
        onSuccess,
        onFail,
        workflowHandoff,
      });
    },
    [
      accountAddress,
      accountId,
      ensureRiskAccepted,
      networkId,
      navigationToTxConfirm,
      scope,
    ],
  );
}

export function useUniversalBorrowRepayWithCollateral({
  networkId,
  accountId,
  accountAddress,
}: {
  networkId: string;
  accountId: string;
  accountAddress?: string;
}) {
  const intl = useIntl();
  const scope = useCommittedEarnScopeGuard(
    JSON.stringify([
      accountId,
      networkId,
      accountAddress
        ? normalizeTaskAccountAddress(networkId, accountAddress)
        : undefined,
    ]),
  );
  const { navigationToTxConfirm } = useSignatureConfirm({
    accountId,
    networkId,
  });
  const ensureRiskAccepted = useEarnRiskWarningGate();
  const activeTaskGroup = useMemo(
    () => ({ scope, detachers: new Set<() => void>() }),
    [scope],
  );
  const activeTaskDetach = activeTaskGroup.detachers;
  useEffect(() => {
    return () => {
      activeTaskDetach.forEach((detach) => detach());
      activeTaskDetach.clear();
    };
  }, [activeTaskDetach]);
  const waitForTxConfirmResult = useCallback(
    async ({
      encodedTx,
      stakingInfo,
      isCurrent,
      beforeSend,
      onConfirmed,
      onLateBroadcastAccepted,
      signal,
      onCancelled,
      onFailed,
    }: {
      encodedTx?: IEncodedTx;
      stakingInfo?: IStakingInfo;
      isCurrent: () => boolean;
      beforeSend: () => Promise<void>;
      onConfirmed?: (
        data: ISendTxOnSuccessData[],
        wasSettled: boolean,
      ) => Promise<void>;
      onLateBroadcastAccepted?: (
        fact: IBroadcastAcceptedFact,
      ) => Promise<boolean>;
      signal?: AbortSignal;
      onCancelled?: () => void;
      onFailed?: () => void;
    }): Promise<ITxConfirmResult> =>
      new Promise((resolve, reject) => {
        let settled = false;
        let successHandled = false;
        let lateFact: Promise<boolean> | undefined;
        let successTxid: string | undefined;

        const resolveOnce = (result: ITxConfirmResult) => {
          if (settled) {
            return;
          }
          settled = true;
          signal?.removeEventListener('abort', onAbort);
          resolve(result);
        };

        const rejectOnce = (error: unknown) => {
          if (settled) {
            return;
          }
          settled = true;
          signal?.removeEventListener('abort', onAbort);
          reject(error);
        };

        function onAbort() {
          try {
            if (!settled) onCancelled?.();
          } finally {
            resolveOnce({ status: 'cancel' });
          }
        }
        if (signal?.aborted) {
          onAbort();
          return;
        }
        signal?.addEventListener('abort', onAbort, { once: true });

        void navigationToTxConfirm({
          encodedTx,
          stakingInfo,
          isNavigationCurrent: isCurrent,
          onBeforeSend: beforeSend,
          onLateBroadcastAccepted: onLateBroadcastAccepted
            ? async (fact) => {
                if (successTxid && successTxid === fact.txid) return;
                const current = onLateBroadcastAccepted(fact);
                lateFact = lateFact
                  ? Promise.all([lateFact, current]).then(
                      ([first, second]) => first || second,
                    )
                  : current;
                await current;
              }
            : undefined,
          onSuccess: (data) => {
            if (successHandled) return;
            successHandled = true;
            successTxid = getLatestTxId(data);
            const wasSettled = settled;
            void (async () => {
              try {
                if (lateFact && (await lateFact)) return;
                await onConfirmed?.(data, wasSettled);
                resolveOnce({ status: 'success', data });
              } catch (error) {
                if (settled) {
                  console.error(
                    'Unable to complete Borrow confirmation callback',
                  );
                } else {
                  rejectOnce(error);
                }
              }
            })();
          },
          onFail: (error) => {
            try {
              if (!settled) onFailed?.();
            } finally {
              rejectOnce(error);
            }
          },
          onCancel: () => {
            try {
              if (!settled) onCancelled?.();
            } finally {
              resolveOnce({ status: 'cancel' });
            }
          },
        })
          .then(() => {
            if (!isCurrent()) resolveOnce({ status: 'cancel' });
          })
          .catch((error) => rejectOnce(error));
      }),
    [navigationToTxConfirm],
  );

  return useCallback(
    async ({
      amount,
      provider,
      marketAddress,
      reserveAddress,
      collateralReserveAddress,
      needsSetupLut,
      repayAll,
      slippageBps,
      routeKey,
      stakingInfo,
      onSetupLutReadyForRepay,
      isActionCurrent,
      onSuccess,
      onFail,
    }: IBorrowBuildTxParams): Promise<boolean> => {
      const isScopeCurrent = scope.capture();
      const isCurrent = () => isScopeCurrent() && (isActionCurrent?.() ?? true);
      if (!isCurrent()) return false;
      // OK-59196: one-time DeFi risk disclaimer, same gate the earn stake flow
      // uses.
      if (
        !(await ensureRiskAccepted({
          provider,
          symbol: getRiskGateSymbol(stakingInfo),
          networkId,
        }))
      ) {
        return false;
      }
      if (!isCurrent()) return false;

      try {
        const frozenAddress =
          accountAddress ??
          (await getTaskAccountAddress({ accountId, networkId }));
        const verifyAccount = async () => {
          if (
            !isCurrent() ||
            !(await isTaskAccountCurrent({
              accountId,
              networkId,
              accountAddress: frozenAddress,
            })) ||
            !isCurrent()
          ) {
            throw new OneKeyLocalError(
              'Borrow transaction confirmation expired',
            );
          }
        };
        await verifyAccount();
        if (!collateralReserveAddress) {
          throw new OneKeyLocalError('collateralReserveAddress is required');
        }
        const intent: ICollateralRepayIntent = {
          amount,
          marketAddress,
          reserveAddress,
          collateralReserveAddress,
          repayAll,
          slippageBps,
          routeKey,
        };
        const key = { accountId, networkId, accountAddress: frozenAddress };
        const pending = () => {
          Toast.message({
            title: intl.formatMessage({ id: ETranslations.global_pending }),
            message: intl.formatMessage({
              id: ETranslations.wallet_transaction_maybe_already_submitted_check_activity__msg,
            }),
          });
          return false;
        };
        const sameIntent = (
          left: ICollateralRepayIntent,
          right: ICollateralRepayIntent,
        ) =>
          JSON.stringify([
            left.amount,
            left.marketAddress,
            left.reserveAddress,
            left.collateralReserveAddress,
            left.repayAll,
            left.slippageBps,
            left.routeKey,
          ]) ===
          JSON.stringify([
            right.amount,
            right.marketAddress,
            right.reserveAddress,
            right.collateralReserveAddress,
            right.repayAll,
            right.slippageBps,
            right.routeKey,
          ]);
        const sameSetupRoute = (task: ICollateralRepayTask) => {
          const previous = task.getTask().identity;
          return (
            previous.accountId === accountId &&
            previous.networkId === networkId &&
            previous.provider.toLowerCase() === provider.toLowerCase() &&
            previous.intent.marketAddress === marketAddress &&
            previous.intent.reserveAddress === reserveAddress &&
            previous.intent.collateralReserveAddress ===
              collateralReserveAddress
          );
        };
        let entry = borrowCollateralRepayRegistry.findReservation(key);
        if (entry?.type === 'conflict') return pending();
        const createTask = (
          preparation: 'setup' | 'freshQuote' | 'direct',
          predecessor?: ICollateralRepayTask,
        ) =>
          createBorrowCollateralRepayTask({
            identity: {
              accountId,
              accountAddress: frozenAddress,
              networkId,
              provider,
              action: 'repayWithCollateral',
              intent,
            },
            preparation,
            predecessor,
            failedMessage: intl.formatMessage({
              id: ETranslations.global_failed,
            }),
            onAsyncError: (error) => {
              if (isCurrent()) {
                Toast.error({
                  title:
                    error instanceof Error
                      ? error.message
                      : intl.formatMessage({ id: ETranslations.global_failed }),
                });
              }
            },
          });
        if (!entry) {
          const task = createTask(needsSetupLut ? 'setup' : 'direct');
          const reservation = borrowCollateralRepayRegistry.reserve(key, task);
          if (reservation.type !== 'reserved') return pending();
          entry = { type: 'owned', controller: task, token: reservation.token };
        }
        let task = entry.controller;
        let reservationToken = entry.token;
        let changed = !sameIntent(task.getTask().identity.intent, intent);
        let didSucceed = false;
        const makeOwner = (
          currentTask: ICollateralRepayTask,
          stopAfterSetup: boolean,
          isOwnerActive: () => boolean = () => true,
        ): IBorrowCollateralRepayTaskOwner<ICollateralRepayIntent> => ({
          isCurrent: () =>
            isCurrent() &&
            isOwnerActive() &&
            (!stopAfterSetup || !hasReusableCollateralSetup(currentTask)),
          verify: verifyAccount,
          buildSetup: async (request) =>
            backgroundApiProxy.serviceStaking.borrowBuildSetupLutTransaction({
              networkId,
              accountId,
              expectedAccountAddress: frozenAddress,
              provider,
              marketAddress: request.marketAddress,
              reserveAddress: request.reserveAddress,
              collateralReserveAddress: request.collateralReserveAddress,
            }),
          confirmSetup: async ({
            built,
            signal,
            onBeforeSend,
            onConfirmed,
            onLateBroadcastAccepted,
            onCancelled,
            onFailed,
          }) => {
            const setupInfo = buildBorrowTrackingStakingInfo({
              stakingInfo,
              orderId: built.orderId,
            });
            const result = await waitForTxConfirmResult({
              encodedTx: parseBorrowEncodedTx(built.tx),
              stakingInfo: setupInfo,
              isCurrent,
              beforeSend: onBeforeSend,
              signal,
              onCancelled,
              onFailed,
              onLateBroadcastAccepted: async (fact) => {
                if (
                  fact.accountId !== accountId ||
                  fact.networkId !== networkId ||
                  !fact.uuid.trim() ||
                  !fact.txid.trim()
                )
                  return false;
                return onLateBroadcastAccepted(fact.txid);
              },
              onConfirmed: async (data, wasSettled) => {
                const txid = getLatestTxId(data);
                if (!txid)
                  throw new OneKeyLocalError(
                    intl.formatMessage({ id: ETranslations.global_failed }),
                  );
                await onConfirmed(
                  txid,
                  data[data.length - 1]?.decodedTx.status ??
                    EDecodedTxStatus.Pending,
                  wasSettled,
                );
              },
            });
            return result.status === 'success';
          },
          recordSetup: async ({
            txid,
            orderId,
            status,
            preserveExistingTx,
          }) => {
            if (!orderId) return 'notTracked';
            const setupInfo = buildBorrowTrackingStakingInfo({
              stakingInfo,
              orderId,
            });
            const result = await backgroundApiProxy.serviceStaking.addEarnOrder(
              {
                orderId,
                networkId,
                txId: txid,
                status,
                ...getEarnOrderTrackingInfo(setupInfo),
              },
              {
                remoteSync: 'once',
                ...(preserveExistingTx ? { preserveExistingTx: true } : {}),
              },
            );
            if (!result || result.remoteStatus === 'failed')
              return 'remoteUnknown';
            if (
              (result.localStatus === 'failed' ||
                result.localStatus === 'unavailable') &&
              result.remoteStatus === 'notAttempted'
            )
              return 'localFailed';
            if (result.remoteStatus !== 'synced') return 'remoteUnknown';
            return 'saved';
          },
          finality: async (txid) => {
            const result =
              await backgroundApiProxy.serviceStaking.waitForSolTxFinalized({
                networkId,
                txId: txid,
              });
            if (currentTask.getSetupTask().facts?.orderId) {
              await backgroundApiProxy.serviceStaking.updateOrderStatusByTxId({
                currentTxId: txid,
                status: mapBorrowLutFinalizationToTxStatus(result),
              });
            }
            return result;
          },
          propagate: async () => {
            await timerUtils.wait(LUT_PROPAGATION_BUFFER_MS);
            await verifyAccount();
            onSetupLutReadyForRepay?.();
          },
          quote: async (request) => {
            await verifyAccount();
            return backgroundApiProxy.serviceStaking.getBorrowRepayWithCollateralQuote(
              {
                networkId,
                accountId,
                expectedAccountAddress: frozenAddress,
                provider,
                marketAddress: request.marketAddress,
                reserveAddress: request.reserveAddress,
                collateralReserveAddress: request.collateralReserveAddress,
                amount: request.amount,
                repayAll: request.repayAll,
                slippageBps: request.slippageBps,
              },
            );
          },
          buildRepay: async (request, quote) =>
            backgroundApiProxy.serviceStaking.borrowBuildRepayWithCollateralTransaction(
              {
                networkId,
                accountId,
                expectedAccountAddress: frozenAddress,
                provider,
                marketAddress: request.marketAddress,
                reserveAddress: request.reserveAddress,
                collateralReserveAddress: request.collateralReserveAddress,
                amount: request.amount,
                repayAll: request.repayAll,
                slippageBps: request.slippageBps,
                routeKey: quote ? quote.routeKey : request.routeKey,
              },
            ),
          confirmRepay: async ({
            built,
            signal,
            onBeforeSend,
            onConfirmed,
            onLateBroadcastAccepted,
            onCancelled,
            onFailed,
            onCompleted,
            onCallbackFailed,
          }) => {
            const info = attachBorrowOrderId({
              stakingInfo: attachRepayWithCollateralAmount({
                stakingInfo,
                amount: built.quote?.swapIn,
              }),
              orderId: built.orderId,
            });
            if (hasReusableCollateralSetup(currentTask)) {
              await timerUtils.wait(SIGNATURE_MODAL_SETTLE_WAIT_MS);
              await verifyAccount();
            }
            const observeLateOrder = createLateEarnOrderObserver({
              accountId,
              networkId,
              onError: () =>
                console.error('Unable to record late Borrow order'),
            });
            const result = await waitForTxConfirmResult({
              encodedTx: parseBorrowEncodedTx(built.tx),
              stakingInfo: info,
              isCurrent,
              beforeSend: onBeforeSend,
              signal,
              onCancelled,
              onFailed,
              onLateBroadcastAccepted: async (fact) => {
                let accepted = false;
                if (
                  fact.accountId !== accountId ||
                  fact.networkId !== networkId ||
                  !fact.uuid.trim() ||
                  !fact.txid.trim()
                )
                  return false;
                accepted = await onLateBroadcastAccepted(fact.txid);
                await observeLateOrder({
                  fact,
                  stakeInfo: info,
                  orderId: built.orderId,
                  onAccepted: () => accepted,
                });
                return accepted;
              },
              onConfirmed: async (data, wasSettled) => {
                const txid = getLatestTxId(data);
                await onConfirmed(txid ?? '');
                try {
                  if (wasSettled) {
                    if (built.orderId && txid) {
                      await backgroundApiProxy.serviceStaking.addEarnOrder(
                        {
                          orderId: built.orderId,
                          networkId,
                          txId: txid,
                          status: data[data.length - 1]?.decodedTx.status,
                          ...getEarnOrderTrackingInfo(info),
                        },
                        { remoteSync: 'once', preserveExistingTx: true },
                      );
                    }
                    onCompleted();
                    return;
                  }
                  await handleBorrowSuccess({
                    data,
                    orderId: built.orderId,
                    networkId,
                    accountId:
                      !wasSettled && isCurrent() && isOwnerActive()
                        ? accountId
                        : undefined,
                    expectedAccountAddress: frozenAddress,
                    stakingInfo: info,
                    onSuccess: (successData) => {
                      if (!wasSettled && isCurrent() && isOwnerActive())
                        onSuccess?.(successData);
                    },
                  });
                  onCompleted();
                } catch (error) {
                  onCallbackFailed();
                  throw error;
                }
                if (!wasSettled && isCurrent() && isOwnerActive())
                  didSucceed = true;
              },
            });
            return result.status === 'success';
          },
        });
        if (!sameSetupRoute(task)) {
          const previous = task.getTask();
          if (previous.identity.accountId !== accountId) return pending();
          const active = previous.steps.some(
            (step) =>
              [
                'preparing',
                'awaitingUser',
                'sending',
                'confirming',
                'verifying',
                'executing',
                'checking',
              ].includes(step.status.type) ||
              (step.kind !== 'wait' && step.status.type === 'unknown'),
          );
          const priorRepay = previous.steps.find((step) => step.id === 'repay');
          if (
            active ||
            (priorRepay?.status.type === 'handedOff' &&
              previous.facts?.repayCallback !== 'completed')
          )
            return pending();
          const setup = task.getSetupTask();
          if (setup.steps.some((step) => step.id === 'setup')) {
            const setupStep = setup.steps.find((step) => step.id === 'setup');
            const cancelledBeforeSend =
              needsSetupLut &&
              setupStep?.status.type === 'cancelled' &&
              setup.facts?.recording === 'notStarted' &&
              setup.facts.finality === 'notQueried';
            if (!cancelledBeforeSend) {
              // Remote order sync failure does not make a finalized LUT ambiguous.
              if (
                setup.facts?.recording !== 'saved' &&
                setup.facts?.recording !== 'remoteUnknown' &&
                setup.facts?.recording !== 'notTracked'
              )
                return pending();
              const finality =
                setup.facts.finality === 'pending'
                  ? await task.refreshSetupFinality(makeOwner(task, false))
                  : setup.facts.finality;
              if (!isCurrent()) return false;
              if (finality !== 'confirmed' && finality !== 'failed')
                return pending();
            }
          }
          const replacement = createTask(needsSetupLut ? 'setup' : 'direct');
          const nextToken = borrowCollateralRepayRegistry.replace(
            key,
            reservationToken,
            replacement,
          );
          if (!nextToken) return pending();
          task = replacement;
          reservationToken = nextToken;
          changed = false;
        }
        const runTask = async (
          currentTask: ICollateralRepayTask,
          stopAfterSetup: boolean,
        ) => {
          let token: symbol;
          const ownerLease = { active: true };
          try {
            token = currentTask.attachOwner(
              makeOwner(currentTask, stopAfterSetup, () => ownerLease.active),
            );
          } catch (error) {
            if (
              error instanceof OneKeyLocalError &&
              error.message === 'Earn workflow owner unavailable'
            )
              return 'busy' as const;
            throw error;
          }
          const detach = () => {
            ownerLease.active = false;
            return currentTask.detachOwner(token);
          };
          activeTaskDetach.add(detach);
          try {
            if (currentTask.getTask().facts?.recording === 'localFailed')
              await currentTask.retryRecording(token);
            const state = currentTask.getTask();
            const step = state.steps[state.currentStepIndex];
            if (
              step?.kind === 'wait' &&
              (step.status.type === 'unknown' ||
                step.status.type === 'cancelled' ||
                step.status.type === 'failed')
            )
              return await currentTask.tryRetryWait(token);
            if (
              step &&
              step.kind !== 'wait' &&
              step.kind !== 'sign' &&
              step.kind !== 'external' &&
              (step.status.type === 'cancelled' ||
                step.status.type === 'failed')
            )
              return await currentTask.tryRetryTransaction(token);
            return await currentTask.tryRun(token);
          } finally {
            activeTaskDetach.delete(detach);
            detach();
          }
        };
        if (task.getSetupTask().facts?.finality === 'failed') {
          const priorRepay = task
            .getTask()
            .steps.find((step) => step.id === 'repay');
          if (
            priorRepay &&
            [
              'awaitingUser',
              'sending',
              'confirming',
              'verifying',
              'unknown',
              'handedOff',
            ].includes(priorRepay.status.type)
          )
            return pending();
          const next = createTask('setup');
          const nextToken = borrowCollateralRepayRegistry.replace(
            key,
            reservationToken,
            next,
          );
          if (!nextToken) return pending();
          task = next;
          reservationToken = nextToken;
          changed = false;
        }
        if (
          changed &&
          task.getSetupTask().steps.some((step) => step.id === 'setup') &&
          !hasReusableCollateralSetup(task)
        ) {
          const result = await runTask(task, true);
          if (!isCurrent()) return false;
          if (result === 'busy' || !hasReusableCollateralSetup(task))
            return pending();
        }
        if (changed) {
          const current = task.getTask();
          const repay = current.steps[current.currentStepIndex];
          if (
            repay?.id === 'repay' &&
            repay.status.type === 'unknown' &&
            'txid' in repay.status &&
            repay.status.txid &&
            current.facts?.repayCallback === 'completed'
          ) {
            const result = await runTask(task, false);
            if (!isCurrent()) return false;
            if (result !== 'started') return pending();
          }
        }
        if (
          changed ||
          task.getTask().currentStepIndex >= task.getTask().steps.length
        ) {
          const current = task.getTask();
          const repay = current.steps.find((step) => step.id === 'repay');
          if (
            repay &&
            [
              'awaitingUser',
              'sending',
              'confirming',
              'verifying',
              'unknown',
            ].includes(repay.status.type)
          )
            return pending();
          if (
            repay?.status.type === 'handedOff' &&
            current.facts?.repayCallback !== 'completed'
          )
            return pending();
          const hasSetup = hasReusableCollateralSetup(task);
          if (!hasSetup && current.steps.some((step) => step.id === 'setup'))
            return pending();
          let preparation: 'setup' | 'freshQuote' | 'direct' = 'direct';
          if (hasSetup) preparation = 'freshQuote';
          else if (needsSetupLut) preparation = 'setup';
          const next = createTask(preparation, hasSetup ? task : undefined);
          const nextToken = borrowCollateralRepayRegistry.replace(
            key,
            reservationToken,
            next,
          );
          if (!nextToken) return pending();
          task = next;
          reservationToken = nextToken;
          changed = false;
        }
        const outcome = await runTask(task, false);
        if (!isCurrent()) return false;
        if (outcome !== 'started') return pending();
        if (task.getTask().facts?.recording === 'localFailed') return pending();
        if (
          didSucceed &&
          !task.getTask().steps.some((step) => step.id === 'setup') &&
          task.getSetupTask() === task.getTask()
        ) {
          borrowCollateralRepayRegistry.release(key, reservationToken);
        }
        return didSucceed;
      } catch (error) {
        if (!isCurrent()) return false;
        Toast.error({
          title:
            error instanceof Error && error.message
              ? error.message
              : intl.formatMessage({
                  id: ETranslations.global_failed,
                }),
        });
        onFail?.(error as Error);
        return false;
      }
    },
    [
      accountAddress,
      accountId,
      activeTaskDetach,
      ensureRiskAccepted,
      intl,
      networkId,
      scope,
      waitForTxConfirmResult,
    ],
  );
}

type IBorrowClaimTxParams = {
  provider: string;
  marketAddress: string;
  ids: string[];
  stakingInfo?: IStakingInfo;
  onSuccess?: IModalSendParamList['SendConfirm']['onSuccess'];
  onFail?: IModalSendParamList['SendConfirm']['onFail'];
};

/**
 * Resolves true once the flow has been handed to the transaction confirm page,
 * false when it never started — today only a declined risk disclaimer, but the
 * point is that no callback fires and nothing throws on that path. A caller
 * that took a lock (submit guard, spinner) before calling MUST release it on
 * false; `onSuccess` / `onFail` / `onCancel` are never invoked.
 */
export function useUniversalBorrowClaim({
  networkId,
  accountId,
  accountAddress,
}: {
  networkId: string;
  accountId: string;
  accountAddress?: string;
}) {
  const { navigationToTxConfirm } = useSignatureConfirm({
    accountId,
    networkId,
  });

  const ensureRiskAccepted = useEarnRiskWarningGate();
  const scope = useCommittedEarnScopeGuard(
    JSON.stringify([
      accountId,
      networkId,
      accountAddress
        ? normalizeTaskAccountAddress(networkId, accountAddress)
        : undefined,
    ]),
  );

  return useCallback(
    async ({
      provider,
      marketAddress,
      ids,
      stakingInfo,
      onSuccess,
      onFail,
    }: IBorrowClaimTxParams): Promise<boolean> => {
      const isCurrent = scope.capture();
      if (!isCurrent()) return false;
      const selectedIds = [...ids];
      // OK-59196: one-time DeFi risk disclaimer, same gate the earn stake flow
      // uses.
      if (
        !(await ensureRiskAccepted({
          provider,
          symbol: getRiskGateSymbol(stakingInfo),
          networkId,
        }))
      ) {
        return false;
      }
      if (!isCurrent()) return false;

      return runBorrowConfirmationTask({
        identity: {
          accountId,
          networkId,
          accountAddress,
          provider,
          action: 'claim',
          intent: { marketAddress, ids: selectedIds },
        },
        build: () =>
          backgroundApiProxy.serviceStaking.borrowBuildClaimTransaction({
            networkId,
            accountId,
            provider,
            marketAddress,
            ids: selectedIds,
          }),
        stakingInfo,
        navigationToTxConfirm,
        isCurrent,
        onSuccess,
        onFail,
      });
    },
    [
      accountAddress,
      accountId,
      ensureRiskAccepted,
      networkId,
      navigationToTxConfirm,
      scope,
    ],
  );
}

export function useUniversalBorrowSetEMode({
  networkId,
  accountId,
  waitForFinalStatus = true,
}: {
  networkId: string;
  accountId: string;
  waitForFinalStatus?: boolean;
}) {
  const { navigationToTxConfirm } = useSignatureConfirm({
    accountId,
    networkId,
  });
  const intl = useIntl();
  const ensureRiskAccepted = useEarnRiskWarningGate();

  return useCallback(
    async ({
      provider,
      marketAddress,
      eModeId,
      stakingInfo,
      ignoreOrderTrackingError,
      onSuccess,
      onFail,
      onCancel,
    }: {
      provider: string;
      marketAddress: string;
      eModeId: number;
      stakingInfo?: IStakingInfo;
      ignoreOrderTrackingError?: boolean;
      onSuccess?: IModalSendParamList['SendConfirm']['onSuccess'];
      onFail?: IModalSendParamList['SendConfirm']['onFail'];
      onCancel?: () => void;
    }): Promise<IBorrowEModeSwitchCheck | undefined> => {
      // OK-59196: an existing position can make this its first DeFi transaction
      // after the upgrade, so gate before the first background request. Calls
      // onCancel so callers that only listen to it (armed eMode steps) unwind
      // exactly as they do for a cancelled confirm.
      if (
        !(await ensureRiskAccepted({
          provider,
          symbol: getRiskGateSymbol(stakingInfo),
          networkId,
        }))
      ) {
        onCancel?.();
        return undefined;
      }

      let switchCheckResp;
      try {
        switchCheckResp =
          await backgroundApiProxy.serviceStaking.borrowSwitchCheckEMode({
            networkId,
            accountId,
            provider,
            marketAddress,
            targetEModeId: eModeId,
            autoHandleError: false,
          });
      } catch (error) {
        if (
          (error as { autoToast?: boolean } | undefined)?.autoToast !== true
        ) {
          const message = (error as { message?: unknown } | undefined)?.message;
          Toast.error({
            title:
              typeof message === 'string' && message
                ? message
                : intl.formatMessage({ id: ETranslations.global_failed }),
          });
        }
        throw error;
      }

      if (switchCheckResp.code !== 0 || !switchCheckResp.data) {
        const message =
          switchCheckResp.message ||
          intl.formatMessage({ id: ETranslations.global_failed });
        Toast.error({ title: message });
        throw new OneKeyLocalError({
          message,
          autoToast: false,
        });
      }

      const latestCheck = switchCheckResp.data;
      if (!latestCheck.canSwitch) {
        return latestCheck;
      }

      const resp =
        await backgroundApiProxy.serviceStaking.borrowBuildSetEModeTransaction({
          networkId,
          accountId,
          provider,
          marketAddress,
          eModeId,
        });
      const stakingInfoWithOrderId = attachBorrowOrderId({
        stakingInfo,
        orderId: resp.orderId,
      });
      await navigationToTxConfirm({
        encodedTx: parseBorrowEncodedTx(resp.tx),
        stakingInfo: stakingInfoWithOrderId,
        onSuccess: async (data) => {
          await handleBorrowSuccess({
            data,
            orderId: resp.orderId,
            networkId,
            accountId,
            stakingInfo: stakingInfoWithOrderId,
            waitForFinalStatus,
            ignoreOrderTrackingError,
            onSuccess,
          });
        },
        onFail,
        onCancel,
      });
      return latestCheck;
    },
    [
      accountId,
      ensureRiskAccepted,
      intl,
      networkId,
      navigationToTxConfirm,
      waitForFinalStatus,
    ],
  );
}

export function useUniversalBorrowSetCollateral({
  networkId,
  accountId,
  accountAddress,
  ownerScope,
}: {
  networkId: string;
  accountId: string;
  accountAddress?: string;
  ownerScope?: string;
}) {
  const { navigationToTxConfirm } = useSignatureConfirm({
    accountId,
    networkId,
  });
  const intl = useIntl();
  const ensureRiskAccepted = useEarnRiskWarningGate();
  const scope = useCommittedEarnScopeGuard(
    JSON.stringify([
      accountId,
      networkId,
      ownerScope,
      accountAddress
        ? normalizeTaskAccountAddress(networkId, accountAddress)
        : undefined,
    ]),
  );

  return useCallback(
    async ({
      provider,
      marketAddress,
      reserveAddress,
      useAsCollateral,
      accountAddress: actionAccountAddress,
      eModeId,
      stakingInfo,
      onSuccess,
      onFail,
      onCancel,
    }: {
      provider: string;
      marketAddress: string;
      reserveAddress: string;
      useAsCollateral: boolean;
      accountAddress?: string;
      eModeId?: number;
      stakingInfo?: IStakingInfo;
      onSuccess?: IModalSendParamList['SendConfirm']['onSuccess'];
      onFail?: IModalSendParamList['SendConfirm']['onFail'];
      onCancel?: () => void;
    }): Promise<boolean> => {
      const isCurrent = scope.capture();
      if (!isCurrent()) return false;
      // OK-59196: same reason as the eMode switch — this can be the first DeFi
      // transaction of an existing position, so gate before the first request.
      if (
        !(await ensureRiskAccepted({
          provider,
          symbol: getRiskGateSymbol(stakingInfo),
          networkId,
        }))
      ) {
        if (isCurrent()) onCancel?.();
        return false;
      }
      if (!isCurrent()) return false;

      let frozenAddress: string;
      let confirmation: IBorrowTransactionConfirmation | undefined;
      try {
        frozenAddress =
          actionAccountAddress ??
          accountAddress ??
          (await getTaskAccountAddress({ accountId, networkId }));
        if (!isCurrent()) return false;
        confirmation =
          await backgroundApiProxy.serviceStaking.getBorrowTransactionConfirmation(
            {
              networkId,
              accountId,
              expectedAccountAddress: frozenAddress,
              provider,
              marketAddress,
              reserveAddress,
              action: 'setCollateral',
              amount: '0',
              useAsCollateral,
              ...(useAsCollateral && eModeId !== undefined ? { eModeId } : {}),
            },
          );
      } catch (error) {
        if (!isCurrent()) return false;
        if (
          (error as { autoToast?: boolean } | undefined)?.autoToast !== true
        ) {
          const message = (error as { message?: unknown } | undefined)?.message;
          Toast.error({
            title:
              typeof message === 'string' && message
                ? message
                : intl.formatMessage({ id: ETranslations.global_failed }),
          });
        }
        throw error;
      }

      if (!isCurrent()) return false;

      const unavailable =
        !confirmation ||
        confirmation.liquidationRisk === true ||
        (useAsCollateral && confirmation.canBeCollateral === false);
      if (unavailable) {
        const message = intl.formatMessage({
          id:
            confirmation?.liquidationRisk === true
              ? ETranslations.defi_disable_collateral_liquidation_risk__desc
              : ETranslations.defi_action_unavailable__msg,
        });
        Toast.error({ title: message });
        throw new OneKeyLocalError({
          message,
          autoToast: false,
        });
      }

      return runBorrowConfirmationTask({
        identity: {
          accountId,
          networkId,
          accountAddress: frozenAddress,
          provider,
          action: 'setCollateral',
          intent: { marketAddress, reserveAddress, useAsCollateral, eModeId },
        },
        build: () =>
          backgroundApiProxy.serviceStaking.borrowBuildSetCollateralTransaction(
            {
              networkId,
              accountId,
              expectedAccountAddress: frozenAddress,
              provider,
              marketAddress,
              reserveAddress,
              useAsCollateral,
              ...(useAsCollateral && eModeId !== undefined ? { eModeId } : {}),
            },
          ),
        stakingInfo,
        navigationToTxConfirm,
        isCurrent,
        verifyAccountBeforeBuild: true,
        ignoreOrderTrackingError: true,
        onSuccess,
        onFail,
        onCancel,
      });
    },
    [
      accountAddress,
      accountId,
      ensureRiskAccepted,
      intl,
      networkId,
      navigationToTxConfirm,
      scope,
    ],
  );
}
