import type { IPrivacyChainScanState } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { getLocalWalletNetworkSyncStatus } from '@onekeyhq/kit-bg/src/vaults/localWallet/syncStatus';
import type {
  ILocalWalletSyncStatus,
  ILocalWalletSyncStatusView,
} from '@onekeyhq/kit-bg/src/vaults/localWallet/syncStatus';
import type {
  ILocalWalletSyncErrorKind,
  ILocalWalletSyncProgress,
} from '@onekeyhq/kit-bg/src/vaults/localWallet/types';
import type { IVaultSettings } from '@onekeyhq/kit-bg/src/vaults/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { formatDistanceStrict } from '@onekeyhq/shared/src/utils/dateUtils';
import {
  getPrivacyChainBackfillBlocksLeft,
  getPrivacyChainBlocksSeconds,
  getPrivacyChainTimeWindowBlocks,
  isTipLagWorthMentioning,
} from '@onekeyhq/shared/src/utils/privacyChainSyncPolicy';
import type { IPrivacyChainBlockTime } from '@onekeyhq/shared/src/utils/privacyChainSyncPolicy';

import type { IntlShape } from 'react-intl';

export function formatPrivacyChainDuration(
  seconds: number,
  addSuffix: boolean,
): string {
  const now = Date.now();
  return formatDistanceStrict(
    now + seconds * 1000,
    now,
    addSuffix,
    addSuffix ? 'round' : 'ceil',
  );
}

type ILocalWalletSettings = NonNullable<IVaultSettings['localWallet']>;

const TIME_LEFT_MIN_MEASURED_MS = 60 * 1000;

// Trusted once the speed has run for a minute and no slower region the chain declares lies ahead:
// earlier it swings, and across such a region it runs optimistic.
export function isPrivacyChainTimeLeftReliable({
  progress,
  settings,
  now,
}: {
  progress: ILocalWalletSyncProgress;
  settings: ILocalWalletSettings | undefined;
  now: number;
}): boolean {
  const since = progress.blocksPerSecSince;
  const scanned = progress.backfillScannedHeight;
  const target = progress.backfillTargetHeight;
  if (since === undefined || now - since < TIME_LEFT_MIN_MEASURED_MS) {
    return false;
  }
  if (typeof scanned !== 'number' || typeof target !== 'number') return false;
  const slowRegionAhead = (settings?.scanRegionHints ?? []).some(
    (hint) => hint.toHeight > scanned && hint.fromHeight <= target,
  );
  return !slowRegionAhead;
}

export type IPrivacyChainSummaryFigure = 'timeLeft' | 'percent';

// While syncing a tight line shows one figure: time left once it is reliable, else the percentage.
export function pickPrivacyChainSummaryFigure(params: {
  progress: ILocalWalletSyncProgress;
  settings: ILocalWalletSettings | undefined;
  now: number;
}): IPrivacyChainSummaryFigure {
  return isPrivacyChainTimeLeftReliable(params) &&
    formatPrivacyChainTimeLeft({ progress: params.progress })
    ? 'timeLeft'
    : 'percent';
}

// Time left at the published scan speed; nothing until a speed is known or while the scan is stopped.
export function formatPrivacyChainTimeLeft({
  progress,
  stopped = false,
}: {
  progress: ILocalWalletSyncProgress;
  stopped?: boolean;
}): string {
  const remaining = getPrivacyChainBackfillBlocksLeft(progress);
  const blocksPerSec = stopped ? undefined : progress.blocksPerSec;
  if (!remaining || !blocksPerSec || blocksPerSec <= 0) return '';
  return `~${formatPrivacyChainDuration(remaining / blocksPerSec, false)}`;
}

// One label per status, the same on every surface.
export const PRIVACY_CHAIN_SYNC_STATUS_LABELS: Record<
  ILocalWalletSyncStatus,
  ETranslations
> = {
  unavailable: ETranslations.global_not_available,
  enabling: ETranslations.global_preparing,
  accountPaused: ETranslations.syncing_paused__title,
  off: ETranslations.global_disabled,
  chainPaused: ETranslations.syncing_paused__title,
  storageUnsupported: ETranslations.global_sync_error,
  waitingWifi: ETranslations.privacy_sync_waiting_wifi__msg,
  error: ETranslations.global_sync_error,
  preparing: ETranslations.global_preparing,
  syncing: ETranslations.global_syncing,
  synced: ETranslations.global_synced,
};

