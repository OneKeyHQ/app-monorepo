import { useRef } from 'react';

import BigNumber from 'bignumber.js';

import { USD_CURRENCY_ID } from '@onekeyhq/shared/src/consts/currencyConsts';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import {
  getNewestAssetSnapshotMeta,
  isAssetSnapshotNewer,
  isAssetSnapshotSameOrNewer,
} from '@onekeyhq/shared/src/utils/assetSnapshotFreshness';
import { memoFn } from '@onekeyhq/shared/src/utils/cacheUtils';
import type { IAssetSnapshotMeta } from '@onekeyhq/shared/types/assetSnapshot';
import type { IWalletBanner } from '@onekeyhq/shared/types/walletBanner';

import { ContextJotaiActionsBase } from '../../utils/ContextJotaiActionsBase';

import {
  accountDeFiOverviewAtom,
  accountOverviewStateAtom,
  accountWorthAtom,
  allNetworksStateAtom,
  approvalsInfoAtom,
  buildOverviewOwnerKey,
  contextAtomMethod,
  overviewDeFiDataStateAtom,
  walletTopBannersAtom,
} from './atoms';

function recomputeCreateAtNetworkWorth({
  worth,
  accountId,
  createAtNetwork,
}: {
  worth: Record<string, string>;
  accountId: string;
  createAtNetwork?: string;
}): string | undefined {
  if (!createAtNetwork) {
    return undefined;
  }

  if (accountUtils.isOthersAccount({ accountId })) {
    const key = accountUtils.buildAccountValueKey({
      accountId,
      networkId: createAtNetwork,
    });
    return new BigNumber(worth[key] ?? '0').toFixed();
  }

  return Object.values(worth)
    .reduce<BigNumber>((sum, value) => sum.plus(value), new BigNumber(0))
    .toFixed();
}

class ContextJotaiActionsAccountOverview extends ContextJotaiActionsBase {
  updateAllNetworksState = contextAtomMethod(
    (get, set, payload: { visibleCount: number }) => {
      set(allNetworksStateAtom(), {
        ...get(allNetworksStateAtom()),
        ...payload,
      });
    },
  );

  updateAccountOverviewState = contextAtomMethod(
    (get, set, payload: { initialized?: boolean; isRefreshing?: boolean }) => {
      set(accountOverviewStateAtom(), {
        ...get(accountOverviewStateAtom()),
        ...payload,
      });
    },
  );

