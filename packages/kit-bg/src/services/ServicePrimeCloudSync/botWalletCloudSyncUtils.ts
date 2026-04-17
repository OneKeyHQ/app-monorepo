import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type { ICloudSyncBotWalletRecord } from '@onekeyhq/shared/types/prime/primeCloudSyncTypes';

export function isBotWalletInCurrentKeylessSyncScope({
  walletId,
  currentKeylessWalletId,
}: {
  walletId: string;
  currentKeylessWalletId: string | null | undefined;
}): boolean {
  if (!currentKeylessWalletId) {
    return false;
  }
  const parsed = accountUtils.parseBotWalletId(walletId);
  return parsed?.parentId === currentKeylessWalletId;
}

export function filterBotWalletRecordsByCurrentKeylessSyncScope({
  records,
  currentKeylessWalletId,
}: {
  records: ICloudSyncBotWalletRecord[];
  currentKeylessWalletId: string | null | undefined;
}): ICloudSyncBotWalletRecord[] {
  return records.filter((record) =>
    isBotWalletInCurrentKeylessSyncScope({
      walletId: record.walletId,
      currentKeylessWalletId,
    }),
  );
}
