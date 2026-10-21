import { isPlainObject } from 'lodash';
import { z } from 'zod';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export type IZcashTransparentOutpoint = { txid: string; vout: number };

export type IZcashTransparentReservation = {
  ownerId: string;
  createdAt: number;
  expiryHeight: number;
};

export type IZcashTransparentPendingTx = {
  ownerId: string;
  rawTx: string;
  txid: string;
  spentOutpoints: IZcashTransparentOutpoint[];
  expiryHeight: number;
  createdAt: number;
  broadcastState: 'accepted' | 'unknown';
  // A signature alone is not authorization to submit or recover by rebroadcast.
  broadcastAuthorized?: boolean;
};

// Monero never links a tx to the paid address on chain; this is the only
// record of who we sent to and how much, and a rescan can't recover it.
export type IXmrSentRecord = {
  recipient: string;
  amountAtomic?: string;
  feeAtomic?: string;
  outcomeUnknown?: true;
};

export type IXmrSentAmount = {
  amountAtomic: string;
  feeAtomic: string;
  broadcastOutcomeUnknown?: boolean;
};

// Records are stored untyped and validated one at a time on read: a malformed
// record is skipped (quarantined) and kept as is, never deleted.
export interface IPrivacyChainJournalDB {
  // accountId -> { reservations: txid:vout -> ..., pendingTxs: txid -> ... }
  zcashTransparent?: Record<string, unknown>;
  // accountId -> txid -> IXmrSentRecord
  xmrSent?: Record<string, unknown>;
}

const reservationSchema = z.object({
  ownerId: z.string().min(1),
  createdAt: z.number().finite(),
  expiryHeight: z.number().int().nonnegative(),
});

const pendingTxSchema = z.object({
  ownerId: z.string().min(1),
  rawTx: z.string().min(1),
  txid: z.string().min(1),
  spentOutpoints: z.array(
    z.object({
      txid: z.string().min(1),
      vout: z.number().int().nonnegative(),
    }),
  ),
  expiryHeight: z.number().int().nonnegative(),
  createdAt: z.number().finite(),
  broadcastState: z.enum(['accepted', 'unknown']),
  broadcastAuthorized: z.boolean().optional(),
});

const xmrSentSchema = z.object({
  recipient: z.string(),
  amountAtomic: z.string().regex(/^\d+$/).optional(),
  feeAtomic: z.string().regex(/^\d+$/).optional(),
  outcomeUnknown: z.literal(true).optional(),
});

type IRecordMap = Record<string, unknown>;

// Valid records are rebuilt from known fields only; quarantined ones are
// written back untouched. Keys never overlap.
type IParsedRecords<T> = {
  valid: Record<string, T>;
  quarantined: IRecordMap;
};

type IZcashTransparentBucket = {
  reservations: IParsedRecords<IZcashTransparentReservation>;
  pendingTxs: IParsedRecords<IZcashTransparentPendingTx>;
};

function isRecordMap(value: unknown): value is IRecordMap {
  return isPlainObject(value);
}

function parseRecords<T>(
  records: IRecordMap | undefined,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
): IParsedRecords<T> {
  const parsed: IParsedRecords<T> = { valid: {}, quarantined: {} };
  for (const [key, record] of Object.entries(records ?? {})) {
    const result = schema.safeParse(record);
    if (result.success) {
      parsed.valid[key] = result.data;
    } else {
      parsed.quarantined[key] = record;
    }
  }
  return parsed;
}

function serializeRecords<T>(records: IParsedRecords<T>): IRecordMap {
  return { ...records.quarantined, ...records.valid };
}

function hasRecords(records: IParsedRecords<unknown>): boolean {
  return (
    Object.keys(records.valid).length > 0 ||
    Object.keys(records.quarantined).length > 0
  );
}

// undefined: the bucket itself is malformed, so nothing in it can be trusted.
function parseZcashBucket(
  bucket: unknown,
): IZcashTransparentBucket | undefined {
  if (bucket === undefined) {
    return {
      reservations: { valid: {}, quarantined: {} },
      pendingTxs: { valid: {}, quarantined: {} },
    };
  }
  if (!isRecordMap(bucket)) {
    return undefined;
  }
  const { reservations, pendingTxs } = bucket;
  if (
    (reservations !== undefined && !isRecordMap(reservations)) ||
    (pendingTxs !== undefined && !isRecordMap(pendingTxs))
  ) {
    return undefined;
  }
  return {
    reservations: parseRecords(reservations, reservationSchema),
    pendingTxs: parseRecords(pendingTxs, pendingTxSchema),
  };
}

