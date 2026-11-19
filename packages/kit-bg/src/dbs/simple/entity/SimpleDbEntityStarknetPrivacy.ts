import type {
  IStrk20AccountPrivacyState,
  IStrk20OptInStatusValue,
} from '@onekeyhq/shared/types/starknetPrivacy';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

/**
 * STRK20 per-account opt-in records. Everything stored here is public: the
 * viewing key itself never reaches storage, only the public key derived from it
 * and the pool's registered copy.
 *
 * Keyed by `${networkId}_${accountId}_${poolAddress}`. The pool belongs in the
 * key because the viewing key is bound to it, so a pool migration must start a
 * fresh record rather than inherit a stale one.
 */
export interface IStarknetPrivacyDBStruct {
  records: Record<string, IStrk20AccountPrivacyState>;
}

export function buildStrk20RecordKey(params: {
  networkId: string;
  accountId: string;
  poolAddress: string;
}): string {
  return [
    params.networkId,
    params.accountId,
    params.poolAddress.toLowerCase(),
  ].join('_');
}

export class SimpleDbEntityStarknetPrivacy extends SimpleDbEntityBase<IStarknetPrivacyDBStruct> {
  entityName = 'starknetPrivacy';

  // Read on every balance refresh and on every send; the payload is a handful
  // of small records.
  override enableCache = true;

  async getRecord(params: {
    networkId: string;
    accountId: string;
    poolAddress: string;
  }): Promise<IStrk20AccountPrivacyState | undefined> {
    const rawData = await this.getRawData();
    return rawData?.records?.[buildStrk20RecordKey(params)];
  }

  /**
   * Any record for this account, whichever pool it belongs to. Lets a hot path
   * answer "has this account opted in?" from one storage read, without first
   * resolving the pool address through the remote config.
   */
  async findAccountRecord(params: {
    networkId: string;
    accountId: string;
  }): Promise<IStrk20AccountPrivacyState | undefined> {
    const rawData = await this.getRawData();
    return Object.values(rawData?.records ?? {}).find(
      (record) =>
        record.networkId === params.networkId &&
        record.accountId === params.accountId,
    );
  }

  async upsertRecord(params: {
    networkId: string;
    accountId: string;
    poolAddress: string;
    record: IStrk20AccountPrivacyState;
  }): Promise<void> {
    const key = buildStrk20RecordKey(params);
    await this.setRawData((rawData) => ({
      records: { ...rawData?.records, [key]: params.record },
    }));
  }

  /** Merges into an existing record; a missing record is left missing. */
  async patchRecord(params: {
    networkId: string;
    accountId: string;
    poolAddress: string;
    patch: Partial<IStrk20AccountPrivacyState>;
    expected?: {
      optInStatus?: IStrk20OptInStatusValue;
      registerTxid?: string;
      lastTransferTxid?: string;
      activationTxid?: string;
    };
  }): Promise<IStrk20AccountPrivacyState | undefined> {
    const key = buildStrk20RecordKey(params);
    let updated: IStrk20AccountPrivacyState | undefined;
    await this.setRawData((rawData) => {
      const records = rawData?.records ?? {};
      const current = records[key];
      if (!current) {
        return { records };
      }
      const expected = params.expected;
      if (
        (expected?.optInStatus !== undefined &&
          current.optInStatus !== expected.optInStatus) ||
        (expected?.registerTxid !== undefined &&
          current.registerTxid !== expected.registerTxid) ||
        (expected?.activationTxid !== undefined &&
          current.activationTxid !== expected.activationTxid) ||
        (expected?.lastTransferTxid !== undefined &&
          current.lastTransfer?.txid !== expected.lastTransferTxid)
      ) {
        updated = current;
        return { records };
      }
      updated = { ...current, ...params.patch };
      if (
        params.patch.lastTxBlockNumber !== undefined &&
        current.lastTxBlockNumber !== undefined
      ) {
        updated.lastTxBlockNumber = Math.max(
          current.lastTxBlockNumber,
          params.patch.lastTxBlockNumber,
        );
      }
      return { records: { ...records, [key]: updated } };
    });
    return updated;
  }

  async setOptInStatus(params: {
    networkId: string;
    accountId: string;
    poolAddress: string;
    optInStatus: IStrk20OptInStatusValue;
  }): Promise<void> {
    await this.patchRecord({
      networkId: params.networkId,
      accountId: params.accountId,
      poolAddress: params.poolAddress,
      patch: { optInStatus: params.optInStatus },
    });
  }

  /**
   * House orphan-sweep hook, run from ServiceAppCleanup after an account or
   * wallet is removed. Unlike the asset caches this sweeps consent state, so it
   * relies on that sweep's keep-set being derived from the raw localDb
   * enumeration (which still lists locked passphrase wallets) — a false drop
   * here would restart the consent flow, not just cost a re-fetch.
   */
  async removeOrphanData(params: { validAccountIds: string[] }): Promise<void> {
    const valid = new Set(params.validAccountIds);
    await this.setRawData((rawData) => {
      const records = rawData?.records ?? {};
      const kept = Object.fromEntries(
        Object.entries(records).filter(([, record]) =>
          valid.has(record.accountId),
        ),
      );
      return { records: kept };
    });
  }
}
