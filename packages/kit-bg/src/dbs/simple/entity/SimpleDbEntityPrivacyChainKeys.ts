import { isPlainObject } from 'lodash';
import { z } from 'zod';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { buildPrivacyChainStorageKey } from '../../../vaults/localWallet/privacyChainStorageKey';
import { PRIVACY_CHAIN_VIEWING_KEY_MISMATCH } from '../../../vaults/localWallet/viewingKeyMismatch';
import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export { buildPrivacyChainStorageKey };

// The only host copy of each account's viewing key (Zcash UFVK, Monero `spendPub:viewPriv`,
// Starknet STRK20 viewing key). Supports both legacy plaintext and password-encrypted records.

export type IPrivacyChainSealedViewingKey =
  | { format: 'plain'; value: string }
  | { format: 'encrypted'; value: string };

export type IPrivacyChainKeyRecord = {
  networkId: string;
  vkFp: string;
  sealed: IPrivacyChainSealedViewingKey;
  // Present for scoped keys (e.g. per-network/per-pool keys) so account-level cleanup still finds them.
  accountId?: string;
};

// Validated on read; a malformed record reads as missing and its key is derived again.
export interface IPrivacyChainKeysDB {
  keys?: Record<string, unknown>;
}

const keyRecordSchema = z.object({
  networkId: z.string().min(1),
  vkFp: z.string().regex(/^[0-9a-f]{32}$/),
  sealed: z.discriminatedUnion('format', [
    z.object({
      format: z.literal('plain'),
      value: z.string().min(1),
    }),
    z.object({
      format: z.literal('encrypted'),
      value: z.string().min(1),
    }),
  ]),
  accountId: z.string().min(1).optional(),
});

function extractOwnerAccountId(
  storageKey: string,
  record?: IPrivacyChainKeyRecord,
): string {
  if (record?.accountId) {
    return record.accountId;
  }
  const sepIndex = storageKey.indexOf('::');
  return sepIndex > 0 ? storageKey.slice(0, sepIndex) : storageKey;
}

function parseKeyRecord(record: unknown): IPrivacyChainKeyRecord | undefined {
  const result = keyRecordSchema.safeParse(record);
  if (!result.success) {
    return undefined;
  }
  const { networkId, vkFp, sealed, accountId } = result.data;
  return accountId !== undefined
    ? { networkId, vkFp, sealed, accountId }
    : { networkId, vkFp, sealed };
}

export class SimpleDbEntityPrivacyChainKeys extends SimpleDbEntityBase<IPrivacyChainKeysDB> {
  entityName = 'privacyChainKeys';

  override enableCache = false;

  // A dropped key costs a password prompt or a device trip to get back.
  protected override readonly enableUnreadableRecordSelfHeal = false;

  protected override readonly rejectInvalidStoredData = true;

  protected override validateStoredData(data: unknown): void {
    if (
      !isPlainObject(data) ||
      ((data as IPrivacyChainKeysDB).keys !== undefined &&
        !isPlainObject((data as IPrivacyChainKeysDB).keys))
    ) {
      throw new OneKeyLocalError(
        'simpledb: invalid persisted data (privacyChainKeys)',
      );
    }
  }

  private async updateKeys(
    build: (keys: Record<string, unknown>) => Record<string, unknown>,
  ): Promise<boolean> {
    const committed = await this.setRawData((raw) => ({
      keys: build({ ...raw?.keys }),
    }));
    return committed !== undefined;
  }

  async getKey({
    accountId,
    scope,
  }: {
    accountId: string;
    scope?: string;
  }): Promise<IPrivacyChainKeyRecord | undefined> {
    const raw = await this.getRawData();
    const storageKey = buildPrivacyChainStorageKey({ accountId, scope });
    return parseKeyRecord(raw?.keys?.[storageKey]);
  }

  // Never replaces a readable record with another identity: an account's key
  // can only change after it is removed.
  async saveKey({
    accountId,
    scope,
    record,
  }: {
    accountId: string;
    scope?: string;
    record: IPrivacyChainKeyRecord;
  }): Promise<void> {
    const storageKey = buildPrivacyChainStorageKey({ accountId, scope });
    const recordToParse = scope ? { ...record, accountId } : record;
    const parsed = parseKeyRecord(recordToParse);
    if (!parsed) {
      throw new OneKeyLocalError('privacy chain: invalid viewing key record');
    }
    const committed = await this.updateKeys((keys) => {
      const existing = parseKeyRecord(keys[storageKey]);
      if (
        existing &&
        (existing.networkId !== parsed.networkId ||
          existing.vkFp !== parsed.vkFp)
      ) {
        const error = new OneKeyLocalError(
          'privacy chain: viewing key does not match the stored identity',
        );
        (error as unknown as Record<string, unknown>)[
          PRIVACY_CHAIN_VIEWING_KEY_MISMATCH
        ] = true;
        throw error;
      }
      return { ...keys, [storageKey]: parsed };
    });
    if (!committed) {
      throw new OneKeyLocalError(
        'privacy chain: viewing key could not be persisted',
      );
    }
  }