function serializeZcashBucket(
  bucket: IZcashTransparentBucket,
): IRecordMap | undefined {
  if (!hasRecords(bucket.reservations) && !hasRecords(bucket.pendingTxs)) {
    return undefined;
  }
  return {
    reservations: serializeRecords(bucket.reservations),
    pendingTxs: serializeRecords(bucket.pendingTxs),
  };
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
    ...(source.outcomeUnknown ? { outcomeUnknown: true } : {}),
  };
}

function outpointKey(outpoint: IZcashTransparentOutpoint): string {
  return `${outpoint.txid}:${outpoint.vout}`;
}

function withAccount(
  records: Record<string, unknown> | undefined,
  accountId: string,
  value: unknown,
): Record<string, unknown> {
  const next = { ...records };
  if (value === undefined) {
    delete next[accountId];
  } else {
    next[accountId] = value;
  }
  return next;
}

export class SimpleDbEntityPrivacyChainJournal extends SimpleDbEntityBase<IPrivacyChainJournalDB> {
  entityName = 'privacyChainJournal';

  override enableCache = false;

  // Signed transactions, input locks and sent recipients can't be rebuilt.
  protected override readonly enableUnreadableRecordSelfHeal = false;

  protected override readonly rejectInvalidStoredData = true;

  // Only the container shape is checked here; records are checked on read.
  protected override validateStoredData(data: unknown): void {
    if (
      !isRecordMap(data) ||
      (data.zcashTransparent !== undefined &&
        !isRecordMap(data.zcashTransparent)) ||
      (data.xmrSent !== undefined && !isRecordMap(data.xmrSent))
    ) {
      throw new OneKeyLocalError(
        'simpledb: invalid persisted data (privacyChainJournal)',
      );
    }
  }

  private async updateJournal(
    build: (raw: IPrivacyChainJournalDB) => IPrivacyChainJournalDB,
  ): Promise<void> {
    await this.setRawData((raw) => {
      const next = build({
        zcashTransparent: raw?.zcashTransparent,
        xmrSent: raw?.xmrSent,
      });
      return {
        zcashTransparent: next.zcashTransparent ?? {},
        xmrSent: next.xmrSent ?? {},
      };
    });
  }

  private async updateZcashBucket(
    accountId: string,
    update: (bucket: IZcashTransparentBucket) => void,
  ): Promise<void> {
    await this.updateJournal((raw) => {
      const bucket = parseZcashBucket(raw.zcashTransparent?.[accountId]);
      if (!bucket) {
        throw new OneKeyLocalError(
          'privacy-chain journal: transparent journal record is unreadable',
        );
      }
      update(bucket);
      return {
        ...raw,
        zcashTransparent: withAccount(
          raw.zcashTransparent,
          accountId,
          serializeZcashBucket(bucket),
        ),
      };
    });
  }

  private async readZcashBucket(
    accountId: string,
  ): Promise<IZcashTransparentBucket | undefined> {
    const raw = await this.getRawData();
    return parseZcashBucket(raw?.zcashTransparent?.[accountId]);
  }

  async listAccountIds(): Promise<string[]> {
    const raw = await this.getRawData();
    return Array.from(
      new Set([
        ...Object.keys(raw?.zcashTransparent ?? {}),
        ...Object.keys(raw?.xmrSent ?? {}),
      ]),
    );
  }

  // Removed app accounts: every journal kind goes with them.
  async removeAccounts({ accountIds }: { accountIds: string[] }) {
    if (accountIds.length === 0) {
      return;
    }
    await this.updateJournal((raw) => {
      const zcashTransparent = { ...raw.zcashTransparent };
      const xmrSent = { ...raw.xmrSent };
      for (const accountId of accountIds) {
        delete zcashTransparent[accountId];
        delete xmrSent[accountId];
      }
      return { zcashTransparent, xmrSent };
    });
  }

  async listZcashTransparentAccountIds(): Promise<string[]> {
    const raw = await this.getRawData();
    return Object.keys(raw?.zcashTransparent ?? {});
  }

  async removeZcashTransparentAccount({ accountId }: { accountId: string }) {
    await this.updateJournal((raw) => ({
      ...raw,
      zcashTransparent: withAccount(raw.zcashTransparent, accountId, undefined),
    }));
  }

  async clearZcashTransparent() {
    await this.updateJournal((raw) => ({ ...raw, zcashTransparent: {} }));
  }

