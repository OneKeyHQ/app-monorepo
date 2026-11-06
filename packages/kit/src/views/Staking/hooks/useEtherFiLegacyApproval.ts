import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import { HardwareErrorCode } from '@onekeyfe/hd-shared';
import BigNumber from 'bignumber.js';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useRouteIsFocusedWhenEnabled } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import { useSignatureConfirm } from '@onekeyhq/kit/src/hooks/useSignatureConfirm';
import { waitForTxFinalStatus } from '@onekeyhq/kit/src/utils/waitForTxFinalStatus';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IOneKeyError } from '@onekeyhq/shared/src/errors/types/errorTypes';
import { isHardwareErrorByCode } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EOnChainHistoryTxStatus } from '@onekeyhq/shared/types/history';
import { EReplaceTxType } from '@onekeyhq/shared/types/tx';

import type { IEarnActionGuardVerificationOptions } from './useEarnActionGuard';

const LIQUID_USD = '0x08c6f91e2b681faf5e17227f2a44c307b3c1364c';
const OLD_ATOMIC_QUEUE = '0xd45884b592e316eb816199615a95c182f75dea07';

type IStatus =
  | 'checking'
  | 'clear'
  | 'required'
  | 'submitting'
  | 'pending'
  | 'unknown';

export function useEtherFiLegacyApproval({
  accountId,
  accountAddress,
  networkId,
  provider,
  vault,
  onCleared,
  skip,
}: {
  accountId: string;
  accountAddress?: string;
  networkId: string;
  provider: string;
  vault?: string;
  onCleared?: () => void;
  skip?: boolean;
}) {
  const isEtherFi =
    !skip &&
    provider.toLowerCase() === 'etherfi' &&
    networkId === getNetworkIdsMap().eth;
  const applicable = isEtherFi && vault?.toLowerCase() === LIQUID_USD;
  const isFocused = useRouteIsFocusedWhenEnabled({ enabled: !!applicable });
  const scopeKey = JSON.stringify([
    accountId,
    accountAddress?.toLowerCase() ?? '',
    networkId,
    provider.toLowerCase(),
    vault ?? '',
    Boolean(skip),
  ]);
  const [scope, setScope] = useState(() => ({ key: scopeKey }));
  if (scope.key !== scopeKey) setScope({ key: scopeKey });
  const scopeRef = useRef(scope);
  const generation = useRef(0);
  const refreshSequence = useRef(0);
  const refreshDiscoveryRef = useRef<number | undefined>(undefined);
  const abortRef = useRef<AbortController | undefined>(undefined);
  const pendingTxIdRef = useRef<string | undefined>(undefined);
  const pendingIsCancelRef = useRef(false);
  const pendingMayIncreaseRef = useRef(false);
  const unobservedIncreaseRef = useRef(false);
  const pendingIncreaseCancellationRef = useRef<string | undefined>(undefined);
  const otherIncreasesRef = useRef(new Set<string>());
  const [state, setState] = useState<{ scope: typeof scope; status: IStatus }>({
    scope,
    status: 'checking',
  });
  const status = state.scope === scope ? state.status : 'checking';
  const statusRef = useRef<{ scope: typeof scope; status: IStatus }>({
    scope,
    status: 'checking',
  });
  useLayoutEffect(() => {
    scopeRef.current = scope;
    if (statusRef.current.scope !== scope) {
      statusRef.current = { scope, status: 'checking' };
    }
  }, [scope]);
  const visibilityRef = useRef({ active: false, generation: 0 });
  const revokeSendStartedRef = useRef(false);
  const interruptedRevokeRef = useRef<
    { scope: typeof scope; sendStarted: boolean } | undefined
  >(undefined);
  useLayoutEffect(() => {
    const visibility = visibilityRef.current;
    visibility.active = true;
    visibility.generation += 1;
    const interrupted = interruptedRevokeRef.current;
    interruptedRevokeRef.current = undefined;
    if (
      interrupted?.scope === scope &&
      statusRef.current.scope === scope &&
      statusRef.current.status === 'submitting'
    ) {
      const next = {
        scope,
        status: interrupted.sendStarted
          ? ('pending' as const)
          : ('unknown' as const),
      };
      statusRef.current = next;
      setState(next);
    }
    return () => {
      visibility.active = false;
      visibility.generation += 1;
      if (
        statusRef.current.scope === scope &&
        statusRef.current.status === 'submitting'
      ) {
        interruptedRevokeRef.current = {
          scope,
          sendStarted: revokeSendStartedRef.current,
        };
      }
    };
  }, [scope]);
  const setStatus = useCallback(
    (next: { scope: typeof scope; status: IStatus }) => {
      if (scopeRef.current !== next.scope) return;
      statusRef.current = next;
      setState(next);
    },
    [],
  );
  const mountedRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  const onClearedRef = useRef(onCleared);
  useLayoutEffect(() => {
    onClearedRef.current = onCleared;
  }, [onCleared]);
  const { navigationToTxConfirm } = useSignatureConfirm({
    accountId,
    networkId,
  });

  const read = useCallback(async () => {
    if (!accountAddress)
      throw new OneKeyLocalError('Legacy approval account unavailable');
    const result = await backgroundApiProxy.serviceStaking.fetchTokenAllowance({
      accountId,
      networkId,
      tokenAddress: LIQUID_USD,
      spenderAddress: OLD_ATOMIC_QUEUE,
      expectedAccountAddress: accountAddress,
    });
    const value = new BigNumber(result.allowanceParsed);
    if (!value.isFinite() || value.isNegative())
      throw new OneKeyLocalError('Invalid allowance');
    return value.isZero();
  }, [accountAddress, accountId, networkId]);

  const findPendingQueueApproval = useCallback(
    async (excludeTxid?: string) => {
      const resolvedAddress =
        await backgroundApiProxy.serviceAccount.getAccountAddressForApi({
          accountId,
          networkId,
        });
      if (
        !accountAddress ||
        resolvedAddress.toLowerCase() !== accountAddress.toLowerCase()
      ) {
        throw new OneKeyLocalError('Legacy approval account changed');
      }
      const transactions =
        await backgroundApiProxy.serviceHistory.getAccountLocalHistoryPendingTxs(
          {
            accountAddress: resolvedAddress,
            networkId,
          },
        );
      const matches = transactions.filter(({ decodedTx }) => {
        if (
          excludeTxid &&
          decodedTx.txid.toLowerCase() === excludeTxid.toLowerCase()
        )
          return false;
        const approval = decodedTx.approveInfo;
        if (
          approval?.spender?.toLowerCase() === OLD_ATOMIC_QUEUE &&
          approval.tokenInfo?.address.toLowerCase() === LIQUID_USD
        )
          return true;
        return decodedTx.actions.some(
          ({ tokenApprove }) =>
            tokenApprove?.spender?.toLowerCase() === OLD_ATOMIC_QUEUE &&
            tokenApprove.tokenIdOnNetwork.toLowerCase() === LIQUID_USD,
        );
      });
      const describe = (transaction: (typeof transactions)[number]) => {
        const approval = transaction.decodedTx.approveInfo;
        const amounts = transaction.decodedTx.actions.flatMap(
          ({ tokenApprove }) =>
            tokenApprove?.spender?.toLowerCase() === OLD_ATOMIC_QUEUE &&
            tokenApprove.tokenIdOnNetwork.toLowerCase() === LIQUID_USD
              ? [tokenApprove.amount]
              : [],
        );
        if (
          approval?.spender?.toLowerCase() === OLD_ATOMIC_QUEUE &&
          approval.tokenInfo?.address.toLowerCase() === LIQUID_USD
        ) {
          amounts.push(approval.amount);
        }
        return {
          txid: transaction.decodedTx.txid,
          isCancel: transaction.replacedType === EReplaceTxType.Cancel,
          mayIncrease: amounts.some((amount) => {
            const amountBN = new BigNumber(amount);
            return !amountBN.isFinite() || !amountBN.isZero();
          }),
        };
      };
      const [transaction, ...others] = matches.map(describe);
      return transaction
        ? {
            ...transaction,
            otherIncreases: others
              .filter((other) => other.mayIncrease && !other.isCancel)
              .map((other) => other.txid.toLowerCase()),
          }
        : undefined;
    },
    [accountAddress, accountId, networkId],
  );

  const observeOtherIncreases = useCallback((txids: string[]) => {
    txids.forEach((txid) => otherIncreasesRef.current.add(txid));
  }, []);

  const findPendingReplacement = useCallback(
    async (txid: string) => {
      const [resolvedAddress, xpub] = await Promise.all([
        backgroundApiProxy.serviceAccount.getAccountAddressForApi({
          accountId,
          networkId,
        }),
        backgroundApiProxy.serviceAccount.getAccountXpub({
          accountId,
          networkId,
        }),
      ]);
      if (
        !accountAddress ||
        resolvedAddress.toLowerCase() !== accountAddress.toLowerCase()
      ) {
        throw new OneKeyLocalError('Legacy approval account changed');
      }
      let historyId = accountUtils.buildLocalHistoryId({
        accountAddress: resolvedAddress,
        networkId,
        txid,
        xpub,
      });
      const visited = new Set<string>();
      let hasReplacement = false;

      while (historyId && !visited.has(historyId) && visited.size < 32) {
        visited.add(historyId);
        const transaction =
          await backgroundApiProxy.serviceHistory.getLocalHistoryTxById({
            accountId,
            networkId,
            historyId,
          });
        if (!transaction) return undefined;
        if (!transaction.replacedNextId) {
          return hasReplacement && transaction.decodedTx.txid
            ? {
                txid: transaction.decodedTx.txid,
                isCancel: transaction.replacedType === EReplaceTxType.Cancel,
              }
            : undefined;
        }
        hasReplacement = true;
        historyId = transaction.replacedNextId;
      }
      return undefined;
    },
    [accountAddress, accountId, networkId],
  );

  const reconcileOtherIncreases = useCallback(
    async (
      clear: boolean,
      isCurrent: () => boolean,
      options?: { preserveConfirmed: boolean },
    ) => {
      const txids = [...otherIncreasesRef.current];
      const settled = await Promise.all(
        txids.map(async (txid) => {
          try {
            const details =
              await backgroundApiProxy.serviceHistory.fetchTxDetails({
                accountId,
                networkId,
                txid,
              });
            const txStatus = details?.data?.status;
            if (txStatus === EOnChainHistoryTxStatus.Failed)
              return 'settled' as const;
            if (txStatus === EOnChainHistoryTxStatus.Success)
              return clear ? ('unknown' as const) : ('increase' as const);
            const replacement = await findPendingReplacement(txid);
            if (!replacement) return 'unknown' as const;
            const replacementDetails =
              await backgroundApiProxy.serviceHistory.fetchTxDetails({
                accountId,
                networkId,
                txid: replacement.txid,
              });
            const replacementStatus = replacementDetails?.data?.status;
            if (
              replacementStatus === EOnChainHistoryTxStatus.Failed ||
              (replacementStatus === EOnChainHistoryTxStatus.Success &&
                replacement.isCancel)
            )
              return 'settled' as const;
            if (replacementStatus === EOnChainHistoryTxStatus.Success && !clear)
              return 'increase' as const;
            return 'unknown' as const;
          } catch {
            return 'unknown' as const;
          }
        }),
      );
      if (!isCurrent()) return false;
      const inspected = new Set(txids);
      const hasUnknown =
        options?.preserveConfirmed ||
        settled.includes('unknown') ||
        [...otherIncreasesRef.current].some((txid) => !inspected.has(txid));
      settled.forEach((result, index) => {
        if (result === 'settled' || (result === 'increase' && !hasUnknown))
          otherIncreasesRef.current.delete(txids[index]);
      });
      return settled.includes('increase');
    },
    [accountId, findPendingReplacement, networkId],
  );

  const monitorTx = useCallback(
    async function monitorLegacyTransaction(
      txid: string,
      id: number,
      controller: AbortController,
      previousTxids = new Set<string>(),
    ): Promise<void> {
      const current = () =>
        id === generation.current &&
        scopeRef.current === scope &&
        pendingTxIdRef.current?.toLowerCase() === txid.toLowerCase() &&
        !controller.signal.aborted;
      const canSettle = () =>
        current() && refreshDiscoveryRef.current === undefined;
      const txidKey = txid.toLowerCase();
      if (!current() || previousTxids.has(txidKey) || previousTxids.size >= 32)
        return;
      const monitoredTxids = new Set(previousTxids).add(txidKey);
      const monitorNext = (
        pending: NonNullable<
          Awaited<ReturnType<typeof findPendingQueueApproval>>
        >,
      ) => {
        observeOtherIncreases(pending.otherIncreases);
        if (refreshDiscoveryRef.current === undefined)
          refreshSequence.current += 1;
        pendingTxIdRef.current = pending.txid;
        pendingIsCancelRef.current = pending.isCancel;
        pendingMayIncreaseRef.current = pending.mayIncrease;
        setStatus({ scope, status: 'pending' });
        if (
          !monitoredTxids.has(pending.txid.toLowerCase()) &&
          monitoredTxids.size < 32
        ) {
          void monitorLegacyTransaction(
            pending.txid,
            id,
            controller,
            monitoredTxids,
          );
        }
      };
      try {
        const finalStatus = await waitForTxFinalStatus({
          accountId,
          networkId,
          txid,
          signal: controller.signal,
        });
        if (!current()) return;
        const isTrackedCancellation =
          pendingIncreaseCancellationRef.current === txidKey;
        if (
          finalStatus === EOnChainHistoryTxStatus.Failed &&
          !isTrackedCancellation
        ) {
          if (!canSettle()) return;
          generation.current += 1;
          pendingTxIdRef.current = undefined;
          setStatus({ scope, status: 'unknown' });
          return;
        }
        if (
          finalStatus !== EOnChainHistoryTxStatus.Success &&
          !(
            isTrackedCancellation &&
            finalStatus === EOnChainHistoryTxStatus.Failed
          )
        )
          return;
        if (isTrackedCancellation)
          pendingIncreaseCancellationRef.current = undefined;
        if (pendingMayIncreaseRef.current && !pendingIsCancelRef.current) {
          unobservedIncreaseRef.current = true;
        }
        const otherPending = await findPendingQueueApproval(txid);
        if (!current()) return;
        if (otherPending) {
          monitorNext(otherPending);
          return;
        }
        if (pendingMayIncreaseRef.current && !pendingIsCancelRef.current) {
          setStatus({ scope, status: 'pending' });
          for (let attempt = 0; attempt < 15 && current(); attempt += 1) {
            try {
              const clear = await read();
              if (!current()) return;
              if (!clear) {
                await reconcileOtherIncreases(clear, canSettle);
                if (!current()) return;
                const latestPending = await findPendingQueueApproval(txid);
                if (!current()) return;
                unobservedIncreaseRef.current = false;
                if (latestPending) {
                  monitorNext(latestPending);
                  return;
                }
                if (!otherIncreasesRef.current.size) {
                  if (!canSettle()) return;
                  generation.current += 1;
                  pendingTxIdRef.current = undefined;
                  pendingMayIncreaseRef.current = false;
                  setStatus({ scope, status: 'required' });
                  return;
                }
              }
            } catch {
              /* Allowance reads can lag the transaction. */
            }
            await timerUtils.wait(2000);
          }
          return;
        }
        if (pendingIsCancelRef.current) {
          for (let attempt = 0; attempt < 15 && current(); attempt += 1) {
            try {
              const clear = await read();
              const latestPending = await findPendingQueueApproval(txid);
              if (!current()) return;
              await reconcileOtherIncreases(clear, canSettle);
              if (!current()) return;
              if (latestPending) {
                monitorNext(latestPending);
                return;
              }
              if (
                !otherIncreasesRef.current.size &&
                !(clear && unobservedIncreaseRef.current)
              ) {
                if (!canSettle()) return;
                generation.current += 1;
                pendingTxIdRef.current = undefined;
                pendingIsCancelRef.current = false;
                setStatus({ scope, status: clear ? 'clear' : 'required' });
                if (clear) onClearedRef.current?.();
                return;
              }
              setStatus({ scope, status: 'pending' });
            } catch {
              /* Allowance or transaction history can lag confirmation. */
            }
            if (attempt < 14) await timerUtils.wait(2000);
          }
          return;
        }
        let observedIncrease = false;
        for (let attempt = 0; attempt < 15 && current(); attempt += 1) {
          try {
            const clear = await read();
            if (!current()) return;
            const hadOtherIncreases = otherIncreasesRef.current.size > 0;
            if (clear || hadOtherIncreases) {
              const latestPending = await findPendingQueueApproval(txid);
              if (!current()) return;
              const confirmedIncrease = await reconcileOtherIncreases(
                clear,
                canSettle,
              );
              if (!current()) return;
              observedIncrease ||= confirmedIncrease;
              if (latestPending) {
                monitorNext(latestPending);
                return;
              }
              if (
                !otherIncreasesRef.current.size &&
                ((clear && !unobservedIncreaseRef.current) ||
                  (!clear && observedIncrease))
              ) {
                if (!canSettle()) return;
                generation.current += 1;
                pendingTxIdRef.current = undefined;
                setStatus({ scope, status: clear ? 'clear' : 'required' });
                if (clear) onClearedRef.current?.();
                return;
              }
              setStatus({ scope, status: 'pending' });
            }
          } catch {
            /* Allowance reads can lag the transaction. */
          }
          if (attempt < 14) await timerUtils.wait(2000);
        }
      } catch {
        if (current()) setStatus({ scope, status: 'pending' });
      }
    },
    [
      accountId,
      findPendingQueueApproval,
      networkId,
      observeOtherIncreases,
      read,
      reconcileOtherIncreases,
      scope,
      setStatus,
    ],
  );

  const refresh = useCallback(async () => {
    if (!mountedRef.current || scopeRef.current !== scope) return;
    const wasPending = statusRef.current.status === 'pending';
    const previousTxId = pendingTxIdRef.current;
    if (!wasPending) generation.current += 1;
    const id = generation.current;
    refreshSequence.current += 1;
    const refreshId = refreshSequence.current;
    refreshDiscoveryRef.current = refreshId;
    const finishDiscovery = () => {
      if (refreshDiscoveryRef.current === refreshId)
        refreshDiscoveryRef.current = undefined;
    };
    const current = () =>
      id === generation.current &&
      refreshId === refreshSequence.current &&
      scopeRef.current === scope;
    setStatus({ scope, status: wasPending ? 'pending' : 'checking' });
    try {
      let clear = await read();
      if (current()) {
        if (!clear) unobservedIncreaseRef.current = false;
        let nextStatus: IStatus = 'clear';
        const pendingTx = await findPendingQueueApproval();
        if (!current()) return;
        if (!pendingTx && pendingTxIdRef.current !== previousTxId) {
          const nextTxid = pendingTxIdRef.current;
          finishDiscovery();
          if (nextTxid) {
            abortRef.current?.abort();
            const controller = new AbortController();
            abortRef.current = controller;
            void monitorTx(nextTxid, id, controller);
          }
          return;
        }
        if (
          !pendingTx ||
          pendingTx.txid.toLowerCase() === previousTxId?.toLowerCase()
        )
          finishDiscovery();
        if (pendingTx) observeOtherIncreases(pendingTx.otherIncreases);
        let confirmedOtherIncrease = await reconcileOtherIncreases(
          clear,
          current,
          { preserveConfirmed: true },
        );
        if (!current()) return;
        if (
          !clear ||
          pendingTx ||
          wasPending ||
          unobservedIncreaseRef.current ||
          otherIncreasesRef.current.size
        ) {
          if (!current()) return;
          const replacementTx =
            !pendingTx && wasPending && previousTxId
              ? await findPendingReplacement(previousTxId)
              : undefined;
          if (!current()) return;
          const activeTx = pendingTx ?? replacementTx;
          if (activeTx) {
            if (
              pendingTxIdRef.current &&
              pendingTxIdRef.current.toLowerCase() !==
                activeTx.txid.toLowerCase()
            ) {
              const previous = pendingTxIdRef.current;
              const tracksIncrease =
                (pendingMayIncreaseRef.current &&
                  !pendingIsCancelRef.current) ||
                pendingIncreaseCancellationRef.current ===
                  previous.toLowerCase();
              if (tracksIncrease) {
                const replacement = activeTx.isCancel
                  ? await findPendingReplacement(previous)
                  : undefined;
                if (!current() || pendingTxIdRef.current !== previous) return;
                if (
                  replacement?.isCancel &&
                  replacement.txid.toLowerCase() === activeTx.txid.toLowerCase()
                ) {
                  pendingIncreaseCancellationRef.current =
                    activeTx.txid.toLowerCase();
                } else {
                  unobservedIncreaseRef.current = true;
                  pendingIncreaseCancellationRef.current = undefined;
                }
              }
              abortRef.current?.abort();
            }
            pendingTxIdRef.current = activeTx.txid;
            pendingIsCancelRef.current = activeTx.isCancel;
            if (pendingTx)
              pendingMayIncreaseRef.current = pendingTx.mayIncrease;
            finishDiscovery();
          }
          if (activeTx || wasPending) {
            nextStatus = 'pending';
            const txid = pendingTxIdRef.current;
            if (txid) {
              const details =
                await backgroundApiProxy.serviceHistory.fetchTxDetails({
                  accountId,
                  networkId,
                  txid,
                });
              if (!current()) return;
              const txStatus = details?.data?.status;
              if (
                txStatus === EOnChainHistoryTxStatus.Success &&
                pendingMayIncreaseRef.current &&
                !pendingIsCancelRef.current
              ) {
                unobservedIncreaseRef.current = clear;
              }
              if (
                txStatus === EOnChainHistoryTxStatus.Failed ||
                txStatus === EOnChainHistoryTxStatus.Success
              ) {
                if (pendingIsCancelRef.current) {
                  clear = await read();
                  if (!current()) return;
                }
                if (
                  pendingIncreaseCancellationRef.current === txid.toLowerCase()
                ) {
                  pendingIncreaseCancellationRef.current = undefined;
                }
                const otherPending = await findPendingQueueApproval(txid);
                if (!current()) return;
                if (otherPending)
                  observeOtherIncreases(otherPending.otherIncreases);
                const laterIncrease = await reconcileOtherIncreases(
                  clear,
                  current,
                );
                confirmedOtherIncrease ||= laterIncrease;
                if (!current()) return;
                if (otherPending) {
                  if (
                    pendingMayIncreaseRef.current &&
                    !pendingIsCancelRef.current
                  )
                    unobservedIncreaseRef.current = true;
                  abortRef.current?.abort();
                  pendingTxIdRef.current = otherPending.txid;
                  pendingIsCancelRef.current = otherPending.isCancel;
                  pendingMayIncreaseRef.current = otherPending.mayIncrease;
                } else if (
                  !otherIncreasesRef.current.size &&
                  !(clear && unobservedIncreaseRef.current) &&
                  (txStatus === EOnChainHistoryTxStatus.Failed ||
                    pendingIsCancelRef.current ||
                    (!clear && confirmedOtherIncrease) ||
                    (pendingMayIncreaseRef.current && !clear) ||
                    (!pendingMayIncreaseRef.current && clear))
                ) {
                  pendingTxIdRef.current = undefined;
                  pendingIsCancelRef.current = false;
                  pendingMayIncreaseRef.current = false;
                  nextStatus = clear ? 'clear' : 'required';
                }
              }
            }
          } else {
            nextStatus =
              otherIncreasesRef.current.size ||
              (clear && unobservedIncreaseRef.current)
                ? 'pending'
                : 'required';
          }
        }
        setStatus({ scope, status: nextStatus });
        if (nextStatus === 'pending' && pendingTxIdRef.current) {
          abortRef.current?.abort();
          const controller = new AbortController();
          abortRef.current = controller;
          void monitorTx(pendingTxIdRef.current, id, controller);
        }
        if (nextStatus !== 'pending' && wasPending) {
          generation.current += 1;
          abortRef.current?.abort();
          pendingTxIdRef.current = undefined;
          pendingIsCancelRef.current = false;
          pendingMayIncreaseRef.current = false;
          if (clear) onClearedRef.current?.();
        }
      }
    } catch {
      if (current()) {
        setStatus({ scope, status: wasPending ? 'pending' : 'unknown' });
        if (wasPending && pendingTxIdRef.current) {
          abortRef.current?.abort();
          const controller = new AbortController();
          abortRef.current = controller;
          void monitorTx(pendingTxIdRef.current, id, controller);
        }
      }
    } finally {
      finishDiscovery();
    }
  }, [
    accountId,
    findPendingQueueApproval,
    findPendingReplacement,
    monitorTx,
    networkId,
    observeOtherIncreases,
    read,
    reconcileOtherIncreases,
    scope,
    setStatus,
  ]);

  useEffect(() => {
    return () => {
      generation.current += 1;
      refreshDiscoveryRef.current = undefined;
      abortRef.current?.abort();
      pendingTxIdRef.current = undefined;
      pendingIsCancelRef.current = false;
      pendingMayIncreaseRef.current = false;
      unobservedIncreaseRef.current = false;
      pendingIncreaseCancellationRef.current = undefined;
      otherIncreasesRef.current = new Set();
    };
  }, [scope]);

  useEffect(() => {
    if (
      applicable &&
      accountId &&
      isFocused &&
      statusRef.current.status !== 'pending' &&
      statusRef.current.status !== 'submitting'
    )
      void refresh();
  }, [accountId, applicable, isFocused, refresh]);

  const revoke = useCallback(async () => {
    if (
      !mountedRef.current ||
      scopeRef.current !== scope ||
      !visibilityRef.current.active ||
      !applicable ||
      statusRef.current.status !== 'required'
    )
      return;
    generation.current += 1;
    const id = generation.current;
    const controller = new AbortController();
    abortRef.current = controller;
    const visibilityGeneration = visibilityRef.current.generation;
    const current = () =>
      id === generation.current &&
      scopeRef.current === scope &&
      !controller.signal.aborted;
    const canSend = () =>
      current() &&
      visibilityRef.current.active &&
      visibilityRef.current.generation === visibilityGeneration;
    let sendStarted = false;
    let sendSucceeded = false;
    let attemptResolved = true;
    let hasUncertainAttempt = false;
    revokeSendStartedRef.current = false;
    setStatus({ scope, status: 'submitting' });
    try {
      const clear = await read();
      const pendingTx = await findPendingQueueApproval();
      if (!current()) return;
      if (pendingTx) observeOtherIncreases(pendingTx.otherIncreases);
      if (pendingTx) {
        pendingTxIdRef.current = pendingTx.txid;
        pendingIsCancelRef.current = pendingTx.isCancel;
        pendingMayIncreaseRef.current = pendingTx.mayIncrease;
        setStatus({ scope, status: 'pending' });
        void monitorTx(pendingTx.txid, id, controller);
        return;
      }
      if (otherIncreasesRef.current.size) {
        setStatus({ scope, status: 'pending' });
        return;
      }
      if (!canSend()) {
        setStatus({ scope, status: 'unknown' });
        return;
      }
      if (clear) {
        if (unobservedIncreaseRef.current) {
          setStatus({ scope, status: 'pending' });
          return;
        }
        setStatus({ scope, status: 'clear' });
        onClearedRef.current?.();
        return;
      }
      const [account, detail] = await Promise.all([
        backgroundApiProxy.serviceAccount.getAccount({ accountId, networkId }),
        backgroundApiProxy.serviceToken.fetchTokenInfoOnly({
          networkId,
          tokenAddress: LIQUID_USD,
        }),
      ]);
      if (!current()) return;
      if (!canSend()) {
        setStatus({ scope, status: 'unknown' });
        return;
      }
      if (
        !accountAddress ||
        account.address.toLowerCase() !== accountAddress.toLowerCase()
      )
        throw new OneKeyLocalError('Legacy approval account changed');
      const token = detail?.info;
      if (
        !token ||
        token.address.toLowerCase() !== LIQUID_USD ||
        token.isNative
      )
        throw new OneKeyLocalError('Invalid liquidUSD token');
      await navigationToTxConfirm({
        isNavigationCurrent: canSend,
        onBeforeSend: async () => {
          if (!canSend())
            throw new OneKeyLocalError('Legacy approval confirmation expired');
          const currentAccount =
            await backgroundApiProxy.serviceAccount.getAccount({
              accountId,
              networkId,
            });
          if (
            !canSend() ||
            currentAccount.address.toLowerCase() !==
              accountAddress.toLowerCase()
          )
            throw new OneKeyLocalError('Legacy approval account changed');
          sendStarted = true;
          if (!attemptResolved) hasUncertainAttempt = true;
          attemptResolved = false;
          revokeSendStartedRef.current = true;
          setStatus({ scope, status: 'submitting' });
        },
        approvesInfo: [
          {
            owner: account.address,
            spender: OLD_ATOMIC_QUEUE,
            amount: '0',
            isMax: false,
            tokenInfo: token,
          },
        ],
        onCancel: () => {
          if (current() && statusRef.current.status === 'submitting')
            setStatus({ scope, status: sendStarted ? 'pending' : 'required' });
        },
        onFail: (error) => {
          if (current() && !sendSucceeded) {
            const rejectedOnDevice = isHardwareErrorByCode({
              error: error as IOneKeyError,
              code: HardwareErrorCode.ActionCancelled,
            });
            if (!attemptResolved && !rejectedOnDevice)
              hasUncertainAttempt = true;
            attemptResolved = true;
            setStatus({
              scope,
              status: hasUncertainAttempt ? 'pending' : 'unknown',
            });
          }
        },
        onSuccess: (data) => {
          if (!current()) return;
          sendSucceeded = true;
          setStatus({ scope, status: 'pending' });
          const txid =
            data[0]?.signedTx?.txid?.trim() || data[0]?.decodedTx?.txid?.trim();
          if (!txid) return;
          pendingTxIdRef.current = txid;
          pendingIsCancelRef.current = false;
          pendingMayIncreaseRef.current = false;
          void monitorTx(txid, id, controller);
        },
      });
      const getStatus = (): IStatus => statusRef.current.status;
      if (current() && !canSend() && getStatus() === 'submitting') {
        setStatus({ scope, status: 'unknown' });
      }
    } catch {
      if (current())
        setStatus({ scope, status: sendStarted ? 'pending' : 'unknown' });
    }
  }, [
    accountAddress,
    accountId,
    applicable,
    findPendingQueueApproval,
    monitorTx,
    navigationToTxConfirm,
    networkId,
    observeOtherIncreases,
    read,
    scope,
    setStatus,
  ]);

  const verifyBeforeAction = useCallback(
    async ({
      allowRevoke = true,
    }: IEarnActionGuardVerificationOptions = {}) => {
      if (
        !mountedRef.current ||
        scopeRef.current !== scope ||
        !visibilityRef.current.active
      )
        return false;
      if (!isEtherFi || (vault && !applicable)) return true;
      if (!applicable || !accountId || statusRef.current.status !== 'clear')
        return false;
      generation.current += 1;
      const id = generation.current;
      const visibilityGeneration = visibilityRef.current.generation;
      const isCurrent = () =>
        id === generation.current && scopeRef.current === scope;
      const isVisible = () =>
        visibilityRef.current.active &&
        visibilityRef.current.generation === visibilityGeneration;
      const stillVisible = () => {
        if (!isCurrent()) return false;
        if (isVisible()) return true;
        setStatus({ scope, status: 'unknown' });
        return false;
      };
      setStatus({ scope, status: 'checking' });
      try {
        const clear = await read();
        if (!stillVisible()) return false;
        if (
          otherIncreasesRef.current.size ||
          (clear && unobservedIncreaseRef.current)
        ) {
          setStatus({ scope, status: 'pending' });
          return false;
        }
        if (!clear) unobservedIncreaseRef.current = false;
        const pendingTx = await findPendingQueueApproval();
        if (!stillVisible()) return false;
        if (pendingTx) observeOtherIncreases(pendingTx.otherIncreases);
        if (pendingTx) {
          pendingTxIdRef.current = pendingTx.txid;
          pendingIsCancelRef.current = pendingTx.isCancel;
          pendingMayIncreaseRef.current = pendingTx.mayIncrease;
          setStatus({ scope, status: 'pending' });
          abortRef.current?.abort();
          const controller = new AbortController();
          abortRef.current = controller;
          void monitorTx(pendingTx.txid, id, controller);
          return false;
        }
        if (!clear) {
          setStatus({ scope, status: 'required' });
          if (allowRevoke) await revoke();
          return false;
        }
        setStatus({ scope, status: 'clear' });
        return true;
      } catch {
        if (id === generation.current && scopeRef.current === scope)
          setStatus({ scope, status: 'unknown' });
        return false;
      }
    },
    [
      accountId,
      applicable,
      findPendingQueueApproval,
      isEtherFi,
      monitorTx,
      observeOtherIncreases,
      read,
      revoke,
      scope,
      setStatus,
      vault,
    ],
  );

  const isActionAllowed = useCallback(() => {
    if (
      !mountedRef.current ||
      scopeRef.current !== scope ||
      !visibilityRef.current.active
    )
      return false;
    if (!isEtherFi || (vault && !applicable)) return true;
    return Boolean(
      applicable &&
      accountId &&
      statusRef.current.scope === scope &&
      statusRef.current.status === 'clear',
    );
  }, [accountId, applicable, isEtherFi, scope, vault]);

  return {
    blocked: isEtherFi && (!vault || (applicable && status !== 'clear')),
    status: applicable ? status : undefined,
    refresh,
    revoke,
    verifyBeforeAction,
    isActionAllowed,
  };
}
