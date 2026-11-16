import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';

import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import {
  EOnChainHistoryTxStatus,
  type IFetchHistoryTxDetailsResp,
} from '@onekeyhq/shared/types/history';
import { EApproveType } from '@onekeyhq/shared/types/staking';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

type IEtherFiApprovalScope = {
  accountId: string;
  networkId: string;
  accountAddress: string;
  tokenAddress: string;
  spenderAddress: string;
};

const etherFiApprovalKey = (scope: IEtherFiApprovalScope) =>
  JSON.stringify([
    scope.accountId,
    scope.networkId,
    scope.accountAddress.toLowerCase(),
    scope.tokenAddress.toLowerCase(),
    scope.spenderAddress.toLowerCase(),
  ]);

type IEtherFiApprovalAttempt = {
  txid: string;
  amount: string;
  expiresAt: number;
};
const etherFiApprovalAttempts = new Map<string, IEtherFiApprovalAttempt[]>();
const etherFiApprovalListeners = new Set<(key: string) => void>();

export function trackEtherFiApproval(
  scope: IEtherFiApprovalScope,
  txid: string,
  amount: string,
) {
  const now = Date.now();
  for (const [key, attempts] of etherFiApprovalAttempts) {
    const active = attempts.filter((attempt) => attempt.expiresAt > now);
    if (active.length) etherFiApprovalAttempts.set(key, active);
    else etherFiApprovalAttempts.delete(key);
  }
  const key = etherFiApprovalKey(scope);
  if (
    etherFiApprovalAttempts.size >= 100 &&
    !etherFiApprovalAttempts.has(key)
  ) {
    const oldest = etherFiApprovalAttempts.keys().next().value;
    if (oldest) etherFiApprovalAttempts.delete(oldest);
  }
  const attempts = etherFiApprovalAttempts.get(key) ?? [];
  if (!attempts.some((attempt) => attempt.txid === txid)) {
    etherFiApprovalAttempts.set(key, [
      ...attempts.slice(-19),
      { txid, amount, expiresAt: now + 10 * 60_000 },
    ]);
  }
  for (const listener of etherFiApprovalListeners) listener(key);
}

function useTxTrack({
  trackTxId,
  accountId,
  networkId,
  timeout = timerUtils.getTimeDurationMs({ minute: 60 }),
  interval = timerUtils.getTimeDurationMs({ seconds: 5 }),
}: {
  accountId: string;
  networkId: string;
  trackTxId?: string;
  timeout?: number;
  interval?: number;
}) {
  const [txDetails, setTxDetails] = useState<IFetchHistoryTxDetailsResp | null>(
    null,
  );
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    if (!trackTxId) {
      return;
    }
    const startAt = Date.now();
    const checkTxDetails = async (txHash: string) => {
      const txDetailsResp =
        await backgroundApiProxy.serviceHistory.fetchTxDetails({
          networkId,
          accountId,
          txid: txHash,
        });
      if (
        txDetailsResp &&
        txDetailsResp.data &&
        txDetailsResp.data.status !== EOnChainHistoryTxStatus.Pending
      ) {
        setTxDetails(txDetailsResp);
      } else if (Date.now() - startAt < timeout) {
        // Continue checking until the timeout is reached
        timer.current = setTimeout(() => checkTxDetails(txHash), interval);
      } else {
        setTxDetails(null);
      }
    };
    // Start the first check
    timer.current = setTimeout(() => checkTxDetails(trackTxId), 0);
    // Clear the timer on cleanup
    return () => clearTimeout(timer.current);
  }, [trackTxId, networkId, accountId, timeout, interval]);
  return txDetails;
}

