import appCrypto from '@onekeyhq/shared/src/appCrypto';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { normalizeErrorProps } from '@onekeyhq/shared/src/errors/utils/errorUtils';
import {
  HardwareCloudSyncCancelledError,
  HardwareCloudSyncError,
} from '@onekeyhq/shared/src/hardware/hardwareCloudSyncError';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import type { IKeylessCloudSyncCredential } from '@onekeyhq/shared/types/keylessCloudSync';

import localDb from '../../dbs/local/localDb';
import { primeCloudSyncPersistAtom } from '../../states/jotai/atoms';
import keylessSyncCredentialStorage from '../ServiceKeylessWallet/utils/keylessSyncCredentialStorage';

import { createHardwareCloudSyncDataError } from './hardwareCloudSyncLog';
import {
  downloadAllForReset,
  isHardwareCloudSyncKeyEnvelopeItem,
  readLockEnvelope,
  reencryptHardwareCloudSyncItems,
  requestWithHardwareCloudSyncSession,
} from './hardwareCloudSyncSession';

import type { IServerSyncRecord } from './hardwareCloudSyncSession';
import type { IBackgroundApi } from '../../apis/IBackgroundApi';
import type { AxiosInstance } from 'axios';

type IMigration = NonNullable<
  IKeylessCloudSyncCredential['pendingHardwareKeyMigration']
>;

function recordsHash(records: IServerSyncRecord[]) {
  const canonical = records
    .map(({ key, dataType, data, dataTimestamp, isDeleted }) => ({
      key,
      dataType,
      data: data ?? '',
      dataTimestamp,
      isDeleted: !!isDeleted,
    }))
    .toSorted((a, b) => {
      if (a.key < b.key) return -1;
      if (a.key > b.key) return 1;
      return 0;
    });
  if (new Set(canonical.map((item) => item.key)).size !== canonical.length) {
    throw createHardwareCloudSyncDataError(
      'Duplicate records in hardware migration snapshot',
    );
  }
  return Buffer.from(
    appCrypto.hash.sha256Sync(
      Buffer.from(stringUtils.stableStringify(canonical), 'utf8'),
    ),
  ).toString('hex');
}

function dataKey(credential: IKeylessCloudSyncCredential) {
  if (!credential.hardwareSession) throw new HardwareCloudSyncCancelledError();
  return {
    dek: credential.encryptionKey,
    dekId: credential.hardwareSession.dekId,
    pwdHash: credential.pwdHash,
  };
}

async function readNonce(
  client: AxiosInstance,
  credential: IKeylessCloudSyncCredential,
) {
  if (!credential.hardwareSession) throw new HardwareCloudSyncCancelledError();
  const { nonce } = await requestWithHardwareCloudSyncSession<{
    nonce: number;
  }>({
    client,
    session: credential.hardwareSession,
    method: 'POST',
    urlPath: '/prime/v1/sync/check',
    data: { pwdHash: credential.pwdHash, nonce: 0, localData: [] },
  });
  if (!Number.isSafeInteger(nonce))
    throw createHardwareCloudSyncDataError(
      'Hardware migration snapshot version is unavailable',
    );
  return nonce;
}

