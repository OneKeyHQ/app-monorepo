import { useCallback, useEffect, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';

import { getEarnProtocol } from '@onekeyhq/kit/src/views/Earn/protocols';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import {
  EOnChainHistoryTxStatus,
  type IFetchHistoryTxDetailsResp,
} from '@onekeyhq/shared/types/history';
import { EApproveType } from '@onekeyhq/shared/types/staking';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

function useTxTrack({
  trackTxId,
  accountId,
  networkId,
  timeout = timerUtils.getTimeDurationMs({ minute: 60 }),
  interval = timerUtils.getTimeDurationMs({ seconds: 5 }),
  retryOnError = false,
  retrySequence = 0,
}: {
  accountId: string;
  networkId: string;
  trackTxId?: string;
  timeout?: number;
  interval?: number;
  retryOnError?: boolean;
  retrySequence?: number;
}) {
  const trackingKey = JSON.stringify([
    accountId,
    networkId,
    trackTxId,
    retrySequence,
  ]);
  const [trackedResult, setTrackedResult] = useState<{
    key: string;
    details?: IFetchHistoryTxDetailsResp;
    timedOut?: boolean;
  }>();
  const txDetails =
    trackTxId && trackedResult?.key === trackingKey
      ? trackedResult.details
      : null;
  const trackingTimedOut = Boolean(
    trackTxId && trackedResult?.key === trackingKey && trackedResult.timedOut,
  );
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    if (!trackTxId) {
      return;
    }
    const startAt = Date.now();
    let cancelled = false;
    const checkTxDetails = async (txHash: string) => {
      let txDetailsResp: IFetchHistoryTxDetailsResp | null;
      try {
        txDetailsResp = await backgroundApiProxy.serviceHistory.fetchTxDetails({
          networkId,
          accountId,
          txid: txHash,
        });
      } catch (error) {
        if (!retryOnError) throw error;
        if (!cancelled && Date.now() - startAt < timeout) {
          timer.current = setTimeout(() => checkTxDetails(txHash), interval);
        } else if (!cancelled) {
          setTrackedResult({ key: trackingKey, timedOut: true });
        }
        return;
      }
      if (cancelled) return;
      if (
        txDetailsResp &&
        txDetailsResp.data &&
        (retryOnError
          ? txDetailsResp.data.status === EOnChainHistoryTxStatus.Success ||
            txDetailsResp.data.status === EOnChainHistoryTxStatus.Failed
          : txDetailsResp.data.status !== EOnChainHistoryTxStatus.Pending)
      ) {
        setTrackedResult({ key: trackingKey, details: txDetailsResp });
      } else if (Date.now() - startAt < timeout) {
        // Continue checking until the timeout is reached
        timer.current = setTimeout(() => checkTxDetails(txHash), interval);
      } else {
        setTrackedResult(
          retryOnError ? { key: trackingKey, timedOut: true } : undefined,
        );
      }
    };
    // Start the first check
    timer.current = setTimeout(() => checkTxDetails(trackTxId), 0);
    // Clear the timer on cleanup
    return () => {
      cancelled = true;
      clearTimeout(timer.current);
    };
  }, [
    trackTxId,
    networkId,
    accountId,
    timeout,
    interval,
    retryOnError,
    trackingKey,
  ]);
  return { txDetails, trackingTimedOut };
}