export function formatPrivacyChainSyncError(
  kind: ILocalWalletSyncErrorKind | undefined,
  intl: Pick<IntlShape, 'formatMessage'>,
): string | undefined {
  if (!kind) return undefined;
  if (kind === 'nodeUnreachable') {
    return intl.formatMessage({
      id: ETranslations.privacy_error_node_unreachable__msg,
    });
  }
  const id =
    kind === 'runtimeUnavailable'
      ? ETranslations.privacy_error_runtime_unavailable__msg
      : ETranslations.privacy_sync_failed_retrying__msg;
  return intl.formatMessage({ id });
}

// One decimal: multi-year backfills advance under 1% per minute, so whole percents read as stuck.
export function formatPrivacyChainPercent(progress: number): string {
  const tenths = Math.floor(Math.min(1, Math.max(0, progress)) * 1000);
  return tenths >= 1000 ? '100%' : `${(tenths / 10).toFixed(1)}%`;
}

export function formatPrivacyChainSyncProgress({
  scanned,
  target,
  progress,
}: {
  scanned: number | null | undefined;
  target: number | null | undefined;
  progress?: number | null;
}): string {
  return [
    typeof scanned === 'number' && typeof target === 'number'
      ? `${scanned.toLocaleString('en-US')} / ${target.toLocaleString('en-US')}`
      : '',
    typeof progress === 'number' && Number.isFinite(progress)
      ? formatPrivacyChainPercent(progress)
      : '',
  ]
    .filter(Boolean)
    .join(' · ');
}

export function getPrivacyChainBackfillProgress(
  progress: Record<string, ILocalWalletSyncProgress>,
  networkId: string,
): ILocalWalletSyncProgress | undefined {
  const remaining = (value: ILocalWalletSyncProgress) =>
    getPrivacyChainBackfillBlocksLeft(value) ?? Number.MAX_SAFE_INTEGER;
  return Object.entries(progress)
    .filter(
      ([key, value]) =>
        key.startsWith(`${networkId}:`) && !value.isBackfillComplete,
    )
    .map(([, value]) => value)
    .reduce<ILocalWalletSyncProgress | undefined>(
      (worst, value) =>
        !worst || remaining(value) > remaining(worst) ? value : worst,
      undefined,
    );
}

// The chain-level status the light and the settings Status row show. `accountIds` limits it to
// one wallet's scanning accounts; `accountPaused`/`unavailable` say all of that wallet's are.
export function getPrivacyChainNetworkSyncDisplay({
  state,
  networkId,
  syncedBelowBlocks,
  blockTime,
  accountIds,
  accountPaused = false,
  unavailable = false,
}: {
  state: IPrivacyChainScanState;
  networkId: string;
  syncedBelowBlocks: number;
  blockTime: IPrivacyChainBlockTime | undefined;
  accountIds?: string[];
  accountPaused?: boolean;
  unavailable?: boolean;
}) {
  let view: ILocalWalletSyncStatusView;
  if (unavailable) {
    view = { status: 'unavailable' };
  } else if (accountPaused) {
    view = { status: 'accountPaused' };
  } else {
    view = getLocalWalletNetworkSyncStatus({
      scan: state,
      networkId,
      accountIds,
      syncedBelowBlocks,
      blockTime,
    });
  }
  return {
    ...view,
    labelId: PRIVACY_CHAIN_SYNC_STATUS_LABELS[view.status],
    // Scanning at the foreground pace right now.
    isRunning:
      state.boostingNetworkIds.includes(networkId) &&
      ['preparing', 'syncing', 'synced', 'error'].includes(view.status),
  };
}

export function pickSlowestPrivacyChainNetwork(
  networkIds: string[],
  progress: Record<string, ILocalWalletSyncProgress>,
): string | undefined {
  let slowest: { networkId: string; done: number } | undefined;
  for (const networkId of networkIds) {
    const entry = getPrivacyChainBackfillProgress(progress, networkId);
    const done = entry?.backfillProgress ?? 0;
    if (!slowest || done < slowest.done) {
      slowest = { networkId, done };
    }
  }
  return slowest?.networkId;
}

