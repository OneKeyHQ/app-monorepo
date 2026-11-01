import type { ReactNode } from 'react';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';

import { OverlayView } from '@onekeyfe/react-native-native-overlay';
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
import type { IIconProps, IKeyOfIcons } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useIsCellularNetwork } from '@onekeyhq/kit/src/hooks/useIsCellularNetwork';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  formatPrivacyChainSyncDetail,
  formatPrivacyChainSyncError,
  formatPrivacyChainSyncSummary,
  getPrivacyChainNetworkSyncDisplay,
  pickPrivacyChainSummaryFigure,
  pickSlowestPrivacyChainNetwork,
} from '@onekeyhq/kit/src/utils/privacyChainSyncDisplay';
import {
  useDeviceStageAtom,
  usePrivacyChainAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IPrivacyChainScanState } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { FLOAT_NAV_BAR_Z_INDEX } from '@onekeyhq/shared/src/consts/zIndexConsts';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { IOverlayAnimation } from '@onekeyfe/react-native-native-overlay';

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

function PrivacyChainSyncNetwork({
  networkId,
  state,
  isCellular,
  expanded,
  primary = false,
  controls,
  onAllowCellular,
}: {
  networkId: string;
  state: IPrivacyChainScanState;
  isCellular: boolean;
  expanded: boolean;
  primary?: boolean;
  controls?: ReactNode;
  onAllowCellular: () => void;
}) {
  const intl = useIntl();
  const { result: metadata } = usePromiseResult(
    async () => {
      const network = await backgroundApiProxy.serviceNetwork.getNetworkSafe({
        networkId,
      });
      return { networkId, name: network?.name };
    },
    [networkId],
    { checkIsFocused: false },
  );
  const networkName =
    metadata?.networkId === networkId ? metadata.name : undefined;
  // Also read collapsed: whether time left is reliable depends on the regions it declares.
  const { result: settingsResult } = usePromiseResult(
    async () => {
      const settings = await backgroundApiProxy.serviceNetwork.getVaultSettings(
        { networkId },
      );
      return { networkId, localWallet: settings.localWallet };
    },
    [networkId],
    { checkIsFocused: false },
  );
  const localWalletSettings =
    settingsResult?.networkId === networkId
      ? settingsResult.localWallet
      : undefined;
  const {
    status,
    progress: entry,
    labelId,
    isRunning,
    syncError,
  } = getPrivacyChainNetworkSyncDisplay({
    state,
    networkId,
    syncedBelowBlocks: localWalletSettings?.syncedBelowBlocks ?? 1,
  });
  const isSyncing = status === 'syncing';
  const isHeldByData = status === 'waitingWifi';
  const isStopped = status === 'chainPaused' || isHeldByData;
  // A figure follows it here, so not the shared label that ends in an ellipsis.
  const stateLabel = intl.formatMessage({
    id: isSyncing ? ETranslations.privacy_sync_syncing__title : labelId,
  });
  const summaryFigure =
    isSyncing && entry
      ? pickPrivacyChainSummaryFigure({
          progress: entry,
          settings: localWalletSettings,
          now: Date.now(),
        })
      : undefined;
  let syncErrorText: string | undefined;
  if (status === 'storageUnsupported') {
    syncErrorText = intl.formatMessage({
      id: ETranslations.privacy_error_webview_outdated__msg,
    });
  } else {
    syncErrorText = formatPrivacyChainSyncError(syncError, intl);
  }
  const isScanningOnMobileData =
    platformEnv.isNative && isCellular && isRunning;
  const detailLine =
    syncErrorText ??
    formatPrivacyChainSyncDetail({
      progress: entry,
      settings: localWalletSettings,
      stopped: isStopped,
      shownAbove: summaryFigure,
      intl,
    });
  const summaryLabel = syncErrorText
    ? stateLabel
    : formatPrivacyChainSyncSummary({
        label: stateLabel,
        progress: entry,
        figure: summaryFigure,
      });
  let lightIcon: IKeyOfIcons = 'RefreshCcwOutline';
  let lightIconColor: IIconProps['color'] = isRunning
    ? '$iconInfo'
    : '$iconSubdued';
  if (syncErrorText) {
    lightIcon = 'ErrorOutline';
    lightIconColor = '$iconCaution';
  } else if (isStopped) {
    lightIcon = 'PauseOutline';
  }
  return (
    <YStack testID={`privacy-chain-sync-network-${networkId}`} gap="$1">
      <XStack gap="$1.5" alignItems="center">
        <Icon name={lightIcon} size="$4" color={lightIconColor} />
        <SizableText
          size="$bodyXsMedium"
          numberOfLines={1}
          flex={1}
          minWidth={0}
        >
          {[networkName, summaryLabel].filter(Boolean).join(' · ')}
        </SizableText>
        {isScanningOnMobileData ? (
          <Icon
            testID={`privacy-chain-sync-mobile-data-${networkId}`}
            name="SignalOutline"
            size="$4"
            color="$iconSubdued"
          />
        ) : null}
        {controls}
      </XStack>
      {(expanded || syncErrorText) && detailLine ? (
        <SizableText
          testID={
            primary
              ? 'privacy-chain-sync-light-detail'
              : `privacy-chain-sync-light-detail-${networkId}`
          }
          size="$bodyXs"
          color={syncErrorText ? '$textCaution' : '$textSubdued'}
        >
          {detailLine}
        </SizableText>
      ) : null}
      {/* Turns on the same switch as the privacy network settings, so it says the same. */}
      {isHeldByData && expanded ? (
        <Button
          testID={
            primary
              ? 'privacy-chain-sync-light-allow-data-btn'
              : `privacy-chain-sync-light-allow-data-btn-${networkId}`
          }
          size="small"
          variant="primary"
          onPress={onAllowCellular}
        >
          {intl.formatMessage({
            id: ETranslations.privacy_sync_mobile_data__title,
          })}
        </Button>
      ) : null}
    </YStack>
  );
}

