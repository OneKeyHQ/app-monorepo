import { useSyncExternalStore } from 'react';

/**
 * Presence of the fee-overflow double-confirm dialog (the one
 * usePreCheckFeeInfo's showFeeInfoOverflowConfirm opens), as a subscribable
 * module-level flag.
 *
 * The background's verifyTransactionFeeInfo blocks on the user's answer to
 * that dialog. A flow that keeps its own sheet up during the transaction —
 * the WalletConnect Pay sheet, which steps aside on native while a prompt is
 * up — needs to know when it opens and closes, exactly as it does for the
 * password and hardware prompts. Those two prompts expose atoms; this one
 * does not — the request travels as a one-shot app event
 * (doubleConfirmTxFeeInfo) and only the dialog itself knows when it closes —
 * hence this store.
 *
 * Count-based rather than boolean so two overlapping opens cannot clear each
 * other's presence.
 */
let openCount = 0;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

export function isTxFeeOverflowConfirmOpen(): boolean {
  return openCount > 0;
}

export function subscribeTxFeeOverflowConfirmPresence(
  listener: () => void,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Marks one dialog as open. The returned function marks it closed again and
 * is idempotent: a dialog settles through its confirm/cancel button AND its
 * own onClose, so the close mark must tolerate firing twice.
 */
export function markTxFeeOverflowConfirmOpen(): () => void {
  openCount += 1;
  notify();
  let isClosed = false;
  return () => {
    if (isClosed) {
      return;
    }
    isClosed = true;
    openCount -= 1;
    notify();
  };
}

export function useIsTxFeeOverflowConfirmOpen(): boolean {
  return useSyncExternalStore(
    subscribeTxFeeOverflowConfirmPresence,
    isTxFeeOverflowConfirmOpen,
  );
}
