import type { ILocalWalletSyncProgress } from '@onekeyhq/kit-bg/src/vaults/localWallet/types';
import { ETranslations, ETranslationsMock } from '@onekeyhq/shared/src/locale';

export function getPrivacyChainSyncLabel({
  disabled = false,
  paused = false,
  held = false,
  preparing = false,
  backfilling,
}: {
  disabled?: boolean;
  paused?: boolean;
  held?: boolean;
  preparing?: boolean;
  backfilling: boolean;
}) {
  if (disabled) return ETranslations.global_disabled;
  if (paused) return ETranslationsMock.privacy_scan_paused;
  if (held) return ETranslationsMock.privacy_scan_state_held;
  if (preparing) return ETranslations.global_preparing;
  return backfilling
    ? ETranslationsMock.privacy_scan_state_scanning
    : ETranslationsMock.privacy_sync_state_following;
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
      ? `${Math.floor(progress * 100)}%`
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
