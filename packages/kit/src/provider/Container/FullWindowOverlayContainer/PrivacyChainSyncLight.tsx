import { memo, useCallback, useEffect, useMemo } from 'react';

import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { uniq } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Button,
  Icon,
  IconButton,
  SizableText,
  Stack,
  XStack,
  YStack,
  useMedia,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useIsCellularNetwork } from '@onekeyhq/kit/src/hooks/useIsCellularNetwork';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  formatPrivacyChainSyncProgress,
  getPrivacyChainBackfillProgress,
  getPrivacyChainScanRegionLabelId,
  getPrivacyChainSyncLabel,
  pickSlowestPrivacyChainNetwork,
} from '@onekeyhq/kit/src/utils/privacyChainSyncDisplay';
import { usePrivacyChainAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { FLOAT_NAV_BAR_Z_INDEX } from '@onekeyhq/shared/src/consts/zIndexConsts';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

const KEEP_AWAKE_TAG = 'privacy-chain-sync';

// Clearance from the window edge, to stay out of the app's own chrome (header/tab bar/home indicator).
const EDGE_CLEARANCE = 72;

// Not expo's useKeepAwake(): that leaves the rejection unhandled, turning a refused lock into a crash.
function KeepScreenAwake() {
  useEffect(() => {
    activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch((e) => {
      console.error('[privacy-chain] keep-awake unavailable', e);
    });
    return () => {
      deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
    };
  }, []);
  return null;
}

// Always-on control for the foreground scan pace: lives app-wide, not on a page, since the pace outlives it.
function BasicPrivacyChainSyncLight() {
  const [
    { boostingNetworkIds, dataBlockedNetworkIds, pausedNetworkIds, progress },
  ] = usePrivacyChainAtom();
  // Anchored opposite the toasts (Toast/Toaster.tsx), so a transient toast never lands on top of this persistent control.
  const intl = useIntl();
  const media = useMedia();
  const { bottom: safeAreaBottom } = useSafeAreaInsets();
  const isCellular = useIsCellularNetwork();
  const isNarrow = media.md;

  // Every chain that wants to run, in one light: the slowest speaks for all; pause/resume act on all of them.
  const activeNetworkIds = useMemo(
    () => uniq([...boostingNetworkIds, ...dataBlockedNetworkIds]),
    [boostingNetworkIds, dataBlockedNetworkIds],
  );
  const networkId =
    pickSlowestPrivacyChainNetwork(activeNetworkIds, progress) ??
    pickSlowestPrivacyChainNetwork(pausedNetworkIds, progress);

  // Only the UI can see connection type; this app-wide surface keeps the scheduler's view from going stale.
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

  const { result: scanRegionHints } = usePromiseResult(async () => {
    if (!networkId) return undefined;
    const settings = await backgroundApiProxy.serviceNetwork.getVaultSettings({
      networkId,
    });
    return settings.localWallet?.scanRegionHints;
  }, [networkId]);

  const onPause = useCallback(() => {
    for (const id of activeNetworkIds) {
      void backgroundApiProxy.servicePrivacyChain.pauseLocalWalletScan({
        networkId: id,
      });
    }
  }, [activeNetworkIds]);

  // 'manual-sync' is what clears the pause.
  const onResume = useCallback(() => {
    for (const id of pausedNetworkIds) {
      void backgroundApiProxy.servicePrivacyChain.startForegroundBoost({
        networkId: id,
        trigger: 'manual-sync',
      });
    }
  }, [pausedNetworkIds]);

  const { result: networkName } = usePromiseResult(async () => {
    if (!networkId) return undefined;
    const network = await backgroundApiProxy.serviceNetwork.getNetworkSafe({
      networkId,
    });
    return network?.name;
  }, [networkId]);

  const onAllowCellular = useCallback(() => {
    void backgroundApiProxy.servicePrivacyChain.setAllowCellularSync({
      allow: true,
    });
  }, []);

  if (!networkId) {
    return null;
  }
  const entry = getPrivacyChainBackfillProgress(progress, networkId);
  const isRunning = boostingNetworkIds.includes(networkId);
  const isPaused = !isRunning && pausedNetworkIds.includes(networkId);
  // Reads the service's own decision: "not boosting and not paused" alone also matches the unblocked background pace.
  const isHeldByData =
    !isRunning && !isPaused && dataBlockedNetworkIds.includes(networkId);
  // A manual pause must stay visible until resumed, backfill done or not.
  if (!isRunning && !isPaused && !isHeldByData && !entry) {
    return null;
  }
  // No progress yet means the first step hasn't reported; progress with no backfill left means it's following the tip.
  const hasProgress = Object.keys(progress).some((key) =>
    key.startsWith(`${networkId}:`),
  );
  // Only native can tell metered from not; only metered is worth saying.
  const connection =
    platformEnv.isNative && isCellular
      ? intl.formatMessage({
          id: ETranslations.privacy_sync_on_mobile_data__msg,
        })
      : '';
  const stateLabel = intl.formatMessage({
    id: getPrivacyChainSyncLabel({
      paused: isPaused,
      held: isHeldByData,
      preparing: !hasProgress,
      backfilling: entry !== undefined,
    }),
  });
  const regionLabelId = getPrivacyChainScanRegionLabelId(
    scanRegionHints,
    entry?.backfillScannedHeight,
  );
  let detailLine: string;
  if (entry) {
    detailLine = [
      networkName,
      formatPrivacyChainSyncProgress({
        scanned: entry.backfillScannedHeight,
        target: entry.backfillTargetHeight,
        progress: entry.backfillProgress,
      }),
      regionLabelId ? intl.formatMessage({ id: regionLabelId }) : '',
      connection,
    ]
      .filter(Boolean)
      .join(' · ');
  } else if (hasProgress) {
    detailLine = [networkName, connection].filter(Boolean).join(' · ');
  } else {
    detailLine = intl.formatMessage({ id: ETranslations.global_preparing });
  }

  return (
    <Stack
      position="absolute"
      // Narrow: bottom-centre above the tab bar/home indicator. Wide: top-right, clear of the sidebar.
      {...(isNarrow
        ? {
            bottom: safeAreaBottom + EDGE_CLEARANCE,
            left: 0,
            right: 0,
            alignItems: 'center' as const,
            // Side padding gives the card a real width; shrink-to-fit otherwise wraps the label mid-word.
            paddingHorizontal: '$4' as const,
          }
        : { top: EDGE_CLEARANCE, right: '$5' as const })}
      zIndex={FLOAT_NAV_BAR_Z_INDEX}
      // box-none, not none: this overlay spans the window, so swallowing all clicks would make the app unusable.
      pointerEvents="box-none"
    >
      <YStack
        gap="$2"
        paddingHorizontal="$4"
        paddingVertical="$3"
        borderRadius="$3"
        backgroundColor="$bgSubdued"
        borderWidth={1}
        borderColor="$borderSubdued"
        // Narrow takes the padded overlay width; wide stays content-sized. Both keep the 360 cap.
        {...(isNarrow ? { width: '100%' as const } : null)}
        maxWidth={360}
        elevation={2}
        pointerEvents="box-none"
      >
        <XStack gap="$2.5" alignItems="center" pointerEvents="box-none">
          <Icon
            // Two bars mean stopped by the user or the data gate; the background pace is still scanning, just slowly.
            name={
              isPaused || isHeldByData ? 'PauseOutline' : 'RefreshCcwOutline'
            }
            size="$5"
            color={isRunning ? '$iconInfo' : '$iconSubdued'}
          />
          <YStack flex={1} gap="$0.5">
            <SizableText size="$bodyMdMedium">{stateLabel}</SizableText>
            {detailLine ? (
              <SizableText size="$bodySm" color="$textSubdued">
                {detailLine}
              </SizableText>
            ) : null}
          </YStack>
          {isRunning ? (
            <>
              <KeepScreenAwake />
              <IconButton
                testID="privacy-chain-sync-light-pause-btn"
                size="medium"
                variant="tertiary"
                icon="PauseOutline"
                title={intl.formatMessage({
                  id: ETranslations.global_pause,
                })}
                onPress={onPause}
                pointerEvents="auto"
              />
            </>
          ) : null}
          {isPaused ? (
            <Button
              testID="privacy-chain-sync-light-resume-btn"
              size="medium"
              variant="primary"
              onPress={onResume}
              pointerEvents="auto"
            >
              {intl.formatMessage({
                id: ETranslations.global_resume,
              })}
            </Button>
          ) : null}
        </XStack>
        {isHeldByData ? (
          <>
            <SizableText size="$bodySm" color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.privacy_sync_mobile_data__desc,
              })}
            </SizableText>
            <Button
              testID="privacy-chain-sync-light-allow-data-btn"
              size="medium"
              variant="primary"
              onPress={onAllowCellular}
              pointerEvents="auto"
            >
              {intl.formatMessage({
                id: ETranslations.privacy_sync_always_allow__action,
              })}
            </Button>
          </>
        ) : null}
        {isRunning ? (
          <SizableText size="$bodySm" color="$textCaution">
            {intl.formatMessage({
              id: ETranslations.privacy_sync_keep_open__msg,
            })}
          </SizableText>
        ) : null}
      </YStack>
    </Stack>
  );
}

export const PrivacyChainSyncLight = memo(BasicPrivacyChainSyncLight);
