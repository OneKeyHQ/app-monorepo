import type { IPerpsRelayDepositSessionAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IRelayDepositStatus } from '@onekeyhq/shared/types/relay';

export const RELAY_DEPOSIT_DIALOG_POLL_INTERVAL_MS = 10_000;
export const RELAY_DEPOSIT_PANEL_POLL_INTERVAL_MS = 15_000;

export type IRelayDepositBadgeType =
  | 'success'
  | 'critical'
  | 'info'
  | 'warning';

export function buildRelayDepositSessionId({
  accountAddress,
  depositAddress,
}: {
  accountAddress: string;
  depositAddress: string;
}) {
  return `${accountAddress.toLowerCase()}-${depositAddress.toLowerCase()}`;
}

export function isRelayDepositTerminalStatus(status?: IRelayDepositStatus) {
  return status === 'success' || status === 'refund' || status === 'failure';
}

export function getRelayDepositStatusLabel(
  status?: IRelayDepositStatus,
  options?: {
    hasSourceTx?: boolean;
    compact?: boolean;
  },
) {
  if (status === 'success') return 'Completed';
  if (status === 'refund') return 'Refunded';
  if (status === 'failure') return 'Failed';
  if (
    status === 'pending' ||
    status === 'submitted' ||
    status === 'depositing'
  ) {
    return 'Processing';
  }
  if (options?.hasSourceTx) {
    return options.compact ? 'Processing' : 'Transfer detected';
  }
  return options?.compact ? 'Waiting' : 'Waiting for transfer';
}

export function getRelayDepositBadgeType(
  status?: IRelayDepositStatus,
  hasSourceTx?: boolean,
): IRelayDepositBadgeType {
  if (status === 'success') return 'success';
  if (status === 'refund' || status === 'failure') return 'critical';
  if ((status && status !== 'waiting') || hasSourceTx) return 'info';
  return 'warning';
}

export function getRelayDepositStepIndex(
  session: IPerpsRelayDepositSessionAtom,
) {
  if (isRelayDepositTerminalStatus(session.status)) return 3;
  if (session.status === 'pending' || session.status === 'submitted') return 2;
  if (session.status === 'depositing' || session.inTxs.length > 0) return 1;
  return 0;
}

export function getRelayDepositFinalStepTitle(status: IRelayDepositStatus) {
  if (status === 'refund') return 'Refunded';
  if (status === 'failure') return 'Failed';
  return 'Completed';
}

export function getRelayDepositFinalStepDesc(status: IRelayDepositStatus) {
  if (status === 'success') return 'Funds arrived in your Perps account.';
  if (status === 'refund') {
    return 'Relay returned funds to the refund address.';
  }
  if (status === 'failure') return 'Relay reported this deposit as failed.';
  return 'Waiting for final confirmation.';
}

export function getRelayDepositTimelineDotBg({
  active,
  terminalFailed,
  isLast,
}: {
  active: boolean;
  terminalFailed: boolean;
  isLast: boolean;
}) {
  if (!active) return '$bgStrong';
  if (terminalFailed && isLast) return '$bgCriticalStrong';
  return '$bgSuccessStrong';
}

export function shortenRelayDepositTxHash(hash?: string) {
  if (!hash) return '';
  if (hash.length <= 18) return hash;
  return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
}

export function formatRelayDepositLastCheckedText(lastCheckedAt?: number) {
  if (!lastCheckedAt) return 'Not checked yet';
  const seconds = Math.max(0, Math.floor((Date.now() - lastCheckedAt) / 1000));
  if (seconds < 5) return 'Checked just now';
  if (seconds < 60) return `Checked ${seconds}s ago`;
  return `Checked ${Math.floor(seconds / 60)}m ago`;
}
