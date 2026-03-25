import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';

export function getWalletAvatarProvider(wallet: IDBWallet | undefined) {
  return (
    wallet?.keylessDetailsInfo?.avatarProvider ??
    wallet?.keylessDetailsInfo?.keylessProvider
  );
}
