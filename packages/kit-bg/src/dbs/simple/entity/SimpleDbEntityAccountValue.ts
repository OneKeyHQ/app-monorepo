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
  // Migration version. Bumped when the migration logic itself is corrected so we
  // can re-run against the preserved `_legacy_*` snapshot for users that already
  // completed a buggy earlier version.
  _migrationVersion?: number;
}

const CURRENT_MIGRATION_VERSION = 2;

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
  // via `_migrationVersion`.
  //
  // Versioning:
  //   v1 (buggy): mis-read the inner `value` map of legacy `all` as
  //     Record<networkId, worth>, but it is actually Record<${networkAccountId}_${networkId}, worth>
  //     produced by `buildAccountValueKey`. This dropped all HD/HW worth and
  //     wrote compound-keyed entries for Others.
  //   v2 (current): parses each inner key with `parseAccountValueKey` and
  //     resolves the address via the embedded networkAccountId, working
  //     uniformly for Others and HD/HW.
  //
  // When `_legacy_all` / `_legacy_data` are present (set by v1), we re-run
  // against them so users who already migrated can recover.
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
      console.log(
        '[accountValue migration] skip: no rawData (fresh install or storage empty)',
      );
      return;
    }
    if ((raw._migrationVersion ?? 0) >= CURRENT_MIGRATION_VERSION) {
      console.log('[accountValue migration] skip: already at current version', {
        migrationVersion: raw._migrationVersion,
        migratedAt: raw._migratedAt,
        migratedAtISO: raw._migratedAt
          ? new Date(raw._migratedAt).toISOString()
          : undefined,
        byAddress: Object.keys(raw.byAddress ?? {}).length,
        allByAddress: Object.keys(raw.allByAddress ?? {}).length,
      });
      return;
    }

    // Source the legacy snapshot. For v0 (never migrated) it lives under
    // `data` / `all`. For v1 (buggy migration already ran) the originals were
    // preserved into `_legacy_data` / `_legacy_all`.
    const previousVersion = raw._migrationVersion ?? (raw._migratedAt ? 1 : 0);
    const legacyData = raw.data ?? raw._legacy_data ?? {};
    const legacyAll = raw.all ?? raw._legacy_all ?? {};
    if (
      Object.keys(legacyData).length === 0 &&
      Object.keys(legacyAll).length === 0
    ) {
      await this.setRawData((current) => ({
        ...(current ?? emptyData()),
        byAddress: current?.byAddress ?? {},
        allByAddress: current?.allByAddress ?? {},
        _migratedAt: Date.now(),
        _migrationVersion: CURRENT_MIGRATION_VERSION,
      }));
      console.log(
        '[accountValue migration] skip: no legacy data, stamped current version',
        { previousVersion },
      );
      return;
    }

    const byAddress: Record<string, IAccountValueEntry> = {};
    const allByAddress: Record<string, IAllNetworkAccountValueEntry> = {};
    const failures: string[] = [];

    // Cache DB-account lookups; the same networkAccountId can appear under
    // many networkIds in legacy `all`.
    const accountResolveCache = new Map<
      string,
      { accountAddress?: string; xpub?: string } | null
    >();
    const resolveByAccountId = async (accountId: string) => {
      const cached = accountResolveCache.get(accountId);
      if (cached !== undefined) return cached;
      try {
        const account = await serviceAccount.getDBAccount({ accountId });
        if (!account) {
          accountResolveCache.set(accountId, null);
          return null;
        }
        const xpub = (account as { xpub?: string }).xpub;
        if (!account.address && !xpub) {
          accountResolveCache.set(accountId, null);
          return null;
        }
        const resolved = { accountAddress: account.address, xpub };
        accountResolveCache.set(accountId, resolved);
        return resolved;
      } catch {
        accountResolveCache.set(accountId, null);
        return null;
      }
    };

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

    // Legacy `all` inner map keys are `${networkAccountId}_${networkId}` from
    // `buildAccountValueKey` (see pre-migration HomeOverviewContainer and
    // TokenSelector write paths). Resolve each inner accountId to its
    // address/xpub and emit one address-keyed entry per (address, networkId).
    for (const [oldKey, entry] of Object.entries(legacyAll)) {
      if (entry?.currency === 'usd') {
        for (const [compoundKey, worth] of Object.entries(entry.value)) {
          const parsed = accountUtils.parseAccountValueKey({
            key: compoundKey,
          });
          if (!parsed.accountId || !parsed.networkId) {
            failures.push(`${oldKey}#${compoundKey}`);
          } else {
            const resolved = await resolveByAccountId(parsed.accountId);
            if (!resolved) {
              failures.push(`${oldKey}#${compoundKey}`);
            } else {
              const addressKey = accountUtils.buildAccountLocalAssetsKey({
                accountAddress: resolved.accountAddress,
                xpub: resolved.xpub,
              });
              const existing = allByAddress[addressKey];
              allByAddress[addressKey] = {
                value: {
                  ...(existing?.value ?? {}),
                  [parsed.networkId]: worth,
                },
                currency: 'usd',
              };
            }
          }
        }
      }
    }

    await this.setRawData((current) => ({
      ...(current ?? emptyData()),
      byAddress,
      allByAddress,
      // Preserve legacy snapshot once, even on re-run, so a future v3 can
      // re-derive without losing data.
      _legacy_data: current?._legacy_data ?? legacyData,
      _legacy_all: current?._legacy_all ?? legacyAll,
      _migratedAt: Date.now(),
      _migrationVersion: CURRENT_MIGRATION_VERSION,
    }));

    console.log('[accountValue migration]', {
      previousVersion,
      migrationVersion: CURRENT_MIGRATION_VERSION,
      legacyData: Object.keys(legacyData).length,
      legacyAll: Object.keys(legacyAll).length,
      byAddress: Object.keys(byAddress).length,
      allByAddress: Object.keys(allByAddress).length,
      failures: failures.length,
    });
  }
}
