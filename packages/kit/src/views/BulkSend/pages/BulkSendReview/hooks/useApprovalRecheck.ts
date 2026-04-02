import { useCallback, useEffect, useRef, useState } from 'react';

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
  transfersInfo: ITransferInfo[];
  totalTokenAmount: string;
  approvesInfo: IApproveInfo[];
  setApprovesInfo: React.Dispatch<React.SetStateAction<IApproveInfo[]>>;
  setUnsignedTxs: React.Dispatch<React.SetStateAction<IUnsignedTxPro[]>>;
  forceRefreshFee: () => void;
};

export function useApprovalRecheck({
  networkId,
  accountId,
  tokenInfo,
  transfersInfo,
  totalTokenAmount,
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

  const checkAllowance = useCallback(async (): Promise<boolean> => {
    if (!accountId || !networkId) return false;

    const bulkSendContractAddress = getBulkSendContractAddress()[networkId];
    if (!bulkSendContractAddress) return false;

    const sender = transfersInfo[0]?.from;
    if (!sender) return false;

    try {
      const result = await backgroundApiProxy.serviceSwap.fetchApproveAllowance(
        {
          networkId,
          tokenAddress: tokenInfo.address,
          spenderAddress: bulkSendContractAddress,
          walletAddress: sender,
          accountId,
          amount: totalTokenAmount,
        },
      );
      return !!result?.isApproved;
    } catch {
      return false;
    }
  }, [
    accountId,
    networkId,
    transfersInfo,
    tokenInfo.address,
    totalTokenAmount,
  ]);

  const startApprovalRecheck = useCallback(() => {
    // Skip if no approvals to recheck
    if (approvesInfoRef.current.length === 0) return;
    if (!accountId || !networkId) return;

    clearTimers();
    isStoppedRef.current = false;
    setIsRecheckingApproval(true);

    const runCheck = async () => {
      const isApproved = await checkAllowance();

      if (!isMountedRef.current || isStoppedRef.current) return;

      if (isApproved) {
        try {
          // Rebuild transfer-only tx with fresh nonce from chain
          const newTransferTx =
            await backgroundApiProxy.serviceSend.prepareSendConfirmUnsignedTx({
              networkId,
              accountId,
              transfersInfo,
            });

          if (!isMountedRef.current) return;

          setApprovesInfo([]);
          setUnsignedTxs([newTransferTx]);
          forceRefreshFee();
        } catch {
          // If rebuilding fails, just clear approve state anyway
          // so the user can retry
          setApprovesInfo([]);
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
  }, [
    accountId,
    networkId,
    transfersInfo,
    checkAllowance,
    setApprovesInfo,
    setUnsignedTxs,
    forceRefreshFee,
    clearTimers,
  ]);

  return {
    isRecheckingApproval,
    startApprovalRecheck,
  };
}
