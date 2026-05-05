import { memo, useCallback, useEffect, useMemo, useRef } from 'react';

import { useIntl } from 'react-intl';

import type { IStackProps } from '@onekeyhq/components';
import {
  Button,
  IconButton,
  SectionList,
  SizableText,
  Stack,
  XStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { EAppSWRCacheScopes } from '@onekeyhq/shared/src/storage/syncStorageKeys';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { swrKeys } from '@onekeyhq/shared/src/utils/swrCacheUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';

import { NetworkAvatar } from '../../../components/NetworkAvatar';

import type { LayoutChangeEvent } from 'react-native';

function RecentNetworkItem({
  network,
  onPressItem,
}: {
  network: IServerNetwork;
  onPressItem?: (network: IServerNetwork) => void;
}) {
  const handlePress = useCallback(() => {
    if (network) {
      onPressItem?.(network);
    }
  }, [onPressItem, network]);
  return (
    <Button
      onPress={handlePress}
      size="small"
      variant="secondary"
      childrenAsText={false}
    >
      <XStack alignItems="center" gap="$2">
        <NetworkAvatar networkId={network.id} size={18} />
        <SizableText textBreakStrategy="simple" size="$bodyMdMedium">
          {network.name}
        </SizableText>
      </XStack>
    </Button>
  );
}

function RecentNetworks({
  onPressItem,
  setRecentNetworksHeight,
  availableNetworks,
  containerProps,
  showAllNetwork = true,
  swrKeyScope,
  walletId,
  accountId,
}: {
  onPressItem?: (network: IServerNetwork) => void;
  setRecentNetworksHeight?: (height: number) => void;
  availableNetworks?: IServerNetwork[];
  containerProps?: IStackProps;
  showAllNetwork?: boolean;
  // Opt-in SWR cache. Pass one of the shared scope enum values to persist
  // the resolved network list to MMKV and skip the cold-start N+1
  // getNetwork round-trips.
  swrKeyScope?: EAppSWRCacheScopes;
  // Pass wallet/account for account-scoped surfaces (Editable selector).
  // Omit for account-agnostic surfaces (Pure selector) — that shares a
  // single slot per scope across callers.
  walletId?: string;
  accountId?: string;
}) {
  const intl = useIntl();

  const swrKey = useMemo(() => {
    if (!swrKeyScope) return undefined;
    return swrKeys.recentNetworks({
      scope: swrKeyScope,
      showAllNetwork,
      walletId,
      accountId,
    });
  }, [swrKeyScope, showAllNetwork, walletId, accountId]);

  const { result: recentNetworks, run } = usePromiseResult(
    async () => {
      const networks: IServerNetwork[] = [];
      const resp = await backgroundApiProxy.serviceNetwork.getRecentNetworks({
        availableNetworks,
      });
      for (const networkId of resp) {
        try {
          const network = await backgroundApiProxy.serviceNetwork.getNetwork({
            networkId,
          });
          networks.push(network);
        } catch (_error) {
          // ignore
        }
      }
      if (!showAllNetwork) {
        return networks.filter(
          (n) => !networkUtils.isAllNetwork({ networkId: n.id }),
        );
      }
      return networks;
    },
    [availableNetworks, showAllNetwork],
    {
      initResult: [],
      swrKey,
    },
  );

  const handleClearRecentNetworks = useCallback(async () => {
    await backgroundApiProxy.serviceNetwork.clearRecentNetworks();
    void run();
  }, [run]);

  // Chip rows re-measure mid-mount (the flexWrap layout flips between 1
  // and 2 rows as NetworkAvatar images/fonts resolve). Left untreated,
  // this makes the section list below jump down by ~40px.
  //
  // Two guards here:
  //   1. max-only: never propagate a shrinking height (prevents any
  //      bounce back).
  //   2. debounced push: coalesce multiple onLayout fires within 48ms
  //      into one setState, so the receiving parent only re-lays out
  //      once per mount cycle. 48ms ≈ 3 frames — below perceptual
  //      threshold but comfortably past the image-load remeasure.
  const maxHeightRef = useRef(0);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    },
    [],
  );
  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const h = event.nativeEvent.layout.height;
      if (h > maxHeightRef.current) {
        maxHeightRef.current = h;
      }
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
      settleTimerRef.current = setTimeout(() => {
        setRecentNetworksHeight?.(maxHeightRef.current);
      }, 48);
    },
    [setRecentNetworksHeight],
  );

  useEffect(() => {
    const fn = async () => {
      await run({ alwaysSetState: true });
    };
    appEventBus.on(EAppEventBusNames.AddedCustomNetwork, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.AddedCustomNetwork, fn);
    };
  }, [run]);

  if (recentNetworks.length === 0) {
    return null;
  }

  return (
    <Stack onLayout={handleLayout} {...containerProps}>
      <SectionList.SectionHeader
        title={intl.formatMessage({
          id: ETranslations.network_recent_used_network,
        })}
      >
        <XStack justifyContent="flex-end" flex={1}>
          <IconButton
            size="small"
            variant="tertiary"
            icon="DeleteOutline"
            onPress={handleClearRecentNetworks}
          />
        </XStack>
      </SectionList.SectionHeader>
      <XStack gap="$2.5" flexWrap="wrap" px="$5" pb="$5">
        {recentNetworks.map((network) => (
          <RecentNetworkItem
            key={network.id}
            network={network}
            onPressItem={onPressItem}
          />
        ))}
      </XStack>
    </Stack>
  );
}

export default memo(RecentNetworks);
