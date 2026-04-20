import { Notification } from 'electron';

import type { IPendingTx } from '@onekeyhq/shared/src/types/desktop/tray';

import { ElectronTranslations, i18nText } from '../i18n';

let previousPendingTxs: IPendingTx[] = [];
// Tracks the account the snapshot was taken for. On wallet switch, the
// diff must reset — otherwise old-account txs missing from the new list
// would fire spurious "Confirmed" notifications.
let previousAccountId: string | undefined;
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

export function diffAndNotify(
  currentTxs: IPendingTx[],
  currentAccountId: string | undefined,
  pendingTxsCleared?: boolean,
): void {
  if (!Notification.isSupported()) {
    previousPendingTxs = currentTxs;
    previousAccountId = currentAccountId;
    return;
  }

  if (currentAccountId !== previousAccountId) {
    previousPendingTxs = [];
    previousAccountId = currentAccountId;
  }

  if (pendingTxsCleared) {
    previousPendingTxs = currentTxs;
    previousAccountId = currentAccountId;
    return;
  }

  for (const prevTx of previousPendingTxs) {
    const currentTx = currentTxs.find((tx) => tx.id === prevTx.id);

    if (!currentTx && prevTx.status === 'pending') {
      showNotification(
        i18nText(ElectronTranslations.tray_notification_tx_confirmed_title),
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
        i18nText(ElectronTranslations.tray_notification_tx_failed_title),
        `${prevTx.amount} → ${truncateAddress(prevTx.to)}`,
        prevTx.id,
      );
    }
  }

  previousPendingTxs = currentTxs;
  previousAccountId = currentAccountId;
}

export function setNotificationClickHandler(
  handler: (txId: string) => void,
): void {
  notificationClickHandler = handler;
}

export function resetNotificationState(): void {
  previousPendingTxs = [];
  previousAccountId = undefined;
}
