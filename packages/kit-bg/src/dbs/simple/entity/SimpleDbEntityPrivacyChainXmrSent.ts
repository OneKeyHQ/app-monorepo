// cspell:ignore randMult
import { isPlainObject } from 'lodash';
import { z } from 'zod';

import type { IXmrSentTxKeys } from '@onekeyhq/core/src/chains/xmr/types';
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

// accountId -> txid -> IXmrSentRecord plus its tx keys. Validated on read; a malformed record is
// quarantined, never deleted.
export interface IPrivacyChainXmrSentDB {
  accounts?: Record<string, unknown>;
}

const hex32 = z.string().regex(/^[0-9a-fA-F]{64}$/);
const txKeysFields = {
  txKey: hex32.optional(),
  additionalTxKeys: z.array(hex32).max(16).optional(),
  device: z
    .object({
      salt: hex32,
      randMult: hex32,
      txEncKeys: z.string().regex(/^(?:[0-9a-fA-F]{2})+$/),
      txPrefixHash: hex32,
    })
    .optional(),
};
const xmrSentRecordSchema = z.object({
  recipient: z.string(),
  amountAtomic: z.string().regex(/^\d+$/).optional(),
  feeAtomic: z.string().regex(/^\d+$/).optional(),
});
const xmrSentSchema = xmrSentRecordSchema.extend(txKeysFields);

type IStoredXmrSent = z.infer<typeof xmrSentSchema>;

type IRecordMap = Record<string, unknown>;

function isRecordMap(value: unknown): value is IRecordMap {
  return isPlainObject(value);
}

// Quarantined records are written back untouched.
function parseRecords(records: IRecordMap | undefined): {
  valid: Record<string, IStoredXmrSent>;
  quarantined: IRecordMap;
} {
  const parsed: {
    valid: Record<string, IStoredXmrSent>;
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

function pickXmrSentTxKeys(
  source: IStoredXmrSent | IXmrSentTxKeys | undefined,
): IXmrSentTxKeys | undefined {
  if (source && 'device' in source && source.device) {
    return { device: source.device };
  }
  if (source && 'txKey' in source && source.txKey !== undefined) {
    return {
      txKey: source.txKey,
      additionalTxKeys: source.additionalTxKeys ?? [],
    };
  }
  return undefined;
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

  // Without `txKeys`, keys already recorded for the tx are kept.
  async recordXmrSent({
    accountId,
    txid,
    recipient,
    amountAtomic,
    feeAtomic,
    txKeys,
  }: {
    accountId: string;
    txid: string;
    recipient: string;
    amountAtomic?: string;
    feeAtomic?: string;
    txKeys?: IXmrSentTxKeys;
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
      const record = xmrSentSchema.safeParse({
        recipient,
        ...amounts,
        ...pickXmrSentTxKeys(txKeys ?? previous),
      });
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

  // Without tx keys: history needs none.
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
    const records: Record<string, IXmrSentRecord> = {};
    for (const [txid, record] of Object.entries(parseRecords(stored).valid)) {
      records[txid] = xmrSentRecordSchema.parse(record);
    }
    return records;
  }

  async getXmrSentTxKeys({
    accountId,
    txid,
  }: {
    accountId: string;
    txid: string;
  }): Promise<IXmrSentTxKeys | undefined> {
    const raw = await this.getRawData();
    const stored = raw?.accounts?.[accountId];
    if (!isRecordMap(stored)) {
      return undefined;
    }
    return pickXmrSentTxKeys(parseRecords(stored).valid[txid]);
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
