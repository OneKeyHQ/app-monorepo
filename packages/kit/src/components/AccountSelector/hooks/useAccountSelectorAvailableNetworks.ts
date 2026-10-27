import { useEffect, useMemo, useRef } from 'react';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import {
  useAccountSelectorAvailableNetworksByNum,
  useAccountSelectorSceneInfo,
} from '../../../states/jotai/contexts/accountSelector';
import { EAvailableNetworksOutcome } from '../../../states/jotai/contexts/accountSelector/outcomes';
import {
  getAccountSelectorPerfTimestamp,
  getNextAccountSelectorPerfOperationId,
  isAccountSelectorPerfDebugEnabled,
} from '../../../states/jotai/contexts/accountSelector/perfDebug';

import type { IAccountSelectorAvailableNetworks } from '../../../states/jotai/contexts/accountSelector';

// Align with the bg-side memoizee maxAge of serviceNetwork.getAllNetworks, so a
// runtime without a mounted AccountSelector (which is where the custom network
// event listener lives) still recovers from a stale list on its own.
const ALL_NETWORK_IDS_CACHE_MAX_AGE = 5 * 60 * 1000;

let allNetworkIdsCache: string[] | undefined;
let allNetworkIdsCacheLoadedAt = 0;
let allNetworkIdsRequest:
  | Promise<{ changed: boolean; networkIds: string[] }>
  | undefined;
let allNetworkIdsRequestTargetForceEpoch = 0;
let allNetworkIdsForceEpoch = 0;
let allNetworkIdsLoadedForceEpoch = 0;
let isForceEpochQueued = false;

function isAllNetworkIdsCacheFresh() {
  return (
    Boolean(allNetworkIdsCache) &&
    Date.now() - allNetworkIdsCacheLoadedAt < ALL_NETWORK_IDS_CACHE_MAX_AGE
  );
}

function areNetworkIdsEqual(previous: string[] | undefined, next: string[]) {
  return (
    previous?.length === next.length &&
    previous.every((networkId, index) => networkId === next[index])
  );
}

function getRequestedForceEpoch(force: boolean) {
  if (!force) {
    return allNetworkIdsForceEpoch;
  }
  if (!isForceEpochQueued) {
    allNetworkIdsForceEpoch += 1;
    isForceEpochQueued = true;
    void Promise.resolve().then(() => {
      isForceEpochQueued = false;
    });
  }
  return allNetworkIdsForceEpoch;
}

function startAllNetworkIdsRequest({
  load,
  targetForceEpoch,
}: {
  load: () => Promise<{ networkIds: string[] }>;
  targetForceEpoch: number;
}) {
  const request = load()
    .then(({ networkIds }) => {
      const requestChanged = !areNetworkIdsEqual(
        allNetworkIdsCache,
        networkIds,
      );
      if (requestChanged || !allNetworkIdsCache) {
        allNetworkIdsCache = networkIds;
      }
      allNetworkIdsCacheLoadedAt = Date.now();
      allNetworkIdsLoadedForceEpoch = Math.max(
        allNetworkIdsLoadedForceEpoch,
        targetForceEpoch,
      );
      return {
        changed: requestChanged,
        networkIds: allNetworkIdsCache || [],
      };
    })
    .finally(() => {
      if (allNetworkIdsRequest === request) {
        allNetworkIdsRequest = undefined;
      }
    });
  allNetworkIdsRequest = request;
  allNetworkIdsRequestTargetForceEpoch = targetForceEpoch;
  return request;
}

async function loadAllNetworkIds({
  force,
  load,
}: {
  force: boolean;
  load: () => Promise<{ networkIds: string[] }>;
}) {
  const requestedForceEpoch = getRequestedForceEpoch(force);
  if (
    !force &&
    allNetworkIdsCache &&
    isAllNetworkIdsCacheFresh() &&
    !allNetworkIdsRequest &&
    allNetworkIdsLoadedForceEpoch >= requestedForceEpoch
  ) {
    return {
      changed: false,
      networkIds: allNetworkIdsCache,
      source: 'cache' as const,
    };
  }
  let changed = false;
  let joinedInFlightRequest = false;
  let startedRequest = false;
  let startedTrailingRequest = false;

  for (;;) {
    const needsLoad =
      !allNetworkIdsCache ||
      !isAllNetworkIdsCacheFresh() ||
      allNetworkIdsLoadedForceEpoch < requestedForceEpoch;
    if (!needsLoad) {
      break;
    }
    let result: { changed: boolean; networkIds: string[] } | undefined;
    if (allNetworkIdsRequest) {
      joinedInFlightRequest = true;
      const joinedTargetForceEpoch = allNetworkIdsRequestTargetForceEpoch;
      try {
        result = await allNetworkIdsRequest;
      } catch (error) {
        if (joinedTargetForceEpoch >= requestedForceEpoch) {
          throw error;
        }
      }
    } else {
      startedRequest = true;
      startedTrailingRequest = joinedInFlightRequest;
      result = await startAllNetworkIdsRequest({
        load,
        targetForceEpoch: allNetworkIdsForceEpoch,
      });
    }
    changed = changed || Boolean(result?.changed);
  }

  let source: 'rpc' | 'shared-inflight' | 'trailing-rpc' = 'rpc';
  if (startedTrailingRequest) {
    source = 'trailing-rpc';
  } else if (joinedInFlightRequest && !startedRequest) {
    source = 'shared-inflight';
  }
  return {
    changed,
    networkIds: allNetworkIdsCache || [],
    source,
  };
}