  // Returns only sealed ciphertext records; decryption stays strictly bg-only.
  async listEncryptedEntries(): Promise<[string, IPrivacyChainKeyRecord][]> {
    const raw = await this.getRawData();
    if (!raw?.keys) {
      return [];
    }
    const entries: [string, IPrivacyChainKeyRecord][] = [];
    for (const [storageKey, rawRecord] of Object.entries(raw.keys)) {
      const parsed = parseKeyRecord(rawRecord);
      if (parsed?.sealed.format === 'encrypted') {
        entries.push([storageKey, parsed]);
      }
    }
    return entries;
  }

  // Replaces or deletes existing encrypted records in one atomic write.
  async applyEncryptedUpdates({
    updates,
  }: {
    updates: [string, IPrivacyChainKeyRecord | null][];
  }): Promise<void> {
    if (!updates.length) {
      return;
    }
    await this.updateKeys((keys) => {
      const next = { ...keys };
      for (const [storageKey, nextRecord] of updates) {
        if (nextRecord === null) {
          delete next[storageKey];
        } else {
          const parsed = parseKeyRecord(nextRecord);
          if (parsed?.sealed.format === 'encrypted') {
            next[storageKey] = parsed;
          }
        }
      }
      return next;
    });
  }

  async removeKey({
    accountId,
    scope,
  }: {
    accountId: string;
    scope?: string;
  }): Promise<void> {
    const storageKey = buildPrivacyChainStorageKey({ accountId, scope });
    const raw = await this.getRawData();
    if (raw?.keys?.[storageKey] === undefined) {
      return;
    }
    const committed = await this.updateKeys((keys) => {
      delete keys[storageKey];
      return keys;
    });
    if (!committed)
      throw new OneKeyLocalError(
        'privacy chain: viewing key removal could not be persisted',
      );
  }

  async removeKeys({ accountIds }: { accountIds: string[] }): Promise<void> {
    const raw = await this.getRawData();
    if (!raw?.keys) {
      return;
    }
    const idSet = new Set(accountIds);
    const keysToDelete = Object.entries(raw.keys)
      .filter(([storageKey, rawRecord]) =>
        idSet.has(extractOwnerAccountId(storageKey, parseKeyRecord(rawRecord))),
      )
      .map(([storageKey]) => storageKey);
    if (!keysToDelete.length) {
      return;
    }
    const committed = await this.updateKeys((keys) => {
      keysToDelete.forEach((storageKey) => {
        delete keys[storageKey];
      });
      return keys;
    });
    if (!committed)
      throw new OneKeyLocalError(
        'privacy chain: viewing key removal could not be persisted',
      );
  }

  async removeOrphanData({
    validAccountIds,
  }: {
    validAccountIds: string[];
  }): Promise<void> {
    const raw = await this.getRawData();
    if (!raw?.keys) {
      return;
    }
    const validSet = new Set(validAccountIds);
    const orphanKeys = Object.entries(raw.keys)
      .filter(
        ([storageKey, rawRecord]) =>
          !validSet.has(
            extractOwnerAccountId(storageKey, parseKeyRecord(rawRecord)),
          ),
      )
      .map(([storageKey]) => storageKey);
    if (!orphanKeys.length) {
      return;
    }
    await this.updateKeys((keys) => {
      orphanKeys.forEach((storageKey) => {
        delete keys[storageKey];
      });
      return keys;
    });
  }

  // Readable records of one network; a malformed one names no network.
  async removeNetworkKeys({ networkId }: { networkId: string }): Promise<void> {
    const committed = await this.updateKeys((keys) =>
      Object.fromEntries(
        Object.entries(keys).filter(
          ([, record]) => parseKeyRecord(record)?.networkId !== networkId,
        ),
      ),
    );
    if (!committed)
      throw new OneKeyLocalError(
        'privacy chain: viewing key removal could not be persisted',
      );
  }

  // Includes malformed records, so removed-account cleanup reaches them.
  async listAccountIds(): Promise<string[]> {
    const raw = await this.getRawData();
    if (!raw?.keys) {
      return [];
    }
    const seen = new Set<string>();
    for (const [storageKey, rawRecord] of Object.entries(raw.keys)) {
      seen.add(extractOwnerAccountId(storageKey, parseKeyRecord(rawRecord)));
    }
    return Array.from(seen);
  }
}
