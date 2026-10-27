import type { IPrivacyChainScanState } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type {
  ILocalWalletSyncErrorKind,
  ILocalWalletSyncProgress,
} from '@onekeyhq/kit-bg/src/vaults/localWallet/types';
import type { IVaultSettings } from '@onekeyhq/kit-bg/src/vaults/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { formatDistanceStrict } from '@onekeyhq/shared/src/utils/dateUtils';
import {
  getPrivacyChainBackfillBlocksLeft,
  isTipLagWorthMentioning,
} from '@onekeyhq/shared/src/utils/privacyChainSyncPolicy';

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

// Time left at the published scan speed, else blocks left; a stopped scan has no speed to project.
export function formatPrivacyChainTimeLeft({
  progress,
  stopped = false,
  intl,
}: {
  progress: ILocalWalletSyncProgress;
  stopped?: boolean;
  intl: Pick<IntlShape, 'formatMessage'>;
}): string {
  const remaining = getPrivacyChainBackfillBlocksLeft(progress);
  if (remaining === undefined || remaining <= 0) return '';
  const blocksPerSec = stopped ? undefined : progress.blocksPerSec;
  if (blocksPerSec && blocksPerSec > 0) {
    return `~${formatPrivacyChainDuration(remaining / blocksPerSec, false)}`;
  }
  return intl.formatMessage(
    { id: ETranslations.privacy_sync_blocks_remaining__msg },
    { count: remaining },
  );
}

export function getPrivacyChainSyncLabel({
  storageUnsupported = false,
  disabled = false,
  paused = false,
  held = false,
  preparing = false,
  backfilling,
}: {
  // Outranks everything: nothing else can change until the WebView is updated.
  storageUnsupported?: boolean;
  disabled?: boolean;
  paused?: boolean;
  held?: boolean;
  preparing?: boolean;
  backfilling: boolean;
}) {
  if (storageUnsupported) {
    return ETranslations.privacy_error_webview_outdated__msg;
  }
  if (disabled) return ETranslations.global_disabled;
  if (paused) return ETranslations.syncing_paused__title;
  if (held) return ETranslations.privacy_sync_waiting_wifi__msg;
  if (preparing) return ETranslations.global_preparing;
  return backfilling
    ? ETranslations.global_syncing
    : ETranslations.global_synced;
}

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
    typeof value.backfillTargetHeight === 'number' &&
    typeof value.backfillScannedHeight === 'number'
      ? Math.max(0, value.backfillTargetHeight - value.backfillScannedHeight)
      : Number.MAX_SAFE_INTEGER;
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

// A queued account with no cursor must not hide work already advancing on the same chain.
export function getPrivacyChainNetworkSyncDisplay({
  state,
  networkId,
  accountPaused = false,
}: {
  state: IPrivacyChainScanState;
  networkId: string;
  accountPaused?: boolean;
}) {
  const isStorageUnsupported =
    state.storageUnsupportedNetworkIds.includes(networkId);
  const isRunning =
    !isStorageUnsupported && state.boostingNetworkIds.includes(networkId);
  const isPaused =
    !isStorageUnsupported &&
    !isRunning &&
    (accountPaused || state.pausedNetworkIds.includes(networkId));
  const isHeldByData =
    !isStorageUnsupported &&
    !isRunning &&
    !isPaused &&
    state.dataBlockedNetworkIds.includes(networkId);
  const entries = Object.entries(state.progress).filter(([key]) =>
    key.startsWith(`${networkId}:`),
  );
  const known = Object.fromEntries(
    entries.filter(([, value]) => value.backfillScannedHeight !== null),
  );
  const backfilling =
    isRunning || entries.some(([, value]) => !value.isBackfillComplete);
  // An explicit start shows no figures until this chain publishes again; a pause outranks it.
  const isStarting = !isPaused && state.preparingNetworkIds.includes(networkId);
  const entry = isStarting
    ? undefined
    : (getPrivacyChainBackfillProgress(known, networkId) ??
      (backfilling ? undefined : Object.values(known)[0]));
  // Only the tip is left to follow: scanning never finishes, so no "done" state.
  const isCaughtUp =
    !isStarting &&
    entries.length > 0 &&
    entries.every(([, value]) => value.isBackfillComplete);
  const syncError =
    isPaused || isHeldByData
      ? undefined
      : state.syncErrorByNetworkId[networkId];
  const hasSyncError = isStorageUnsupported || syncError !== undefined;
  const labelId = hasSyncError
    ? ETranslations.global_sync_error
    : getPrivacyChainSyncLabel({
        paused: isPaused,
        held: isHeldByData,
        preparing: isStarting || Object.keys(known).length === 0,
        backfilling,
      });
  return {
    entry,
    labelId,
    isCaughtUp,
    isRunning,
    isPaused,
    isHeldByData,
    isStorageUnsupported,
    syncError,
  };
}

// The chain furthest from done, by fraction: block counts are not comparable
// across chains. A chain with no figure yet counts as not started.
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

type ILocalWalletSettings = NonNullable<IVaultSettings['localWallet']>;

// Roomy surfaces: blocks, percentage and time (else blocks) left while backfilling; scanned and
// chain heights once caught up.
export function formatPrivacyChainSyncDetail({
  progress,
  settings,
  stopped = false,
  intl,
}: {
  progress: ILocalWalletSyncProgress | null | undefined;
  settings: ILocalWalletSettings | undefined;
  stopped?: boolean;
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
        progress: progress.backfillProgress,
      }),
      formatPrivacyChainTimeLeft({ progress, stopped, intl }),
      regionLabelId ? intl.formatMessage({ id: regionLabelId }) : '',
    ]
      .filter(Boolean)
      .join(' · ');
    return (
      line ||
      intl.formatMessage({
        id: getPrivacyChainSyncLabel({ backfilling: true }),
      })
    );
  }
  // Caught up, not finished: a chain never says "up to date". Heights are safe to show here,
  // since every account sits at the same tip once backfill is done.
  const heights = formatPrivacyChainSyncProgress({
    scanned: progress.tipScannedHeight,
    target: progress.chainTip,
  });
  const lag = progress.tipLag;
  const behind =
    isTipLagWorthMentioning(
      lag,
      settings?.tipLagWarningBlocks ?? Number.MAX_SAFE_INTEGER,
    ) && settings
      ? ` · ${formatPrivacyChainDuration(-(lag ?? 0) * settings.blockTimeSeconds, true)}`
      : '';
  return heights
    ? `${heights}${behind}`
    : intl.formatMessage({
        id: getPrivacyChainSyncLabel({ backfilling: false }),
      });
}

// Tight surfaces: the state, then while syncing its percentage and time (else blocks) left.
export function formatPrivacyChainSyncSummary({
  label,
  progress,
  syncing,
  intl,
}: {
  label: string;
  progress: ILocalWalletSyncProgress | undefined;
  syncing: boolean;
  intl: Pick<IntlShape, 'formatMessage'>;
}): string {
  if (!syncing || !progress) return label;
  const percent =
    typeof progress.backfillProgress === 'number' &&
    Number.isFinite(progress.backfillProgress)
      ? formatPrivacyChainPercent(progress.backfillProgress)
      : '';
  return [
    [label, percent].filter(Boolean).join(' '),
    formatPrivacyChainTimeLeft({ progress, intl }),
  ]
    .filter(Boolean)
    .join(' · ');
}
