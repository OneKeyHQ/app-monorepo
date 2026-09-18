import { memo, useCallback, useEffect } from 'react';

import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
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
import { usePrivacyChainAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { FLOAT_NAV_BAR_Z_INDEX } from '@onekeyhq/shared/src/consts/zIndexConsts';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslationsMock } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

const KEEP_AWAKE_TAG = 'privacy-chain-sync';

// Clearance from the window edge, on both anchors.
//
// One number because it means one thing: stay out of the app's own chrome.
// At the top that is the title bar and page header; at the bottom it is the
// tab bar and home indicator. Sitting at the default $4 put the pill inside
// the desktop header instead of over the content it describes.
const EDGE_CLEARANCE = 72;

// Held for exactly as long as the fast pace is actually running.
//
// Mount = acquire, unmount = release, and this only ever mounts inside the
// running branch below -- so waiting for data consent holds nothing, and the
// light disappearing releases it without anyone having to remember to.
//
// Not expo's useKeepAwake(): it calls activateKeepAwakeAsync().then() with no
// catch, so a device that refuses the lock surfaces as an unhandled rejection.
// Failing to hold the screen on is a degraded sync, not an app error.
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

// The always-on control for the foreground scan pace.
//
// The pace is a property of how far behind the wallet is, not of any page: the
// scheduler turns it on whenever there is real history left to rebuild and off
// when there is not. So its control cannot live on a page either -- close
// token details and the battery would keep draining with nothing on screen
// saying so, and nothing to press.
//
// Two states, because a refused boost still needs the user:
//   running          -> holds the screen awake, offers pause
//   needs-consent    -> holds nothing, offers "Continue on mobile data"
//
// Subscribes rather than polls. The scheduler publishes at the end of each
// pass while it still holds the wallet; polling for this instead put the read
// into the same FIFO lane as the scan, for the entire life of the app.
function BasicPrivacyChainSyncLight() {
  const [
    { boostingNetworkIds, dataBlockedNetworkIds, pausedNetworkIds, progress },
  ] = usePrivacyChainAtom();
  // Anchored opposite the toasts, which sit top-center when narrow and
  // bottom-right when wide (components/actions/Toast/Toaster.tsx). A toast is
  // transient and fires at any moment; this light is persistent, so sharing an
  // anchor would mean a toast eventually lands on top of the one control that
  // stops the battery drain. Narrow also keeps the top clear for the page
  // header and balance, and puts the buttons in thumb reach.
  const intl = useIntl();
  const media = useMedia();
  const { bottom: safeAreaBottom } = useSafeAreaInsets();
  const isCellular = useIsCellularNetwork();
  const isNarrow = media.md;

  const boostingNetworkId = boostingNetworkIds[0];
  const blockedNetworkId = dataBlockedNetworkIds[0];
  const pausedNetworkId = pausedNetworkIds[0];
  const networkId = boostingNetworkId ?? blockedNetworkId ?? pausedNetworkId;

  // Only the UI can see the connection type, and this surface is the one that
  // exists app-wide -- reporting it from a page meant the scheduler's view of
  // the network went stale the moment that page closed.
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

  const onPause = useCallback(() => {
    if (!networkId) return;
    void backgroundApiProxy.servicePrivacyChain.pauseLocalWalletScan({
      networkId,
    });
  }, [networkId]);

  // 'manual-sync' is what clears the pause -- the press IS the resume.
  const onResume = useCallback(() => {
    if (!networkId) return;
    void backgroundApiProxy.servicePrivacyChain.startForegroundBoost({
      networkId,
      trigger: 'manual-sync',
    });
  }, [networkId]);

  const onAllowCellular = useCallback(() => {
    void backgroundApiProxy.servicePrivacyChain.setAllowCellularSync({
      allow: true,
    });
  }, []);

  if (!networkId) {
    return null;
  }
  const entry = Object.entries(progress)
    .filter(
      ([key, value]) =>
        key.startsWith(`${networkId}:`) && !value.isBackfillComplete,
    )
    .map(([, value]) => value)
    .toSorted((left, right) => {
      const remaining = (value: typeof left) => {
        if (
          value.backfillTargetHeight === null ||
          value.backfillScannedHeight === null
        ) {
          return Number.MAX_SAFE_INTEGER;
        }
        return Math.max(
          0,
          value.backfillTargetHeight - value.backfillScannedHeight,
        );
      };
      return remaining(right) - remaining(left);
    })[0];
  const isRunning = boostingNetworkIds.includes(networkId);
  const isPaused = !isRunning && pausedNetworkIds.includes(networkId);
  // The service already decides this and publishes it; inferring it from
  // "not boosting and not paused" also caught the ordinary background pace,
  // which is not blocked by anything.
  const isHeldByData =
    !isRunning && !isPaused && dataBlockedNetworkIds.includes(networkId);
  // Nothing left to resume means nothing worth reporting.
  if (!isRunning && !entry) {
    return null;
  }
  // Only native can tell metered from not; elsewhere the label would guess.
  const connection = platformEnv.isNative
    ? ` · ${intl.formatMessage({
        id: isCellular
          ? ETranslationsMock.privacy_scan_on_cellular
          : ETranslationsMock.privacy_scan_on_wifi,
      })}`
    : '';
  const pct =
    entry?.backfillProgress === null || entry?.backfillProgress === undefined
      ? ''
      : `${Math.floor(entry.backfillProgress * 100)}% · `;
  const scanned = entry?.backfillScannedHeight;
  const target = entry?.backfillTargetHeight;
  const heights =
    typeof scanned === 'number' && typeof target === 'number'
      ? `${scanned.toLocaleString('en-US')} / ${target.toLocaleString('en-US')}`
      : '';
  // The state is its own line, not something to infer from an icon.
  let stateLabel: string;
  if (isRunning) {
    stateLabel = intl.formatMessage({
      id: ETranslationsMock.privacy_scan_state_scanning,
    });
  } else if (isPaused) {
    stateLabel = intl.formatMessage({
      id: ETranslationsMock.privacy_scan_paused,
    });
  } else {
    stateLabel = intl.formatMessage({
      id: ETranslationsMock.privacy_scan_state_held,
    });
  }
  const detailLine = entry
    ? `${pct}${heights}${connection}`.replace(/^ · /, '')
    : intl.formatMessage({ id: ETranslationsMock.privacy_scan_starting });

  return (
    <Stack
      position="absolute"
      // Narrow: bottom-centre, lifted clear of the bottom tab bar and the home
      // indicator. Wide: top-right, clear of the left sidebar and of a centred
      // modal's action row.
      {...(isNarrow
        ? {
            bottom: safeAreaBottom + EDGE_CLEARANCE,
            left: 0,
            right: 0,
            alignItems: 'center' as const,
            // Side padding so the card below can take a real width instead of
            // shrinking to fit: a `flex: 1` text column inside a shrink-to-fit
            // parent collapses to its minimum content width, which wraps the
            // label mid-word ("Scan / ning") and overlaps the lines under it.
            paddingHorizontal: '$4' as const,
          }
        : { top: EDGE_CLEARANCE, right: '$5' as const })}
      zIndex={FLOAT_NAV_BAR_Z_INDEX}
      // box-none, not none: the overlay spans the window, so swallowing clicks
      // would make the whole app unusable behind it. Only the buttons opt back
      // in -- the text keeps reporting without intercepting.
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
        // Narrow takes the padded width of the overlay; wide stays content-sized
        // beside the sidebar. Both keep the 360 cap.
        {...(isNarrow ? { width: '100%' as const } : null)}
        maxWidth={360}
        elevation={2}
        pointerEvents="box-none"
      >
        <XStack gap="$2.5" alignItems="center" pointerEvents="box-none">
          <Icon
            // Two bars mean stopped. Only the user and the data gate stop it;
            // the background pace is still scanning, just slowly.
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
                  id: ETranslationsMock.privacy_scan_pause_title,
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
                id: ETranslationsMock.privacy_scan_resume,
              })}
            </Button>
          ) : null}
        </XStack>
        {isHeldByData ? (
          <>
            <SizableText size="$bodySm" color="$textSubdued">
              {intl.formatMessage({
                id: ETranslationsMock.privacy_scan_held_desc,
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
                id: ETranslationsMock.privacy_scan_continue,
              })}
            </Button>
          </>
        ) : null}
        {isRunning ? (
          <SizableText size="$bodySm" color="$textCaution">
            {intl.formatMessage({
              id: ETranslationsMock.privacy_scan_extra_power,
            })}
          </SizableText>
        ) : null}
      </YStack>
    </Stack>
  );
}

export const PrivacyChainSyncLight = memo(BasicPrivacyChainSyncLight);