export function useTrackTokenAllowance({
  networkId,
  accountId,
  initialValue,
  refreshOnMount = false,
  refreshTrackedEtherFiApproval = false,
  etherFiApprovalTrackingActive = true,
  tokenAddress,
  spenderAddress,
  approveType,
  expectedAccountAddress,
}: {
  networkId: string;
  accountId: string;
  initialValue?: string;
  /** Fetch the current chain allowance even when a seeded value is provided. */
  refreshOnMount?: boolean;
  refreshTrackedEtherFiApproval?: boolean;
  etherFiApprovalTrackingActive?: boolean;
  tokenAddress: string;
  spenderAddress: string;
  approveType?: EApproveType;
  expectedAccountAddress?: string;
}) {
  const isLegacyApprove = approveType === EApproveType.Legacy;
  const isExistApproveTarget = !!spenderAddress;
  const shouldFetchInitialAllowance =
    isExistApproveTarget && (initialValue === undefined || refreshOnMount);
  const allowanceTargetKey = [
    accountId,
    networkId,
    tokenAddress,
    spenderAddress,
    approveType ?? '',
    expectedAccountAddress ?? '',
  ].join('|');
  const allowanceTargetKeyRef = useRef(allowanceTargetKey);
  allowanceTargetKeyRef.current = allowanceTargetKey;
  const allowanceScope = useMemo(
    () => ({ key: allowanceTargetKey }),
    [allowanceTargetKey],
  );
  const allowanceScopeRef = useRef(allowanceScope);
  allowanceScopeRef.current = allowanceScope;
  const refreshTrackedEtherFiApprovalRef = useRef(
    refreshTrackedEtherFiApproval,
  );
  refreshTrackedEtherFiApprovalRef.current = refreshTrackedEtherFiApproval;
  const allowanceReadSequence = useRef(0);
  const allowanceAppliedSequence = useRef(0);
  const [allowanceState, setAllowanceState] = useState<{
    targetKey: string;
    value: string;
    available: boolean;
  }>(() => ({
    targetKey: allowanceTargetKey,
    value: initialValue ?? '0',
    available: initialValue !== undefined,
  }));
  const allowance =
    allowanceState.targetKey === allowanceTargetKey
      ? allowanceState.value
      : '0';
  const allowanceAvailable =
    allowanceState.targetKey === allowanceTargetKey && allowanceState.available;
  const [trackTxId, setTrackTxId] = useState<string>('');
  const [loading, setLoading] = useState(shouldFetchInitialAllowance);
  const txDetails = useTxTrack({
    accountId,
    networkId,
    trackTxId,
  });
  useEffect(() => {
    setTrackTxId('');
    setLoading(shouldFetchInitialAllowance);
    setAllowanceState((current) =>
      refreshTrackedEtherFiApprovalRef.current &&
      current.targetKey === allowanceTargetKey &&
      current.available
        ? current
        : {
            targetKey: allowanceTargetKey,
            value: initialValue ?? '0',
            available: initialValue !== undefined,
          },
    );
  }, [allowanceTargetKey, initialValue, shouldFetchInitialAllowance]);
  const fetchAllowanceResponse = useCallback(async () => {
    allowanceReadSequence.current += 1;
    const allowanceRequestSequence = allowanceReadSequence.current;
    const result = await backgroundApiProxy.serviceStaking.fetchTokenAllowance({
      networkId,
      accountId,
      expectedAccountAddress,
      tokenAddress,
      spenderAddress: earnUtils.resolveEarnAllowanceSpenderAddress({
        networkId,
        approveType,
        approveSpenderAddress: spenderAddress,
      }),
    });
    return { ...result, allowanceRequestSequence };
  }, [
    accountId,
    approveType,
    networkId,
    spenderAddress,
    tokenAddress,
    expectedAccountAddress,
  ]);
  useEffect(() => {
    let cancelled = false;
    if (isExistApproveTarget) {
      const fetchAllowance = async () => {
        if (!txDetails && !shouldFetchInitialAllowance) {
          if (!cancelled) {
            setLoading(false);
          }
          return;
        }
        try {
          const allowanceInfo = await fetchAllowanceResponse();
          if (
            !cancelled &&
            allowanceInfo &&
            allowanceInfo.allowanceRequestSequence >=
              allowanceAppliedSequence.current &&
            allowanceTargetKeyRef.current === allowanceTargetKey
          ) {
            allowanceAppliedSequence.current =
              allowanceInfo.allowanceRequestSequence;
            setAllowanceState({
              targetKey: allowanceTargetKey,
              value: allowanceInfo.allowanceParsed,
              available: true,
            });
            setLoading(false);
          }
        } finally {
          if (
            !cancelled &&
            allowanceTargetKeyRef.current === allowanceTargetKey
          ) {
            setLoading(false);
          }
        }
      };
      void fetchAllowance().catch(() => undefined);
    }
    return () => {
      cancelled = true;
    };
  }, [
    txDetails,
    networkId,
    accountId,
    spenderAddress,
    tokenAddress,
    approveType,
    fetchAllowanceResponse,
    allowanceTargetKey,
    isLegacyApprove,
    isExistApproveTarget,
    initialValue,
    shouldFetchInitialAllowance,
  ]);
  const trackAllowance = useCallback((txid: string) => {
    setTrackTxId(txid);
    setLoading(true);
  }, []);
  const applyVerifiedAllowance = useCallback(
    (value: string, requestSequence?: number) => {
      if (requestSequence === undefined) allowanceReadSequence.current += 1;
      const sequence = requestSequence ?? allowanceReadSequence.current;
      if (
        allowanceScopeRef.current === allowanceScope &&
        sequence >= allowanceAppliedSequence.current
      ) {
        allowanceAppliedSequence.current = sequence;
        setAllowanceState({
          targetKey: allowanceScope.key,
          value,
          available: true,
        });
        setLoading(false);
        return true;
      }
      return false;
    },
    [allowanceScope],
  );
  useEffect(() => {
    if (
      !refreshTrackedEtherFiApproval ||
      !etherFiApprovalTrackingActive ||
      !accountId ||
      !networkId ||
      !expectedAccountAddress ||
      !tokenAddress ||
      !spenderAddress
    )
      return;
    const key = etherFiApprovalKey({
      accountId,
      networkId,
      accountAddress: expectedAccountAddress,
      tokenAddress,
      spenderAddress,
    });
    let cancelled = false;
    const timers = new Map<string, ReturnType<typeof setTimeout> | undefined>();
    const timeoutToken = Symbol('etherFiApprovalReadTimeout');
    const withTimeout = async <T>(request: Promise<T>) => {
      let timeout: ReturnType<typeof setTimeout> | undefined;
      try {
        return await Promise.race([
          request,
          new Promise<never>((_resolve, reject) => {
            timeout = setTimeout(() => reject(timeoutToken), 10_000);
          }),
        ]);
      } finally {
        if (timeout) clearTimeout(timeout);
      }
    };
    const removeAttempt = (attempt: IEtherFiApprovalAttempt) => {
      const remaining = (etherFiApprovalAttempts.get(key) ?? []).filter(
        (item) => item !== attempt,
      );
      if (remaining.length) etherFiApprovalAttempts.set(key, remaining);
      else etherFiApprovalAttempts.delete(key);
      timers.delete(attempt.txid);
    };
    const startAttempt = (attempt: IEtherFiApprovalAttempt) => {
      if (timers.has(attempt.txid) || attempt.expiresAt <= Date.now()) return;
      timers.set(attempt.txid, undefined);
      let timeouts = 0;
      const refresh = async () => {
        let retryDelay = 5000;
        try {
          const details = await withTimeout(
            backgroundApiProxy.serviceHistory.fetchTxDetails({
              accountId,
              networkId,
              txid: attempt.txid,
            }),
          );
          if (cancelled) return;
          if (details?.data.status === EOnChainHistoryTxStatus.Failed) {
            removeAttempt(attempt);
            return;
          }
          if (details?.data.status === EOnChainHistoryTxStatus.Success) {
            const result = await withTimeout(fetchAllowanceResponse());
            if (cancelled) return;
            const value = new BigNumber(result.allowanceParsed);
            const required = new BigNumber(attempt.amount);
            if (
              value.isFinite() &&
              !value.isNegative() &&
              applyVerifiedAllowance(
                result.allowanceParsed,
                result.allowanceRequestSequence,
              )
            ) {
              if (
                required.isFinite() &&
                required.gt(0) &&
                value.gte(required)
              ) {
                removeAttempt(attempt);
                return;
              }
            }
          }
          timeouts = 0;
        } catch (error) {
          if (error === timeoutToken) timeouts += 1;
          if (timeouts >= 3) {
            retryDelay = Math.min(120_000, 15_000 * 2 ** (timeouts - 3));
          }
          // Retry only while the original transaction remains tracked.
        }
        if (!cancelled && Date.now() < attempt.expiresAt)
          timers.set(
            attempt.txid,
            setTimeout(() => void refresh(), retryDelay),
          );
        else if (!cancelled) removeAttempt(attempt);
      };
      void refresh();
    };
    const start = () => {
      (etherFiApprovalAttempts.get(key) ?? []).forEach(startAttempt);
    };
    const listener = (changedKey: string) => {
      if (changedKey === key) start();
    };
    etherFiApprovalListeners.add(listener);
    start();
    return () => {
      cancelled = true;
      for (const timer of timers.values()) if (timer) clearTimeout(timer);
      etherFiApprovalListeners.delete(listener);
    };
  }, [
    accountId,
    networkId,
    expectedAccountAddress,
    tokenAddress,
    spenderAddress,
    refreshTrackedEtherFiApproval,
    etherFiApprovalTrackingActive,
    fetchAllowanceResponse,
    applyVerifiedAllowance,
  ]);
  return {
    allowance,
    allowanceAvailable,
    trackAllowance,
    loading,
    fetchAllowanceResponse,
    applyVerifiedAllowance,
  };
}
