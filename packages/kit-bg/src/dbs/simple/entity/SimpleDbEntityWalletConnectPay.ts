import { sha256 } from '@noble/hashes/sha256';

import { OneKeyError } from '@onekeyhq/shared/src/errors';
import appStorage from '@onekeyhq/shared/src/storage/appStorage';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import {
  WC_PAY_PROGRESS_CORRUPT_ERROR,
  WC_PAY_PROGRESS_UNREADABLE_ERROR,
} from '@onekeyhq/shared/src/walletConnect/payBroadcastUtils';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

// Recorded at the pre-broadcast boundary for eth_sendTransaction actions so
// the phantom-txid recovery check has a propagation-independent criterion:
// "never broadcast" additionally requires the sender's confirmed on-chain tx
// count to not exceed this nonce (a higher count means a transaction with
// this nonce already landed — quite possibly this very one)
export interface IWcPayBroadcastMeta {
  sender: string;
  nonce: number;
}

export interface IWcPayStoredActionEntry {
  // sha256 hex of the action's normalized walletRpc (chainId + method
  // + JSON-parsed params, see getWcPayActionFingerprint); proves a stored
  // result still belongs to the same-index action when the server returns a
  // recomputed action list on a later attempt
  fingerprint: string;
  result: string;
  broadcastMeta?: IWcPayBroadcastMeta;
}

// Plaintext SimpleDb keeps only this expiry/lookup index. The sensitive
// payload — action results (consumable signatures / fully signed
// transactions) — is encrypted at rest in appStorage.secureStorage under a
// key derived from the same progress key.
export interface IWcPayStoredProgressMeta {
  paymentId: string;
  optionId: string;
  // indexedAccountId ?? accountId of the signing account; results produced
  // with one account must never be replayed into an attempt made with another
  accountKey: string;
  updatedAt: number;
}

export interface IWcPayStoredProgress extends IWcPayStoredProgressMeta {
  entries: IWcPayStoredActionEntry[];
}

export interface ISimpleDbWalletConnectPay {
  progress: Record<string, IWcPayStoredProgressMeta>;
}

// Backstop for payments that never reach a final confirmPayment state (the
// normal cleanup path). Server-side payment expiry is minutes, so a record
// this old can never be legitimately resumed.
const PROGRESS_TTL_MS = 48 * 60 * 60 * 1000;

function buildProgressKey({
  paymentId,
  optionId,
  accountKey,
}: {
  paymentId: string;
  optionId: string;
  accountKey: string;
}): string {
  return `${paymentId}__${optionId}__${accountKey}`;
}

// expo-secure-store only accepts [A-Za-z0-9._-] keys while progress keys
// contain account ids with arbitrary characters; hash to a safe fixed form
function buildSecurePayloadKey(progressKey: string): string {
  return `wc_pay_progress_${bufferUtils.bytesToHex(
    sha256(bufferUtils.toBuffer(progressKey, 'utf8')),
  )}`;
}

/**
 * Durable record of WalletConnect Pay signing progress. Persisted in the
 * background (not UI memory) because on native the UI runtime can be
 * reclaimed while a broadcast transaction is still confirming; a resumed
 * attempt must know the transaction was already sent, or the payment could
 * be broadcast twice.
 *
 * SimpleDb holds only the non-sensitive index; entries live encrypted in
 * secureStorage and are deleted together with the index on final payment
 * state or TTL expiry. On platforms without secure storage (bare web,
 * Linux without a real keyring backend) progress is simply not persisted —
 * signatures are never written to plaintext storage as a fallback; flows
 * containing a broadcast-capable action are refused upfront there instead
 * (see ServiceWalletConnectPay.getRequiredPaymentActions).
 */
export class SimpleDbEntityWalletConnectPay extends SimpleDbEntityBase<ISimpleDbWalletConnectPay> {
  entityName = 'walletConnectPay';

  override enableCache = false;

  // Public so the payment flow can preflight before any action executes:
  // broadcast-capable actions must not start when their progress cannot be
  // durably recorded (see ServiceWalletConnectPay.getRequiredPaymentActions)
  async supportsDurableProgress(): Promise<boolean> {
    try {
      return await appStorage.secureStorage.supportSecureStorage();
    } catch {
      return false;
    }
  }

