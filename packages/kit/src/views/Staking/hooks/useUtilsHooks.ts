import { useCallback, useEffect, useRef, useState } from 'react';

import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IFetchHistoryTxDetailsResp } from '@onekeyhq/shared/types/history';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

function useTxTrack({
  txid,
  accountId,
  networkId,
  timeout = timerUtils.getTimeDurationMs({ minute: 60 }),
  ms = timerUtils.getTimeDurationMs({ seconds: 30 }),
}: {
  accountId: string;
  networkId: string;
  txid?: string;
  timeout?: number;
  ms?: number;
}) {
  const [txStatus, setTxStatus] = useState<IFetchHistoryTxDetailsResp | null>(
    null,
  );
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (!txid) {
      return;
    }
    const timerCurrent = timer.current;
    const now = Date.now();
    async function main({ trackId }: { trackId: string }) {
      const txDetails = await backgroundApiProxy.serviceHistory.fetchTxDetails({
        networkId,
        accountId,
        txid: trackId,
      });
      if (txDetails) {
        setTxStatus(txDetails);
      } else if (Date.now() - now < timeout) {
        timer.current = setTimeout(() => main({ trackId }), ms);
      } else {
        setTxStatus(null);
      }
    }
    void main({ trackId: txid });
    return () => {
      clearTimeout(timerCurrent);
    };
  }, [txid, networkId, accountId, timeout, ms]);
  return txStatus;
}

export function useTokenAllowance({
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
  const [trackingTxId, setTrackingTxId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>();
  const txDetails = useTxTrack({ accountId, networkId, txid: trackingTxId });
  useEffect(() => {
    async function main() {
      if (!txDetails) {
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
    void main();
  }, [txDetails, networkId, accountId, spenderAddress, tokenAddress]);
  const refreshAllowance = useCallback(
    (txid: string) => {
      setTrackingTxId(txid);
      setLoading(true);
    },
    [setTrackingTxId],
  );
  return { allowance, refreshAllowance, loading };
}