export function useAccountSelectorAvailableNetworks({
  consumer = 'unspecified',
  num,
}: {
  consumer?: string;
  num: number;
}): IAccountSelectorAvailableNetworks {
  const { serviceNetwork } = backgroundApiProxy;
  const availableNetworksInfo = useAccountSelectorAvailableNetworksByNum(num);
  const { sceneName } = useAccountSelectorSceneInfo();
  const forceRefreshRef = useRef(false);

  const defaultNetworkId = useMemo(() => {
    return availableNetworksInfo?.defaultNetworkId;
  }, [availableNetworksInfo?.defaultNetworkId]);

  const { result: networkIds, run } = usePromiseResult(
    async () => {
      const perfEnabled = isAccountSelectorPerfDebugEnabled();
      const operationId = perfEnabled
        ? getNextAccountSelectorPerfOperationId()
        : undefined;
      const requestedAt = perfEnabled ? getAccountSelectorPerfTimestamp() : 0;
      const trigger = forceRefreshRef.current
        ? 'custom-network-event'
        : 'mount-or-deps';
      forceRefreshRef.current = false;
      if (perfEnabled) {
        defaultLogger.accountSelector.perf.trace('availableNetworksRequested', {
          consumer,
          num,
          operationId,
          sceneName,
          trigger,
        });
      }
      if (
        availableNetworksInfo?.networkIds &&
        availableNetworksInfo?.networkIds?.length
      ) {
        if (perfEnabled) {
          defaultLogger.accountSelector.perf.trace('availableNetworksResult', {
            changed: false,
            consumer,
            networkCount: availableNetworksInfo.networkIds.length,
            num,
            operationId,
            outcome: EAvailableNetworksOutcome.Success,
            sceneName,
            source: 'configured',
            totalMs: Math.round(
              getAccountSelectorPerfTimestamp() - requestedAt,
            ),
            trigger,
          });
        }
        return availableNetworksInfo?.networkIds;
      }
      try {
        const result = await loadAllNetworkIds({
          force: trigger === 'custom-network-event',
          load: () => serviceNetwork.getAllNetworkIds(),
        });
        if (perfEnabled) {
          defaultLogger.accountSelector.perf.trace('availableNetworksResult', {
            changed: result.changed,
            consumer,
            networkCount: result.networkIds.length,
            num,
            operationId,
            outcome: EAvailableNetworksOutcome.Success,
            sceneName,
            source: result.source,
            totalMs: Math.round(
              getAccountSelectorPerfTimestamp() - requestedAt,
            ),
            trigger,
          });
        }
        return result.networkIds;
      } catch (error) {
        if (perfEnabled) {
          defaultLogger.accountSelector.perf.trace('availableNetworksResult', {
            consumer,
            num,
            operationId,
            outcome: EAvailableNetworksOutcome.Error,
            sceneName,
            totalMs: Math.round(
              getAccountSelectorPerfTimestamp() - requestedAt,
            ),
            trigger,
          });
        }
        throw error;
      }
    },
    [
      availableNetworksInfo?.networkIds,
      consumer,
      num,
      sceneName,
      serviceNetwork,
    ],
    {
      initResult: [],
    },
  );

  useEffect(() => {
    const refreshNetworkIds = () => {
      forceRefreshRef.current = true;
      void run({ alwaysSetState: true });
    };
    appEventBus.on(EAppEventBusNames.AddedCustomNetwork, refreshNetworkIds);
    return () => {
      appEventBus.off(EAppEventBusNames.AddedCustomNetwork, refreshNetworkIds);
    };
  }, [run]);

  return useMemo(
    () => ({
      networkIds,
      defaultNetworkId,
    }),
    [networkIds, defaultNetworkId],
  );
}
