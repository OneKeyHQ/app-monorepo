import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';

// The only way in and out of a privacy chain's viewing material (Zcash UFVK,
// Monero view key pair). It stays out of the account record so it never rides
// along with cloud backup, Prime transfer or account listings. Reads are async
// and may be empty.

export async function getLocalWalletViewingKey({
  backgroundApi,
  networkId,
  accountId,
}: {
  backgroundApi: IBackgroundApi;
  networkId: string;
  accountId: string;
}): Promise<string | undefined> {
  const record = await backgroundApi.simpleDb.privacyChain.getViewingKey({
    accountId,
  });
  return record?.networkId === networkId ? record.value : undefined;
}

export async function saveLocalWalletViewingKey({
  backgroundApi,
  networkId,
  accountId,
  value,
}: {
  backgroundApi: IBackgroundApi;
  networkId: string;
  accountId: string;
  value: string;
}): Promise<void> {
  if (!value) {
    throw new OneKeyLocalError('privacy chain: empty viewing key');
  }
  await backgroundApi.simpleDb.privacyChain.setViewingKey({
    accountId,
    record: { networkId, value },
  });
}

export async function removeLocalWalletViewingKeys({
  backgroundApi,
  accountIds,
}: {
  backgroundApi: IBackgroundApi;
  accountIds: string[];
}): Promise<void> {
  if (accountIds.length === 0) return;
  await backgroundApi.simpleDb.privacyChain.removeViewingKeys({ accountIds });
}

export async function listLocalWalletViewingKeyAccountIds({
  backgroundApi,
}: {
  backgroundApi: IBackgroundApi;
}): Promise<string[]> {
  return backgroundApi.simpleDb.privacyChain.listViewingKeyAccountIds();
}
