import type { ILocalWalletSyncProgress } from '@onekeyhq/kit-bg/src/vaults/localWallet/types';
import type { IVaultSettings } from '@onekeyhq/kit-bg/src/vaults/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import type { IntlShape } from 'react-intl';

export function formatPrivacyChainRemainingBlocks(
  progress: ILocalWalletSyncProgress,
  intl: Pick<IntlShape, 'formatMessage'>,
): string {
  const remaining = progress.backfillRemainingBlocks;
  if (
    remaining === undefined ||
    !Number.isSafeInteger(remaining) ||
    remaining < 0 ||
    progress.isBackfillComplete
  )
    return '';
  return intl.formatMessage(
    {
      id: ETranslations.privacy_sync_blocks_remaining__msg,
    },
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

// One decimal: a multi-year backfill advances well under 1% per minute, and a
// whole-percent floor reads as "stuck at 0%" while blocks are flowing.
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

// Which chain the sync light speaks for when several are catching up: the one
// furthest from done, by fraction (block counts are not comparable across
// chains with different block times). A chain with no figure yet counts as
// not started.
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