  // Read outcome of the encrypted entries payload. 'absent' is a CONFIRMED
  // "no ciphertext stored" — the only verdict on which callers may clean up
  // the index. 'unreadable' is a TRANSIENT read failure (locked keychain,
  // platform hiccup, a decrypt error — every platform adapter reports those
  // by throwing): the record may heal on a later read, so callers must fail
  // the operation and leave it for a later attempt, the server-side final
  // state, or the TTL. 'corrupt' is a CONTENT verdict, never an access one:
  // the payload was read and decrypted but is provably not a record this
  // store ever wrote (saveActionResult only ever serializes arrays), so it
  // cannot carry a real txid — which is the only reason callers may surface
  // the user-confirmed discard escape for it. Neither failure
  // verdict may trigger deletion by itself: only an explicit
  // fromIndex-0 discard (user-confirmed) removes an undecodable record.
  private async readSecureEntries(
    progressKey: string,
  ): Promise<
    | { status: 'ok'; entries: IWcPayStoredActionEntry[] }
    | { status: 'absent' }
    | { status: 'unreadable' }
    | { status: 'corrupt' }
  > {
    let payload: string | undefined | null;
    try {
      payload = await appStorage.secureStorage.getSecureItem(
        buildSecurePayloadKey(progressKey),
      );
    } catch {
      // EVERY throwing read — the adapter-labeled permanent kind included —
      // stays 'unreadable', deliberately: 'corrupt' unlocks a destructive
      // user-confirmed discard, and that is only safe on a CONTENT verdict
      // (payload read, decoded, provably not a record). A read failure is
      // an ACCESS verdict — the payload may be an intact record holding a
      // broadcast txid, and removeSecureItem needs no decryption, so the
      // discard would destroy that evidence on an inferred-permanent
      // failure. The cost is bounded: the refusal is per
      // payment+option+account, the TTL sweep deletes without decrypting,
      // and the payment itself expires server-side in minutes.
      return { status: 'unreadable' };
    }
    if (!payload) {
      return { status: 'absent' };
    }
    try {
      const entries = JSON.parse(payload) as IWcPayStoredActionEntry[];
      // valid JSON of the wrong shape cannot be decrypt garbage (that fails
      // the parse below) — it is deterministic corruption
      return Array.isArray(entries)
        ? { status: 'ok', entries }
        : { status: 'corrupt' };
    } catch {
      // unparseable plaintext may still be a transient decrypt artifact on
      // an adapter that returned garbage instead of throwing; stay on the
      // conservative verdict
      return { status: 'unreadable' };
    }
  }

  // The index entry for a key is only ever deleted AFTER its ciphertext
  // removal succeeded: deleting the index over a still-present ciphertext
  // would orphan the payload where getProgress (index-driven) and the TTL
  // sweep can never reach it again — while saveActionResult still reads it
  // by key and keeps refusing writes, closing the damaged-record escape
  // permanently. The two modes differ only in how a ciphertext-removal
  // failure surfaces: `strictCiphertext` (explicit, user/flow-initiated
  // discards) rethrows so the caller sees the discard did not happen;
  // best-effort (background cleanup: TTL, orphan index, final states)
  // swallows the failure but KEEPS that key's index entry, so the next
  // sweep retries the removal instead of stranding the ciphertext.
  // Returns the keys whose ciphertext AND index entry were actually
  // removed, so callers can tell a completed deletion from a kept-for-retry
  // one (the TTL read path must not report "gone" for a record that in
  // fact refused to delete — that would shadow a damaged record's escape).
  private async removeProgressByKeys(
    progressKeys: string[],
    options?: { strictCiphertext?: boolean },
  ): Promise<string[]> {
    if (!progressKeys.length) {
      return [];
    }
    const removedKeys: string[] = [];
    await Promise.all(
      progressKeys.map(async (key) => {
        try {
          await appStorage.secureStorage.removeSecureItem(
            buildSecurePayloadKey(key),
          );
          removedKeys.push(key);
        } catch (error) {
          if (options?.strictCiphertext) {
            // fail the discard loudly instead of leaving the user with a
            // record that silently refused to go away (see the note above)
            throw error;
          }
          // best-effort: keep this key's index entry for a later retry
        }
      }),
    );
    if (!removedKeys.length) {
      return [];
    }
    await this.setRawData((rawData) => {
      const progress = { ...rawData?.progress };
      for (const key of removedKeys) {
        delete progress[key];
      }
      return { progress };
    });
    return removedKeys;
  }

