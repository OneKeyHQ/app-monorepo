import type { ITransferRecipient } from '@onekeyhq/shared/types/history';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export interface ITransferRecipientsCacheEntry {
  accountId: string;
  networkId: string;
  // Requested page size; part of the key so a shorter lookup (e.g. the
  // 10-item interaction check) never overwrites Send's longer list.
  limit: number;
  data: ITransferRecipient[];
  lastUsedDeriveType?: string;
  updatedAt: number;
}

export interface ITransferRecipientsCacheDBStruct {
  // key: `${accountId}__${networkId}__${limit}`
  entries: Record<string, ITransferRecipientsCacheEntry>;
}

// Keep the cache bounded; the newest entries win.
export const TRANSFER_RECIPIENTS_CACHE_MAX_ENTRIES = 30;

export function buildTransferRecipientsCacheKey({
  accountId,
  networkId,
  limit,
}: {
  accountId: string;
  networkId: string;
  limit: number;
}) {
  return `${accountId}__${networkId}__${limit}`;
}

/**
 * Last successful `/transfer-recipient` answer per account + network.
 *
 * The Send address page paints this list at once on a cold start and
 * refreshes from the API in the background, so the "Recent" tab does not sit
 * on a skeleton for the whole server round trip (OK-63452).
 */
export class SimpleDbEntityTransferRecipientsCache extends SimpleDbEntityBase<ITransferRecipientsCacheDBStruct> {
  entityName = 'transferRecipientsCache';

  override enableCache = false;

  async getEntry({
    accountId,
    networkId,
    limit,
  }: {
    accountId: string;
    networkId: string;
    limit: number;
  }): Promise<ITransferRecipientsCacheEntry | undefined> {
    const rawData = await this.getRawData();
    return rawData?.entries?.[
      buildTransferRecipientsCacheKey({ accountId, networkId, limit })
    ];
  }

  async setEntry(
    entry: Omit<ITransferRecipientsCacheEntry, 'updatedAt'>,
  ): Promise<void> {
    const key = buildTransferRecipientsCacheKey(entry);
    await this.setRawData((rawData) => {
      const entries: Record<string, ITransferRecipientsCacheEntry> = {
        ...rawData?.entries,
        [key]: { ...entry, updatedAt: Date.now() },
      };
      const keys = Object.keys(entries);
      if (keys.length > TRANSFER_RECIPIENTS_CACHE_MAX_ENTRIES) {
        keys
          .toSorted((a, b) => entries[a].updatedAt - entries[b].updatedAt)
          .slice(0, keys.length - TRANSFER_RECIPIENTS_CACHE_MAX_ENTRIES)
          .forEach((staleKey) => {
            delete entries[staleKey];
          });
      }
      return { entries };
    });
  }

  async clear(): Promise<void> {
    await this.setRawData({ entries: {} });
  }
}