  updateAccountWorth = contextAtomMethod(
    (
      get,
      set,
      payload: {
        worth: Record<string, string>;
        createAtNetworkWorth?: string;
        createAtNetwork?: string;
        initialized: boolean;
        accountId: string;
        updateAll?: boolean;
        merge?: boolean;
        reset?: boolean;
        currency?: string;
        assetSnapshotMetaByKey?: Record<string, IAssetSnapshotMeta>;
        assetSnapshotMeta?: IAssetSnapshotMeta;
      },
    ) => {
      const currency = payload.currency ?? USD_CURRENCY_ID;
      if (payload.reset) {
        set(accountWorthAtom(), {
          worth: {},
          createAtNetworkWorth: '0',
          initialized: payload.initialized,
          accountId: payload.accountId,
          updateAll: payload.updateAll,
          currency,
        });
        return;
      }

      const current = get(accountWorthAtom());
      const sameAccount = current.accountId === payload.accountId;
      // `merge: false` is the long-standing replacement mode used by the
      // single-network path. An all-network `updateAll` payload is a complete
      // replacement only when it carries the aggregate marker proving that
      // every enabled network was observed. Cache hydration and incomplete
      // fan-outs also use `updateAll`, but they are partial and must retain
      // omitted networks.
      const isCompleteSnapshot =
        payload.merge !== true &&
        (payload.updateAll !== true || Boolean(payload.assetSnapshotMeta));
      const currentMetaByKey = sameAccount
        ? (current.assetSnapshotMetaByKey ?? {})
        : {};
      const currentAggregateMeta = sameAccount
        ? current.assetSnapshotMeta
        : undefined;
      const incomingMetaForKey = (key: string) =>
        payload.assetSnapshotMetaByKey?.[key] ??
        (isCompleteSnapshot ? payload.assetSnapshotMeta : undefined);

      if (payload.merge) {
        const baseWorth = sameAccount ? current.worth : {};
        const baseCreateAtNetworkWorth = sameAccount
          ? current.createAtNetworkWorth
          : '0';
        const acceptedWorth: Record<string, string> = {};
        Object.entries(payload.worth).forEach(([key, value]) => {
          const incomingMeta = incomingMetaForKey(key);
          const existingMeta = getNewestAssetSnapshotMeta(
            currentMetaByKey[key],
            currentAggregateMeta,
          );
          if (
            !existingMeta ||
            isAssetSnapshotNewer(incomingMeta, existingMeta)
          ) {
            acceptedWorth[key] = value;
          }
        });
        const nextMetaByKey = { ...currentMetaByKey };
        Object.entries(payload.worth).forEach(([key]) => {
          const incomingMeta = incomingMetaForKey(key);
          const existingMeta = getNewestAssetSnapshotMeta(
            currentMetaByKey[key],
            currentAggregateMeta,
          );
          if (
            incomingMeta &&
            (!existingMeta || isAssetSnapshotNewer(incomingMeta, existingMeta))
          ) {
            nextMetaByKey[key] = incomingMeta;
          }
        });
        const nextWorth = {
          ...baseWorth,
          ...acceptedWorth,
        };
        const hasAcceptedWorth = Object.keys(acceptedWorth).length > 0;
        const recomputedCreateAtNetworkWorth =
          payload.createAtNetworkWorth !== undefined
            ? recomputeCreateAtNetworkWorth({
                worth: nextWorth,
                accountId: payload.accountId,
                createAtNetwork: payload.createAtNetwork,
              })
            : undefined;
        // `merge` receives independent network responses. When the producer
        // supplies the owner's create network, derive the scalar from the
        // materialized absolute values so a refreshed key replaces its prior
        // contribution instead of being added a second time. Legacy callers
        // without that context retain the historical additive behavior.
        let nextCreateAtNetworkWorth = baseCreateAtNetworkWorth;
        if (recomputedCreateAtNetworkWorth !== undefined) {
          nextCreateAtNetworkWorth = recomputedCreateAtNetworkWorth;
        } else if (
          payload.createAtNetworkWorth !== undefined &&
          (Object.keys(payload.worth).length === 0 || hasAcceptedWorth)
        ) {
          nextCreateAtNetworkWorth = new BigNumber(
            baseCreateAtNetworkWorth ?? '0',
          )
            .plus(payload.createAtNetworkWorth)
            .toFixed();
        }
        // `merge: true` is an independent per-network update. Its marker
        // cannot describe the complete account snapshot, so never promote it
        // to the aggregate marker used by full replacements.
        const nextAggregateMeta = currentAggregateMeta;
        // The currency tag describes the values in `nextWorth`. When every
        // incoming value was rejected as stale, only retained values remain
        // and they still carry the previous tag; adopting the rejected
        // payload's tag would convert them from the wrong currency downstream.
        const nextCurrency =
          !hasAcceptedWorth && sameAccount && Object.keys(nextWorth).length > 0
            ? current.currency
            : currency;
        set(accountWorthAtom(), {
          worth: nextWorth,
          createAtNetworkWorth: nextCreateAtNetworkWorth,
          initialized: payload.initialized,
          accountId: payload.accountId,
          updateAll: payload.updateAll,
          currency: nextCurrency,
          ...(Object.keys(nextMetaByKey).length > 0
            ? { assetSnapshotMetaByKey: nextMetaByKey }
            : {}),
          ...(nextAggregateMeta
            ? { assetSnapshotMeta: nextAggregateMeta }
            : {}),
        });
        return;
      }

      const currentValue =
        sameAccount &&
        typeof current.worth === 'object' &&
        current.worth !== null
          ? current.worth
          : {};
      // Progressive per-network merges admit each response as it settles, and
      // the full snapshot built from the same round re-materializes those
      // responses with EQUAL markers. Equal markers must not block the
      // replacement, otherwise a full refresh could never evict an omitted
      // (disabled/removed) network; only strictly older input is stale.
      const incomingKeysAreFresh = Object.keys(payload.worth).every((key) => {
        const incomingMeta = incomingMetaForKey(key);
        const existingMeta = getNewestAssetSnapshotMeta(
          currentMetaByKey[key],
          currentAggregateMeta,
        );
        return (
          !existingMeta ||
          isAssetSnapshotSameOrNewer(incomingMeta, existingMeta)
        );
      });
      // Keys omitted by the full snapshot are evicted, so their markers must
      // be strictly older than the oldest marker the snapshot covers. Keys the
      // snapshot supplies were admitted per key above.
      const completeMetaIsFresh = payload.assetSnapshotMeta
        ? isAssetSnapshotSameOrNewer(
            payload.assetSnapshotMeta,
            currentAggregateMeta,
          ) &&
          Object.entries(currentMetaByKey)
            .filter(
              ([key]) =>
                !Object.prototype.hasOwnProperty.call(payload.worth, key),
            )
            .every(([, currentMeta]) =>
              isAssetSnapshotNewer(payload.assetSnapshotMeta, currentMeta),
            )
        : !currentAggregateMeta && Object.keys(currentMetaByKey).length === 0;
      const hasVersionedCurrentSnapshot =
        Boolean(currentAggregateMeta) ||
        Object.keys(currentMetaByKey).length > 0;
      const hasIncomingSnapshotMeta =
        Boolean(payload.assetSnapshotMeta) ||
        Object.keys(payload.assetSnapshotMetaByKey ?? {}).length > 0;
      const hasCompleteIncomingSnapshotMeta =
        !isCompleteSnapshot ||
        (!hasIncomingSnapshotMeta && !hasVersionedCurrentSnapshot) ||
        (Boolean(payload.assetSnapshotMeta) &&
          Object.keys(payload.worth).every((key) =>
            Boolean(incomingMetaForKey(key)),
          ));
      const canReplaceFullSnapshot =
        !isCompleteSnapshot ||
        (hasCompleteIncomingSnapshotMeta &&
          incomingKeysAreFresh &&
          completeMetaIsFresh);
      const preserveCurrentValues =
        sameAccount && (!isCompleteSnapshot || !canReplaceFullSnapshot);
      const nextWorth: Record<string, string> = preserveCurrentValues
        ? { ...currentValue }
        : {};
      const nextMetaByKey: Record<string, IAssetSnapshotMeta> =
        preserveCurrentValues ? { ...currentMetaByKey } : {};
      // An admitted full snapshot is authoritative for every key it supplies,
      // including keys whose marker equals the stored one (see above).
      const admitsEqualMarker = isCompleteSnapshot && canReplaceFullSnapshot;
      let acceptedValueCount = 0;
      Object.entries(payload.worth).forEach(([key, value]) => {
        const incomingMeta = incomingMetaForKey(key);
        const existingMeta = getNewestAssetSnapshotMeta(
          currentMetaByKey[key],
          currentAggregateMeta,
        );
        const incomingIsFresh = admitsEqualMarker
          ? isAssetSnapshotSameOrNewer(incomingMeta, existingMeta)
          : isAssetSnapshotNewer(incomingMeta, existingMeta);
        if (!sameAccount || !existingMeta || incomingIsFresh) {
          nextWorth[key] = value;
          acceptedValueCount += 1;
          if (incomingMeta) {
            nextMetaByKey[key] = incomingMeta;
          }
        } else if (current.worth[key] !== undefined) {
          // Replacement still preserves the current value for an explicitly
          // supplied key when that incoming snapshot is stale.
          nextWorth[key] = current.worth[key];
          if (existingMeta) {
            nextMetaByKey[key] = existingMeta;
          }
        }
      });
      const shouldUpdateAggregate =
        payload.updateAll === true &&
        isCompleteSnapshot &&
        canReplaceFullSnapshot;
      let nextAggregateMeta: IAssetSnapshotMeta | undefined;
      if (shouldUpdateAggregate) {
        nextAggregateMeta = payload.assetSnapshotMeta;
      } else if (sameAccount) {
        nextAggregateMeta = currentAggregateMeta;
      }
      const shouldUpdateCreateAtNetworkWorth =
        !sameAccount ||
        (isCompleteSnapshot && canReplaceFullSnapshot) ||
        (payload.updateAll !== true && acceptedValueCount > 0) ||
        // Cache hydration is a partial all-network seed (no aggregate marker),
        // but it is also the first value for a freshly reset owner. Preserve
        // its create-at-network scalar so Others-account persistence does not
        // briefly write zero while the per-network map is already populated.
        (payload.updateAll === true &&
          payload.createAtNetworkWorth !== undefined &&
          sameAccount &&
          current.createAtNetworkWorth === '0' &&
          Object.keys(currentValue).length === 0 &&
          !currentAggregateMeta &&
          Object.keys(currentMetaByKey).length === 0 &&
          acceptedValueCount > 0);
      let nextCreateAtNetworkWorth = current.createAtNetworkWorth;
      const recomputedCreateAtNetworkWorth =
        payload.createAtNetworkWorth !== undefined
          ? recomputeCreateAtNetworkWorth({
              worth: nextWorth,
              accountId: payload.accountId,
              createAtNetwork: payload.createAtNetwork,
            })
          : undefined;
      if (recomputedCreateAtNetworkWorth !== undefined) {
        nextCreateAtNetworkWorth = recomputedCreateAtNetworkWorth;
      } else if (shouldUpdateAggregate || shouldUpdateCreateAtNetworkWorth) {
        nextCreateAtNetworkWorth = payload.createAtNetworkWorth ?? '0';
      }

      // See the merge path: a replacement that rejected every incoming value
      // keeps only retained values and must keep their currency tag.
      const nextCurrency =
        acceptedValueCount === 0 &&
        sameAccount &&
        Object.keys(nextWorth).length > 0
          ? current.currency
          : currency;

      set(accountWorthAtom(), {
        worth: nextWorth,
        createAtNetworkWorth: nextCreateAtNetworkWorth,
        initialized: payload.initialized,
        accountId: payload.accountId,
        updateAll: payload.updateAll,
        currency: nextCurrency,
        ...(Object.keys(nextMetaByKey).length > 0
          ? { assetSnapshotMetaByKey: nextMetaByKey }
          : {}),
        ...(nextAggregateMeta ? { assetSnapshotMeta: nextAggregateMeta } : {}),
      });
    },
  );

