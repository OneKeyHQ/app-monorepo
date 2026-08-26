import { sha256 } from '@noble/hashes/sha256';

import { OneKeyError } from '@onekeyhq/shared/src/errors';
import appStorage from '@onekeyhq/shared/src/storage/appStorage';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

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
 * dev desktop) progress is simply not persisted — signatures are never
 * written to plaintext storage as a fallback; flows containing a
 * broadcast-capable action are refused upfront there instead (see
 * ServiceWalletConnectPay.getRequiredPaymentActions).
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

  private async readSecureEntries(
    progressKey: string,
  ): Promise<IWcPayStoredActionEntry[] | undefined> {
    try {
      const payload = await appStorage.secureStorage.getSecureItem(
        buildSecurePayloadKey(progressKey),
      );
      if (!payload) {
        return undefined;
      }
      const entries = JSON.parse(payload) as IWcPayStoredActionEntry[];
      return Array.isArray(entries) ? entries : undefined;
    } catch {
      // a payload that fails to decrypt is unrecoverable; callers treat it
      // as absent
      return undefined;
    }
  }

  private async removeProgressByKeys(progressKeys: string[]): Promise<void> {
    if (!progressKeys.length) {
      return;
    }
    // ciphertext first so a failure never leaves payload without its index
    await Promise.all(
      progressKeys.map(async (key) => {
        try {
          await appStorage.secureStorage.removeSecureItem(
            buildSecurePayloadKey(key),
          );
        } catch {
          // removal is best-effort; the index delete below still hides it
        }
      }),
    );
    await this.setRawData((rawData) => {
      const progress = { ...rawData?.progress };
      for (const key of progressKeys) {
        delete progress[key];
      }
      return { progress };
    });
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
    if (Date.now() - meta.updatedAt > PROGRESS_TTL_MS) {
      await this.removeProgressByKeys([key]);
      return undefined;
    }
    const entries = await this.readSecureEntries(key);
    if (!entries?.length) {
      // index without readable payload cannot be resumed; drop the leftover
      await this.removeProgressByKeys([key]);
      return undefined;
    }
    return { ...meta, entries };
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
        const entries = await this.readSecureEntries(key);
        const entry = entries?.find((item) => item?.result === txid);
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
    const entries = [...((await this.readSecureEntries(key)) ?? [])];
    // Contiguity invariant: entries must form a dense prefix. Writing past a
    // missing earlier index would serialize a `null` hole, and a record with
    // a hole cannot be resumed by index alignment. Failing here instead is
    // the established policy (see ServiceSend's pre-broadcast record):
    // failing closed costs one retry, while a hole next to an
    // already-broadcast txid destroys the only duplicate-payment evidence.
    // This also covers the readSecureEntries failure mode where the array
    // above was rebuilt empty: refusing the write keeps the intact
    // ciphertext (and any recorded txid in it) on disk.
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
    const entries = (await this.readSecureEntries(key)) ?? [];
    const kept = entries.slice(0, Math.max(0, fromIndex));
    if (!kept.length) {
      await this.removeProgressByKeys([key]);
      return;
    }
    try {
      await appStorage.secureStorage.setSecureItem(
        buildSecurePayloadKey(key),
        JSON.stringify(kept),
      );
    } catch {
      // stale longer progress must not survive a discard request
      await this.removeProgressByKeys([key]);
      return;
    }
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