// The chain-declared region the scan is inside right now (e.g. Zcash's 2022
// spam blocks), so every progress line can say why it is slow.
export function getPrivacyChainScanRegionLabelId(
  hints: NonNullable<IVaultSettings['localWallet']>['scanRegionHints'],
  scannedHeight: number | null | undefined,
) {
  if (typeof scannedHeight !== 'number') return undefined;
  return hints?.find(
    (hint) =>
      scannedHeight >= hint.fromHeight && scannedHeight <= hint.toHeight,
  )?.labelId;
}

// Roomy surfaces: blocks, percentage and time left (when known) while backfilling; scanned and
// chain heights once caught up. `shownAbove` leaves out the figure a summary line above already shows.
export function formatPrivacyChainSyncDetail({
  progress,
  settings,
  stopped = false,
  shownAbove,
  intl,
}: {
  progress: ILocalWalletSyncProgress | null | undefined;
  settings: ILocalWalletSettings | undefined;
  stopped?: boolean;
  shownAbove?: IPrivacyChainSummaryFigure;
  intl: Pick<IntlShape, 'formatMessage'>;
}): string | null {
  if (!progress) return null;
  const heightsPresent = [
    progress.backfillScannedHeight,
    progress.backfillTargetHeight,
    progress.tipScannedHeight,
    progress.chainTip,
  ].some((height) => typeof height === 'number');
  if (!heightsPresent) {
    return progress.isSyncing
      ? intl.formatMessage({ id: ETranslations.global_preparing })
      : null;
  }

  // A chain has no finish line; only backfill does, so only backfill shows a percentage/ETA.
  if (!progress.isBackfillComplete) {
    const scanned = progress.backfillScannedHeight;
    const regionLabelId = getPrivacyChainScanRegionLabelId(
      settings?.scanRegionHints,
      scanned,
    );
    const line = [
      formatPrivacyChainSyncProgress({
        scanned,
        target: progress.backfillTargetHeight,
        progress:
          shownAbove === 'percent' ? undefined : progress.backfillProgress,
      }),
      shownAbove === 'timeLeft'
        ? ''
        : formatPrivacyChainTimeLeft({ progress, stopped }),
      regionLabelId ? intl.formatMessage({ id: regionLabelId }) : '',
    ]
      .filter(Boolean)
      .join(' · ');
    return (
      line ||
      intl.formatMessage({ id: PRIVACY_CHAIN_SYNC_STATUS_LABELS.syncing })
    );
  }
  // Caught up, not finished: a chain never says "up to date". Heights are safe to show here,
  // since every account sits at the same tip once backfill is done.
  const heights = formatPrivacyChainSyncProgress({
    scanned: progress.tipScannedHeight,
    target: progress.chainTip,
  });
  const lag = progress.tipLag;
  let behind = '';
  if (
    settings &&
    isTipLagWorthMentioning(
      lag,
      getPrivacyChainTimeWindowBlocks(
        settings,
        settings.tipLagWarningBlocks,
        progress.chainTip,
      ),
    )
  ) {
    const lagSeconds = getPrivacyChainBlocksSeconds(
      settings,
      lag,
      progress.chainTip,
    );
    behind = ` · ${formatPrivacyChainDuration(-lagSeconds, true)}`;
  }
  return heights
    ? `${heights}${behind}`
    : intl.formatMessage({ id: PRIVACY_CHAIN_SYNC_STATUS_LABELS.synced });
}

// Tight surfaces: the state, then while syncing the one figure picked for it.
export function formatPrivacyChainSyncSummary({
  label,
  progress,
  figure,
}: {
  label: string;
  progress: ILocalWalletSyncProgress | undefined;
  figure: IPrivacyChainSummaryFigure | undefined;
}): string {
  if (!figure || !progress) return label;
  let value = '';
  if (figure === 'timeLeft') {
    value = formatPrivacyChainTimeLeft({ progress });
  } else if (
    typeof progress.backfillProgress === 'number' &&
    Number.isFinite(progress.backfillProgress)
  ) {
    value = formatPrivacyChainPercent(progress.backfillProgress);
  }
  return [label, value].filter(Boolean).join(' · ');
}
