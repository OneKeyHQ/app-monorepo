import { replaceActiveTransferPairingRuntime } from '../prime-transfer/pairing-session-runtime';
import { secureCache } from '../secure-cache';

type IAuthFlowCleanup = () => Promise<void>;

let activeAuthFlowCleanup: IAuthFlowCleanup | null = null;
let activeAuthFlowCleanupPromise: Promise<void> | null = null;

export function registerActiveAuthFlowCleanup(
  cleanup: IAuthFlowCleanup,
): () => void {
  activeAuthFlowCleanup = cleanup;

  return () => {
    if (activeAuthFlowCleanup === cleanup) {
      activeAuthFlowCleanup = null;
    }
  };
}

export async function runActiveAuthFlowCleanup(): Promise<void> {
  const cleanup = activeAuthFlowCleanup;
  if (!cleanup) {
    return;
  }

  if (activeAuthFlowCleanupPromise) {
    await activeAuthFlowCleanupPromise;
    return;
  }

  activeAuthFlowCleanupPromise = (async () => {
    try {
      await cleanup();
    } finally {
      if (activeAuthFlowCleanup === cleanup) {
        activeAuthFlowCleanup = null;
      }
      activeAuthFlowCleanupPromise = null;
    }
  })();

  await activeAuthFlowCleanupPromise;
}

export function createAuthLoginInterruptionCleanup({
  clearSession,
  replaceActiveSession = replaceActiveTransferPairingRuntime,
}: {
  clearSession?: () => Promise<void>;
  replaceActiveSession?: (runtime: null) => Promise<void> | void;
}): IAuthFlowCleanup {
  return async () => {
    await Promise.resolve(replaceActiveSession(null));
    await clearSession?.();
  };
}

export function createSignalCleanupHandler({
  exitCode,
  runCleanup = runActiveAuthFlowCleanup,
  clearSecureCache = () => secureCache.clearAll(),
  disposeHardwareSdk,
  exit = (code: number) => process.exit(code),
}: {
  exitCode: number;
  runCleanup?: () => Promise<void>;
  clearSecureCache?: () => void;
  disposeHardwareSdk?: () => Promise<void>;
  exit?: (code: number) => void;
}): () => void {
  let isExiting = false;

  return () => {
    if (isExiting) {
      exit(exitCode);
      return;
    }

    isExiting = true;

    void (async () => {
      try {
        await runCleanup();
      } catch {
        // Cleanup is best-effort during signal-driven shutdown.
      }
      try {
        await disposeHardwareSdk?.();
      } catch {
        // Hardware SDK dispose is best-effort; USB handles leak otherwise.
      }
      clearSecureCache();
      exit(exitCode);
    })();
  };
}

export function resetActiveAuthFlowCleanupForTests(): void {
  activeAuthFlowCleanup = null;
  activeAuthFlowCleanupPromise = null;
}