  updateApprovalsInfo = contextAtomMethod(
    (
      get,
      set,
      payload: { hasRiskApprovals?: boolean; riskApprovalsCount?: number },
    ) => {
      set(approvalsInfoAtom(), {
        ...get(approvalsInfoAtom()),
        ...payload,
      });
    },
  );

  updateWalletTopBanners = contextAtomMethod(
    (get, set, payload: { banners: IWalletBanner[] }) => {
      set(walletTopBannersAtom(), {
        banners: payload.banners,
      });
    },
  );

  updateAccountDeFiOverview = contextAtomMethod(
    (
      get,
      set,
      value: {
        overview: {
          totalValue: number;
          totalDebt: number;
          totalReward: number;
          netWorth: number;
        };
        merge?: boolean;
        currency?: string;
        accountId?: string;
        networkId?: string;
        isReady?: boolean;
      },
    ) => {
      const overview = get(accountDeFiOverviewAtom());

      if (value.merge) {
        const newOverview = {
          totalValue: new BigNumber(overview.totalValue)
            .plus(value.overview.totalValue)
            .toNumber(),
          totalDebt: new BigNumber(overview.totalDebt ?? 0)
            .plus(value.overview.totalDebt ?? 0)
            .toNumber(),
          netWorth: new BigNumber(overview.netWorth ?? 0)
            .plus(value.overview.netWorth ?? 0)
            .toNumber(),
          totalReward: new BigNumber(overview.totalReward ?? 0)
            .plus(value.overview.totalReward ?? 0)
            .toNumber(),
          // Honor the producer's currency on first merge into an empty atom
          // (overview.currency defaults to ''); otherwise a later currency
          // switch silently misreads the basis.
          currency: value.currency ?? overview.currency,
          accountId: value.accountId ?? overview.accountId,
          networkId: value.networkId ?? overview.networkId,
        };
        set(accountDeFiOverviewAtom(), newOverview);
      } else {
        set(accountDeFiOverviewAtom(), {
          ...value.overview,
          currency: value.currency ?? overview.currency,
          accountId: value.accountId ?? overview.accountId,
          networkId: value.networkId ?? overview.networkId,
        });
      }

      // Auto-set DeFi state when readiness is explicitly provided
      if ('isReady' in value) {
        set(overviewDeFiDataStateAtom(), {
          ownerKey: buildOverviewOwnerKey(
            value.accountId ?? overview.accountId,
            value.networkId ?? overview.networkId,
          ),
          isReady: value.isReady,
        });
      }
    },
  );

