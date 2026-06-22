import { PRIME_CLOUD_SYNC_CREATE_GENESIS_TIME } from '@onekeyhq/shared/src/consts/primeConsts';

export function buildDefaultBotWalletName(index: number): string {
  return `Bot #${index + 1}`;
}

export function isDefaultBotWalletName({
  index,
  name,
}: {
  index: number;
  name: string;
}): boolean {
  return name === buildDefaultBotWalletName(index);
}

export async function resolveBotWalletSyncItemDataTime({
  shouldUseCreateGenesisTime,
  timeNow,
}: {
  shouldUseCreateGenesisTime?: boolean;
  timeNow: () => Promise<number>;
}): Promise<number> {
  if (shouldUseCreateGenesisTime) {
    return PRIME_CLOUD_SYNC_CREATE_GENESIS_TIME;
  }
  return timeNow();
}
