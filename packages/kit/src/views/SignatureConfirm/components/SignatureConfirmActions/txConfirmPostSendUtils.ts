import type { IOneKeyError } from '@onekeyhq/shared/src/errors/types/errorTypes';
import type { IBatchSendTxCheckpointErrorData } from '@onekeyhq/shared/types/tx';

export function syncBatchSendSuccessfullySentTxsFromError({
  error,
  successfullySentTxs,
}: {
  error: unknown;
  successfullySentTxs: string[];
}) {
  const checkpoint = (
    error as IOneKeyError<unknown, IBatchSendTxCheckpointErrorData> | undefined
  )?.data?.batchSendSuccessfullySentTxs;
  if (!Array.isArray(checkpoint)) {
    return;
  }

  for (const uuid of checkpoint) {
    if (
      typeof uuid === 'string' &&
      uuid.length > 0 &&
      !successfullySentTxs.includes(uuid)
    ) {
      successfullySentTxs.push(uuid);
    }
  }
}

export async function runTxConfirmPostSendTask({
  hasBroadcastReceipt,
  action,
  onError,
}: {
  hasBroadcastReceipt: boolean;
  action: () => Promise<void>;
  onError: (error: unknown) => void;
}) {
  if (!hasBroadcastReceipt) {
    await action();
    return;
  }

  try {
    await action();
  } catch (error) {
    try {
      onError(error);
    } catch {
      // Logging must not reopen an already completed broadcast.
    }
  }
}