export function useTrackTokenAllowance({
  providerName,
  networkId,
  accountId,
  initialValue,
  refreshOnMount = false,
  retryTrackingOnError = false,
  tokenAddress,
  spenderAddress,
  approveType,
}: {
  providerName: string;
  networkId: string;
  accountId: string;
  initialValue?: string;
  /** Fetch the current chain allowance even when a seeded value is provided. */
  refreshOnMount?: boolean;
  retryTrackingOnError?: boolean;
  tokenAddress: string;
  spenderAddress: string;
  approveType?: EApproveType;
}) {
  const isLegacyApprove = approveType === EApproveType.Legacy;
  const isExistApproveTarget = !!spenderAddress;
  const shouldFetchInitialAllowance =
    isExistApproveTarget && (initialValue === undefined || refreshOnMount);
  const allowanceTargetKey = [
    accountId,
    networkId,
    providerName,
    tokenAddress,
    spenderAddress,
    approveType ?? '',
  ].join('|');
  const allowanceTargetKeyRef = useRef(allowanceTargetKey);
  allowanceTargetKeyRef.current = allowanceTargetKey;
  const [allowanceState, setAllowanceState] = useState<{
    targetKey: string;
    value: string;
    available: boolean;
    error: boolean;
  }>(() => ({
    targetKey: allowanceTargetKey,
    value: initialValue ?? '0',
    available: initialValue !== undefined && !shouldFetchInitialAllowance,
    error: false,
  }));
  const allowance =
    allowanceState.targetKey === allowanceTargetKey
      ? allowanceState.value
      : '0';
  const allowanceAvailable =
    allowanceState.targetKey === allowanceTargetKey && allowanceState.available;
  const allowanceError =
    allowanceState.targetKey === allowanceTargetKey && allowanceState.error;
  const [retryRequest, setRetryRequest] = useState<{
    targetKey: string;
    sequence: number;
  }>();
  const [trackTxId, setTrackTxId] = useState<string>('');
  const trackedTargetRef = useRef('');
  const trackedTxIdRef = useRef('');
  const [loading, setLoading] = useState(shouldFetchInitialAllowance);
  const { txDetails, trackingTimedOut } = useTxTrack({
    accountId,
    networkId,
    trackTxId,
    retryOnError: retryTrackingOnError,
    retrySequence:
      retryRequest?.targetKey === allowanceTargetKey
        ? retryRequest.sequence
        : 0,
  });
  const isTrackingAllowance = Boolean(
    retryTrackingOnError &&
    trackTxId &&
    trackedTargetRef.current === allowanceTargetKey,
  );
  const isTrackingTimedOut = isTrackingAllowance && trackingTimedOut;
  useEffect(() => {
    if (
      retryTrackingOnError &&
      trackedTxIdRef.current &&
      trackedTargetRef.current === allowanceTargetKey
    ) {
      return;
    }
    trackedTxIdRef.current = '';
    trackedTargetRef.current = '';
    setTrackTxId('');
    setLoading(shouldFetchInitialAllowance);
    setAllowanceState({
      targetKey: allowanceTargetKey,
      value: initialValue ?? '0',
      available: initialValue !== undefined && !shouldFetchInitialAllowance,
      error: false,
    });
  }, [
    allowanceTargetKey,
    initialValue,
    shouldFetchInitialAllowance,
    retryTrackingOnError,
  ]);
  const fetchAllowanceResponse = useCallback(
    async () =>
      backgroundApiProxy.serviceStaking.fetchTokenAllowance({
        networkId,
        accountId,
        tokenAddress,
        spenderAddress: getEarnProtocol(
          providerName,
        ).resolveAllowanceSpenderAddress({
          networkId,
          approveType,
          approveSpenderAddress: spenderAddress,
        }),
      }),
    [
      accountId,
      approveType,
      networkId,
      providerName,
      spenderAddress,
      tokenAddress,
    ],
  );
  useEffect(() => {
    let cancelled = false;
    if (isExistApproveTarget) {
      const fetchAllowance = async () => {
        if (
          trackTxId &&
          trackedTargetRef.current === allowanceTargetKey &&
          !txDetails
        ) {
          return;
        }
        if (
          !txDetails &&
          !shouldFetchInitialAllowance &&
          retryRequest?.targetKey !== allowanceTargetKey
        ) {
          if (!cancelled) {
            setLoading(false);
          }
          return;
        }
        try {
          if (retryTrackingOnError && txDetails) setLoading(true);
          setAllowanceState((previous) => ({
            ...previous,
            available: false,
            error: false,
          }));
          const allowanceInfo = await fetchAllowanceResponse();
          const parsedAllowance = new BigNumber(
            allowanceInfo?.allowanceParsed ?? '',
          );
          if (!parsedAllowance.isFinite() || parsedAllowance.isNegative()) {
            throw new OneKeyLocalError('Allowance unavailable');
          }
          if (
            !cancelled &&
            allowanceInfo &&
            allowanceTargetKeyRef.current === allowanceTargetKey
          ) {
            setAllowanceState({
              targetKey: allowanceTargetKey,
              value: allowanceInfo.allowanceParsed,
              available: true,
              error: false,
            });
          }
        } catch {
          if (
            !cancelled &&
            allowanceTargetKeyRef.current === allowanceTargetKey
          ) {
            setAllowanceState((previous) => ({
              ...previous,
              available: false,
              error: true,
            }));
          }
        } finally {
          if (
            !cancelled &&
            allowanceTargetKeyRef.current === allowanceTargetKey
          ) {
            if (
              retryTrackingOnError &&
              txDetails &&
              trackedTxIdRef.current === trackTxId
            ) {
              trackedTxIdRef.current = '';
              trackedTargetRef.current = '';
              setTrackTxId('');
            }
            setLoading(false);
          }
        }
      };
      void fetchAllowance();
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
    retryRequest,
    retryTrackingOnError,
    trackTxId,
  ]);
  const retryAllowance = useCallback(() => {
    setLoading(true);
    setAllowanceState((previous) => ({ ...previous, error: false }));
    setRetryRequest((previous) => ({
      targetKey: allowanceTargetKey,
      sequence: (previous?.sequence ?? 0) + 1,
    }));
  }, [allowanceTargetKey]);
  const trackAllowance = useCallback(
    (txid: string) => {
      trackedTxIdRef.current = txid;
      trackedTargetRef.current = allowanceTargetKey;
      setTrackTxId(txid);
      setLoading(true);
    },
    [allowanceTargetKey],
  );
  return {
    allowance,
    allowanceAvailable: allowanceAvailable && !isTrackingAllowance,
    allowanceError: allowanceError || isTrackingTimedOut,
    retryAllowance,
    trackAllowance,
    loading: !isTrackingTimedOut && (loading || isTrackingAllowance),
    fetchAllowanceResponse,
  };
}
