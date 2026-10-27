import { isPlainObject } from 'lodash';
import { z } from 'zod';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

// Monero never links a tx to the paid address on chain; this is the only record of recipients and
// amounts, and a rescan can't recover it.
export type IXmrSentRecord = {
  recipient: string;
  amountAtomic?: string;
  feeAtomic?: string;
};

export type IXmrSentAmount = {
  amountAtomic: string;
  feeAtomic: string;
};

// accountId -> txid -> IXmrSentRecord. Validated on read; a malformed record is quarantined, never deleted.
export interface IPrivacyChainXmrSentDB {
  accounts?: Record<string, unknown>;
}

const xmrSentSchema = z.object({
  recipient: z.string(),
  amountAtomic: z.string().regex(/^\d+$/).optional(),
  feeAtomic: z.string().regex(/^\d+$/).optional(),
});

type IRecordMap = Record<string, unknown>;

function isRecordMap(value: unknown): value is IRecordMap {
  return isPlainObject(value);
}

// Quarantined records are written back untouched.
function parseRecords(records: IRecordMap | undefined): {
  valid: Record<string, IXmrSentRecord>;
  quarantined: IRecordMap;
} {
  const parsed: {
    valid: Record<string, IXmrSentRecord>;
    quarantined: IRecordMap;
  } = { valid: {}, quarantined: {} };
  for (const [key, record] of Object.entries(records ?? {})) {
    const result = xmrSentSchema.safeParse(record);
    if (result.success) {
      parsed.valid[key] = result.data;
    } else {
      parsed.quarantined[key] = record;
    }
  }
  return parsed;
}

function pickXmrSentAmounts(
  source: Omit<IXmrSentRecord, 'recipient'> | undefined,
): Omit<IXmrSentRecord, 'recipient'> {
  if (source?.amountAtomic === undefined || source.feeAtomic === undefined) {
    return {};
  }
  return {
    amountAtomic: source.amountAtomic,
    feeAtomic: source.feeAtomic,
  };
}

export class SimpleDbEntityPrivacyChainXmrSent extends SimpleDbEntityBase<IPrivacyChainXmrSentDB> {
  entityName = 'privacyChainXmrSent';

  override enableCache = false;

  protected override readonly enableUnreadableRecordSelfHeal = false;

  protected override readonly rejectInvalidStoredData = true;

  protected override validateStoredData(data: unknown): void {
    if (
      !isRecordMap(data) ||
      (data.accounts !== undefined && !isRecordMap(data.accounts))
    ) {
      throw new OneKeyLocalError(
        'simpledb: invalid persisted data (privacyChainXmrSent)',
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

  async recordXmrSent({
    accountId,
    txid,
    recipient,
    amountAtomic,
    feeAtomic,
  }: {
    accountId: string;
    txid: string;
    recipient: string;
    amountAtomic?: string;
    feeAtomic?: string;
  }): Promise<void> {
    await this.updateAccounts((accounts) => {
      const stored = accounts[accountId];
      if (stored !== undefined && !isRecordMap(stored)) {
        throw new OneKeyLocalError(
          'privacy-chain journal: sent record list is unreadable',
        );
      }
      const records = parseRecords(stored);
      const previous = records.valid[txid];
      // Amounts are kept only as a pair.
      const amounts =
        amountAtomic !== undefined && feeAtomic !== undefined
          ? pickXmrSentAmounts({ amountAtomic, feeAtomic })
          : pickXmrSentAmounts(previous);
      const record = xmrSentSchema.safeParse({ recipient, ...amounts });
      if (!record.success) {
        throw new OneKeyLocalError('xmr: invalid sent record');
      }
      delete records.quarantined[txid];
      records.valid[txid] = record.data;
      return {
        ...accounts,
        [accountId]: { ...records.quarantined, ...records.valid },
      };
    });
  }

  async listXmrSent({
    accountId,
  }: {
    accountId: string;
  }): Promise<Record<string, IXmrSentRecord>> {
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