// Copies a complete, versioned snapshot between separately authenticated spaces.
// The original space is retained. Replacing existing target data requires
// confirmation of this exact snapshot, or an exact retry of our own upload.
export async function migrateHardwareCloudSyncRecords({
  client,
  source,
  target,
  isCurrent,
  savePending,
  beforeFlush,
  overwriteTargetSnapshot,
}: {
  client: AxiosInstance;
  source: IKeylessCloudSyncCredential;
  target: IKeylessCloudSyncCredential;
  isCurrent: () => boolean;
  savePending: (pending: IMigration) => Promise<void>;
  beforeFlush: () => Promise<void>;
  overwriteTargetSnapshot?: string;
}) {
  const sourceSession = source.hardwareSession;
  const targetSession = target.hardwareSession;
  if (
    !sourceSession ||
    !targetSession ||
    source.keylessWalletId === target.keylessWalletId
  )
    throw new HardwareCloudSyncCancelledError();
  const assertCurrent = () => {
    if (!isCurrent()) throw new HardwareCloudSyncCancelledError();
  };
  assertCurrent();
  const targetLock = await readLockEnvelope({ client, session: targetSession });
  const sourceLock = await readLockEnvelope({ client, session: sourceSession });
  if (
    targetLock?.dekId !== targetSession.dekId ||
    sourceLock?.dekId !== sourceSession.dekId
  ) {
    throw new HardwareCloudSyncError(
      ETranslations.cloud_sync_key_changed_sync_again__msg,
      'Encryption key changed. Sync again.',
    );
  }
  const targetNonce = await readNonce(client, target);
  const targetRecords = await downloadAllForReset({
    client,
    session: targetSession,
    pwdHash: target.pwdHash,
  });
  const targetData = targetRecords.filter(
    (item) => !isHardwareCloudSyncKeyEnvelopeItem(item),
  );
  const pending = source.pendingHardwareKeyMigration;
  const targetRecordsHash = recordsHash(targetData);
  const targetSnapshotHash = Buffer.from(
    appCrypto.hash.sha256Sync(
      Buffer.from(
        stringUtils.stableStringify({
          sourceCredentialId: source.keylessWalletId,
          targetCredentialId: target.keylessWalletId,
          pwdHash: target.pwdHash,
          nonce: targetNonce,
          recordsHash: targetRecordsHash,
        }),
        'utf8',
      ),
    ),
  ).toString('hex');
  if (
    targetData.length &&
    overwriteTargetSnapshot !== targetSnapshotHash &&
    !(
      pending?.target.keylessWalletId === target.keylessWalletId &&
      pending.target.pwdHash === target.pwdHash &&
      pending.recordsHash === targetRecordsHash
    )
  ) {
    throw new OneKeyLocalError(
      normalizeErrorProps(
        {
          key: ETranslations.cloud_sync_hardware_switch_target_has_data__msg,
          autoToast: false,
          info: {
            targetCredentialId: target.keylessWalletId,
            targetSnapshotHash,
          },
        },
        {
          defaultMessage:
            "This wallet already has synced data. Continuing will replace its cloud data with your current synced data. This can't be undone.",
        },
      ),
    );
  }
  assertCurrent();
  const sourceNonce = await readNonce(client, source);
  const sourceRecords = (
    await downloadAllForReset({
      client,
      session: sourceSession,
      pwdHash: source.pwdHash,
    })
  ).filter((item) => !isHardwareCloudSyncKeyEnvelopeItem(item));
  recordsHash(sourceRecords);
  const copied = await reencryptHardwareCloudSyncItems({
    items: sourceRecords.map((item) => ({
      ...item,
      id: item.key,
      pwdHash: source.pwdHash,
    })),
    from: dataKey(source),
    to: dataKey(target),
  });
  assertCurrent();
  if ((await readNonce(client, source)) !== sourceNonce) {
    throw new HardwareCloudSyncError(
      ETranslations.cloud_sync_data_changed_during_key_change__msg,
      'Synced data changed during the key change. Try again.',
    );
  }
  await savePending({
    target,
    recordsHash: recordsHash(copied),
    phase: 'prepared',
  });
  assertCurrent();
  await beforeFlush();
  assertCurrent();
  await requestWithHardwareCloudSyncSession({
    client,
    session: targetSession,
    method: 'POST',
    urlPath: '/prime/v1/sync/flush',
    data: {
      nonce: 0,
      pwdHash: target.pwdHash,
      expectedPwdHash: target.pwdHash,
      expectedNonce: targetNonce,
      lock: {
        key: 'lock',
        dataType: 'Lock',
        data: stringUtils.stableStringify(targetLock),
        dataTimestamp: targetLock.createdAt,
      },
      localData: [
        ...targetRecords.filter(isHardwareCloudSyncKeyEnvelopeItem),
        ...copied,
      ].map(({ key, dataType, data, dataTimestamp, isDeleted }) => ({
        key,
        dataType,
        data: data ?? '',
        dataTimestamp,
        isDeleted: !!isDeleted,
      })),
    },
  });
  // A source upload during the destination write must not silently cut this
  // client over to an older copy. The journal permits retrying that copy.
  if ((await readNonce(client, source)) !== sourceNonce) {
    throw new HardwareCloudSyncError(
      ETranslations.cloud_sync_data_changed_during_key_change__msg,
      'Synced data changed during the key change. Try again.',
    );
  }
}

