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
  formatPrivacyChainPercent,
  formatPrivacyChainSyncError,
  formatPrivacyChainSyncProgress,
  getPrivacyChainNetworkSyncDisplay,
  getPrivacyChainScanRegionLabelId,
  pickSlowestPrivacyChainNetwork,
} from '@onekeyhq/kit/src/utils/privacyChainSyncDisplay';
import { usePrivacyChainAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
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
  const { result: regionHints } = usePromiseResult(
    async () => {
      if (!expanded) return undefined;
      const settings = await backgroundApiProxy.serviceNetwork.getVaultSettings(
        { networkId },
      );
      return { networkId, hints: settings.localWallet?.scanRegionHints };
    },
    [networkId, expanded],
    { checkIsFocused: false },
  );
  const scanRegionHints =
    regionHints?.networkId === networkId ? regionHints.hints : undefined;
  const {
    entry,
    labelId,
    isStorageUnsupported,
    isRunning,
    isPaused,
    isHeldByData,
    syncError,
  } = getPrivacyChainNetworkSyncDisplay({ state, networkId });
  const stateLabel = intl.formatMessage({ id: labelId });
  let syncErrorText: string | undefined;
  if (isStorageUnsupported) {
    syncErrorText = intl.formatMessage({
      id: ETranslations.privacy_error_webview_outdated__msg,
    });
  } else {
    syncErrorText = formatPrivacyChainSyncError(syncError, intl);
  }
  const regionLabelId = getPrivacyChainScanRegionLabelId(
    scanRegionHints,
    entry?.backfillScannedHeight,
  );
  const connection =
    platformEnv.isNative && isCellular
      ? intl.formatMessage({
          id: ETranslations.privacy_sync_on_mobile_data__msg,
        })
      : '';
  const detailLine =
    syncErrorText ??
    (entry
      ? [
          formatPrivacyChainSyncProgress({
            scanned: entry.backfillScannedHeight,
            target: entry.backfillTargetHeight,
            progress: entry.backfillProgress,
          }),
          regionLabelId ? intl.formatMessage({ id: regionLabelId }) : '',
          connection,
        ]
          .filter(Boolean)
          .join(' · ')
      : connection);
  const summaryLabel =
    entry &&
    isRunning &&
    !syncErrorText &&
    typeof entry.backfillProgress === 'number' &&
    Number.isFinite(entry.backfillProgress)
      ? `${stateLabel} ${formatPrivacyChainPercent(entry.backfillProgress)}`
      : stateLabel;
  let lightIcon: IKeyOfIcons = 'RefreshCcwOutline';
  let lightIconColor: IIconProps['color'] = isRunning
    ? '$iconInfo'
    : '$iconSubdued';
  if (syncErrorText) {
    lightIcon = 'ErrorOutline';
    lightIconColor = '$iconCaution';
  } else if (isPaused || isHeldByData) {
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
      {isHeldByData ? (
        <>
          <SizableText size="$bodySm" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.privacy_sync_mobile_data__desc,
            })}
          </SizableText>
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
              id: ETranslations.privacy_sync_always_allow__action,
            })}
          </Button>
        </>
      ) : null}
    </YStack>
  );
}

function BasicPrivacyChainSyncLight() {
  const [state] = usePrivacyChainAtom();
  const {
    boostingNetworkIds,
    dataBlockedNetworkIds,
    progress,
    storageUnsupportedNetworkIds,
  } = state;
  const intl = useIntl();
  const media = useMedia();
  const { bottom: safeAreaBottom } = useSafeAreaInsets();
  const isCellular = useIsCellularNetwork();
  const [expanded, setExpanded] = useState(false);
  // Paused by this light and not yet stopped by the service: already hidden.
  const [closingNetworkIds, setClosingNetworkIds] = useState<string[]>([]);
  const activeNetworkIds = useMemo(
    () => uniq([...boostingNetworkIds, ...dataBlockedNetworkIds]),
    [boostingNetworkIds, dataBlockedNetworkIds],
  );
  // A chain that has caught up only follows the tip; it shows only to report a wait or an error.
  const visibleNetworkIds = useMemo(
    () =>
      activeNetworkIds.filter((id) => {
        if (closingNetworkIds.includes(id)) return false;
        const display = getPrivacyChainNetworkSyncDisplay({
          state,
          networkId: id,
        });
        return (
          !display.isCaughtUp ||
          display.isStorageUnsupported ||
          display.isHeldByData ||
          display.syncError !== undefined
        );
      }),
    [activeNetworkIds, closingNetworkIds, state],
  );
  useEffect(() => {
    setClosingNetworkIds((ids) => {
      const next = ids.filter((id) => activeNetworkIds.includes(id));
      return next.length === ids.length ? ids : next;
    });
  }, [activeNetworkIds]);
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
    setClosingNetworkIds((ids) => uniq([...ids, ...controllableNetworkIds]));
    for (const id of controllableNetworkIds) {
      void backgroundApiProxy.servicePrivacyChain
        .pauseLocalWalletScan({ networkId: id })
        .catch(() =>
          setClosingNetworkIds((ids) => ids.filter((value) => value !== id)),
        );
    }
  }, [controllableNetworkIds]);
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
      {hasRunningScans ? (
        <IconButton
          testID="privacy-chain-sync-light-pause-btn"
          size="small"
          variant="tertiary"
          icon="PauseOutline"
          title={intl.formatMessage({ id: ETranslations.global_pause })}
          onPress={onPause}
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
      </YStack>
    </Stack>
  );
}

const PrivacyChainSyncLightContent = memo(BasicPrivacyChainSyncLight);

const IOS_HOST_ANIMATION: IOverlayAnimation = { enter: { type: 'none' } };

// iOS lost its full-window container; `hardware` level keeps the light above dialogs and sheets.
export function PrivacyChainSyncLight() {
  if (!platformEnv.isNativeIOS) {
    return <PrivacyChainSyncLightContent />;
  }
  return (
    <OverlayView
      visible
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
