import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import type { ReactNode } from 'react';

import { useNavigation } from '@react-navigation/core';
import { isEmpty } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Icon,
  Page,
  ScrollView,
  SizableText,
  Spinner,
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
import thirdPartyDeviceUtils from '@onekeyhq/shared/src/utils/thirdPartyDeviceUtils';
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

import SectionHeader from './SectionHeader';

import type { EFirmwareType } from '@onekeyfe/hd-shared';

export type IDeviceManagementListItem = IHwQrWalletWithDevice & {
  firmwareTypeBadge?: EFirmwareType;
  firmwareVersionDisplay?: string;
  bleName?: string;
  shouldUpdate?: boolean;
  updateVersionDisplay?: string;
  isQrWallet?: boolean;
  deviceType?: IHardwareDeviceType;
  deviceColor?: IHardwareDeviceColor;
};

// Module-level so dedup survives modal close/reopen within a session.
const reportedUnverifiedDeviceIds = new Set<string>();

// Desktop cards share three columns of the 900px page; phones get one.
const DEVICE_GRID_MAX_WIDTH = 900;
const DEVICE_GRID_COLUMN_GAP = 16;
const CARD_WIDTH = {
  mobile: '100%',
  desktop: `calc((100% - ${DEVICE_GRID_COLUMN_GAP * 2}px) / 3)`,
} as const;
// The picture area is a fixed size, so a status change never moves a card.
const ART_AREA_HEIGHT = { desktop: 244, mobile: 184 };
const ART_HEIGHT = { desktop: 160, mobile: 120 };

export type IDeviceCardChip = 'qr' | 'unverified' | 'update';

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

function DeviceCardChip({ chip }: { chip: IDeviceCardChip }) {
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
    // truncated; a long word may sit over the corner of the device.
    <XStack
      position="absolute"
      bottom={8}
      right={8}
      px={6}
      py={2}
      borderRadius="$full"
      borderWidth={1}
      borderColor={colors.border}
      bg={colors.bg}
      testID={`device-card-chip-${chip}`}
    >
      <SizableText size="$bodySm" color={colors.text} numberOfLines={1}>
        {label}
      </SizableText>
    </XStack>
  );
}

function ConnectedDot() {
  return (
    <Stack
      position="absolute"
      top={16}
      left={16}
      w={8}
      h={8}
      borderRadius="$full"
      bg="$brand9"
      borderWidth={1}
      borderColor="$brand10"
      style={{ boxShadow: '0 0 6px 1px rgba(14, 172, 0, 0.45)' }}
    />
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

const SURFACE_BG = {
  idle: '$bgSubdued',
  hover: '$bgHover',
  press: '$bgActive',
} as const;

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
          {isConnected ? <ConnectedDot /> : null}
          {chip ? <DeviceCardChip chip={chip} /> : null}
        </Stack>
      )}
    >
      <YStack p="$4" gap="$1">
        <SizableText size="$bodyMdMedium" color="$text" numberOfLines={1}>
          {item.wallet.name}
        </SizableText>
        {/* Always a second line, so every card keeps the same height. */}
        <SizableText
          size="$bodySm"
          color="$textSubdued"
          numberOfLines={1}
          minHeight={16}
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
        >
          <Icon name="PlusLargeOutline" color="$iconSubdued" />
          <SizableText size="$bodyMd" color="$textSubdued">
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

        const firmwareTypeBadge = vendorProfile.isThirdParty
          ? thirdPartyDeviceUtils.getFirmwareType({
              features: item.device?.featuresInfo,
            })
          : await deviceUtils.getFirmwareType({
              features: item.device?.featuresInfo,
            });
        const deviceVersion = vendorProfile.isThirdParty
          ? thirdPartyDeviceUtils.getDeviceVersion({
              device: item.device,
              features: item.device?.featuresInfo,
            })
          : await deviceUtils.getDeviceVersion({
              device: item.device,
              features: item.device?.featuresInfo,
            });
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
        const shouldUpdate = vendorProfile.firmware.update
          ? deviceDetectStatus?.hasUpgrade
          : false;
        const updateVersionDisplay = vendorProfile.firmware.update
          ? deviceDetectStatus?.toVersion
          : undefined;
        item.firmwareTypeBadge = firmwareTypeBadge;
        const firmwareTypeLabel =
          deviceUtils.getFirmwareTypeLabelByFirmwareType({
            firmwareType: firmwareTypeBadge,
            displayFormat: 'withSpace',
          });
        item.firmwareVersionDisplay = `${firmwareTypeLabel}v${
          deviceVersion.firmwareVersion ?? '-'
        }`;
        item.shouldUpdate = shouldUpdate;
        item.updateVersionDisplay =
          updateVersionDisplay && !isEmpty(updateVersionDisplay)
            ? `v${updateVersionDisplay}`
            : undefined;
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

  const showHeader = existingDevices || isLoading;

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
    <Page fullPage safeAreaEnabled={gtMd || showHeader}>
      {renderHeader()}
      <Page.Body
        alignItems="stretch"
        $gtMd={{
          overflow: 'hidden',
          borderTopLeftRadius: '$4',
          borderTopRightRadius: '$4',
        }}
      >
        {showHeader ? (
          <Page.Container flex={1} padded={false}>
            <ScrollView flex={1} bg="$bgApp">
              <YStack
                px="$pagePadding"
                pt="$2"
                pb="$8"
                $gtMd={{
                  pt: platformEnv.isExtensionUiSidePanel ? '$2' : '$16',
                  pb: '$16',
                }}
              >
                <YStack
                  w="100%"
                  maxWidth={DEVICE_GRID_MAX_WIDTH}
                  alignSelf="center"
                  gap="$6"
                >
                  <SectionHeader />
                  {existingDevices ? (
                    <XStack
                      flexWrap="wrap"
                      columnGap={DEVICE_GRID_COLUMN_GAP}
                      rowGap="$6"
                    >
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
                    </XStack>
                  ) : (
                    <Stack p="$16">
                      <Spinner size="large" />
                    </Stack>
                  )}
                </YStack>
              </YStack>
            </ScrollView>
          </Page.Container>
        ) : null}
        {!existingDevices && !isLoading ? <DeviceGuideView /> : null}
      </Page.Body>
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
