// Hyperliquid perps net worth resolution for account selector rows.
//
// This module is loaded ONLY via dynamic import from ServiceAccountSelector:
// it is selector-open code, and keeping it (plus its dependency chain —
// homeWalletTabSupportUtils, accountSelectorPerpsWorthUtils) behind a lazy
// segment keeps it out of the native background startup graph, which is
// enforced by the Startup Graph Budget CI check. Do not convert the caller
// to a static import.

import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { PERPS_NETWORK_ID } from '@onekeyhq/shared/src/consts/perp';
import { PERPS_HL_PORTFOLIO_STALE_SERVE_MAX_AGE_MS } from '@onekeyhq/shared/src/consts/perpCache';
import cacheUtils from '@onekeyhq/shared/src/utils/cacheUtils';
import { buildHomeWalletTabSupport } from '@onekeyhq/shared/src/utils/homeWalletTabSupportUtils';
import { isHyperliquidPortfolioSnapshotFresh } from '@onekeyhq/shared/src/utils/hyperliquidPortfolioUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { perpsCommonConfigPersistAtom } from '../../states/jotai/atoms';

import { buildAccountsPerpsNetWorthUsd } from './accountSelectorPerpsWorthUtils';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';
import type { IAccountSelectorDeFiItem } from '../../states/jotai/atoms/accountSelectorValues';
import type { IAccountDeriveTypes } from '../../vaults/types';

export class AccountSelectorPerpsWorth {
  backgroundApi: IBackgroundApi;

  constructor({ backgroundApi }: { backgroundApi: IBackgroundApi }) {
    this.backgroundApi = backgroundApi;
  }

  // Network-support inputs (perp config, DeFi-enabled map, all-networks
  // state) are constant across one selector open, but the values loader
  // calls the bg method once per 50-row batch — memoize briefly so a
  // multi-batch open computes them once. The perps derive type is
  // deliberately NOT part of this cache: it changes when the user switches
  // the EVM global derive type and is re-read per call in
  // _getPerpsSelectorGating.
  private _getPerpsSelectorGatingCached = cacheUtils.memoizee(
    async (
      linkedNetworkId: string | undefined,
    ): Promise<{
      isPerpsSupported: boolean;
      isGatingReady: boolean;
    }> => {
      const notSupported = {
        isPerpsSupported: false,
        isGatingReady: true,
      };
      const { perpConfigCommon, perpConfigLoaded } =
        await perpsCommonConfigPersistAtom.get();
      // Not-yet-loaded config counts as enabled, mirroring usePerpTabConfig.
      const perpDisabled = perpConfigLoaded
        ? perpConfigCommon?.disablePerp === true
        : false;
      if (perpDisabled) {
        return notSupported;
      }

      // On a cold start the local map is empty; await the shared sync
      // promise and gate on the final map, so every batch of one selector
      // open computes perps with the same verdict instead of the early
      // batches silently dropping it. The sync is deduped in ServiceDeFi
      // and its empty result is negative-cached, so this blocks at most
      // once per cold start.
      const { enabledNetworksMap: deFiEnabledNetworksMap, isReady } =
        await this.backgroundApi.serviceDeFi.getDeFiEnabledNetworksMapState();
      const isSingleLinkedNetwork =
        !!linkedNetworkId &&
        !networkUtils.isAllNetwork({ networkId: linkedNetworkId });
      let isPerpsSupported: boolean;
      if (isSingleLinkedNetwork) {
        isPerpsSupported = buildHomeWalletTabSupport({
          network: {
            id: linkedNetworkId,
            isAllNetworks: false,
            isTestnet: false,
          },
          deFiEnabledNetworksMap,
          perpDisabled,
        }).isPerpsSupported;
      } else {
        // No linked network (account manager) behaves like the All Networks
        // Home context.
        const [allNetworksState, { networks }] = await Promise.all([
          this.backgroundApi.serviceAllNetwork.getAllNetworksState(),
          this.backgroundApi.serviceNetwork.getAllNetworks({
            excludeTestNetwork: true,
            excludeAllNetworkItem: true,
          }),
        ]);
        isPerpsSupported = buildHomeWalletTabSupport({
          network: {
            id: getNetworkIdsMap().onekeyall,
            isAllNetworks: true,
            isTestnet: false,
          },
          allNetworks: networks,
          allNetworksState,
          deFiEnabledNetworksMap,
          perpDisabled,
        }).isPerpsSupported;
      }
      if (!isPerpsSupported) {
        return { ...notSupported, isGatingReady: isReady };
      }
      return { isPerpsSupported, isGatingReady: isReady };
    },
    {
      max: 4,
      maxAge: timerUtils.getTimeDurationMs({ seconds: 15 }),
      promise: true,
    },
  );

