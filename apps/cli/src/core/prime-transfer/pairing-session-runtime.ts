import { createTransferStateMachine } from './transfer-state-machine';
import { DEFAULT_TRANSFER_PAIRING_TIMEOUT_MS } from './transfer-types';

import type {
  ITransferPairingRuntime,
  ITransferPairingTimeoutWindow,
} from './transfer-types';
import type { AppError } from '../../errors';

let activeTransferPairingRuntime: ITransferPairingRuntime | null = null;
const runtimeTimeoutControllers = new WeakMap<
  ITransferPairingRuntime,
  {
    startedAt?: string;
    expiresAt?: string;
    timeoutHandle?: ReturnType<typeof setTimeout>;
    clearTimeoutFn?: typeof clearTimeout;
  }
>();
const runtimeTerminalErrors = new WeakMap<ITransferPairingRuntime, AppError>();

interface ICreateTransferPairingRuntimeParams {
  roomId: string;
  userId: string;
  pairingCode: string;
  now?: () => Date;
  dispose: () => Promise<void>;
}

export function getActiveTransferPairingRuntime(): ITransferPairingRuntime | null {
  return activeTransferPairingRuntime;
}

export function getTransferPairingRuntimeError(
  runtime: ITransferPairingRuntime,
): AppError | null {
  return runtimeTerminalErrors.get(runtime) ?? null;
}

export function setTransferPairingRuntimeError(
  runtime: ITransferPairingRuntime,
  error: AppError | null,
): void {
  if (error) {
    runtimeTerminalErrors.set(runtime, error);
    return;
  }

  runtimeTerminalErrors.delete(runtime);
}

function getRuntimeTimeoutWindow(
  runtime: ITransferPairingRuntime,
): ITransferPairingTimeoutWindow | null {
  const controller = runtimeTimeoutControllers.get(runtime);
  if (!controller?.startedAt || !controller.expiresAt) {
    return null;
  }

  return {
    startedAt: controller.startedAt,
    expiresAt: controller.expiresAt,
  };
}

function clearTransferPairingRuntimeTimeout(
  runtime: ITransferPairingRuntime,
): void {
  const controller = runtimeTimeoutControllers.get(runtime);
  if (!controller?.timeoutHandle) {
    return;
  }

  (controller.clearTimeoutFn ?? clearTimeout)(controller.timeoutHandle);
  controller.timeoutHandle = undefined;
}

export function createTransferPairingRuntime({
  roomId,
  userId,
  pairingCode,
  now,
  dispose,
}: ICreateTransferPairingRuntimeParams): ITransferPairingRuntime {
  const stateMachine = createTransferStateMachine({ now });
  let isDisposed = false;
  let verificationCode: string | null = null;
  const runtimeRef: { current: ITransferPairingRuntime | null } = {
    current: null,
  };

  const transition: ITransferPairingRuntime['transition'] = (event) => {
    const currentRuntime = runtimeRef.current;
    if (currentRuntime && event !== 'transfer_failed') {
      setTransferPairingRuntimeError(currentRuntime, null);
    }

    const nextState = stateMachine.transition(event);
    if (currentRuntime && nextState.isTerminal) {
      clearTransferPairingRuntimeTimeout(currentRuntime);
    }

    return nextState;
  };

  const runtime: ITransferPairingRuntime = {
    roomId,
    userId,
    pairingCode,
    getVerificationCode: () => verificationCode,
    setVerificationCode: (code) => {
      verificationCode = code;
    },
    getState: () => stateMachine.getState(),
    subscribe: (listener) => stateMachine.subscribe(listener),
    transition,
    waitForState: (matcher) => stateMachine.waitForState(matcher),
    dispose: async () => {
      if (isDisposed) {
        return;
      }

      isDisposed = true;
      clearTransferPairingRuntimeTimeout(runtime);
      setTransferPairingRuntimeError(runtime, null);
      await dispose();
    },
  };
  runtimeRef.current = runtime;

  runtimeTimeoutControllers.set(runtime, {});

  return runtime;
}

export function startTransferPairingRuntimeTimeout(
  runtime: ITransferPairingRuntime,
  {
    timeoutMs = DEFAULT_TRANSFER_PAIRING_TIMEOUT_MS,
    now = () => new Date(),
    setTimeoutFn = setTimeout,
    clearTimeoutFn = clearTimeout,
  }: {
    timeoutMs?: number;
    now?: () => Date;
    setTimeoutFn?: typeof setTimeout;
    clearTimeoutFn?: typeof clearTimeout;
  } = {},
): ITransferPairingTimeoutWindow | null {
  const controller = runtimeTimeoutControllers.get(runtime);
  if (!controller) {
    return null;
  }

  const existingWindow = getRuntimeTimeoutWindow(runtime);
  if (existingWindow) {
    return existingWindow;
  }

  if (runtime.getState().isTerminal) {
    return null;
  }

  const startedAt = now();
  const expiresAt = new Date(startedAt.getTime() + timeoutMs);
  controller.startedAt = startedAt.toISOString();
  controller.expiresAt = expiresAt.toISOString();
  controller.clearTimeoutFn = clearTimeoutFn;
  controller.timeoutHandle = setTimeoutFn(() => {
    controller.timeoutHandle = undefined;
    runtime.transition('transfer_timeout');
  }, timeoutMs);

  return {
    startedAt: controller.startedAt,
    expiresAt: controller.expiresAt,
  };
}

export async function replaceActiveTransferPairingRuntime(
  nextRuntime: ITransferPairingRuntime | null,
): Promise<void> {
  const previousRuntime = activeTransferPairingRuntime;
  activeTransferPairingRuntime = nextRuntime;

  if (!previousRuntime) {
    return;
  }

  try {
    await previousRuntime.dispose();
  } catch {
    // Cleanup is best-effort for transient pairing runtime state.
  }
}
