import {
  OneKeyInternalError,
  OneKeyLocalError,
} from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EOnChainHistoryTxStatus } from '@onekeyhq/shared/types/history';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';

const TRANSACTION_READY_TIMEOUT_MS = 120_000;
const TRANSACTION_READY_POLL_MS = 2000;

export class TransactionConfirmationPendingError extends OneKeyLocalError {
  constructor() {
    super({ key: ETranslations.tx_confirm_waiting__desc });
  }
}

export function requestTxConfirmation(
  open: (callbacks: {
    onSuccess: (result: ISendTxOnSuccessData[]) => void;
    onCancel: () => void;
    onFail: (error: Error) => void;
  }) => Promise<void>,
  isCurrent: () => boolean,
): Promise<ISendTxOnSuccessData[] | undefined> {
  return new Promise((resolve, reject) => {
    void open({
      onSuccess: resolve,
      onCancel: () => resolve(undefined),
      onFail: reject,
    }).then(() => {
      if (!isCurrent()) resolve(undefined);
    }, reject);
  });
}

export async function waitForTransactionReady({
  isCurrent,
  check,
  isTerminalError,
}: {
  isCurrent: () => boolean;
  check: () => Promise<boolean>;
  isTerminalError?: (error: unknown) => boolean;
}): Promise<boolean> {
  const timeoutAt = Date.now() + TRANSACTION_READY_TIMEOUT_MS;
  while (isCurrent() && Date.now() < timeoutAt) {
    // Allow the completed confirmation to close before pushing the next one.
    await timerUtils.wait(TRANSACTION_READY_POLL_MS);
    if (!isCurrent()) return false;
    try {
      if (await check()) return isCurrent();
    } catch (error) {
      if (isTerminalError?.(error)) {
        throw error;
      }
    }
  }
  if (!isCurrent()) return false;
  throw new TransactionConfirmationPendingError();
}

export async function waitForSendPrerequisite({
  accountId,
  networkId,
  txid,
  isCurrent,
}: {
  accountId: string;
  networkId: string;
  txid: string;
  isCurrent: () => boolean;
}): Promise<boolean> {
  return waitForTransactionReady({
    isCurrent,
    isTerminalError: (error) =>
      error instanceof OneKeyLocalError || error instanceof OneKeyInternalError,
    check: async () => {
      const { status } =
        await backgroundApiProxy.serviceSend.getSendPrerequisiteProgress({
          accountId,
          networkId,
          txid,
        });
      if (status === EOnChainHistoryTxStatus.Failed) {
        throw new OneKeyLocalError({
          key: ETranslations.swap_review_transaction_failed,
        });
      }
      return status === EOnChainHistoryTxStatus.Success;
    },
  });
}