function BasicPrivacyChainSyncLight() {
  const [state] = usePrivacyChainAtom();
  const {
    boostingNetworkIds,
    dataBlockedNetworkIds,
    pausedNetworkIds,
    progress,
    storageUnsupportedNetworkIds,
  } = state;
  const intl = useIntl();
  const media = useMedia();
  const { bottom: safeAreaBottom } = useSafeAreaInsets();
  const isCellular = useIsCellularNetwork();
  const [expanded, setExpanded] = useState(false);
  // A paused chain stays here, so its Continue is where its Pause was.
  const activeNetworkIds = useMemo(
    () =>
      uniq([
        ...boostingNetworkIds,
        ...dataBlockedNetworkIds,
        ...pausedNetworkIds,
      ]),
    [boostingNetworkIds, dataBlockedNetworkIds, pausedNetworkIds],
  );
  const activeNetworkKey = activeNetworkIds.join(',');
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
              return [id, settings.localWallet?.syncedBelowBlocks] as const;
            }),
        ),
      ),
    [activeNetworkKey],
    { checkIsFocused: false },
  );
  // A synced chain only follows the tip, so it has nothing to show.
  const visibleNetworkIds = useMemo(
    () =>
      activeNetworkIds.filter(
        (id) =>
          getPrivacyChainNetworkSyncDisplay({
            state,
            networkId: id,
            syncedBelowBlocks: syncedBelowBlocksByNetwork?.[id] ?? 1,
          }).status !== 'synced',
      ),
    [activeNetworkIds, state, syncedBelowBlocksByNetwork],
  );
  const networkId = pickSlowestPrivacyChainNetwork(visibleNetworkIds, progress);
  const otherNetworkIds = useMemo(
    () => visibleNetworkIds.filter((id) => id !== networkId),
    [visibleNetworkIds, networkId],
  );
  const controllableNetworkIds = useMemo(
    () =>
      visibleNetworkIds.filter(
        (id) => !storageUnsupportedNetworkIds.includes(id),
      ),
    [visibleNetworkIds, storageUnsupportedNetworkIds],
  );
  const hasRunningScans = controllableNetworkIds.some((id) =>
    boostingNetworkIds.includes(id),
  );
  const resumableNetworkIds = useMemo(
    () => visibleNetworkIds.filter((id) => pausedNetworkIds.includes(id)),
    [visibleNetworkIds, pausedNetworkIds],
  );
  // Waiting for Wi-Fi or an outdated WebView must not keep the light up either: Pause folds every
  // shown chain that is not paused yet into the Continue bar.
  const pausableNetworkIds = useMemo(
    () => visibleNetworkIds.filter((id) => !pausedNetworkIds.includes(id)),
    [visibleNetworkIds, pausedNetworkIds],
  );

  useEffect(() => {
    if (!networkId) setExpanded(false);
  }, [networkId]);
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
    for (const id of pausableNetworkIds) {
      void backgroundApiProxy.servicePrivacyChain.pauseLocalWalletScan({
        networkId: id,
      });
    }
  }, [pausableNetworkIds]);
  const onResume = useCallback(() => {
    for (const id of resumableNetworkIds) {
      void backgroundApiProxy.servicePrivacyChain.startForegroundBoost({
        networkId: id,
        trigger: 'manual-sync',
      });
    }
  }, [resumableNetworkIds]);
  const onAllowCellular = useCallback(() => {
    void backgroundApiProxy.servicePrivacyChain.setAllowCellularSync({
      allow: true,
    });
  }, []);
  if (!networkId) return null;

  const controls = (
    <>
      {!expanded && otherNetworkIds.length > 0 ? (
        <SizableText size="$bodyXs" color="$textSubdued">
          +{otherNetworkIds.length}
        </SizableText>
      ) : null}
      <IconButton
        testID="privacy-chain-sync-light-details-btn"
        size="small"
        variant="tertiary"
        icon={expanded ? 'ChevronTopSmallOutline' : 'ChevronDownSmallOutline'}
        title={intl.formatMessage({
          id: expanded
            ? ETranslations.global_collapse
            : ETranslations.global_details,
        })}
        onPress={() => setExpanded((value) => !value)}
      />
      {pausableNetworkIds.length ? (
        <IconButton
          testID="privacy-chain-sync-light-pause-btn"
          size="small"
          variant="tertiary"
          icon="PauseOutline"
          title={intl.formatMessage({ id: ETranslations.global_pause })}
          onPress={onPause}
        />
      ) : null}
      {!pausableNetworkIds.length && resumableNetworkIds.length ? (
        <IconButton
          testID="privacy-chain-sync-light-resume-btn"
          size="small"
          variant="tertiary"
          icon="PlayOutline"
          title={intl.formatMessage({ id: ETranslations.global_resume })}
          onPress={onResume}
        />
      ) : null}
    </>
  );
  return (
    <Stack
      position="absolute"
      {...(media.md
        ? {
            bottom: safeAreaBottom + EDGE_CLEARANCE,
            left: 0,
            right: 0,
            alignItems: 'center' as const,
            paddingHorizontal: '$4' as const,
          }
        : { top: EDGE_CLEARANCE, right: '$5' as const })}
      zIndex={FLOAT_NAV_BAR_Z_INDEX}
      pointerEvents="box-none"
    >
      {hasRunningScans ? <KeepScreenAwake /> : null}
      <YStack
        testID="privacy-chain-sync-light"
        gap="$2"
        px="$2.5"
        py="$1.5"
        borderRadius="$3"
        backgroundColor="$bgSubdued"
        borderWidth={1}
        borderColor="$borderSubdued"
        width={expanded ? 300 : 256}
        maxWidth="100%"
        elevation={2}
        pointerEvents="auto"
      >
        <PrivacyChainSyncNetwork
          key={networkId}
          networkId={networkId}
          state={state}
          isCellular={isCellular}
          expanded={expanded}
          primary
          controls={controls}
          onAllowCellular={onAllowCellular}
        />
        {expanded
          ? otherNetworkIds.map((id) => (
              <Stack
                key={id}
                borderTopWidth={1}
                borderColor="$borderSubdued"
                pt="$2"
              >
                <PrivacyChainSyncNetwork
                  networkId={id}
                  state={state}
                  isCellular={isCellular}
                  expanded
                  onAllowCellular={onAllowCellular}
                />
              </Stack>
            ))
          : null}
        {/* The phone stops scanning in the background or when locked. */}
        {expanded && hasRunningScans && platformEnv.isNative ? (
          <SizableText
            testID="privacy-chain-sync-light-keep-open"
            size="$bodyXs"
            color="$textSubdued"
          >
            {intl.formatMessage({
              id: ETranslations.privacy_sync_keep_open__msg,
            })}
          </SizableText>
        ) : null}
      </YStack>
    </Stack>
  );
}

const PrivacyChainSyncLightContent = memo(BasicPrivacyChainSyncLight);

const IOS_HOST_ANIMATION: IOverlayAnimation = { enter: { type: 'none' } };

// iOS lost its full-window container; `hardware` level keeps the light above dialogs and sheets.
// The hardware stage shares that level and mounts first, so the light would
// stack above it: it steps aside while a device stage is up.
function IOSPrivacyChainSyncLight() {
  const [stage] = useDeviceStageAtom();
  const isStageOpen = Boolean(stage && stage.step !== 'off');
  return (
    <OverlayView
      visible={!isStageOpen}
      level="hardware"
      presentation="fullscreen"
      animation={IOS_HOST_ANIMATION}
      blocking={false}
      backdrop={false}
      dismissOnBackPress={false}
      testID="privacy-chain-sync-light-overlay-host"
    >
      <PrivacyChainSyncLightContent />
    </OverlayView>
  );
}

// Elsewhere the stage's overlay level sits above the app tree the light renders in.
export function PrivacyChainSyncLight() {
  if (!platformEnv.isNativeIOS) {
    return <PrivacyChainSyncLightContent />;
  }
  return <IOSPrivacyChainSyncLight />;
}
