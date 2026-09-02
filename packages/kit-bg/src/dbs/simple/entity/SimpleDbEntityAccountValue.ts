import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import {
  canApplyAssetSnapshotMeta as canApplySnapshotMeta,
  getNewestAssetSnapshotMeta,
  isAssetSnapshotNewer,
  isAssetSnapshotSameOrNewer,
  normalizeAssetSnapshotMeta as normalizeSnapshotMeta,
  sameAssetSnapshotMeta as sameSnapshotMeta,
} from '@onekeyhq/shared/src/utils/assetSnapshotFreshness';
import type { IAssetSnapshotMeta } from '@onekeyhq/shared/types/assetSnapshot';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

import type ServiceAccount from '../../../services/ServiceAccount/ServiceAccount';

// Stored value entry for a single (networkId, addressOrXpub) pair.
export interface IAccountValueEntry {
  value: string;
  currency: 'usd';
  /** Freshness of the response that produced this single-network value. */
  assetSnapshotMeta?: IAssetSnapshotMeta;
}

// Stored value entry for All Networks aggregate, keyed only by addressOrXpub.
// Inner value is keyed by networkId so a single address shared across multiple
// EVM-compatible networks can hold per-network worth in one entry.
export interface IAllNetworkAccountValueEntry {
  value: Record<string, string>; // <networkId, value>
  currency: 'usd';
  /** Freshness of the complete all-network snapshot, when known. */
  assetSnapshotMeta?: IAssetSnapshotMeta;
  /** Freshness for each network in the value map (partial writes need this). */
  assetSnapshotMetaByNetwork?: Record<string, IAssetSnapshotMeta>;
}

export interface IAccountValueDb {
  // Single-network worth, key = buildAccountLocalAssetsKey({networkId, accountAddress, xpub}).
  byAddress: Record<string, IAccountValueEntry>;

  // All Networks aggregate worth, key = buildAccountLocalAssetsKey({accountAddress, xpub}) (no networkId).
  // Inner value records per-network worth so callers can iterate or sum.
  allByAddress: Record<string, IAllNetworkAccountValueEntry>;

  // Legacy fields preserved during the one-shot address-key migration so a rollback
  // PR can keep reading old data. Cleaned up in a later release.
  _legacy_data?: Record<
    string,
    {
      value: string;
      currency: string;
      assetSnapshotMeta?: IAssetSnapshotMeta;
    }
  >;
  _legacy_all?: Record<
    string,
    {
      value: Record<string, string>;
      currency: string;
      assetSnapshotMeta?: IAssetSnapshotMeta;
      assetSnapshotMetaByNetwork?: Record<string, IAssetSnapshotMeta>;
    }
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
  assetSnapshotMeta?: IAssetSnapshotMeta;
}

// Freshness admission helpers live in
// `@onekeyhq/shared/src/utils/assetSnapshotFreshness` so every persistence
// layer applies the identical comparison. This adapter only bridges the
// array-shaped call sites in this entity.
function maxSnapshotMeta(
  values: Array<IAssetSnapshotMeta | undefined>,
): IAssetSnapshotMeta | undefined {
  return getNewestAssetSnapshotMeta(...values);
}

function isSameStringMap(
  left: Record<string, string>,
  right: Record<string, string>,
): boolean {
  const leftKeys = Object.keys(left);
  return (
    leftKeys.length === Object.keys(right).length &&
    leftKeys.every((key) => right[key] === left[key])
  );
}

function isSameMetaMap(
  left: Record<string, IAssetSnapshotMeta> | undefined,
  right: Record<string, IAssetSnapshotMeta> | undefined,
): boolean {
  const leftKeys = Object.keys(left ?? {});
  return (
    leftKeys.length === Object.keys(right ?? {}).length &&
    leftKeys.every(
      (key) =>
        Boolean(right?.[key]) && sameSnapshotMeta(left?.[key], right?.[key]),
    )
  );
}

// Value-level equality of a persisted all-network entry, used to skip
// re-serializing the entity when a refresh repeats what is already stored.
function isSameAllNetworkEntry(
  left: IAllNetworkAccountValueEntry,
  right: IAllNetworkAccountValueEntry,
): boolean {
  return (
    left.currency === right.currency &&
    isSameStringMap(left.value, right.value) &&
    sameSnapshotMeta(left.assetSnapshotMeta, right.assetSnapshotMeta) &&
    isSameMetaMap(
      left.assetSnapshotMetaByNetwork,
      right.assetSnapshotMetaByNetwork,
    )
  );
}

function emptyData(): IAccountValueDb {
  return { byAddress: {}, allByAddress: {} };
}

