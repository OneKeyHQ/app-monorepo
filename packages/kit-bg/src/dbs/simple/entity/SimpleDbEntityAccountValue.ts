import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

import type ServiceAccount from '../../../services/ServiceAccount/ServiceAccount';

// Stored value entry for a single (networkId, addressOrXpub) pair.
export interface IAccountValueEntry {
  value: string;
  currency: 'usd';
}

// Stored value entry for All Networks aggregate, keyed only by addressOrXpub.
// Inner value is keyed by networkId so a single address shared across multiple
// EVM-compatible networks can hold per-network worth in one entry.
export interface IAllNetworkAccountValueEntry {
  value: Record<string, string>; // <networkId, value>
  currency: 'usd';
}

export interface IAccountValueDb {
  // Single-network worth, key = buildAccountLocalAssetsKey({networkId, accountAddress, xpub}).
  byAddress: Record<string, IAccountValueEntry>;

  // All Networks aggregate worth, key = buildAccountLocalAssetsKey({accountAddress, xpub}) (no networkId).
  // Inner value records per-network worth so callers can iterate or sum.
  allByAddress: Record<string, IAllNetworkAccountValueEntry>;

  // Legacy fields preserved during the one-shot address-key migration so a rollback
  // PR can keep reading old data. Cleaned up in a later release.
  _legacy_data?: Record<string, { value: string; currency: string }>;
  _legacy_all?: Record<
    string,
    { value: Record<string, string>; currency: string }
  >;
  _migratedAt?: number;
}

export interface IAccountValueSingleItem {
  networkId: string;
  accountAddress?: string;
  xpub?: string;
}

export interface IAccountValueAllItem {
  accountAddress?: string;
  xpub?: string;
}

export interface IAccountValueAllWriteItem {
  accountAddress?: string;
  xpub?: string;
  networkId: string;
  value: string;
}

function emptyData(): IAccountValueDb {
  return { byAddress: {}, allByAddress: {} };
}

export class SimpleDbEntityAccountValue extends SimpleDbEntityBase<IAccountValueDb> {
  entityName = 'accountValue';

  override enableCache = false;

  private buildSingleKey({
    networkId,
    accountAddress,
    xpub,
  }: IAccountValueSingleItem): string | null {
    if (!accountAddress && !xpub) {
      return null;
    }
    return accountUtils.buildAccountLocalAssetsKey({
      networkId,
      accountAddress,
      xpub,
    });
  }

  private buildAllKey({
    accountAddress,
    xpub,
  }: IAccountValueAllItem): string | null {
    if (!accountAddress && !xpub) {
      return null;
    }
    return accountUtils.buildAccountLocalAssetsKey({
      accountAddress,
      xpub,
    });
  }

  async getAccountsValue({ items }: { items: IAccountValueSingleItem[] }) {
    const raw = await this.getRawData();
    return items.map((it) => {
      const key = this.buildSingleKey(it);
      const entry = key ? raw?.byAddress?.[key] : undefined;
      return {
        value: entry?.value,
        currency: entry?.currency,
      };
    });
  }

  async updateAccountValue({
    networkId,
    accountAddress,
    xpub,
    value,
    currency,
  }: {
    networkId: string;
    accountAddress?: string;
    xpub?: string;
    value: string;
    currency: 'usd';
  }) {
    const key = this.buildSingleKey({ networkId, accountAddress, xpub });
    if (!key) {
      return;
    }
    await this.setRawData((rawData) => {
      const base = rawData ?? emptyData();
      return {
        ...base,
        byAddress: {
          ...base.byAddress,
          [key]: { value, currency },
        },
        allByAddress: base.allByAddress ?? {},
      };
    });
  }

  async getAllNetworkAccountsValue({
    items,
  }: {
    items: IAccountValueAllItem[];
  }) {
    const raw = await this.getRawData();
    return items.map((it) => {
      const key = this.buildAllKey(it);
      const entry = key ? raw?.allByAddress?.[key] : undefined;
      return {
        value: entry?.value,
        currency: entry?.currency,
      };
    });
  }

  async updateAllNetworkAccountValue({
    items,
    currency,
    updateAll,
  }: {
    items: IAccountValueAllWriteItem[];
    currency: 'usd';
    updateAll?: boolean;
  }) {
    // Group write items by addressKey so a single setRawData call handles
    // multi-network entries that share the same address.
    const grouped: Record<string, Record<string, string>> = {};
    for (const it of items) {
      const key = this.buildAllKey(it);
      if (key) {
        grouped[key] = { ...grouped[key], [it.networkId]: it.value };
      }
    }
    if (Object.keys(grouped).length === 0) {
      return;
    }

    await this.setRawData((rawData) => {
      const base = rawData ?? emptyData();
      const existing = base.allByAddress ?? {};
      const next: Record<string, IAllNetworkAccountValueEntry> = {
        ...existing,
      };
      for (const [key, valueMap] of Object.entries(grouped)) {
        if (updateAll) {
          next[key] = { value: valueMap, currency };
        } else {
          next[key] = {
            value: { ...existing[key]?.value, ...valueMap },
            currency,
          };
        }
      }
      return {
        ...base,
        byAddress: base.byAddress ?? {},
        allByAddress: next,
      };
    });
  }

