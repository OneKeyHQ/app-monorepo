import { isPlainObject } from 'lodash';
import { z } from 'zod';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { PRIVACY_CHAIN_VIEWING_KEY_MISMATCH } from '../../../vaults/localWallet/viewingKeyMismatch';
import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

// The only copy of each privacy chain account's viewing key (Zcash UFVK,
// Monero `spendPub:viewPriv`) on the host. Read and written only through
// vaults/localWallet/viewingKeyStore.ts.

export type IPrivacyChainSealedViewingKey = { format: 'plain'; value: string };

export type IPrivacyChainKeyRecord = {
  networkId: string;
  // See vaults/localWallet/viewingKeyFingerprint.ts.
  vkFp: string;
  sealed: IPrivacyChainSealedViewingKey;
};

// Records are stored untyped and validated one at a time on read: a malformed
// record reads as missing, so its key is derived again.
export interface IPrivacyChainKeysDB {
  // accountId -> IPrivacyChainKeyRecord
  keys?: Record<string, unknown>;
}

const keyRecordSchema = z.object({
  networkId: z.string().min(1),
  vkFp: z.string().regex(/^[0-9a-f]{32}$/),
  sealed: z.object({
    format: z.literal('plain'),
    value: z.string().min(1),
  }),
});

function parseKeyRecord(record: unknown): IPrivacyChainKeyRecord | undefined {
  const result = keyRecordSchema.safeParse(record);
  return result.success ? result.data : undefined;
}

export class SimpleDbEntityPrivacyChainKeys extends SimpleDbEntityBase<IPrivacyChainKeysDB> {
  entityName = 'privacyChainKeys';

  override enableCache = false;

  // A dropped key costs a password prompt or a device trip to get back.
  protected override readonly enableUnreadableRecordSelfHeal = false;

  protected override readonly rejectInvalidStoredData = true;

  // Only the container shape is checked here; records are checked on read.
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
  ): Promise<void> {
    await this.setRawData((raw) => ({ keys: build({ ...raw?.keys }) }));
  }

  async getKey({
    accountId,
  }: {
    accountId: string;
  }): Promise<IPrivacyChainKeyRecord | undefined> {
    const raw = await this.getRawData();
    return parseKeyRecord(raw?.keys?.[accountId]);
  }

  // Never replaces a readable record with another identity: an account's key
  // can only change after it is removed.
  async saveKey({
    accountId,
    record,
  }: {
    accountId: string;
    record: IPrivacyChainKeyRecord;
  }): Promise<void> {
    const parsed = parseKeyRecord(record);
    if (!parsed) {
      throw new OneKeyLocalError('privacy chain: invalid viewing key record');
    }
    await this.updateKeys((keys) => {
      const existing = parseKeyRecord(keys[accountId]);
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
      return { ...keys, [accountId]: parsed };
    });
  }

  async removeKeys({ accountIds }: { accountIds: string[] }): Promise<void> {
    const raw = await this.getRawData();
    if (!accountIds.some((id) => raw?.keys?.[id] !== undefined)) {
      return;
    }
    await this.updateKeys((keys) => {
      accountIds.forEach((id) => {
        delete keys[id];
      });
      return keys;
    });
  }

  // Readable records of one network; a malformed one names no network and is
  // left for removed-account cleanup.
  async removeNetworkKeys({ networkId }: { networkId: string }): Promise<void> {
    await this.updateKeys((keys) =>
      Object.fromEntries(
        Object.entries(keys).filter(
          ([, record]) => parseKeyRecord(record)?.networkId !== networkId,
        ),
      ),
    );
  }

  // Includes malformed records, so removed-account cleanup reaches them.
  async listAccountIds(): Promise<string[]> {
    const raw = await this.getRawData();
    return Object.keys(raw?.keys ?? {});
  }
}
