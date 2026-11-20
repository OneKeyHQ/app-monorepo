import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import {
  Icon,
  Page,
  SizableText,
  Stack,
  XStack,
  YStack,
  useMedia,
  useTheme,
} from '@onekeyhq/components';
import type { IHardwareDeviceType } from '@onekeyhq/components/src/content/HardwareDevice';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { useHardwareWalletConnectStatus } from '@onekeyhq/kit/src/hooks/useHardwareWalletConnectStatus';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';
import { getDeviceManagementWallets } from '@onekeyhq/kit/src/states/jotai/contexts/deviceDetails/deviceStateManagement';
import { useNavigateToPickYourDevicePage } from '@onekeyhq/kit/src/views/Onboarding/hooks/useToOnBoardingPage';
import { useFirmwareUpdatesDetectStatusPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { getVendorProfile } from '@onekeyhq/shared/src/hardware/config/vendorProfile';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
import { getHardwareDeviceColor } from '@onekeyhq/shared/src/utils/hardwareDeviceColors';
import type { IHardwareDeviceColor } from '@onekeyhq/shared/src/utils/hardwareDeviceColors';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IHwQrWalletWithDevice } from '@onekeyhq/shared/types/account';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import { selectFirmwareUpdateDetectStatus } from '../../../FirmwareUpdate/utils';
import { useDeviceManagerNavigation } from '../../hooks/useDeviceManagerNavigation';
import { DeviceManagementTestIDs } from '../../testIDs';
import { DeviceArt } from '../DeviceArt';
import { DeviceCommonHeader } from '../DeviceCommonHeader';
import { canOpenDeviceManagementDetails } from '../DeviceDetailsModal/utils';
import { DeviceGuideView } from '../DeviceGuideModal/DeviceGuideView';
import { FadeView } from '../FadeView';

import {
  ART_AREA_HEIGHT,
  ART_HEIGHT,
  CARD_TEXT,
  CARD_WIDTH,
  DeviceListGrid,
  DeviceListPageBody,
  DeviceListPlaceholder,
  SURFACE_BG,
  useDeviceListPlaceholderDelay,
} from './DeviceListFrame';

import type { EFirmwareType } from '@onekeyfe/hd-shared';

export type IDeviceManagementListItem = IHwQrWalletWithDevice & {
  // Set by the wallet menu's device list, which shares this shape.
  firmwareTypeBadge?: EFirmwareType;
  bleName?: string;
  shouldUpdate?: boolean;
  isQrWallet?: boolean;
  deviceType?: IHardwareDeviceType;
  deviceColor?: IHardwareDeviceColor;
};

// Module-level so dedup survives modal close/reopen within a session.
const reportedUnverifiedDeviceIds = new Set<string>();

// Hover and press tint only the background, eased by CSS on the web; native
// switches it at once.
const BG_TRANSITION = platformEnv.isNative
  ? undefined
  : { transition: 'background-color 150ms ease-out' };

const CHIP_POSITION = { position: 'absolute', bottom: 8, right: 8 } as const;

const DOT_SIZE = 8;
const DOT_POSITION = {
  position: 'absolute',
  top: 16,
  left: 16,
  width: DOT_SIZE,
  height: DOT_SIZE,
  pointerEvents: 'none',
} as const;
const RING_POSITION = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: DOT_SIZE,
  height: DOT_SIZE,
} as const;
// The glow is the dot's own green, which is brighter in dark mode.
const DOT_GLOW = {
  light: { boxShadow: '0 0 6px 1px rgba(14, 172, 0, 0.45)' },
  dark: { boxShadow: '0 0 6px 1px rgba(55, 255, 53, 0.45)' },
} as const;
const DOT_FADE = { duration: 200, easing: Easing.out(Easing.cubic) };
const RING_OUT = { duration: 450, easing: Easing.out(Easing.cubic) };

type IDeviceCardChip = 'qr' | 'unverified' | 'update';

