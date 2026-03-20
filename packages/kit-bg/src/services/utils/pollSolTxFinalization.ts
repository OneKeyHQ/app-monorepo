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
  txId,
}: {
  getSignatureStatuses: (
    signatures: string[],
  ) => Promise<Array<ISolTxSignatureStatus | null | undefined> | undefined>;
  intervalMs?: number;
  maxAttempts?: number;
  onStatusError?: (error: unknown) => void;
  txId: string;
}): Promise<ISolTxFinalizationResult> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const statuses = await getSignatureStatuses([txId]);
      const status = statuses?.[0];

      if (status) {
        if (status.err) {
          return 'failed';
        }
        if (status.confirmationStatus === 'finalized') {
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
