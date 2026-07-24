import { sha256 } from '@noble/hashes/sha256';

import appStorage from '@onekeyhq/shared/src/storage/appStorage';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export interface IWcPayStoredActionEntry {
  // stableStringify of the action's walletRpc (chainId+method+params);
  // proves a stored result still belongs to the same-index action when the
  // server returns a recomputed action list on a later attempt
  fingerprint: string;
  result: string;
}

// Plaintext SimpleDb keeps only this expiry/lookup index. The sensitive
// payload — action results (consumable signatures / fully signed
// transactions) and fingerprints (raw walletRpc) — is encrypted at rest in
// appStorage.secureStorage under a key derived from the same progress key.
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
 * written to plaintext storage as a fallback.
 */
export class SimpleDbEntityWalletConnectPay extends SimpleDbEntityBase<ISimpleDbWalletConnectPay> {
  entityName = 'walletConnectPay';

  override enableCache = false;

  private async supportsSecurePayload(): Promise<boolean> {
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

  async saveActionResult({
    paymentId,
    optionId,
    accountKey,
    index,
    fingerprint,
    result,
  }: {
    paymentId: string;
    optionId: string;
    accountKey: string;
    index: number;
    fingerprint: string;
    result: string;
  }): Promise<void> {
    // never fall back to plaintext: without secure storage the progress is
    // simply not persisted and a retry starts from the first action
    if (!(await this.supportsSecurePayload())) {
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
    entries[index] = { fingerprint, result };
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