// One label at most. A QR wallet is never verified or updated from here, and
// an unverified device is the more urgent of the two.
export function getDeviceCardChip({
  item,
  isThirdParty,
}: {
  item: IDeviceManagementListItem;
  isThirdParty: boolean;
}): IDeviceCardChip | undefined {
  if (item.isQrWallet) return 'qr';
  if (!isThirdParty && item.device && !item.device.verifiedAtVersion) {
    return 'unverified';
  }
  if (item.shouldUpdate) return 'update';
  return undefined;
}

const CHIP_COLORS = {
  qr: { bg: '$bgSubdued', border: '$borderSubdued', text: '$textSubdued' },
  unverified: {
    bg: '$bgCriticalSubdued',
    border: '$borderCriticalSubdued',
    text: '$textCritical',
  },
  update: {
    bg: '$bgInfoSubdued',
    border: '$borderInfoSubdued',
    text: '$textInfo',
  },
} as const;

function DeviceCardChip({
  chip,
  visible,
  fadeInOnMount,
}: {
  chip: IDeviceCardChip;
  visible: boolean;
  // Read once: a label that was there when the page opened just sits there.
  fadeInOnMount: boolean;
}) {
  const intl = useIntl();
  const colors = CHIP_COLORS[chip];
  let label = 'QR';
  if (chip === 'unverified') {
    label = intl.formatMessage({ id: ETranslations.global_unverified });
  } else if (chip === 'update') {
    label = intl.formatMessage({ id: ETranslations.global_update });
  }
  return (
    // A label, not a button: the whole card opens the device. Never
    // truncated; a long word may sit over the corner of the device. Leaving,
    // it stays mounted and fades out.
    <FadeView
      shown={visible}
      fadeInOnMount={fadeInOnMount}
      style={CHIP_POSITION}
    >
      {/* The tints are translucent: an opaque base keeps the label's
          contrast over the picture area, which darkens on hover and press. */}
      <XStack bg="$bgApp" borderRadius="$full">
        <XStack
          px={6}
          py={2}
          borderRadius="$full"
          borderWidth={1}
          borderColor={colors.border}
          bg={colors.bg}
          testID={`device-card-chip-${chip}`}
          aria-hidden={!visible}
        >
          <SizableText size="$bodySm" color={colors.text} numberOfLines={1}>
            {label}
          </SizableText>
        </XStack>
      </XStack>
    </FadeView>
  );
}

function ConnectedDot({
  connected,
  animated,
}: {
  connected: boolean;
  animated: boolean;
}) {
  const themeVariant = useThemeVariant();
  // Always mounted, so connecting and disconnecting are transitions of one
  // element; the state the page opened with renders without motion.
  const lit = useSharedValue(connected ? 1 : 0);
  // The glow ring: 1 once it has rung out.
  const ring = useSharedValue(1);
  const connectedBeforeRef = useRef(connected);
  useEffect(() => {
    if (connected === connectedBeforeRef.current) return;
    connectedBeforeRef.current = connected;
    const target = connected ? 1 : 0;
    lit.value = animated ? withTiming(target, DOT_FADE) : target;
    // Each connection made while the page is open rings the glow once.
    if (connected && animated) {
      ring.value = 0;
      ring.value = withTiming(1, RING_OUT);
    }
  }, [animated, connected, lit, ring]);
  const dotStyle = useAnimatedStyle(() => ({
    opacity: lit.value,
    transform: [{ scale: 0.6 + 0.4 * lit.value }],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: 0.5 * (1 - ring.value),
    transform: [{ scale: 1 + 1.6 * ring.value }],
  }));
  return (
    <Animated.View style={[DOT_POSITION, dotStyle]} aria-hidden>
      <Animated.View style={[RING_POSITION, ringStyle]}>
        <Stack w={DOT_SIZE} h={DOT_SIZE} borderRadius="$full" bg="$brand9" />
      </Animated.View>
      <Stack
        w={DOT_SIZE}
        h={DOT_SIZE}
        borderRadius="$full"
        bg="$brand9"
        borderWidth={1}
        borderColor="$brand10"
        style={DOT_GLOW[themeVariant === 'dark' ? 'dark' : 'light']}
      />
    </Animated.View>
  );
}

