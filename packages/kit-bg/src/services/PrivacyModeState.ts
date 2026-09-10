import type { ILocalWalletSyncProgress } from '../vaults/localWallet/types';

const PRIVACY_MODE_RESUME_REORG_SAFETY_BLOCKS = 100;

export function isPrivacySyncSchedulingAllowed({
  deviceIsCellular,
  allowPrivacySyncOnCellular,
}: {
  deviceIsCellular: boolean | undefined;
  allowPrivacySyncOnCellular: boolean;
}): boolean {
  return deviceIsCellular === false || allowPrivacySyncOnCellular;
}

export function filterPrivacyModeEnabledAccounts<
  T extends { accountId: string },
>({
  accounts,
  enabledAccountIds,
}: {
  accounts: T[];
  enabledAccountIds: ReadonlySet<string>;
}): T[] {
  return accounts.filter(({ accountId }) => enabledAccountIds.has(accountId));
}

export function getPrivacyModeResumeFromHeight({
  progress,
  birthdayHeight,
}: {
  progress: ILocalWalletSyncProgress | undefined;
  birthdayHeight: number;
}): number {
  if (!progress?.isBackfillComplete) {
    return birthdayHeight;
  }
  const scannedHeight = progress.tipScannedHeight ?? progress.chainTip;
  if (scannedHeight === null) {
    return birthdayHeight;
  }
  return Math.max(
    birthdayHeight,
    scannedHeight - PRIVACY_MODE_RESUME_REORG_SAFETY_BLOCKS,
  );
}