  // One-shot migration from the legacy `data` / `all` shape (keyed by accountId)
  // to the new address-keyed shape. Safe to invoke on every startup — idempotent
  // via `_migratedAt`. Legacy fields are kept for one or two releases so a
  // rollback PR can read them directly.
  async migrateFromAccountIdToAddressKey({
    serviceAccount,
  }: {
    serviceAccount: ServiceAccount;
  }) {
    const raw = (await this.getRawData()) as
      | (IAccountValueDb & {
          data?: Record<string, { value: string; currency: string }>;
          all?: Record<
            string,
            { value: Record<string, string>; currency: string }
          >;
        })
      | null
      | undefined;

    if (!raw) {
      return;
    }
    if (raw._migratedAt) {
      return;
    }
    const legacyData = raw.data ?? {};
    const legacyAll = raw.all ?? {};
    if (
      Object.keys(legacyData).length === 0 &&
      Object.keys(legacyAll).length === 0
    ) {
      // Nothing to migrate, but still stamp _migratedAt so we don't keep
      // hitting this branch every cold start.
      await this.setRawData((current) => ({
        ...(current ?? emptyData()),
        byAddress: current?.byAddress ?? {},
        allByAddress: current?.allByAddress ?? {},
        _migratedAt: Date.now(),
      }));
      return;
    }

    const byAddress: Record<string, IAccountValueEntry> = {};
    const allByAddress: Record<string, IAllNetworkAccountValueEntry> = {};
    const failures: string[] = [];

    // Legacy `data` was only ever populated by Others accounts at their
    // createAtNetwork. Skip anything that doesn't fit that shape.
    for (const [oldKey, entry] of Object.entries(legacyData)) {
      if (
        entry?.currency === 'usd' &&
        accountUtils.isOthersAccount({ accountId: oldKey })
      ) {
        try {
          const account = await serviceAccount.getDBAccount({
            accountId: oldKey,
          });
          if (account && account.createAtNetwork) {
            const addressKey = accountUtils.buildAccountLocalAssetsKey({
              networkId: account.createAtNetwork,
              accountAddress: account.address,
              xpub: (account as { xpub?: string }).xpub,
            });
            byAddress[addressKey] = { value: entry.value, currency: 'usd' };
          } else {
            failures.push(oldKey);
          }
        } catch {
          failures.push(oldKey);
        }
      }
    }

    for (const [oldKey, entry] of Object.entries(legacyAll)) {
      if (entry?.currency !== 'usd') {
        // skip: unknown currency leaves no safe migration path
      } else if (accountUtils.isOthersAccount({ accountId: oldKey })) {
        try {
          const account = await serviceAccount.getDBAccount({
            accountId: oldKey,
          });
          const xpub = account
            ? (account as { xpub?: string }).xpub
            : undefined;
          if (account && (account.address || xpub)) {
            const addressKey = accountUtils.buildAccountLocalAssetsKey({
              accountAddress: account.address,
              xpub,
            });
            allByAddress[addressKey] = {
              value: {
                ...allByAddress[addressKey]?.value,
                ...entry.value,
              },
              currency: 'usd',
            };
          } else {
            failures.push(oldKey);
          }
        } catch {
          failures.push(oldKey);
        }
      } else {
        for (const [networkId, v] of Object.entries(entry.value)) {
          try {
            const result =
              await serviceAccount.getNetworkAccountsInSameIndexedAccountId({
                indexedAccountId: oldKey,
                networkIds: [networkId],
              });
            const networkAccount = result?.[0]?.account;
            if (networkAccount) {
              const addressKey = accountUtils.buildAccountLocalAssetsKey({
                accountAddress: networkAccount.address,
                xpub: (networkAccount as { xpub?: string }).xpub,
              });
              allByAddress[addressKey] = {
                value: {
                  ...allByAddress[addressKey]?.value,
                  [networkId]: v,
                },
                currency: 'usd',
              };
            } else {
              failures.push(`${oldKey}/${networkId}`);
            }
          } catch {
            failures.push(`${oldKey}/${networkId}`);
          }
        }
      }
    }

    await this.setRawData(() => ({
      byAddress,
      allByAddress,
      _legacy_data: legacyData,
      _legacy_all: legacyAll,
      _migratedAt: Date.now(),
    }));

    console.log('[accountValue migration]', {
      legacyData: Object.keys(legacyData).length,
      legacyAll: Object.keys(legacyAll).length,
      byAddress: Object.keys(byAddress).length,
      allByAddress: Object.keys(allByAddress).length,
      failures: failures.length,
    });
  }
}