// The whole card is one target: hover and press tint the picture area.
function CardPressable({
  onPress,
  testID,
  children,
  w,
  renderSurface,
}: {
  onPress?: () => void;
  testID?: string;
  children?: ReactNode;
  w: typeof CARD_WIDTH;
  renderSurface?: (state: 'idle' | 'hover' | 'press') => ReactNode;
}) {
  const [state, setState] = useState<'idle' | 'hover' | 'press'>('idle');
  const interactive = Boolean(onPress);
  return (
    <YStack
      w={w.mobile}
      $gtMd={{ w: w.desktop }}
      testID={testID}
      {...(interactive
        ? {
            role: 'button' as const,
            tabIndex: 0,
            onPress,
            onHoverIn: () => setState('hover'),
            onHoverOut: () => setState('idle'),
            // Native waits a beat before tinting, as the app's list rows do,
            // so a scroll that starts on a card doesn't flash it.
            delayPressIn: platformEnv.isNative ? 50 : undefined,
            onPressIn: () => setState('press'),
            onPressOut: () => setState('idle'),
            onKeyDown: (e: { key: string; preventDefault: () => void }) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onPress?.();
              }
            },
            focusVisibleStyle: {
              outlineWidth: 2,
              outlineStyle: 'solid',
              outlineColor: '$focusRing',
              outlineOffset: 2,
              borderRadius: '$4',
            },
          }
        : null)}
      // Keep each card its own height; the add card is shorter than a
      // device card and would otherwise stretch to the row.
      alignSelf="flex-start"
      cursor="default"
      userSelect="none"
    >
      {renderSurface?.(interactive ? state : 'idle')}
      {children}
    </YStack>
  );
}

