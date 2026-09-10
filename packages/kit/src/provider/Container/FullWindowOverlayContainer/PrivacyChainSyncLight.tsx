import { memo, useCallback, useEffect } from 'react';

import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

import {
  Button,
  Icon,
  IconButton,
  SizableText,
  Stack,
  XStack,
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
  const [{ boostingNetworkIds, dataBlockedNetworkIds, progress }] =
    usePrivacyChainAtom();
  // Anchored opposite the toasts, which sit top-center when narrow and
  // bottom-right when wide (components/actions/Toast/Toaster.tsx). A toast is
  // transient and fires at any moment; this light is persistent, so sharing an
  // anchor would mean a toast eventually lands on top of the one control that
  // stops the battery drain. Narrow also keeps the top clear for the page
  // header and balance, and puts the buttons in thumb reach.
  const media = useMedia();
  const { bottom: safeAreaBottom } = useSafeAreaInsets();
  const isCellular = useIsCellularNetwork();
  const isNarrow = media.md;

  const boostingNetworkId = boostingNetworkIds[0];
  const blockedNetworkId = dataBlockedNetworkIds[0];
  const networkId = boostingNetworkId ?? blockedNetworkId;

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
    void backgroundApiProxy.servicePrivacyChain.pauseForegroundBoost({
      networkId,
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
  const isRunning = Boolean(boostingNetworkId);
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
          }
        : { top: EDGE_CLEARANCE, right: '$5' as const })}
      zIndex={FLOAT_NAV_BAR_Z_INDEX}
      // box-none, not none: the overlay spans the window, so swallowing clicks
      // would make the whole app unusable behind it. Only the buttons opt back
      // in -- the text keeps reporting without intercepting.
      pointerEvents="box-none"
    >
      <XStack
        gap="$2"
        alignItems="center"
        paddingLeft="$3"
        paddingRight="$1.5"
        paddingVertical="$1.5"
        borderRadius="$full"
        backgroundColor="$bgSubdued"
        borderWidth={1}
        borderColor="$borderSubdued"
        opacity={0.92}
        pointerEvents="box-none"
      >
        {isRunning ? (
          <>
            <KeepScreenAwake />
            <Icon name="RefreshCcwOutline" size="$4" color="$iconSubdued" />
            <SizableText size="$bodySmMedium" color="$textSubdued">
              {entry ? `Syncing ${pct}${heights}` : 'Starting sync…'}
            </SizableText>
            <SizableText size="$bodySm" color="$textCaution">
              Using extra power
            </SizableText>
            {/* Stops the extra power, not the sync -- the chain keeps
                catching up at the background pace. The title says so: a
                "pause" that silently stopped syncing would be a much bigger
                promise than this button makes. */}
            <IconButton
              testID="privacy-chain-sync-light-pause-btn"
              size="small"
              variant="tertiary"
              icon="PauseOutline"
              title="Stop fast sync (keeps syncing slowly)"
              onPress={onPause}
              pointerEvents="auto"
            />
          </>
        ) : (
          <>
            <Icon name="LockOutline" size="$4" color="$iconCaution" />
            <SizableText size="$bodySmMedium" color="$textSubdued">
              {entry
                ? `Paused on mobile data · ${pct}${heights}`
                : 'Waiting for mobile data permission'}
            </SizableText>
            <Button
              testID="privacy-chain-sync-light-allow-data-btn"
              size="small"
              variant="primary"
              onPress={onAllowCellular}
              pointerEvents="auto"
            >
              Continue
            </Button>
          </>
        )}
      </XStack>
    </Stack>
  );
}

export const PrivacyChainSyncLight = memo(BasicPrivacyChainSyncLight);
