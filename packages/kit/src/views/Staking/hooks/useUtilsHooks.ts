import { useCallback, useEffect, useRef, useState } from 'react';

import { MorphoBundlerContract } from '@onekeyhq/shared/src/consts/addresses';
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
  tokenAddress,
  spenderAddress,
  approveType,
}: {
  networkId: string;
  accountId: string;
  initialValue?: string;
  tokenAddress: string;
  spenderAddress: string;
  approveType?: EApproveType;
}) {
  const isLegacyApprove = approveType === EApproveType.Legacy;
  const isExistApproveTarget = !!spenderAddress;
  const shouldFetchInitialAllowance =
    initialValue === undefined && isExistApproveTarget;
  const allowanceTargetKey = [
    accountId,
    networkId,
    tokenAddress,
    spenderAddress,
    approveType ?? '',
  ].join('|');
  const allowanceTargetKeyRef = useRef(allowanceTargetKey);
  allowanceTargetKeyRef.current = allowanceTargetKey;
  const [allowanceState, setAllowanceState] = useState<{
    targetKey: string;
    value: string;
  }>(() => ({
    targetKey: allowanceTargetKey,
    value: initialValue ?? '0',
  }));
  const allowance =
    allowanceState.targetKey === allowanceTargetKey
      ? allowanceState.value
      : '0';
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
    setAllowanceState((prev) => ({
      targetKey: allowanceTargetKey,
      value:
        prev.targetKey === allowanceTargetKey ? (initialValue ?? '0') : '0',
    }));
  }, [allowanceTargetKey, initialValue, shouldFetchInitialAllowance]);
  const fetchAllowanceResponse = useCallback(
    async () =>
      backgroundApiProxy.serviceStaking.fetchTokenAllowance({
        networkId,
        accountId,
        tokenAddress,
        spenderAddress:
          approveType === EApproveType.Permit
            ? MorphoBundlerContract
            : spenderAddress,
      }),
    [accountId, approveType, networkId, spenderAddress, tokenAddress],
  );
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
            allowanceTargetKeyRef.current === allowanceTargetKey
          ) {
            setAllowanceState({
              targetKey: allowanceTargetKey,
              value: allowanceInfo.allowanceParsed,
            });
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
    shouldFetchInitialAllowance,
  ]);
  const trackAllowance = useCallback((txid: string) => {
    setTrackTxId(txid);
    setLoading(true);
  }, []);
  return { allowance, trackAllowance, loading, fetchAllowanceResponse };
}
