import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { buildPrivacyChainStorageKey } from '../../dbs/simple/entity/SimpleDbEntityPrivacyChainKeys';

import { localWalletText } from './messages';
import { getViewingKeyFingerprint } from './viewingKeyFingerprint';
import {
  PRIVACY_CHAIN_VIEWING_KEY_MISMATCH,
  isPrivacyChainViewingKeyMismatchError,
} from './viewingKeyMismatch';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';
import type { IPrivacyChainKeyRecord } from '../../dbs/simple/entity/SimpleDbEntityPrivacyChainKeys';

const PRIVACY_VIEWING_KEY_DATA_TYPE = 'privacy_viewing_key';

function buildEncryptionAad({
  storageKey,
  networkId,
  vkFp,
}: {
  storageKey: string;
  networkId: string;
  vkFp: string;
}): string {
  return `privacyChainKeys:${storageKey}:${networkId}:${vkFp}`;
}

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
  if (record?.networkId !== networkId || record.sealed.format !== 'plain') {
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

// Bg-only encrypted viewing key helpers: plaintext never crosses SimpleDbProxy/IPC.
export async function saveEncryptedLocalWalletViewingKey({
  backgroundApi,
  accountId,
  scope,
  networkId,
  vkFp,
  plaintext,
  password,
}: {
  backgroundApi: IBackgroundApi;
  accountId: string;
  scope?: string;
  networkId: string;
  vkFp: string;
  plaintext: string;
  password: string;
}): Promise<void> {
  if (!plaintext || !password || !backgroundApi.simpleDb?.privacyChainKeys) {
    return;
  }
  const storageKey = buildPrivacyChainStorageKey({ accountId, scope });
  const { encryptStringAsync } =
    await import('@onekeyhq/core/src/secret/encryptors/aes256');
  const ciphertext = await encryptStringAsync({
    password,
    data: plaintext,
    dataEncoding: 'utf8',
    aad: buildEncryptionAad({ storageKey, networkId, vkFp }),
    dataType: PRIVACY_VIEWING_KEY_DATA_TYPE,
  });
  await backgroundApi.simpleDb.privacyChainKeys.saveKey({
    accountId,
    scope,
    record: {
      networkId,
      vkFp,
      sealed: { format: 'encrypted', value: ciphertext },
    },
  });
}

export async function getDecryptedLocalWalletViewingKey({
  backgroundApi,
  accountId,
  scope,
  networkId,
  password,
}: {
  backgroundApi: IBackgroundApi;
  accountId: string;
  scope?: string;
  networkId: string;
  password: string;
}): Promise<ILocalWalletViewingKey | undefined> {
  if (!password || !backgroundApi.simpleDb?.privacyChainKeys?.getKey) {
    return undefined;
  }
  const record = await backgroundApi.simpleDb.privacyChainKeys.getKey({
    accountId,
    scope,
  });
  if (
    !record ||
    record.networkId !== networkId ||
    record.sealed.format !== 'encrypted'
  ) {
    return undefined;
  }
  const storageKey = buildPrivacyChainStorageKey({ accountId, scope });
  const { decryptStringAsync } =
    await import('@onekeyhq/core/src/secret/encryptors/aes256');
  const plaintext = await decryptStringAsync({
    password,
    data: record.sealed.value,
    resultEncoding: 'utf8',
    aad: buildEncryptionAad({
      storageKey,
      networkId: record.networkId,
      vkFp: record.vkFp,
    }),
    dataType: PRIVACY_VIEWING_KEY_DATA_TYPE,
  });
  return { value: plaintext, vkFp: record.vkFp };
}

export async function reEncryptLocalWalletViewingKeys({
  backgroundApi,
  oldPassword,
  newPassword,
}: {
  backgroundApi: IBackgroundApi;
  oldPassword: string;
  newPassword: string;
}): Promise<{ rollback: () => Promise<void> }> {
  const privacyChainKeys = backgroundApi.simpleDb?.privacyChainKeys;
  if (
    !privacyChainKeys?.listEncryptedEntries ||
    !privacyChainKeys?.applyEncryptedUpdates ||
    !oldPassword ||
    !newPassword
  ) {
    return { rollback: async () => undefined };
  }
  const encryptedEntries = await privacyChainKeys.listEncryptedEntries();
  if (!encryptedEntries.length) {
    return { rollback: async () => undefined };
  }
  const { decryptStringAsync, encryptStringAsync } =
    await import('@onekeyhq/core/src/secret/encryptors/aes256');
  const previousUpdates: [string, IPrivacyChainKeyRecord][] = [];
  const nextUpdates: [string, IPrivacyChainKeyRecord | null][] = [];
  for (const [storageKey, parsed] of encryptedEntries) {
    previousUpdates.push([storageKey, parsed]);
    const aad = buildEncryptionAad({
      storageKey,
      networkId: parsed.networkId,
      vkFp: parsed.vkFp,
    });
    try {
      // eslint-disable-next-line no-await-in-loop
      const plaintext = await decryptStringAsync({
        password: oldPassword,
        data: parsed.sealed.value,
        resultEncoding: 'utf8',
        aad,
        dataType: PRIVACY_VIEWING_KEY_DATA_TYPE,
      });
      // eslint-disable-next-line no-await-in-loop
      const reEncrypted = await encryptStringAsync({
        password: newPassword,
        data: plaintext,
        dataEncoding: 'utf8',
        aad,
        dataType: PRIVACY_VIEWING_KEY_DATA_TYPE,
      });
      nextUpdates.push([
        storageKey,
        {
          ...parsed,
          sealed: { format: 'encrypted', value: reEncrypted },
        },
      ]);
    } catch {
      // Drop unreadable encrypted cache entries rather than blocking password updates;
      // viewing keys can be re-derived on next unlock.
      nextUpdates.push([storageKey, null]);
    }
  }
  await privacyChainKeys.applyEncryptedUpdates({ updates: nextUpdates });
  return {
    rollback: async () => {
      await privacyChainKeys.applyEncryptedUpdates({
        updates: previousUpdates,
      });
    },
  };
}