  async reserveTransparentOutpoints({
    accountId,
    ownerId,
    outpoints,
    currentHeight,
    expiryHeight,
  }: {
    accountId: string;
    ownerId: string;
    outpoints: IZcashTransparentOutpoint[];
    currentHeight: number;
    expiryHeight: number;
  }): Promise<void> {
    await this.updateJournal((raw) => {
      // A malformed bucket elsewhere is kept as is; only the target must parse.
      const target = parseZcashBucket(raw.zcashTransparent?.[accountId]);
      if (!target) {
        throw new OneKeyLocalError(
          'privacy-chain journal: transparent journal record is unreadable',
        );
      }
      const buckets = new Map<string, IZcashTransparentBucket>();
      for (const [storedAccountId, stored] of Object.entries(
        raw.zcashTransparent ?? {},
      )) {
        const bucket = parseZcashBucket(stored);
        if (bucket) {
          buckets.set(storedAccountId, bucket);
        }
      }
      buckets.set(accountId, target);
      for (const bucket of buckets.values()) {
        for (const [key, reservation] of Object.entries(
          bucket.reservations.valid,
        )) {
          if (reservation.expiryHeight < currentHeight) {
            delete bucket.reservations.valid[key];
          }
        }
      }
      const reservations = target.reservations.valid;
      for (const outpoint of outpoints) {
        const key = outpointKey(outpoint);
        const existing = [...buckets.values()]
          .map((bucket) => bucket.reservations.valid[key])
          .find(Boolean);
        if (existing && existing.ownerId !== ownerId) {
          const error = new OneKeyLocalError(
            'zcash: a selected transparent input is already reserved',
          );
          Object.assign(error, {
            code: 'UTXO_ALREADY_RESERVED',
            params: { outpoint: key },
          });
          throw error;
        }
        reservations[key] = { ownerId, createdAt: Date.now(), expiryHeight };
      }
      let zcashTransparent = { ...raw.zcashTransparent };
      for (const [storedAccountId, bucket] of buckets) {
        zcashTransparent = withAccount(
          zcashTransparent,
          storedAccountId,
          serializeZcashBucket(bucket),
        );
      }
      return { ...raw, zcashTransparent };
    });
  }

  async releaseTransparentReservation({
    accountId,
    ownerId,
  }: {
    accountId: string;
    ownerId: string;
  }): Promise<void> {
    const raw = await this.getRawData();
    if (raw?.zcashTransparent?.[accountId] === undefined) {
      return;
    }
    await this.updateZcashBucket(accountId, (bucket) => {
      for (const [key, reservation] of Object.entries(
        bucket.reservations.valid,
      )) {
        if (reservation.ownerId === ownerId) {
          delete bucket.reservations.valid[key];
        }
      }
    });
  }

  async saveTransparentPendingTx({
    accountId,
    tx,
    requireLiveReservation,
  }: {
    accountId: string;
    tx: IZcashTransparentPendingTx;
    requireLiveReservation?: boolean;
  }): Promise<void> {
    await this.updateZcashBucket(accountId, (bucket) => {
      if (requireLiveReservation) {
        const reservations = bucket.reservations.valid;
        if (
          tx.spentOutpoints.length === 0 ||
          tx.spentOutpoints.some((outpoint) => {
            const reservation = reservations[outpointKey(outpoint)];
            return (
              reservation?.ownerId !== tx.ownerId ||
              reservation.expiryHeight !== tx.expiryHeight
            );
          })
        ) {
          throw new OneKeyLocalError(
            'zcash: transparent signing reservation was removed or replaced',
          );
        }
      }
      const record = pendingTxSchema.safeParse(tx);
      if (!record.success) {
        throw new OneKeyLocalError('zcash: invalid signed transaction journal');
      }
      delete bucket.pendingTxs.quarantined[tx.txid];
      bucket.pendingTxs.valid[tx.txid] = record.data;
    });
  }

  async listTransparentPendingTxs({
    accountId,
  }: {
    accountId: string;
  }): Promise<IZcashTransparentPendingTx[]> {
    const bucket = await this.readZcashBucket(accountId);
    return Object.values(bucket?.pendingTxs.valid ?? {});
  }

  // Outpoints a signed or signing transaction still spends; a new selection
  // must skip them until that transaction settles or expires.
  async listTransparentOutpointsInUse({
    accountId,
    currentHeight,
  }: {
    accountId: string;
    currentHeight?: number;
  }): Promise<Set<string>> {
    const bucket = await this.readZcashBucket(accountId);
    const keys = new Set(
      Object.entries(bucket?.reservations.valid ?? {})
        .filter(
          ([, reservation]) =>
            currentHeight === undefined ||
            reservation.expiryHeight >= currentHeight,
        )
        .map(([key]) => key),
    );
    for (const tx of Object.values(bucket?.pendingTxs.valid ?? {})) {
      for (const outpoint of tx.spentOutpoints) {
        keys.add(outpointKey(outpoint));
      }
    }
    return keys;
  }

  async authorizeTransparentPendingTx({
    accountId,
    txid,
    rawTx,
  }: {
    accountId: string;
    txid: string;
    rawTx: string;
  }): Promise<void> {
    await this.updateZcashBucket(accountId, (bucket) => {
      const tx = bucket.pendingTxs.valid[txid];
      if (!tx || tx.rawTx !== rawTx) {
        throw new OneKeyLocalError(
          'zcash: signed transaction journal mismatch',
        );
      }
      bucket.pendingTxs.valid[txid] = { ...tx, broadcastAuthorized: true };
    });
  }