  // Cache only gating computed from a ready DeFi map: when the awaited sync
  // still ends with an empty map (sync failure or empty server list), that
  // provisional verdict must not be pinned for the whole memo TTL — dropping
  // it lets the next loader pass retry once the map actually syncs.
  private async _getPerpsSelectorGating(
    linkedNetworkId: string | undefined,
  ): Promise<{
    isPerpsSupported: boolean;
    perpsDeriveType: IAccountDeriveTypes | undefined;
    isGatingReady: boolean;
  }> {
    const gating = await this._getPerpsSelectorGatingCached(linkedNetworkId);
    if (!gating.isGatingReady) {
      void this._getPerpsSelectorGatingCached.delete(linkedNetworkId);
    }
    if (!gating.isPerpsSupported) {
      return { ...gating, perpsDeriveType: undefined };
    }
    // Re-read on every call, outside the memo TTL: switching the EVM global
    // derive type must not leave rows resolving perps snapshots for the
    // previous derive type's addresses.
    const perpsDeriveType =
      await this.backgroundApi.serviceNetwork.getGlobalDeriveTypeOfNetwork({
        networkId: PERPS_NETWORK_ID,
      });
    return { ...gating, perpsDeriveType };
  }

  // One getAllAccounts read + in-memory lookups instead of a per-row
  // getNetworkAccount (each a DB read + vault address build) on the
  // selector-open path.
  private async _resolvePerpsAddressesByIndexedAccountIds({
    indexedAccountIds,
    perpsDeriveType,
  }: {
    indexedAccountIds: string[];
    perpsDeriveType: IAccountDeriveTypes;
  }): Promise<Record<string, string | undefined>> {
    const addressByIndexedAccountId: Record<string, string | undefined> = {};
    const { accounts: allDbAccounts } =
      await this.backgroundApi.serviceAccount.getAllAccounts();
    const { accounts: perpsAccounts } =
      await this.backgroundApi.serviceAccount.getAccountsByIndexedAccounts({
        indexedAccountIds,
        networkId: PERPS_NETWORK_ID,
        deriveType: perpsDeriveType,
        allDbAccounts,
        // Rows without a created perps-network account resolve to undefined
        // instead of throwing per row.
        skipDbQueryIfNotFoundFromAllDbAccounts: true,
      });
    for (const account of perpsAccounts) {
      if (account?.indexedAccountId) {
        addressByIndexedAccountId[account.indexedAccountId] =
          account.addressDetail?.normalizedAddress ||
          account.address ||
          undefined;
      }
    }
    // Rows missed by the Account-table pass resolve through the same call
    // Home's overview uses (getNetworkAccount with the perps network's
    // global derive type), so the selector agrees with Home's perps display
    // by construction. The Address index cannot substitute here: its key
    // omits the derive type, so a reverse mapping from snapshot addresses
    // cannot prove a candidate belongs to the CURRENT derive path — after a
    // global derive-type switch it would surface the old path's balance.
    const unresolvedIds = indexedAccountIds.filter(
      (id) => !addressByIndexedAccountId[id],
    );
    if (unresolvedIds.length) {
      await Promise.all(
        unresolvedIds.map(async (indexedAccountId) => {
          try {
            const account =
              await this.backgroundApi.serviceAccount.getNetworkAccount({
                accountId: undefined,
                indexedAccountId,
                networkId: PERPS_NETWORK_ID,
                deriveType: perpsDeriveType,
              });
            addressByIndexedAccountId[indexedAccountId] =
              account?.addressDetail?.normalizedAddress ||
              account?.address ||
              undefined;
          } catch {
            // No resolvable address for the current derive path — the row
            // keeps no perps worth, matching Home whose own resolution
            // fails the same way.
          }
        }),
      );
    }
    return addressByIndexedAccountId;
  }

