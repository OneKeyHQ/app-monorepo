import { useCallback, useEffect, useRef, useState } from 'react';

import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import {
  EOnChainHistoryTxStatus,
  type IFetchHistoryTxDetailsResp,
} from '@onekeyhq/shared/types/history';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

function useTxTrack({
  trackTxId,
  accountId,
  networkId,
  timeout = timerUtils.getTimeDurationMs({ minute: 60 }),
  interval = timerUtils.getTimeDurationMs({ seconds: 30 }),
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
  const timer = useRef<ReturnType<typeof setTimeout>>();
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
}: {
  networkId: string;
  accountId: string;
  initialValue: string;
  tokenAddress: string;
  spenderAddress: string;
}) {
  const [allowance, setAllowance] = useState<string>(initialValue);
  const [trackTxId, setTrackTxId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>();
  const txDetails = useTxTrack({
    accountId,
    networkId,
    trackTxId,
  });
  useEffect(() => {
    async function fetchAllowance() {
      if (!txDetails) {
        setLoading(false);
        return;
      }
      try {
        const allowanceInfo =
          await backgroundApiProxy.serviceStaking.fetchTokenAllowance({
            networkId,
            accountId,
            tokenAddress,
            spenderAddress,
          });
        if (allowanceInfo) {
          setAllowance(allowanceInfo.allowanceParsed);
        }
      } finally {
        setLoading(false);
      }
    }
    void fetchAllowance();
  }, [txDetails, networkId, accountId, spenderAddress, tokenAddress]);
  const trackAllowance = useCallback(
    (txid: string) => {
      setTrackTxId(txid);
      setLoading(true);
    },
    [setTrackTxId],
  );
  return { allowance, trackAllowance, loading };
}