// Exported for tests.
export function DeviceCard({
  item,
  onPress,
  isConnected,
}: {
  item: IDeviceManagementListItem;
  onPress: (item: IDeviceManagementListItem) => void;
  isConnected: boolean;
}) {
  const { gtMd } = useMedia();
  const vendorProfile = getVendorProfile(
    item.device?.vendor ?? EHardwareVendor.onekey,
  );
  const isThirdParty = vendorProfile.isThirdParty;
  const canOpenDetails = canOpenDeviceManagementDetails(item.device?.vendor);
  const isVerified = Boolean(item.device?.verifiedAtVersion);

  // Diagnostic: snapshot unverified devices once per session, comparing UI vs fresh DB.
  useEffect(() => {
    const dbDevice = item.device;
    if (item.isQrWallet || !dbDevice || isVerified) return;
    if (reportedUnverifiedDeviceIds.has(dbDevice.id)) return;
    reportedUnverifiedDeviceIds.add(dbDevice.id);

    const uiRaw = JSON.stringify(dbDevice.verifiedAtVersion) ?? 'undefined';

    void (async () => {
      let freshDbFound: boolean | undefined;
      let freshRaw: string | undefined;
      try {
        const fresh = await backgroundApiProxy.serviceAccount.getDevice({
          dbDeviceId: dbDevice.id,
        });
        freshDbFound = Boolean(fresh);
        if (fresh) {
          freshRaw = JSON.stringify(fresh.verifiedAtVersion);
        }
      } catch {
        // freshDbFound stays undefined → read error
      }

      // Bypass usePromiseResult cache by re-issuing the same service call.
      let requeryServiceFound: boolean | undefined;
      let requeryMatchCount: number | undefined;
      let requeryWalletId: string | undefined;
      let requeryRaw: string | undefined;
      try {
        const requery =
          await backgroundApiProxy.serviceAccount.getAllHwQrWalletWithDevice({
            filterHiddenWallet: true,
            skipDuplicateDeviceSameType: true,
          });
        const matches = Object.values(requery).filter(
          (entry) => entry.device?.id === dbDevice.id,
        );
        requeryMatchCount = matches.length;
        const match = matches[0];
        requeryServiceFound = Boolean(match?.device);
        if (match?.device) {
          requeryWalletId = match.wallet.id;
          requeryRaw = JSON.stringify(match.device.verifiedAtVersion);
        }
      } catch {
        // requeryServiceFound stays undefined → read error
      }

      try {
        defaultLogger.hardware.verify.deviceUnverifiedDetected({
          dbDeviceId: dbDevice.id,
          deviceId: dbDevice.deviceId,
          uiWalletId: item.wallet.id,
          uiVerifiedAtVersion: uiRaw,
          freshDbFound,
          freshDbVerifiedAtVersion: freshRaw,
          requeryServiceFound,
          requeryServiceMatchCount: requeryMatchCount,
          requeryServiceWalletId: requeryWalletId,
          requeryServiceVerifiedAtVersion: requeryRaw,
          mismatch: freshRaw !== undefined && freshRaw !== uiRaw,
          createdAt: dbDevice.createdAt,
          updatedAt: dbDevice.updatedAt,
          connectId: dbDevice.connectId,
        });
      } catch {
        // never affect rendering
      }
    })();
  }, [isVerified, item.device, item.isQrWallet, item.wallet.id]);

  const bleName = deviceUtils.buildDeviceBleName({
    features: item.device?.featuresInfo,
  });
  const chip = getDeviceCardChip({ item, isThirdParty });
  const size = gtMd ? 'desktop' : 'mobile';
  const reducedMotion = useReducedMotion();
  // True after the first render: a label appearing from then on changed
  // while the page was open.
  const openedRef = useRef(false);
  useEffect(() => {
    openedRef.current = true;
  }, []);
  // Keep the last label on screen while it fades out.
  const lastChipRef = useRef(chip);
  if (chip) lastChipRef.current = chip;
  const shownChip = chip ?? lastChipRef.current;

  return (
    <CardPressable
      w={CARD_WIDTH}
      testID={DeviceManagementTestIDs.deviceListItem}
      onPress={canOpenDetails ? () => onPress(item) : undefined}
      renderSurface={(state) => (
        <Stack
          h={ART_AREA_HEIGHT[size]}
          bg={SURFACE_BG[state]}
          borderRadius="$4"
          ai="center"
          jc="center"
          overflow="hidden"
          style={reducedMotion ? undefined : BG_TRANSITION}
          testID={
            isConnected
              ? DeviceManagementTestIDs.deviceStatusConnected
              : DeviceManagementTestIDs.deviceStatusDisconnected
          }
        >
          <DeviceArt
            deviceType={item.deviceType}
            color={item.deviceColor}
            wallet={item.wallet}
            height={ART_HEIGHT[size]}
          />
          <ConnectedDot connected={isConnected} animated={!reducedMotion} />
          {shownChip ? (
            <DeviceCardChip
              key={shownChip}
              chip={shownChip}
              visible={Boolean(chip)}
              fadeInOnMount={openedRef.current}
            />
          ) : null}
        </Stack>
      )}
    >
      <YStack p="$4" gap="$1">
        <SizableText size={CARD_TEXT.name} color="$text" numberOfLines={1}>
          {item.wallet.name}
        </SizableText>
        {/* Always a second line, so every card keeps the same height. */}
        <SizableText
          size={CARD_TEXT.detail}
          color="$textSubdued"
          numberOfLines={1}
          minHeight={CARD_TEXT.detailHeight}
        >
          {bleName}
        </SizableText>
      </YStack>
    </CardPressable>
  );
}

function AddDeviceCard({ onPress }: { onPress: () => void }) {
  const intl = useIntl();
  const { gtMd } = useMedia();
  const reducedMotion = useReducedMotion();
  return (
    <CardPressable
      w={CARD_WIDTH}
      testID={DeviceManagementTestIDs.addNewDeviceBtn}
      onPress={onPress}
      renderSurface={(state) => (
        <YStack
          h={ART_AREA_HEIGHT[gtMd ? 'desktop' : 'mobile']}
          borderRadius="$4"
          borderWidth={1}
          borderStyle="dashed"
          borderColor="$border"
          bg={state === 'idle' ? undefined : SURFACE_BG[state]}
          ai="center"
          jc="center"
          gap="$2"
          style={reducedMotion ? undefined : BG_TRANSITION}
        >
          <Icon name="PlusLargeOutline" color="$iconSubdued" />
          <SizableText
            size={platformEnv.isNative ? '$bodyLg' : '$bodyMd'}
            color="$textSubdued"
          >
            {intl.formatMessage({
              id: ETranslations.device_management_add_device__action,
            })}
          </SizableText>
        </YStack>
      )}
    />
  );
}