  async getProgress(params: {
    paymentId: string;
    optionId: string;
    accountKey: string;
  }): Promise<IWcPayStoredProgress | undefined> {
    const data = await this.getRawData();
    const key = buildProgressKey(params);
    const meta = data?.progress?.[key];
    if (!meta) {
      return undefined;
    }
    const isExpired = Date.now() - meta.updatedAt > PROGRESS_TTL_MS;
    if (isExpired) {
      const removedKeys = await this.removeProgressByKeys([key]);
      if (removedKeys.includes(key)) {
        return undefined;
      }
      // The expired record refused to delete (ciphertext removal failed;
      // its index entry was kept for a later sweep). "Expired" must not
      // shadow "damaged": fall through to the payload read so a corrupt
      // record still throws and re-surfaces the user-confirmed discard
      // escape instead of silently starting a fresh attempt that
      // saveActionResult will refuse anyway.
    }
    const read = await this.readSecureEntries(key);
    if (read.status === 'unreadable' || read.status === 'corrupt') {
      // the ciphertext exists but cannot be used. Deleting here would
      // destroy a possibly txid-bearing record; refuse the read instead —
      // the caller (getStoredActionResults) maps each verdict to its own
      // user-facing refusal, and the record stays until a later successful
      // read, an explicit user-confirmed discard, the final state, or the
      // TTL
      throw new OneKeyError(
        read.status === 'corrupt'
          ? WC_PAY_PROGRESS_CORRUPT_ERROR
          : WC_PAY_PROGRESS_UNREADABLE_ERROR,
      );
    }
    if (isExpired) {
      // expired but readable (only reachable when the deletion above
      // failed): never resume an expired record — report absent; the kept
      // index entry lets a later sweep retry the deletion
      return undefined;
    }
    if (read.status === 'absent' || !read.entries.length) {
      // confirmed-empty payload: the index is an orphan; drop the leftover
      await this.removeProgressByKeys([key]);
      return undefined;
    }
    return { ...meta, entries: read.entries };
  }

  /**
   * Look up the pre-broadcast metadata recorded for a txid. Keyed by txid
   * (unique per transaction) so the recovery check does not need the
   * payment/option/account identity threaded through the executor. The
   * progress map only ever holds a handful of in-flight payments, so the
   * scan is cheap.
   */
  async findBroadcastMetaByTxid({
    txid,
  }: {
    txid: string;
  }): Promise<IWcPayBroadcastMeta | undefined> {
    if (!txid) {
      return undefined;
    }
    const data = await this.getRawData();
    const now = Date.now();
    for (const [key, meta] of Object.entries(data?.progress ?? {})) {
      if (now - meta.updatedAt <= PROGRESS_TTL_MS) {
        // an unreadable record simply cannot match; skip it (best-effort
        // scan) rather than fail the whole lookup
        const read = await this.readSecureEntries(key);
        const entry =
          read.status === 'ok'
            ? read.entries.find((item) => item?.result === txid)
            : undefined;
        if (entry?.broadcastMeta) {
          return entry.broadcastMeta;
        }
      }
    }
    return undefined;
  }

  async saveActionResult({
    paymentId,
    optionId,
    accountKey,
    index,
    fingerprint,
    result,
    broadcastMeta,
  }: {
    paymentId: string;
    optionId: string;
    accountKey: string;
    index: number;
    fingerprint: string;
    result: string;
    broadcastMeta?: IWcPayBroadcastMeta;
  }): Promise<void> {
    // never fall back to plaintext: without secure storage the progress is
    // simply not persisted and a retry starts from the first action.
    // Broadcast-capable flows are refused upfront on such platforms
    // (getRequiredPaymentActions checks supportsDurableProgress), so
    // skipping here only ever affects re-executable sign-only results
    if (!(await this.supportsDurableProgress())) {
      return;
    }
    const now = Date.now();
    // prune expired leftovers (index + ciphertext) so abandoned payments do
    // not accumulate
    const data = await this.getRawData();
    const expiredKeys = Object.entries(data?.progress ?? {})
      .filter(([, meta]) => now - meta.updatedAt > PROGRESS_TTL_MS)
      .map(([key]) => key);
    await this.removeProgressByKeys(expiredKeys);

    const key = buildProgressKey({ paymentId, optionId, accountKey });
    const existingRead = await this.readSecureEntries(key);
    if (
      existingRead.status === 'unreadable' ||
      existingRead.status === 'corrupt'
    ) {
      // never rebuild over ciphertext that exists but cannot be used: at
      // index 0 the write below would overwrite (destroy) it, and at later
      // indexes the contiguity check would refuse anyway. Failing closed
      // costs one retry; overwriting destroys duplicate-payment evidence
      throw new OneKeyError(
        existingRead.status === 'corrupt'
          ? WC_PAY_PROGRESS_CORRUPT_ERROR
          : WC_PAY_PROGRESS_UNREADABLE_ERROR,
      );
    }
    const entries = [
      ...(existingRead.status === 'ok' ? existingRead.entries : []),
    ];
    // Contiguity invariant: entries must form a dense prefix. Writing past a
    // missing earlier index would serialize a `null` hole, and a record with
    // a hole cannot be resumed by index alignment. Failing here instead is
    // the established policy (see ServiceSend's pre-broadcast record):
    // failing closed costs one retry, while a hole next to an
    // already-broadcast txid destroys the only duplicate-payment evidence.
    for (let i = 0; i < index; i += 1) {
      if (!entries[i]) {
        throw new OneKeyError(
          'WalletConnect Pay progress record is not contiguous',
        );
      }
    }
    // A re-affirming write of the same result may omit broadcastMeta (the
    // UI-side write after the confirm round-trip does); it must not erase
    // the metadata recorded at the pre-broadcast boundary — the phantom-txid
    // recovery check depends on it. A different result is a re-executed
    // action: its stale metadata must not survive.
    const existingEntry = entries[index];
    const effectiveBroadcastMeta =
      broadcastMeta ??
      (existingEntry?.result === result
        ? existingEntry?.broadcastMeta
        : undefined);
    entries[index] = effectiveBroadcastMeta
      ? { fingerprint, result, broadcastMeta: effectiveBroadcastMeta }
      : { fingerprint, result };
    // payload first: an index entry must never exist without its ciphertext
    await appStorage.secureStorage.setSecureItem(
      buildSecurePayloadKey(key),
      JSON.stringify(entries),
    );
    await this.setRawData((rawData) => {
      const progress = { ...rawData?.progress };
      progress[key] = { paymentId, optionId, accountKey, updatedAt: now };
      return { progress };
    });
  }