// Only ciphertext still belonging to `from` is rewritten. Comparing inside
// the DB transaction preserves edits made after the snapshot was read.
async function reencryptLocalItems(
  backgroundApi: IBackgroundApi,
  from: IKeylessCloudSyncCredential,
  to: IKeylessCloudSyncCredential,
) {
  const { items } =
    await backgroundApi.servicePrimeCloudSync.getAllLocalSyncItems({
      includeUnsupportedDataTypes: true,
    });
  const originals = items.filter((item) => item.pwdHash === from.pwdHash);
  const replacements = await reencryptHardwareCloudSyncItems({
    items: originals,
    from: dataKey(from),
    to: dataKey(to),
  });
  const byId = new Map(replacements.map((item) => [item.id, item]));
  const beforeById = new Map(originals.map((item) => [item.id, item]));
  await localDb.updateSyncItem({
    ids: originals.map((item) => item.id),
    updater: (record) => {
      const before = beforeById.get(record.id);
      const after = byId.get(record.id);
      if (
        before &&
        after &&
        record.pwdHash === before.pwdHash &&
        record.data === before.data &&
        record.rawData === before.rawData &&
        record.dataTime === before.dataTime &&
        record.isDeleted === before.isDeleted
      ) {
        record.data = after.data;
        record.pwdHash = after.pwdHash;
      }
      return record;
    },
  });
}

// Recovery follows the persisted selection: before the selection write it
// restores A; after that write it finishes B. Both keys survive either crash.
export async function recoverHardwareCloudSyncMigration(
  backgroundApi: IBackgroundApi,
) {
  const config = await primeCloudSyncPersistAtom.get();
  const selected = config.hardwareCloudSyncKeySource?.credentialId;
  if (!selected) return;
  const source =
    await keylessSyncCredentialStorage.getPendingHardwareKeyMigration();
  const pending = source?.pendingHardwareKeyMigration;
  if (!source || !pending || pending.phase !== 'committing') return;
  if (selected === source.keylessWalletId) {
    await reencryptLocalItems(backgroundApi, pending.target, source);
    await keylessSyncCredentialStorage.saveCredential({
      ...source,
      pendingHardwareKeyMigration: { ...pending, phase: 'prepared' },
    });
  } else if (selected === pending.target.keylessWalletId) {
    await reencryptLocalItems(backgroundApi, source, pending.target);
    await keylessSyncCredentialStorage.saveCredential(pending.target);
  }
}

export async function commitHardwareCloudSyncMigration({
  backgroundApi,
  source,
  target,
}: {
  backgroundApi: IBackgroundApi;
  source: IKeylessCloudSyncCredential;
  target: IKeylessCloudSyncCredential;
}) {
  if (
    (await primeCloudSyncPersistAtom.get()).hardwareCloudSyncKeySource
      ?.credentialId !== source.keylessWalletId
  ) {
    throw new HardwareCloudSyncCancelledError();
  }
  const pending = source.pendingHardwareKeyMigration;
  if (
    !pending ||
    !target.source ||
    pending.target.keylessWalletId !== target.keylessWalletId
  )
    throw new HardwareCloudSyncCancelledError();
  await keylessSyncCredentialStorage.saveCredential({
    ...source,
    pendingHardwareKeyMigration: { ...pending, target, phase: 'committing' },
  });
  try {
    await reencryptLocalItems(backgroundApi, source, target);
    await primeCloudSyncPersistAtom.set((config) => {
      if (
        config.hardwareCloudSyncKeySource?.credentialId !==
          source.keylessWalletId ||
        !config.isCloudSyncEnabledKeyless
      )
        throw new HardwareCloudSyncCancelledError();
      return {
        ...config,
        hardwareCloudSyncKeySource: target.source,
        currentCloudSyncKeylessWalletId: target.keylessWalletId,
      };
    });
    await keylessSyncCredentialStorage.saveCredential(target);
  } catch (error) {
    await recoverHardwareCloudSyncMigration(backgroundApi);
    if (
      (await primeCloudSyncPersistAtom.get()).hardwareCloudSyncKeySource
        ?.credentialId !== target.keylessWalletId
    )
      throw error;
  }
}
