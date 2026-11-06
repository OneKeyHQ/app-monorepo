import { useEffect } from 'react';

import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useIsCellularNetwork } from '@onekeyhq/kit/src/hooks/useIsCellularNetwork';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { getPrivacyChainNetworkSyncDisplay } from '@onekeyhq/kit/src/utils/privacyChainSyncDisplay';
import {
  useDeviceStageAtom,
  usePrivacyChainAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IPrivacyChainBlockTime } from '@onekeyhq/shared/src/utils/privacyChainSyncPolicy';

const KEEP_AWAKE_TAG = 'privacy-chain-sync';

// Keep each chain's threshold across mounts so caught-up scans never acquire a wake lock.
const syncedBelowBlocksCache = new Map<
  string,
  { syncedBelowBlocks: number; blockTime?: IPrivacyChainBlockTime }
>();

// Network reporting and the foreground wake lock belong to scanning, not its visual surfaces.
export function PrivacyChainSyncEffects() {
  const [state] = usePrivacyChainAtom();
  const [stage] = useDeviceStageAtom();
  const isCellular = useIsCellularNetwork();
  const activeNetworkKey = state.boostingNetworkIds.join(',');
  const { result: syncedBelowBlocksByNetwork } = usePromiseResult(
    async () =>
      Object.fromEntries(
        await Promise.all(
          activeNetworkKey
            .split(',')
            .filter(Boolean)
            .map(async (id) => {
              const settings =
                await backgroundApiProxy.serviceNetwork.getVaultSettings({
                  networkId: id,
                });
              const value = {
                syncedBelowBlocks: settings.localWallet?.syncedBelowBlocks ?? 1,
                blockTime: settings.localWallet,
              };
              syncedBelowBlocksCache.set(id, value);
              return [id, value] as const;
            }),
        ),
      ),
    [activeNetworkKey],
    { checkIsFocused: false },
  );
  const isStageOpen = Boolean(stage && stage.step !== 'off');
  const hasRunningScans =
    !(platformEnv.isNativeIOS && isStageOpen) &&
    state.boostingNetworkIds.some((networkId) => {
      if (state.storageUnsupportedNetworkIds.includes(networkId)) return false;
      const threshold =
        syncedBelowBlocksByNetwork?.[networkId] ??
        syncedBelowBlocksCache.get(networkId);
      return (
        getPrivacyChainNetworkSyncDisplay({
          state,
          networkId,
          syncedBelowBlocks:
            threshold?.syncedBelowBlocks ?? Number.POSITIVE_INFINITY,
          blockTime: threshold?.blockTime,
        }).status !== 'synced'
      );
    });

  useEffect(() => {
    const reportDeviceNetworkState = () => {
      void backgroundApiProxy.servicePrivacyChain.setDeviceNetworkState({
        isCellular,
      });
    };
    reportDeviceNetworkState();
    appEventBus.on(
      EAppEventBusNames.BackgroundThreadReady,
      reportDeviceNetworkState,
    );
    return () => {
      appEventBus.off(
        EAppEventBusNames.BackgroundThreadReady,
        reportDeviceNetworkState,
      );
    };
  }, [isCellular]);

  useEffect(() => {
    if (!hasRunningScans) return;
    activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {
      defaultLogger.app.error.log('Privacy chain keep-awake unavailable');
    });
    return () => {
      deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
    };
  }, [hasRunningScans]);

  return null;
}
