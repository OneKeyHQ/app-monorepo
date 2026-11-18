import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { localWalletText } from './messages';
import { getViewingKeyFingerprint } from './viewingKeyFingerprint';
import {
  PRIVACY_CHAIN_VIEWING_KEY_MISMATCH,
  isPrivacyChainViewingKeyMismatchError,
} from './viewingKeyMismatch';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';

// The only way in and out of a privacy chain's viewing material (Zcash UFVK,
// Monero view key pair). It stays out of the account record so it never rides
// along with cloud backup, Prime transfer or account listings. Reads are async
// and may be empty.

export type ILocalWalletViewingKey = {
  value: string;
  vkFp: string;
};

export { isPrivacyChainViewingKeyMismatchError as isLocalWalletViewingKeyMismatchError };

export async function getLocalWalletViewingKey({
  backgroundApi,
  networkId,
  accountId,
}: {
  backgroundApi: IBackgroundApi;
  networkId: string;
  accountId: string;
}): Promise<ILocalWalletViewingKey | undefined> {
  const record = await backgroundApi.simpleDb.privacyChainKeys.getKey({
    accountId,
  });
  if (record?.networkId !== networkId) {
    return undefined;
  }
  const value = record.sealed.value;
  // A record whose key no longer matches its name is damaged; derive again.
  if (
    getViewingKeyFingerprint({ networkId, viewingKey: value }) !== record.vkFp
  ) {
    return undefined;
  }
  return { value, vkFp: record.vkFp };
}

function createViewingKeyMismatchError(): OneKeyLocalError {
  return Object.assign(
    new OneKeyLocalError(
      localWalletText(ETranslations.privacy_error_setup_incomplete__msg),
    ),
    { [PRIVACY_CHAIN_VIEWING_KEY_MISMATCH]: true },
  );
}

// Refuses a key that differs from the stored one or from the identity the
// account's scan state names: the caller stops with the setup-incomplete
// error instead of switching the account's identity.
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
}): Promise<ILocalWalletViewingKey> {
  if (!value) {
    throw new OneKeyLocalError('privacy chain: empty viewing key');
  }
  const vkFp = getViewingKeyFingerprint({ networkId, viewingKey: value });
  const expectedVkFp =
    await backgroundApi.simpleDb.privacyChainState.getAccountVkFp({
      networkId,
      accountId,
    });
  if (expectedVkFp !== undefined && expectedVkFp !== vkFp) {
    throw createViewingKeyMismatchError();
  }
  try {
    await backgroundApi.simpleDb.privacyChainKeys.saveKey({
      accountId,
      record: { networkId, vkFp, sealed: { format: 'plain', value } },
    });
  } catch (error) {
    if (!isPrivacyChainViewingKeyMismatchError(error)) {
      throw error;
    }
    throw createViewingKeyMismatchError();
  }
  return { value, vkFp };
}

export async function removeLocalWalletViewingKeys({
  backgroundApi,
  accountIds,
}: {
  backgroundApi: IBackgroundApi;
  accountIds: string[];
}): Promise<void> {
  if (accountIds.length === 0) return;
  await backgroundApi.simpleDb.privacyChainKeys.removeKeys({ accountIds });
}

// Goes with the network's scan database (App Reset).
export async function removeNetworkLocalWalletViewingKeys({
  backgroundApi,
  networkId,
}: {
  backgroundApi: IBackgroundApi;
  networkId: string;
}): Promise<void> {
  await backgroundApi.simpleDb.privacyChainKeys.removeNetworkKeys({
    networkId,
  });
}

export async function listLocalWalletViewingKeyAccountIds({
  backgroundApi,
}: {
  backgroundApi: IBackgroundApi;
}): Promise<string[]> {
  return backgroundApi.simpleDb.privacyChainKeys.listAccountIds();
}