// A record persisted before the address-key migration (which runs deferred at
// bootstrap) still has the legacy `data` / `all` shape and lacks the
// address-keyed buckets. Writers must index normalized buckets rather than
// `undefined`, otherwise every refresh throws until the migration lands.
function withAddressBuckets(
  raw: IAccountValueDb | null | undefined,
): IAccountValueDb {
  return {
    ...raw,
    byAddress: raw?.byAddress ?? {},
    allByAddress: raw?.allByAddress ?? {},
  };
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
        ...(entry?.assetSnapshotMeta
          ? { assetSnapshotMeta: entry.assetSnapshotMeta }
          : {}),
      };
    });
  }

  async updateAccountValue({
    networkId,
    accountAddress,
    xpub,
    value,
    currency,
    assetSnapshotMeta,
  }: {
    networkId: string;
    accountAddress?: string;
    xpub?: string;
    value: string;
    currency: 'usd';
    assetSnapshotMeta?: IAssetSnapshotMeta;
  }) {
    const key = this.buildSingleKey({ networkId, accountAddress, xpub });
    if (!key) {
      return;
    }
    const normalizedMeta = normalizeSnapshotMeta(assetSnapshotMeta);
    // Rejected (stale) or identical writes are no-ops. An unchanged value with
    // a NEWER marker is not: the marker must be persisted, otherwise a later
    // stale response would be admitted against the old one.
    const isNoopAgainst = (existing: IAccountValueEntry | undefined) =>
      !canApplySnapshotMeta(assetSnapshotMeta, existing?.assetSnapshotMeta) ||
      (existing?.value === value &&
        existing?.currency === currency &&
        sameSnapshotMeta(assetSnapshotMeta, existing?.assetSnapshotMeta));
    // Pre-check outside the mutex so a repeated refresh does not re-serialize
    // the whole entity (see updateAllNetworkAccountValue).
    if (
      isNoopAgainst(withAddressBuckets(await this.getRawData()).byAddress[key])
    ) {
      return;
    }
    await this.setRawData((rawData) => {
      const base = withAddressBuckets(rawData);
      const existing = base.byAddress[key];
      // The authoritative comparison happens inside the builder: setRawData
      // serializes this entity's writes, whereas the pre-read above can be
      // stale by the time the write acquires the mutex.
      if (isNoopAgainst(existing)) {
        return base;
      }
      return {
        ...base,
        byAddress: {
          ...base.byAddress,
          [key]: {
            value,
            currency,
            ...(normalizedMeta ? { assetSnapshotMeta: normalizedMeta } : {}),
          },
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
        ...(entry?.assetSnapshotMeta
          ? { assetSnapshotMeta: entry.assetSnapshotMeta }
          : {}),
        ...(entry?.assetSnapshotMetaByNetwork
          ? { assetSnapshotMetaByNetwork: entry.assetSnapshotMetaByNetwork }
          : {}),
      };
    });
  }

  async updateAllNetworkAccountValue({
    items,
    currency,
    updateAll,
    snapshotMeta,
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
    /** Freshness of the complete snapshot (used for updateAll replacement). */
    snapshotMeta?: IAssetSnapshotMeta;
  }) {
    const normalizedSnapshotMeta = normalizeSnapshotMeta(snapshotMeta);

    // Group write items by addressKey so a single setRawData call handles
    // multi-network entries that share the same address.
    const grouped: Record<
      string,
      {
        value: Record<string, string>;
        assetSnapshotMetaByNetwork: Record<string, IAssetSnapshotMeta>;
      }
    > = {};
    for (const it of items) {
      const key = this.buildAllKey(it);
      if (key) {
        const entry =
          grouped[key] ??
          (grouped[key] = {
            value: {},
            assetSnapshotMetaByNetwork: {},
          });
        const incomingMeta = normalizeSnapshotMeta(
          it.assetSnapshotMeta ?? normalizedSnapshotMeta,
        );
        const existingMeta = entry.assetSnapshotMetaByNetwork[it.networkId];
        // Multiple derive rows can collapse to one address/network. Keep the
        // newest item from this call before entering the serialized builder.
        if (!existingMeta || canApplySnapshotMeta(incomingMeta, existingMeta)) {
          entry.value[it.networkId] = it.value;
          if (incomingMeta) {
            entry.assetSnapshotMetaByNetwork[it.networkId] = incomingMeta;
          }
        }
      }
    }
    if (Object.keys(grouped).length === 0) {
      return;
    }

    // Applies the grouped writes to one snapshot of the entity and reports
    // whether anything changed. Used twice: for a cheap pre-check outside the
    // mutex and, authoritatively, inside the setRawData builder.
    const applyWrites = (
      base: IAccountValueDb,
    ): { next: IAccountValueDb; changed: boolean } => {
      const existing = base.allByAddress;
      const next: Record<string, IAllNetworkAccountValueEntry> = {
        ...existing,
      };
      let changed = false;
      for (const [
        key,
        { value: valueMap, assetSnapshotMetaByNetwork },
      ] of Object.entries(grouped)) {
        const previous = existing[key];
        const previousMetaByNetwork =
          previous?.assetSnapshotMetaByNetwork ?? {};

        // A complete snapshot can replace the map only when every network it
        // supplies is at least as fresh as the stored one, its own version is
        // not older than the stored complete snapshot, and every network it
        // omits (evicted by the replacement) is strictly older than the
        // snapshot's oldest marker. Equal markers for supplied networks are
        // admitted because the partial path may already have written this
        // round's responses; rejecting them would make a full refresh unable
        // to evict a disabled/removed network. This decision is made under the
        // entity mutex so overlapping writes in this writer see the latest
        // persisted marker.
        const previousNetworkMetaOf = (networkId: string) =>
          maxSnapshotMeta([
            previousMetaByNetwork[networkId],
            previous?.assetSnapshotMeta,
          ]);
        const incomingNetworksAreFresh = Object.keys(valueMap).every(
          (networkId) => {
            const incomingMeta = assetSnapshotMetaByNetwork[networkId];
            const previousNetworkMeta = previousNetworkMetaOf(networkId);
            return (
              !previousNetworkMeta ||
              isAssetSnapshotSameOrNewer(incomingMeta, previousNetworkMeta)
            );
          },
        );
        const omittedNetworksAreOlder = Object.keys(previous?.value ?? {})
          .filter(
            (networkId) =>
              !Object.prototype.hasOwnProperty.call(valueMap, networkId),
          )
          .every((networkId) => {
            const previousNetworkMeta = previousNetworkMetaOf(networkId);
            return (
              !previousNetworkMeta ||
              isAssetSnapshotNewer(normalizedSnapshotMeta, previousNetworkMeta)
            );
          });
        const hasCompleteIncomingSnapshotMeta =
          Boolean(normalizedSnapshotMeta) &&
          Object.keys(valueMap).every(
            (networkId) =>
              normalizeSnapshotMeta(assetSnapshotMetaByNetwork[networkId]) !==
              undefined,
          );
        const canReplaceWhole =
          updateAll &&
          hasCompleteIncomingSnapshotMeta &&
          incomingNetworksAreFresh &&
          isAssetSnapshotSameOrNewer(
            normalizedSnapshotMeta,
            previous?.assetSnapshotMeta,
          ) &&
          omittedNetworksAreOlder;

        // Without a complete snapshot version, an address that already has
        // per-network versions is treated as a partial merge. Dropping absent
        // networks in that case could resurrect stale data from a legacy
        // caller, so preserve them until a versioned full snapshot arrives.
        if (canReplaceWhole) {
          const replaced: IAllNetworkAccountValueEntry = {
            value: { ...valueMap },
            currency,
            ...(normalizedSnapshotMeta
              ? { assetSnapshotMeta: normalizedSnapshotMeta }
              : {}),
            ...(Object.keys(assetSnapshotMetaByNetwork).length > 0
              ? {
                  assetSnapshotMetaByNetwork: { ...assetSnapshotMetaByNetwork },
                }
              : {}),
          };
          if (!previous || !isSameAllNetworkEntry(previous, replaced)) {
            next[key] = replaced;
            changed = true;
          }
        } else {
          // A full snapshot that is not admitted (for example, because one
          // sibling network has a newer version) degrades to a per-network merge;
          // this keeps the newer sibling and avoids deleting it.
          const mergedValue: Record<string, string> = {
            ...previous?.value,
          };
          const mergedMetaByNetwork: Record<string, IAssetSnapshotMeta> = {
            ...previousMetaByNetwork,
          };
          let entryChanged = !previous || previous.currency !== currency;
          for (const [networkId, incomingValue] of Object.entries(valueMap)) {
            const incomingMeta = assetSnapshotMetaByNetwork[networkId];
            const previousNetworkMeta = previousNetworkMetaOf(networkId);
            if (canApplySnapshotMeta(incomingMeta, previousNetworkMeta)) {
              if (
                mergedValue[networkId] !== incomingValue ||
                !sameSnapshotMeta(mergedMetaByNetwork[networkId], incomingMeta)
              ) {
                entryChanged = true;
              }
              mergedValue[networkId] = incomingValue;
              if (incomingMeta) {
                mergedMetaByNetwork[networkId] = incomingMeta;
              } else {
                delete mergedMetaByNetwork[networkId];
              }
            }
          }

          if (entryChanged) {
            next[key] = {
              value: updateAll && !previous ? { ...valueMap } : mergedValue,
              currency,
              ...(previous?.assetSnapshotMeta
                ? { assetSnapshotMeta: previous.assetSnapshotMeta }
                : {}),
              ...(Object.keys(mergedMetaByNetwork).length > 0
                ? { assetSnapshotMetaByNetwork: mergedMetaByNetwork }
                : {}),
            };
            changed = true;
          }
        }
      }
      return changed
        ? { next: { ...base, allByAddress: next }, changed }
        : { next: base, changed };
    };

    // Most refresh calls repeat values the store already holds: every settled
    // network re-publishes the whole atom snapshot, and a builder-based
    // setRawData always re-serializes the entire entity. Pre-check on a read
    // outside the mutex and skip when nothing would change. The builder
    // re-evaluates under the mutex, so a stale pre-read can at most cost one
    // redundant write, never a lost one.
    const preRead = await this.getRawData();
    if (!applyWrites(withAddressBuckets(preRead)).changed) {
      return;
    }
    await this.setRawData(
      (rawData) => applyWrites(withAddressBuckets(rawData)).next,
    );
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
          data?: Record<
            string,
            {
              value: string;
              currency: string;
              assetSnapshotMeta?: IAssetSnapshotMeta;
            }
          >;
          all?: Record<
            string,
            {
              value: Record<string, string>;
              currency: string;
              assetSnapshotMeta?: IAssetSnapshotMeta;
              assetSnapshotMetaByNetwork?: Record<string, IAssetSnapshotMeta>;
            }
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
            byAddress[addressKey] = {
              value: entry.value,
              currency: 'usd',
              ...(entry.assetSnapshotMeta
                ? { assetSnapshotMeta: entry.assetSnapshotMeta }
                : {}),
            };
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
              const networkMeta = maxSnapshotMeta([
                entry.assetSnapshotMetaByNetwork?.[parsed.networkId],
                entry.assetSnapshotMeta,
              ]);
              const existingValueForNetwork =
                existing?.value?.[parsed.networkId];
              const existingNetworkMeta = maxSnapshotMeta([
                existing?.assetSnapshotMetaByNetwork?.[parsed.networkId],
                existing?.assetSnapshotMeta,
              ]);
              // A global legacy marker applies to the whole map, but it must
              // not prevent copying a different network that has not been
              // emitted yet. Compare markers only when this network already
              // has a value; otherwise the legacy row fills the missing key.
              const canApplyLegacy =
                existingValueForNetwork === undefined ||
                canApplySnapshotMeta(networkMeta, existingNetworkMeta);
              if (canApplyLegacy) {
                const legacyEntry: IAllNetworkAccountValueEntry = {
                  value: {
                    ...existing?.value,
                    [parsed.networkId]: worth,
                  },
                  currency: 'usd',
                };
                if (entry.assetSnapshotMeta) {
                  legacyEntry.assetSnapshotMeta = entry.assetSnapshotMeta;
                } else if (existing?.assetSnapshotMeta) {
                  legacyEntry.assetSnapshotMeta = existing.assetSnapshotMeta;
                }
                if (networkMeta || existing?.assetSnapshotMetaByNetwork) {
                  legacyEntry.assetSnapshotMetaByNetwork = {
                    ...existing?.assetSnapshotMetaByNetwork,
                    ...(networkMeta ? { [parsed.networkId]: networkMeta } : {}),
                  };
                }
                allByAddress[addressKey] = legacyEntry;
              }
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
        if (!cur) {
          mergedAllByAddress[key] = legacyEntry;
        } else {
          const mergedEntry: IAllNetworkAccountValueEntry = {
            value: { ...legacyEntry.value, ...cur.value },
            currency: cur.currency,
          };
          if (cur.assetSnapshotMeta) {
            mergedEntry.assetSnapshotMeta = cur.assetSnapshotMeta;
          } else if (legacyEntry.assetSnapshotMeta) {
            mergedEntry.assetSnapshotMeta = legacyEntry.assetSnapshotMeta;
          }
          if (
            cur.assetSnapshotMetaByNetwork ||
            legacyEntry.assetSnapshotMetaByNetwork
          ) {
            mergedEntry.assetSnapshotMetaByNetwork = {
              ...legacyEntry.assetSnapshotMetaByNetwork,
              ...cur.assetSnapshotMetaByNetwork,
            };
          }
          mergedAllByAddress[key] = mergedEntry;
        }
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