function DeviceManagementV2ListWeb() {
  const intl = useIntl();
  const navigation = useNavigation();
  const { gtMd } = useMedia();
  const theme = useTheme();
  const { pushToDeviceDetail } = useDeviceManagerNavigation();
  const toOnBoardingPage = useNavigateToPickYourDevicePage();

  const placeholderDelay = useDeviceListPlaceholderDelay();
  const [detectStatus] = useFirmwareUpdatesDetectStatusPersistAtom();
  const { connectedDevices } = useHardwareWalletConnectStatus();

  const {
    result: hwQrWalletList = [],
    run: refreshHwQrWalletList,
    isLoading,
  } = usePromiseResult<Array<IDeviceManagementListItem>>(
    async () => {
      const r =
        await backgroundApiProxy.serviceAccount.getAllHwQrWalletWithDevice({
          filterHiddenWallet: true,
        });
      const devices: Array<IDeviceManagementListItem> =
        getDeviceManagementWallets(Object.values(r)).toSorted((a, b) => {
          const orderA = a.wallet.walletOrder || a.wallet.walletNo;
          const orderB = b.wallet.walletOrder || b.wallet.walletNo;
          return orderA - orderB;
        });
      const firmwareUpdateConnectIds = devices.flatMap((item) => {
        const vendorProfile = getVendorProfile(
          item.device?.vendor ?? EHardwareVendor.onekey,
        );
        return vendorProfile.firmware.update && item.device?.connectId
          ? [item.device.connectId]
          : [];
      });
      const detectStatusSnapshots = firmwareUpdateConnectIds.length
        ? await backgroundApiProxy.serviceFirmwareUpdate.getFirmwareUpdateDetectStatuses(
            { connectIds: firmwareUpdateConnectIds },
          )
        : {};

      for (const item of devices) {
        item.isQrWallet = accountUtils.isQrWallet({
          walletId: item.wallet.id,
        });

        const vendorProfile = getVendorProfile(
          item.device?.vendor ?? EHardwareVendor.onekey,
        );
        if (item.device) {
          // Same source as the details page; the stored type covers devices
          // whose features were never read.
          const deviceType =
            !vendorProfile.isThirdParty && item.device.featuresInfo
              ? await deviceUtils.getDeviceTypeFromFeatures({
                  features: item.device.featuresInfo,
                })
              : item.device.deviceType;
          item.deviceType = deviceType as IHardwareDeviceType | undefined;
          item.deviceColor = getHardwareDeviceColor({
            deviceType,
            serialNo: item.device.uuid,
          });
        }
        if (!vendorProfile.firmware.showVersion) {
          // eslint-disable-next-line no-continue
          continue;
        }

        const deviceConnectId = item.device?.connectId;
        const detectStatusSnapshot =
          vendorProfile.firmware.update && deviceConnectId
            ? detectStatusSnapshots[deviceConnectId]
            : undefined;
        const deviceDetectStatus = deviceConnectId
          ? selectFirmwareUpdateDetectStatus({
              connectId: deviceConnectId,
              persistedStatus: detectStatus,
              snapshot: detectStatusSnapshot,
            })
          : undefined;
        item.shouldUpdate = vendorProfile.firmware.update
          ? deviceDetectStatus?.hasUpgrade
          : false;
      }

      return devices;
    },
    [detectStatus],
    {
      revalidateOnFocus: true,
      initResult: [],
      watchLoading: true,
    },
  );

  const walletConnectionMap = useMemo(() => {
    const map = new Map<string, boolean>();
    hwQrWalletList.forEach((wallet) => {
      const isQrWallet = accountUtils.isQrWallet({
        walletId: wallet.wallet.id,
      });
      if (isQrWallet) {
        map.set(wallet.wallet.id, false);
        return false;
      }

      const deviceId = wallet.wallet.associatedDeviceInfo?.deviceId;
      const isConnected = deviceId ? connectedDevices.has(deviceId) : false;
      map.set(wallet.wallet.id, isConnected);
    });
    return map;
  }, [hwQrWalletList, connectedDevices]);

  useEffect(() => {
    const refreshWallets = () => {
      void refreshHwQrWalletList({ alwaysSetState: true });
    };
    const refreshFirmwareStatus = () => {
      void refreshHwQrWalletList();
    };
    appEventBus.on(EAppEventBusNames.WalletUpdate, refreshWallets);
    appEventBus.on(
      EAppEventBusNames.FirmwareUpdateDetectStatusChanged,
      refreshFirmwareStatus,
    );
    return () => {
      appEventBus.off(EAppEventBusNames.WalletUpdate, refreshWallets);
      appEventBus.off(
        EAppEventBusNames.FirmwareUpdateDetectStatusChanged,
        refreshFirmwareStatus,
      );
    };
  }, [refreshHwQrWalletList]);

  const onWalletPressed = useCallback(
    (item: IDeviceManagementListItem) => {
      if (item.wallet.id) {
        pushToDeviceDetail({
          walletId: item.wallet.id,
          initialDeviceVendor: item.device?.vendor,
        });
      }
    },
    [pushToDeviceDetail],
  );

  const onAddDevice = useCallback(() => {
    void toOnBoardingPage();
  }, [toOnBoardingPage]);

  const existingDevices = hwQrWalletList.length > 0;
  // The page holds its loading shape until the first load finishes: the
  // hook's first render reports neither loading nor loaded, and a refocus
  // reload must not swap the empty-list guide for the grid and back.
  const loadedOnceRef = useRef(false);
  if (isLoading === false || existingDevices) {
    loadedOnceRef.current = true;
  }
  const loadedOnce = loadedOnceRef.current;
  const showHeader = existingDevices || !loadedOnce;

  // Only apply transparent header on mobile when showing DeviceGuideView
  useLayoutEffect(() => {
    if (!gtMd) {
      navigation.setOptions({
        headerTransparent: !showHeader,
        headerStyle: {
          backgroundColor: !showHeader ? 'transparent' : theme.bgApp.val,
        },
        title: showHeader
          ? intl.formatMessage({
              id: ETranslations.global_device_management,
            })
          : '',
      });
    }
  }, [navigation, showHeader, gtMd, theme.bgApp.val, intl]);

  const renderHeader = () => {
    // Desktop: always show header
    // Mobile: only show header when has devices or loading
    if (gtMd || showHeader) {
      return (
        <DeviceCommonHeader
          title={intl.formatMessage({
            id: ETranslations.global_device_management,
          })}
        />
      );
    }
    return null;
  };

  return (
    // Native lists run to the bottom edge; the scroll padding clears the home
    // indicator.
    <Page
      fullPage
      safeAreaEnabled={!platformEnv.isNative && (gtMd || showHeader)}
    >
      {renderHeader()}
      <DeviceListPageBody>
        {showHeader ? (
          <DeviceListGrid>
            {existingDevices ? (
              <>
                {hwQrWalletList.map((item) => (
                  <DeviceCard
                    key={item.wallet.id}
                    item={item}
                    onPress={onWalletPressed}
                    isConnected={
                      walletConnectionMap.get(item.wallet.id) ?? false
                    }
                  />
                ))}
                {/* Adding a device is the last card in the grid. */}
                <AddDeviceCard onPress={onAddDevice} />
              </>
            ) : (
              <DeviceListPlaceholder delay={placeholderDelay} />
            )}
          </DeviceListGrid>
        ) : null}
        {loadedOnce && !existingDevices ? <DeviceGuideView /> : null}
      </DeviceListPageBody>
    </Page>
  );
}

function DeviceManagementListPageContainer() {
  const sceneName = EAccountSelectorSceneName.home;
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <DeviceManagementV2ListWeb />
    </AccountSelectorProviderMirror>
  );
}

export default DeviceManagementListPageContainer;
