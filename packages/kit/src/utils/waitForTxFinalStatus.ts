import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EOnChainHistoryTxStatus } from '@onekeyhq/shared/types/history';

// Poll a broadcast tx until it reaches a final on-chain status (Success /
// Failed), or give up after maxAttempts and return undefined (still pending).
// Shared by the staking multi-step flows and the DeFi action confirming sheet.
export async function waitForTxFinalStatus({
  accountId,
  networkId,
  txid,
  signal,
  maxAttempts = 24,
  intervalMs = timerUtils.getTimeDurationMs({ seconds: 5 }),
  expectedAccountAddress,
}: {
  accountId: string;
  networkId: string;
  txid: string;
  signal?: AbortSignal;
  maxAttempts?: number;
  intervalMs?: number;
  expectedAccountAddress?: string;
}): Promise<EOnChainHistoryTxStatus | undefined> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (signal?.aborted) {
      return undefined;
    }

    let txStatus: EOnChainHistoryTxStatus | undefined;
    try {
      const txDetailsResp =
        await backgroundApiProxy.serviceHistory.fetchTxDetails({
          accountId,
          networkId,
          txid,
          ...(expectedAccountAddress !== undefined
            ? { expectedAccountAddress }
            : undefined),
        });
      txStatus = txDetailsResp?.data?.status;
    } catch (_error) {
      // A failed lookup remains pending until the polling limit.
    }

    if (signal?.aborted) return undefined;
    if (
      txStatus === EOnChainHistoryTxStatus.Success ||
      txStatus === EOnChainHistoryTxStatus.Failed
    ) {
      return txStatus;
    }

    if (attempt < maxAttempts - 1) {
      await new Promise<void>((resolve) => {
        const timer: { value?: ReturnType<typeof setTimeout> } = {};
        const finish = () => {
          if (timer.value !== undefined) clearTimeout(timer.value);
          signal?.removeEventListener('abort', finish);
          resolve();
        };
        timer.value = setTimeout(finish, intervalMs);
        signal?.addEventListener('abort', finish, { once: true });
        if (signal?.aborted) finish();
      });
    }
  }

  return undefined;
}
