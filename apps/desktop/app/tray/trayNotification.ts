import { Notification } from 'electron';

import type { IPendingTx } from '@onekeyhq/shared/src/types/desktop/tray';

let previousPendingTxs: IPendingTx[] = [];
let notificationClickHandler: ((txId: string) => void) | null = null;

function truncateAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function showNotification(title: string, body: string, txId: string): void {
  const notification = new Notification({ title, body, silent: false });
  notification.on('click', () => {
    notificationClickHandler?.(txId);
  });
  notification.show();
}

export function diffAndNotify(currentTxs: IPendingTx[]): void {
  if (!Notification.isSupported()) {
    previousPendingTxs = currentTxs;
    return;
  }

  for (const prevTx of previousPendingTxs) {
    const currentTx = currentTxs.find((tx) => tx.id === prevTx.id);

    if (!currentTx && prevTx.status === 'pending') {
      showNotification(
        'Transaction Confirmed',
        `${prevTx.amount} → ${truncateAddress(prevTx.to)}`,
        prevTx.id,
      );
    }

    if (
      currentTx &&
      currentTx.status === 'failed' &&
      prevTx.status !== 'failed'
    ) {
      showNotification(
        'Transaction Failed',
        `${prevTx.amount} → ${truncateAddress(prevTx.to)}`,
        prevTx.id,
      );
    }
  }

  previousPendingTxs = currentTxs;
}

export function setNotificationClickHandler(
  handler: (txId: string) => void,
): void {
  notificationClickHandler = handler;
}

export function resetNotificationState(): void {
  previousPendingTxs = [];
}
