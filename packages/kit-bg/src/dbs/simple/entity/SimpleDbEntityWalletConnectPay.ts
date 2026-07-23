import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export interface IWcPayStoredActionEntry {
  // stableStringify of the action's walletRpc (chainId+method+params);
  // proves a stored result still belongs to the same-index action when the
  // server returns a recomputed action list on a later attempt
  fingerprint: string;
  result: string;
}

export interface IWcPayStoredProgress {
  paymentId: string;
  optionId: string;
  // indexedAccountId ?? accountId of the signing account; results produced
  // with one account must never be replayed into an attempt made with another
  accountKey: string;
  entries: IWcPayStoredActionEntry[];
  updatedAt: number;
}

export interface ISimpleDbWalletConnectPay {
  progress: Record<string, IWcPayStoredProgress>;
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

/**
 * Durable record of WalletConnect Pay signing progress. Persisted in the
 * background (not UI memory) because on native the UI runtime can be
 * reclaimed while a broadcast transaction is still confirming; a resumed
 * attempt must know the transaction was already sent, or the payment could
 * be broadcast twice.
 */
export class SimpleDbEntityWalletConnectPay extends SimpleDbEntityBase<ISimpleDbWalletConnectPay> {
  entityName = 'walletConnectPay';

  override enableCache = false;

  async getProgress(params: {
    paymentId: string;
    optionId: string;
    accountKey: string;
  }): Promise<IWcPayStoredProgress | undefined> {
    const data = await this.getRawData();
    const record = data?.progress?.[buildProgressKey(params)];
    if (!record) {
      return undefined;
    }
    if (Date.now() - record.updatedAt > PROGRESS_TTL_MS) {
      return undefined;
    }
    return record;
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
    await this.setRawData((rawData) => {
      const now = Date.now();
      const progress = { ...rawData?.progress };
      // prune expired leftovers so abandoned payments do not accumulate
      for (const [key, record] of Object.entries(progress)) {
        if (now - record.updatedAt > PROGRESS_TTL_MS) {
          delete progress[key];
        }
      }
      const key = buildProgressKey({ paymentId, optionId, accountKey });
      const entries = [...(progress[key]?.entries ?? [])];
      entries[index] = { fingerprint, result };
      progress[key] = {
        paymentId,
        optionId,
        accountKey,
        entries,
        updatedAt: now,
      };
      return { progress };
    });
  }

  async removeProgress(params: {
    paymentId: string;
    optionId: string;
    accountKey: string;
  }): Promise<void> {
    await this.setRawData((rawData) => {
      const progress = { ...rawData?.progress };
      delete progress[buildProgressKey(params)];
      return { progress };
    });
  }

  async clearPaymentProgress({
    paymentId,
  }: {
    paymentId: string;
  }): Promise<void> {
    await this.setRawData((rawData) => {
      const progress = { ...rawData?.progress };
      for (const [key, record] of Object.entries(progress)) {
        if (record.paymentId === paymentId) {
          delete progress[key];
        }
      }
      return { progress };
    });
  }
}
