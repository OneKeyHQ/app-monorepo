import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

export type ISolTxFinalizationResult = 'finalized' | 'failed' | 'timeout';

type ISolTxSignatureStatus = {
  confirmationStatus?: string | null;
  err?: unknown;
};

export async function pollSolTxFinalization({
  getSignatureStatuses,
  intervalMs = 3000,
  maxAttempts = 40,
  onStatusError,
  requireFinalizedFailure = false,
  txId,
}: {
  getSignatureStatuses: (
    signatures: string[],
  ) => Promise<Array<ISolTxSignatureStatus | null | undefined> | undefined>;
  intervalMs?: number;
  maxAttempts?: number;
  onStatusError?: (error: unknown) => void;
  requireFinalizedFailure?: boolean;
  txId: string;
}): Promise<ISolTxFinalizationResult> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const statuses = await getSignatureStatuses([txId]);
      const status = statuses?.[0];

      if (status) {
        if (status.err) {
          if (
            !requireFinalizedFailure ||
            status.confirmationStatus === 'finalized'
          )
            return 'failed';
        } else if (
          status.confirmationStatus === 'finalized' &&
          (!requireFinalizedFailure || status.err === null)
        ) {
          return 'finalized';
        }
      }
    } catch (error) {
      onStatusError?.(error);
    }

    if (attempt < maxAttempts - 1) {
      await timerUtils.wait(intervalMs);
    }
  }

  return 'timeout';
}
