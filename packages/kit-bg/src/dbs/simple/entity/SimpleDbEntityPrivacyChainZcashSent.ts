import { isPlainObject } from 'lodash';
import { z } from 'zod';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

// A shielded payment funded by transparent coins: the backend sees no recipient or memo and the
// runtime does not scan the tx, so this is the sender's only record. Never copy it into the
// shared history cache, pending sends or logs.
export type IZcashSentRecord = {
  // The address the user typed.
  recipient: string;
  amountZat: string;
  feeZat: string;
  memoHex?: string;
  createdAt: number;
};

// accountId -> lowercase txid -> IZcashSentRecord. Validated on read; a malformed record is quarantined, never deleted.
export interface IPrivacyChainZcashSentDB {
  accounts?: Record<string, unknown>;
}

const zcashSentSchema = z.object({
  recipient: z.string().min(1),
  amountZat: z.string().regex(/^\d+$/),
  feeZat: z.string().regex(/^\d+$/),
  memoHex: z
    .string()
    .regex(/^[0-9a-f]{1024}$/)
    .optional(),
  createdAt: z.number().int().nonnegative(),
});

type IRecordMap = Record<string, unknown>;

function isRecordMap(value: unknown): value is IRecordMap {
  return isPlainObject(value);
}

// Quarantined records are written back untouched.
function parseRecords(records: IRecordMap | undefined): {
  valid: Record<string, IZcashSentRecord>;
  quarantined: IRecordMap;
} {
  const parsed: {
    valid: Record<string, IZcashSentRecord>;
    quarantined: IRecordMap;
  } = { valid: {}, quarantined: {} };
  for (const [key, record] of Object.entries(records ?? {})) {
    const result = zcashSentSchema.safeParse(record);
    if (result.success) {
      parsed.valid[key] = result.data;
    } else {
      parsed.quarantined[key] = record;
    }
  }
  return parsed;
}

export class SimpleDbEntityPrivacyChainZcashSent extends SimpleDbEntityBase<IPrivacyChainZcashSentDB> {
  entityName = 'privacyChainZcashSent';

  override enableCache = false;

  protected override readonly enableUnreadableRecordSelfHeal = false;

  protected override readonly rejectInvalidStoredData = true;

  protected override validateStoredData(data: unknown): void {
    if (
      !isRecordMap(data) ||
      (data.accounts !== undefined && !isRecordMap(data.accounts))
    ) {
      throw new OneKeyLocalError(
        'simpledb: invalid persisted data (privacyChainZcashSent)',
      );
    }
  }

  private async updateAccounts(
    build: (accounts: IRecordMap) => IRecordMap,
  ): Promise<void> {
    await this.setRawData((raw) => ({
      accounts: build({ ...raw?.accounts }),
    }));
  }

  async recordZcashSent({
    accountId,
    txid,
    record,
  }: {
    accountId: string;
    txid: string;
    record: IZcashSentRecord;
  }): Promise<void> {
    const parsed = zcashSentSchema.safeParse(record);
    if (!parsed.success || !txid) {
      throw new OneKeyLocalError('zcash: invalid sent record');
    }
    await this.updateAccounts((accounts) => {
      const stored = accounts[accountId];
      if (stored !== undefined && !isRecordMap(stored)) {
        throw new OneKeyLocalError(
          'privacy-chain journal: sent record list is unreadable',
        );
      }
      const key = txid.toLowerCase();
      const records = parseRecords(stored);
      delete records.quarantined[key];
      records.valid[key] = parsed.data;
      return {
        ...accounts,
        [accountId]: { ...records.quarantined, ...records.valid },
      };
    });
  }

  async listZcashSent({
    accountId,
  }: {
    accountId: string;
  }): Promise<Record<string, IZcashSentRecord>> {
    const raw = await this.getRawData();
    const stored = raw?.accounts?.[accountId];
    if (!isRecordMap(stored)) {
      return {};
    }
    return parseRecords(stored).valid;
  }

  async listAccountIds(): Promise<string[]> {
    const raw = await this.getRawData();
    return Object.keys(raw?.accounts ?? {});
  }

  // Removal is lifecycle deletion, so quarantined records go too.
  async removeAccounts({
    accountIds,
  }: {
    accountIds: string[];
  }): Promise<void> {
    if (accountIds.length === 0) return;
    await this.updateAccounts((accounts) => {
      accountIds.forEach((accountId) => {
        delete accounts[accountId];
      });
      return accounts;
    });
  }
}