  updateOverviewDeFiDataState = contextAtomMethod(
    (
      get,
      set,
      value: {
        accountId?: string;
        networkId?: string;
        isReady?: boolean;
      },
    ) => {
      set(overviewDeFiDataStateAtom(), {
        ownerKey: buildOverviewOwnerKey(value.accountId, value.networkId),
        isReady: value.isReady,
      });
    },
  );
}

const createActions = memoFn(() => {
  // console.log('new ContextJotaiActionsAccountOverview()', Date.now());
  return new ContextJotaiActionsAccountOverview();
});

export function useAccountOverviewActions() {
  const actions = createActions();

  const updateAccountWorth = actions.updateAccountWorth.use();
  const updateAccountOverviewState = actions.updateAccountOverviewState.use();
  const updateAllNetworksState = actions.updateAllNetworksState.use();
  const updateApprovalsInfo = actions.updateApprovalsInfo.use();
  const updateWalletTopBanners = actions.updateWalletTopBanners.use();
  const updateAccountDeFiOverview = actions.updateAccountDeFiOverview.use();
  const updateOverviewDeFiDataState = actions.updateOverviewDeFiDataState.use();

  return useRef({
    updateAllNetworksState,
    updateAccountWorth,
    updateAccountOverviewState,
    updateApprovalsInfo,
    updateWalletTopBanners,
    updateAccountDeFiOverview,
    updateOverviewDeFiDataState,
  });
}
