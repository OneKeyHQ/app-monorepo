import { useCallback, useEffect, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';

import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type {
  IApproveInfo,
  ITransferInfo,
} from '@onekeyhq/kit-bg/src/vaults/types';
import { getBulkSendContractAddress } from '@onekeyhq/shared/src/consts/bulkSendContractAddress';
import type { IToken } from '@onekeyhq/shared/types/token';

const POLLING_INTERVAL = 5000;
const POLLING_TIMEOUT = 30_000;

type IUseApprovalRecheckParams = {
  networkId: string;
  accountId: string | undefined;
  tokenInfo: IToken;
  approvesInfo: IApproveInfo[];
  setApprovesInfo: React.Dispatch<React.SetStateAction<IApproveInfo[]>>;
  setUnsignedTxs: React.Dispatch<React.SetStateAction<IUnsignedTxPro[]>>;
  forceRefreshFee: () => void;
};

export function useApprovalRecheck({
  networkId,
  accountId,
  tokenInfo,
  approvesInfo,
  setApprovesInfo,
  setUnsignedTxs,
  forceRefreshFee,
}: IUseApprovalRecheckParams) {
  const [isRecheckingApproval, setIsRecheckingApproval] = useState(false);
  const pollingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);
  // Flag to stop polling after timeout fires, preventing race condition
  // where in-flight async check reschedules timer after clearTimers() ran
  const isStoppedRef = useRef(false);

  // Keep latest values in refs to avoid stale closures in polling
  const approvesInfoRef = useRef(approvesInfo);
  approvesInfoRef.current = approvesInfo;

  const clearTimers = useCallback(() => {
    isStoppedRef.current = true;
    if (pollingTimerRef.current) {
      clearTimeout(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
    if (timeoutTimerRef.current) {
      clearTimeout(timeoutTimerRef.current);
      timeoutTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      clearTimers();
    };
  }, [clearTimers]);

  const checkAllowance = useCallback(
    async (pendingTransfersInfo: ITransferInfo[]): Promise<boolean> => {
      if (!accountId || !networkId) return false;

      const bulkSendContractAddress = getBulkSendContractAddress()[networkId];
      if (!bulkSendContractAddress) return false;

      const sender = pendingTransfersInfo[0]?.from;
      if (!sender) return false;

      // The allowance to verify is the raw on-chain total the approve tx
      // granted. Transfer amounts are raw here (scaled-UI display amounts
      // were converted at submit), while the route's totalTokenAmount stays
      // display-basis for the summary — summing transfers keeps this check on
      // the same basis as the approval itself.
      const rawTotalAmount = pendingTransfersInfo
        .reduce(
          (acc, transfer) => acc.plus(transfer.amount || '0'),
          new BigNumber(0),
        )
        .toFixed();

      try {
        const result =
          await backgroundApiProxy.serviceSwap.fetchApproveAllowance({
            networkId,
            tokenAddress: tokenInfo.address,
            spenderAddress: bulkSendContractAddress,
            walletAddress: sender,
            accountId,
            amount: rawTotalAmount,
          });
        return !!result?.isApproved;
      } catch {
        return false;
      }
    },
    [accountId, networkId, tokenInfo.address],
  );

  const startApprovalRecheck = useCallback(
    // Only transfers not yet broadcast: when a split send fails midway, the
    // sent chunks already consumed part of the allowance and must not be rebuilt.
    // keptTxs (broadcast but not yet recorded) stay ahead of the rebuilt txs
    // so a retry can still finish their history.
    (pendingTransfersInfo: ITransferInfo[], keptTxs: IUnsignedTxPro[] = []) => {
      // Skip if no approvals to recheck
      if (approvesInfoRef.current.length === 0) return;
      if (!accountId || !networkId) return;
      if (pendingTransfersInfo.length === 0) return;

      clearTimers();
      isStoppedRef.current = false;
      setIsRecheckingApproval(true);

      const runCheck = async () => {
        const isApproved = await checkAllowance(pendingTransfersInfo);

        if (!isMountedRef.current || isStoppedRef.current) return;

        if (isApproved) {
          try {
            // Rebuild pending transfer-only txs with fresh nonce from chain
            const newTransferTxs =
              await backgroundApiProxy.serviceSend.prepareBulkSendTransferTxs({
                networkId,
                accountId,
                transfersInfo: pendingTransfersInfo,
              });

            if (!isMountedRef.current) return;

            setApprovesInfo([]);
            setUnsignedTxs([...keptTxs, ...newTransferTxs]);
            forceRefreshFee();
          } catch {
            // If rebuilding fails, just clear approve state anyway
            // so the user can retry; drop the approve txs with it so the
            // tx list keeps matching approvesInfo.
            setApprovesInfo([]);
            setUnsignedTxs((prev) => prev.filter((tx) => !tx.approveInfo));
          }

          clearTimers();
          setIsRecheckingApproval(false);
          return;
        }

        // Schedule next check if still mounted and not stopped
        if (isMountedRef.current && !isStoppedRef.current) {
          pollingTimerRef.current = setTimeout(runCheck, POLLING_INTERVAL);
        }
      };

      // Start the first check immediately
      void runCheck();

      // Set max timeout
      timeoutTimerRef.current = setTimeout(() => {
        if (!isMountedRef.current) return;
        clearTimers();
        setIsRecheckingApproval(false);
      }, POLLING_TIMEOUT);
    },
    [
      accountId,
      networkId,
      checkAllowance,
      setApprovesInfo,
      setUnsignedTxs,
      forceRefreshFee,
      clearTimers,
    ],
  );

  return {
    isRecheckingApproval,
    startApprovalRecheck,
  };
}