  // Attach perps worth onto the DeFi overview items (ride-along) so the UI
  // atom plumbing (loader → accountSelectorDeFiMapAtom → AccountValue) stays
  // unchanged.
  async buildDeFiOverviewWithPerps({
    accounts,
    linkedNetworkId,
    accountsDeFiOverview,
  }: {
    accounts: {
      accountId: string;
      indexedAccountId?: string;
      accountAddress?: string;
    }[];
    linkedNetworkId?: string;
    accountsDeFiOverview: IAccountSelectorDeFiItem[] | undefined;
  }): Promise<IAccountSelectorDeFiItem[]> {
    const accountsPerpsNetWorthUsd = await this._getAccountsPerpsNetWorthUsd({
      accounts,
      linkedNetworkId,
    });
    return accounts.map((_, index) => {
      const overviewItem = accountsDeFiOverview?.[index];
      const perpsNetWorthUsd = accountsPerpsNetWorthUsd[index];
      if (perpsNetWorthUsd === undefined) {
        return overviewItem;
      }
      return {
        ...overviewItem,
        overview: overviewItem?.overview ?? {},
        perpsNetWorthUsd,
      };
    });
  }

  // Hyperliquid perps net worth (USD) per selector row, read from the LOCAL
  // portfolio snapshot cache only — the same cache the Home overview polls
  // into — so selector totals can match Home's tokens + DeFi + perps sum.
  // Gating mirrors Home's isPerpsSupported (buildHomeWalletTabSupport): a
  // BTC-linked selector gets no perps, exactly like the BTC Home overview.
  private async _getAccountsPerpsNetWorthUsd({
    accounts,
    linkedNetworkId,
  }: {
    accounts: {
      accountId: string;
      indexedAccountId?: string;
      accountAddress?: string;
    }[];
    linkedNetworkId?: string;
  }): Promise<(string | undefined)[]> {
    const emptyResult = accounts.map(() => undefined);
    try {
      const { isPerpsSupported, perpsDeriveType } =
        await this._getPerpsSelectorGating(linkedNetworkId);
      if (!isPerpsSupported || !perpsDeriveType) {
        return emptyResult;
      }

      const perpData = await this.backgroundApi.simpleDb.perp.getPerpData();
      const snapshotNetWorthUsdByAddress: Record<string, string> = {};
      const now = Date.now();
      for (const [address, snapshot] of Object.entries(
        perpData?.hyperliquidPortfolioSnapshotByAddress ?? {},
      )) {
        const netWorthUsd = snapshot?.netWorthUsd;
        // Mirror ServiceHyperliquid.getHyperliquidPortfolioSnapshot's cache
        // policy: fresh snapshots serve as-is; stale ones only inside the
        // stale-serve window and never when degraded. Older entries would
        // render as loading on Home, so the selector must not sum them.
        if (
          netWorthUsd !== undefined &&
          (isHyperliquidPortfolioSnapshotFresh(snapshot, now) ||
            (!snapshot.isDegraded &&
              now - snapshot.fetchedAt <=
                PERPS_HL_PORTFOLIO_STALE_SERVE_MAX_AGE_MS))
        ) {
          // Same-policy mode check: a snapshot written under a different
          // abstraction mode than the persisted one is rejected by the
          // service (allowCachedFallback), so the selector must not sum it
          // either. getUserAbstractionMode reads the cached perp data and
          // includes the legacy dexAbstraction fallback.
          const persistedMode =
            await this.backgroundApi.simpleDb.perp.getUserAbstractionMode(
              address,
            );
          if (!persistedMode || snapshot.abstractionMode === persistedMode) {
            snapshotNetWorthUsdByAddress[address.toLowerCase()] = netWorthUsd;
          }
        }
      }

      return await buildAccountsPerpsNetWorthUsd({
        accounts,
        snapshotNetWorthUsdByAddress,
        resolvePerpsAddressesByIndexedAccountIds: async (indexedAccountIds) =>
          this._resolvePerpsAddressesByIndexedAccountIds({
            indexedAccountIds,
            perpsDeriveType,
          }),
      });
    } catch {
      // Perps worth is additive display data — never break the selector.
      return emptyResult;
    }
  }
}
