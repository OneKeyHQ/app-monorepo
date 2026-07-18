import type {
  ITxConfirmBeforeConfirm,
  ITxConfirmPreflightPhase,
} from '@onekeyhq/shared/src/routes/signatureConfirm';

export async function runTxConfirmPreflight(
  beforeConfirm: ITxConfirmBeforeConfirm,
  phase: ITxConfirmPreflightPhase,
): Promise<void> {
  await beforeConfirm(phase);
}

export async function runTxConfirmExclusiveSubmit<TResult>({
  inFlightRef,
  submit,
  terminalRef,
}: {
  inFlightRef: { current: boolean };
  submit: () => Promise<TResult>;
  terminalRef?: { current: boolean };
}): Promise<
  { executed: true; result: TResult } | { executed: false; result?: never }
> {
  if (inFlightRef.current || terminalRef?.current) {
    return { executed: false };
  }
  inFlightRef.current = true;
  try {
    return { executed: true, result: await submit() };
  } finally {
    inFlightRef.current = false;
  }
}

export async function runTxConfirmSignAndSendWithPreflight<TResult>({
  beforeConfirm,
  isAttemptActive,
  onPreflightError,
  signAndSend,
}: {
  beforeConfirm?: ITxConfirmBeforeConfirm;
  isAttemptActive?: () => boolean;
  onPreflightError: (error: unknown) => void | Promise<void>;
  signAndSend: () => Promise<TResult>;
}): Promise<
  { executed: true; result: TResult } | { executed: false; result?: never }
> {
  if (isAttemptActive && !isAttemptActive()) {
    return { executed: false };
  }
  if (beforeConfirm) {
    try {
      await runTxConfirmPreflight(beforeConfirm, 'sign');
    } catch (error) {
      await onPreflightError(error);
      return { executed: false };
    }
  }
  // A user can leave TxConfirm while the live preflight is awaiting network
  // state. Recheck the exact attempt immediately before starting the signer.
  if (isAttemptActive && !isAttemptActive()) {
    return { executed: false };
  }
  return { executed: true, result: await signAndSend() };
}

export async function runTxConfirmBatchSignAndSendWithPreflight<
  TRequest,
  TResult,
>({
  beforeConfirm,
  isAttemptActive,
  onPreflightError,
  request,
  serviceSend,
}: {
  beforeConfirm?: ITxConfirmBeforeConfirm;
  isAttemptActive?: () => boolean;
  onPreflightError: (error: unknown) => void | Promise<void>;
  request: TRequest;
  serviceSend: {
    batchSignAndSendTransaction: (request: TRequest) => Promise<TResult>;
  };
}) {
  return runTxConfirmSignAndSendWithPreflight({
    beforeConfirm,
    isAttemptActive,
    onPreflightError,
    signAndSend: () => serviceSend.batchSignAndSendTransaction(request),
  });
}