  /**
   * Drop stored results from `fromIndex` on (used when a recorded
   * transaction turns out reverted on chain and can never be resumed).
   * Throws, with the record left untouched, when the retained prefix cannot
   * be rewritten; only an explicit `fromIndex: 0` removes the whole record.
   */
  async truncateActionResults({
    paymentId,
    optionId,
    accountKey,
    fromIndex,
  }: {
    paymentId: string;
    optionId: string;
    accountKey: string;
    fromIndex: number;
  }): Promise<void> {
    const key = buildProgressKey({ paymentId, optionId, accountKey });
    const read = await this.readSecureEntries(key);
    if (read.status === 'unreadable' || read.status === 'corrupt') {
      if (fromIndex > 0) {
        // cannot slice entries that cannot be read; refuse rather than
        // delete a record whose tail may hold a broadcast txid
        throw new OneKeyError(
          read.status === 'corrupt'
            ? WC_PAY_PROGRESS_CORRUPT_ERROR
            : WC_PAY_PROGRESS_UNREADABLE_ERROR,
        );
      }
      // fromIndex 0 is an explicit discard of the whole record — an
      // unusable one included; this is the one deletion path open to a
      // record that cannot be read (the UI's user-confirmed damaged-record
      // escape goes through here). Strict: a swallowed ciphertext-removal
      // failure would close that escape permanently (see
      // removeProgressByKeys)
      await this.removeProgressByKeys([key], { strictCiphertext: true });
      return;
    }
    const entries = read.status === 'ok' ? read.entries : [];
    const kept = entries.slice(0, Math.max(0, fromIndex));
    if (!kept.length) {
      // every truncate is an explicit discard request; strict for the same
      // reason as the unusable branch above
      await this.removeProgressByKeys([key], { strictCiphertext: true });
      return;
    }
    // A failed prefix rewrite leaves the LONGER record in place, and that is
    // the safe failure: the retained head may hold txids already on chain,
    // and deleting the whole record here would let the next attempt start
    // from action zero and broadcast a settled leg again. The stale tail
    // only costs a re-probe on resume (the mined-wait / phantom-txid checks
    // judge it again and land back here), so the storage failure propagates
    // to the caller instead of being traded for a deletion.
    await appStorage.secureStorage.setSecureItem(
      buildSecurePayloadKey(key),
      JSON.stringify(kept),
    );
    await this.setRawData((rawData) => {
      const progress = { ...rawData?.progress };
      if (progress[key]) {
        progress[key] = { ...progress[key], updatedAt: Date.now() };
      }
      return { progress };
    });
  }

  async removeProgress(params: {
    paymentId: string;
    optionId: string;
    accountKey: string;
  }): Promise<void> {
    await this.removeProgressByKeys([buildProgressKey(params)]);
  }

  async clearPaymentProgress({
    paymentId,
  }: {
    paymentId: string;
  }): Promise<void> {
    const data = await this.getRawData();
    const keys = Object.entries(data?.progress ?? {})
      .filter(([, meta]) => meta.paymentId === paymentId)
      .map(([key]) => key);
    await this.removeProgressByKeys(keys);
  }
}