  async markTransparentPendingTxAccepted({
    accountId,
    txid,
  }: {
    accountId: string;
    txid: string;
  }): Promise<void> {
    await this.updateZcashBucket(accountId, (bucket) => {
      const tx = bucket.pendingTxs.valid[txid];
      if (tx) {
        bucket.pendingTxs.valid[txid] = { ...tx, broadcastState: 'accepted' };
      }
    });
  }

  async settleTransparentPendingTx({
    accountId,
    txid,
  }: {
    accountId: string;
    txid: string;
  }): Promise<void> {
    await this.updateZcashBucket(accountId, (bucket) => {
      const ownerId = bucket.pendingTxs.valid[txid]?.ownerId;
      delete bucket.pendingTxs.valid[txid];
      if (ownerId) {
        for (const [key, reservation] of Object.entries(
          bucket.reservations.valid,
        )) {
          if (reservation.ownerId === ownerId) {
            delete bucket.reservations.valid[key];
          }
        }
      }
    });
  }

  // "Clear pending transactions" for one account. A send the node accepted
  // that can still be mined keeps its rawTx and its input locks; any other
  // lock or rawTx goes, as BTC keeps no local input locks. A tx counts as
  // expired once its expiryHeight is below `expiredBeforeHeight`; without
  // it, no accepted send is treated as expired.
  async clearTransparentPendingSends({
    accountId,
    expiredBeforeHeight,
  }: {
    accountId: string;
    expiredBeforeHeight?: number;
  }): Promise<void> {
    const raw = await this.getRawData();
    if (raw?.zcashTransparent?.[accountId] === undefined) {
      return;
    }
    await this.updateZcashBucket(accountId, (bucket) => {
      const keptOwnerIds = new Set<string>();
      for (const [txid, tx] of Object.entries(bucket.pendingTxs.valid)) {
        const expired =
          expiredBeforeHeight !== undefined &&
          tx.expiryHeight < expiredBeforeHeight;
        if (tx.broadcastState === 'accepted' && !expired) {
          keptOwnerIds.add(tx.ownerId);
        } else {
          delete bucket.pendingTxs.valid[txid];
        }
      }
      for (const [key, reservation] of Object.entries(
        bucket.reservations.valid,
      )) {
        if (!keptOwnerIds.has(reservation.ownerId)) {
          delete bucket.reservations.valid[key];
        }
      }
    });
  }

  // Called at broadcast: the last moment this exists, since the chain
  // doesn't carry it and a rescan can't recover it.
  async recordXmrSent({
    accountId,
    txid,
    recipient,
    amountAtomic,
    feeAtomic,
    outcomeUnknown,
  }: {
    accountId: string;
    txid: string;
    recipient: string;
    amountAtomic?: string;
    feeAtomic?: string;
    outcomeUnknown?: boolean;
  }): Promise<void> {
    await this.updateJournal((raw) => {
      const stored = raw.xmrSent?.[accountId];
      if (stored !== undefined && !isRecordMap(stored)) {
        throw new OneKeyLocalError(
          'privacy-chain journal: sent record list is unreadable',
        );
      }
      const records = parseRecords(stored, xmrSentSchema);
      const previous = records.valid[txid];
      // Amounts are only kept as a pair; a recipient-only write keeps the
      // amounts already recorded for this tx.
      const amounts =
        amountAtomic !== undefined && feeAtomic !== undefined
          ? pickXmrSentAmounts({
              amountAtomic,
              feeAtomic,
              outcomeUnknown: outcomeUnknown ? true : undefined,
            })
          : pickXmrSentAmounts(previous);
      const record = xmrSentSchema.safeParse({ recipient, ...amounts });
      if (!record.success) {
        throw new OneKeyLocalError('xmr: invalid sent record');
      }
      delete records.quarantined[txid];
      records.valid[txid] = record.data;
      return {
        ...raw,
        xmrSent: withAccount(raw.xmrSent, accountId, serializeRecords(records)),
      };
    });
  }

  async listXmrSent({
    accountId,
  }: {
    accountId: string;
  }): Promise<Record<string, IXmrSentRecord>> {
    const raw = await this.getRawData();
    const stored = raw?.xmrSent?.[accountId];
    if (!isRecordMap(stored)) {
      return {};
    }
    return parseRecords(stored, xmrSentSchema).valid;
  }

  async removeXmrSentAccount({ accountId }: { accountId: string }) {
    await this.updateJournal((raw) => ({
      ...raw,
      xmrSent: withAccount(raw.xmrSent, accountId, undefined),
    }));
  }

  async clearXmrSent() {
    await this.updateJournal((raw) => ({ ...raw, xmrSent: {} }));
  }
}
