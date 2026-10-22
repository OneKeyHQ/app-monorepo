import { useCallback, useEffect, useRef, useState } from 'react';

import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
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

/** 跟踪指定账户和授权目标的额度；查询失败仍保留未知状态，不能把回退的零当作链上额度。 */
export function useTrackTokenAllowance({
  providerName,
  networkId,
  accountId,
  initialValue,
  refreshOnMount = false,
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
  }>(() => ({
    targetKey: allowanceTargetKey,
    value: initialValue ?? '0',
    available: initialValue !== undefined && !shouldFetchInitialAllowance,
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
    setAllowanceState({
      targetKey: allowanceTargetKey,
      value: initialValue ?? '0',
      available: initialValue !== undefined && !shouldFetchInitialAllowance,
    });
  }, [allowanceTargetKey, initialValue, shouldFetchInitialAllowance]);
  const fetchAllowanceResponse = useCallback(
    async () =>
      backgroundApiProxy.serviceStaking.fetchTokenAllowance({
        networkId,
        accountId,
        tokenAddress,
        spenderAddress: earnUtils.resolveEarnAllowanceSpenderAddress({
          providerName,
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
        if (!txDetails && !shouldFetchInitialAllowance) {
          if (!cancelled) {
            setLoading(false);
          }
          return;
        }
        try {
          // 回源失败时旧值仅用于展示，不能继续作为已核实的授权额度。
          setAllowanceState((previous) => ({ ...previous, available: false }));
          const allowanceInfo = await fetchAllowanceResponse();
          if (
            !cancelled &&
            allowanceInfo &&
            allowanceTargetKeyRef.current === allowanceTargetKey
          ) {
            setAllowanceState({
              targetKey: allowanceTargetKey,
              value: allowanceInfo.allowanceParsed,
              available: true,
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
    initialValue,
    shouldFetchInitialAllowance,
  ]);
  const trackAllowance = useCallback((txid: string) => {
    setTrackTxId(txid);
    setLoading(true);
  }, []);
  return {
    allowance,
    allowanceAvailable,
    trackAllowance,
    loading,
    fetchAllowanceResponse,
  };
}
