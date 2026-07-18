import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import resetUtils from '@onekeyhq/shared/src/utils/resetUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

let ownsForegroundResetLease = false;
let foregroundResetLeaseGeneration = 0;

export async function quiesceExtensionForeground(): Promise<void> {
  // This listener is installed with the UI bridge, before React mounts. Once
  // reset starts, no new persistence write can enter this runtime; drain the
  // writes that already passed their entry guard before acknowledging BG.
  if (!ownsForegroundResetLease) {
    resetUtils.startResetting();
    ownsForegroundResetLease = true;
    foregroundResetLeaseGeneration += 1;
  }
  const ownedLeaseGeneration = foregroundResetLeaseGeneration;
  await resetUtils.waitForResetSensitiveTasksToSettle();
  if (
    !ownsForegroundResetLease ||
    foregroundResetLeaseGeneration !== ownedLeaseGeneration
  ) {
    throw new OneKeyLocalError('Extension foreground reset was resumed');
  }
}

export function commitExtensionForegroundReset({
  localStorage = globalThis.localStorage,
  sessionStorage = globalThis.sessionStorage,
}: {
  localStorage?: Pick<Storage, 'clear'>;
  sessionStorage?: Pick<Storage, 'clear'>;
} = {}): void {
  if (!ownsForegroundResetLease) {
    throw new OneKeyLocalError('Extension foreground reset was not prepared');
  }

  // Only commit after every foreground has prepared successfully. This keeps
  // a failed prepare fully reversible: no browser store is cleared and resume
  // can safely return each UI to normal operation.
  timerUtils.disableSetTimeout();
  timerUtils.disableSetInterval();

  const clearFailures: string[] = [];
  try {
    localStorage.clear();
  } catch (error) {
    console.error('window.localStorage.clear() error');
    clearFailures.push(
      `localStorage: ${
        error instanceof Error ? error.message : 'unknown clear error'
      }`,
    );
  }
  try {
    sessionStorage.clear();
  } catch (error) {
    console.error('window.sessionStorage.clear() error');
    clearFailures.push(
      `sessionStorage: ${
        error instanceof Error ? error.message : 'unknown clear error'
      }`,
    );
  }
  if (clearFailures.length > 0) {
    throw new OneKeyLocalError(
      `Extension foreground storage clear failed: ${clearFailures.join('; ')}`,
    );
  }
}

export function resumeExtensionForeground(): void {
  foregroundResetLeaseGeneration += 1;
  if (ownsForegroundResetLease) {
    ownsForegroundResetLease = false;
    // Releases the PREPARE lease and restores setInterval only when this was
    // the last reset guard in the foreground runtime.
    resetUtils.endResetting();
  }
  timerUtils.enableSetTimeout();
}
