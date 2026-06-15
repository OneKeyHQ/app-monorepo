import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
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

const CURRENT_MIGRATION_VERSION = 1;

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
    const existing = (await this.getRawData())?.byAddress?.[key];
    if (existing?.value === value && existing?.currency === currency) {
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
    // When `updateAll === true` the caller has completed a full token
    // snapshot for the covered address keys, so the per-network map for
    // each touched address is replaced — networkIds that no longer appear
    // (network removed/disabled, refresh produced no value) are dropped to
    // avoid stale entries leaking into ChainSelector / AccountSelector /
    // UniversalSearch. Address keys NOT covered by this refresh are left
    // untouched so a sibling wallet's data for an unrelated address is
    // preserved. When `updateAll === false` writes are partial and merge
    // by networkId.
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

    const existingMap = (await this.getRawData())?.allByAddress ?? {};
    const isNoop = Object.entries(grouped).every(([key, valueMap]) => {
      const prev = existingMap[key];
      if (!prev || prev.currency !== currency) return false;
      if (updateAll) {
        // Replace mode: the existing map must match the incoming snapshot
        // exactly, otherwise we still need to write to drop stale networkIds.
        const prevKeys = Object.keys(prev.value);
        const nextKeys = Object.keys(valueMap);
        if (prevKeys.length !== nextKeys.length) return false;
        return nextKeys.every((nId) => prev.value[nId] === valueMap[nId]);
      }
      return Object.entries(valueMap).every(
        ([nId, v]) => prev.value[nId] === v,
      );
    });
    if (isNoop) {
      return;
    }

    await this.setRawData((rawData) => {
      const base = rawData ?? emptyData();
      const existing = base.allByAddress;
      const next: Record<string, IAllNetworkAccountValueEntry> = {
        ...existing,
      };
      for (const [key, valueMap] of Object.entries(grouped)) {
        next[key] = {
          value: updateAll
            ? valueMap
            : { ...existing[key]?.value, ...valueMap },
          currency,
        };
      }
      return {
        ...base,
        allByAddress: next,
      };
    });
  }

  // One-shot migration from the legacy accountId-keyed `data` / `all` shape
  // to the address-keyed shape. Idempotent via `_migrationVersion`; bump
  // `CURRENT_MIGRATION_VERSION` to re-run against the preserved `_legacy_*`
  // snapshot when the migration logic itself changes.
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
    if ((raw._migrationVersion ?? 0) >= CURRENT_MIGRATION_VERSION) {
      return;
    }

    // For v0 (never migrated) the snapshot lives under `data` / `all`; for
    // earlier buggy migration versions the originals were preserved into
    // `_legacy_*` so we can re-run.
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
      return;
    }

    const byAddress: Record<string, IAccountValueEntry> = {};
    const allByAddress: Record<string, IAllNetworkAccountValueEntry> = {};

    // Track transient resolve failures so we can hold back the migration
    // version bump and retry on a later launch instead of permanently
    // dropping a legacy entry.
    let hadResolveError = false;

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
        const xpub = accountUtils.pickXpubFromDBAccount(account);
        if (!account.address && !xpub) {
          accountResolveCache.set(accountId, null);
          return null;
        }
        const resolved = { accountAddress: account.address, xpub };
        accountResolveCache.set(accountId, resolved);
        return resolved;
      } catch {
        hadResolveError = true;
        defaultLogger.app.bootstrap.initDeferredStepFailed(
          `accountValue.migrate.resolveAccount[${accountId}]`,
          0,
        );
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
          if (account?.createAtNetwork) {
            const addressKey = accountUtils.buildAccountLocalAssetsKey({
              networkId: account.createAtNetwork,
              accountAddress: account.address,
              xpub: accountUtils.pickXpubFromDBAccount(account),
            });
            byAddress[addressKey] = { value: entry.value, currency: 'usd' };
          }
        } catch {
          hadResolveError = true;
          defaultLogger.app.bootstrap.initDeferredStepFailed(
            `accountValue.migrate.legacyData[${oldKey}]`,
            0,
          );
          // Skip records that fail to resolve; legacy snapshot stays preserved
          // in `_legacy_data` so a later version can retry.
        }
      }
    }

    // Legacy `all` inner map keys are `${networkAccountId}_${networkId}` from
    // `buildAccountValueKey`. Resolve each inner accountId to its address/xpub
    // and emit one address-keyed entry per (address, networkId).
    for (const [, entry] of Object.entries(legacyAll)) {
      if (entry?.currency === 'usd') {
        for (const [compoundKey, worth] of Object.entries(entry.value)) {
          const parsed = accountUtils.parseAccountValueKey({
            key: compoundKey,
          });
          if (parsed.accountId && parsed.networkId) {
            const resolved = await resolveByAccountId(parsed.accountId);
            if (resolved) {
              const addressKey = accountUtils.buildAccountLocalAssetsKey({
                accountAddress: resolved.accountAddress,
                xpub: resolved.xpub,
              });
              const existing = allByAddress[addressKey];
              allByAddress[addressKey] = {
                value: {
                  ...existing?.value,
                  [parsed.networkId]: worth,
                },
                currency: 'usd',
              };
            }
          }
        }
      }
    }

    await this.setRawData((current) => {
      // Merge so that any writes that landed during the migration window —
      // and any post-migration writes preserved across a version-bump
      // re-run — survive. `current` wins over the legacy-derived snapshot;
      // legacy values only fill keys that don't already exist.
      const mergedByAddress: Record<string, IAccountValueEntry> = {
        ...byAddress,
        ...current?.byAddress,
      };
      const mergedAllByAddress: Record<string, IAllNetworkAccountValueEntry> = {
        ...current?.allByAddress,
      };
      for (const [key, legacyEntry] of Object.entries(allByAddress)) {
        const cur = mergedAllByAddress[key];
        mergedAllByAddress[key] = cur
          ? {
              value: { ...legacyEntry.value, ...cur.value },
              currency: cur.currency,
            }
          : legacyEntry;
      }

      return {
        ...(current ?? emptyData()),
        byAddress: mergedByAddress,
        allByAddress: mergedAllByAddress,
        // Preserve legacy snapshot once, even on re-run, so a future
        // migration version can re-derive without losing data.
        _legacy_data: current?._legacy_data ?? legacyData,
        _legacy_all: current?._legacy_all ?? legacyAll,
        _migratedAt: Date.now(),
        // Hold the version back when any legacy entry failed to resolve so
        // a later launch retries; otherwise a single transient DB error
        // would permanently strip that account's cached worth.
        _migrationVersion: hadResolveError
          ? (current?._migrationVersion ?? 0)
          : CURRENT_MIGRATION_VERSION,
      };
    });

    // Nudge consumers that already read the empty buckets during the
    // pre-migration window to re-fetch and pick up the freshly-merged data.
    appEventBus.emit(EAppEventBusNames.AccountValueUpdate, undefined);
  }

  // Drop cached worth belonging to deleted accounts. `byAddress` keys are
  // networkId-prefixed; `allByAddress` keys are bare addresses/xpubs. `validOwners`
  // is the set of lowercased addresses/xpubs of all surviving accounts. The
  // `_legacy_*` / migration fields are preserved. Pure-cache cleanup.
  // See ServiceAppCleanup.cleanupOrphanedAssetCaches.
  @backgroundMethod()
  async removeOrphanData({ validOwners }: { validOwners: string[] }) {
    const existing = await this.getRawData();
    if (!existing) {
      return;
    }
    const validOwnerSet = new Set(validOwners.map((o) => o.toLowerCase()));
    await this.setRawData((rawData) => {
      // Trust the in-mutex fresh value, not the pre-mutex `existing` snapshot:
      // a concurrent clearRawData (e.g. "Clear cache") nulls the store, and
      // falling back to `existing` would resurrect the just-cleared cache.
      const base = rawData;
      const nextByAddress: Record<string, IAccountValueEntry> = {};
      for (const [key, value] of Object.entries(base?.byAddress ?? {})) {
        if (
          accountUtils.isLocalAssetsKeyOwnedBy({
            key,
            validOwners: validOwnerSet,
          })
        ) {
          nextByAddress[key] = value;
        }
      }
      const nextAllByAddress: Record<string, IAllNetworkAccountValueEntry> = {};
      for (const [key, value] of Object.entries(base?.allByAddress ?? {})) {
        if (
          accountUtils.isLocalAssetsKeyOwnedBy({
            key,
            validOwners: validOwnerSet,
          })
        ) {
          nextAllByAddress[key] = value;
        }
      }
      return {
        ...(base ?? emptyData()),
        byAddress: nextByAddress,
        allByAddress: nextAllByAddress,
      };
    });
  }
}
