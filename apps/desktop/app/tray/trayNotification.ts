import { Notification } from 'electron';
import type { IPendingTx } from '@onekeyhq/shared/src/types/desktop/tray';

let previousPendingTxs: IPendingTx[] = [];
let notificationClickHandler: ((txId: string) => void) | null = null;

function truncateAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function diffAndNotify(currentTxs: IPendingTx[]): void {
  if (!Notification.isSupported()) {
    previousPendingTxs = currentTxs;
    return;
  }

  for (const prevTx of previousPendingTxs) {
    const currentTx = currentTxs.find((tx) => tx.id === prevTx.id);

    if (!currentTx && prevTx.status === 'pending') {
      const notification = new Notification({
        // TODO: i18n tray.notification_tx_confirmed
        title: 'Transaction Confirmed',
        body: `${prevTx.amount} → ${truncateAddress(prevTx.to)}`,
        silent: false,
      });
      notification.on('click', () => {
        notificationClickHandler?.(prevTx.id);
      });
      notification.show();
    }

    if (currentTx && currentTx.status === 'failed' && prevTx.status !== 'failed') {
      const notification = new Notification({
        // TODO: i18n tray.notification_tx_failed
        title: 'Transaction Failed',
        body: `${prevTx.amount} → ${truncateAddress(prevTx.to)}`,
        silent: false,
      });
      notification.on('click', () => {
        notificationClickHandler?.(prevTx.id);
      });
      notification.show();
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
