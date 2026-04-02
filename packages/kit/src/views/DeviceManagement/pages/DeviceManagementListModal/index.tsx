import { useCallback, useEffect, useLayoutEffect, useMemo } from 'react';

import { useNavigation } from '@react-navigation/core';
import { isEmpty } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Badge,
  Divider,
  Icon,
  ListView,
  Page,
  SizableText,
  Spinner,
  Stack,
  XStack,
  YStack,
  useMedia,
  useTheme,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import type { IWalletAvatarProps } from '@onekeyhq/kit/src/components/WalletAvatar';
import { WalletAvatar } from '@onekeyhq/kit/src/components/WalletAvatar';
import { useHardwareWalletConnectStatus } from '@onekeyhq/kit/src/hooks/useHardwareWalletConnectStatus';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useNavigateToPickYourDevicePage } from '@onekeyhq/kit/src/views/Onboarding/hooks/useToOnBoardingPage';
import { useFirmwareUpdatesDetectStatusPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IHwQrWalletWithDevice } from '@onekeyhq/shared/types/account';

import { useDeviceManagerNavigation } from '../../hooks/useDeviceManagerNavigation';
import { DeviceCommonHeader } from '../DeviceCommonHeader';
import { DeviceGuideView } from '../DeviceGuideModal/DeviceGuideView';

import SectionHeader from './SectionHeader';
import { VerifiedBadge } from './VerifiedBadge';

import type { EFirmwareType } from '@onekeyfe/hd-shared';

export type IDeviceManagementListItem = IHwQrWalletWithDevice & {
  firmwareTypeBadge?: EFirmwareType;
  firmwareVersionDisplay?: string;
  bleName?: string;
  shouldUpdate?: boolean;
  updateVersionDisplay?: string;
  isQrWallet?: boolean;
};

function DeviceListItem({
  item,
  onPress,
  isConnected,
}: {
  item: IDeviceManagementListItem;
  onPress: (wallet: IHwQrWalletWithDevice['wallet']) => void;
  isConnected: boolean;
}) {
  const { gtMd } = useMedia();
  const walletAvatarProps: IWalletAvatarProps = {
    img: item.wallet.avatarInfo?.img,
    wallet: item.wallet,
    firmwareTypeBadge: item.firmwareTypeBadge,
    firmwareTypeProps: {
      top: 0,
      left: -1,
    },
    badge: item.isQrWallet ? 'QR' : undefined,
  };

  const isVerified = Boolean(item.device?.verifiedAtVersion);

  const bleName = deviceUtils.buildDeviceBleName({
    features: item.device?.featuresInfo,
  });

  const renderItemText = useMemo(() => {
    if (item.isQrWallet) {
      return null;
    }

    if (item.shouldUpdate) {
      if (gtMd) {
        return (
          <Badge badgeSize="sm" badgeType="info">
            <XStack ai="center" gap="$1.5">
              <Icon name="DownloadCircleOutline" color="$iconInfo" size="$4" />
              {item.updateVersionDisplay ? (
                <SizableText size="$bodySmMedium" color="$textInfo">
                  {item.updateVersionDisplay}
                </SizableText>
              ) : null}
            </XStack>
          </Badge>
        );
      }
      return (
        <Stack width="$2" height="$2" bg="$iconInfo" borderRadius="$full" />
      );
    }

    if (gtMd) {
      return (
        <SizableText size="$bodyMd" color="$textDisabled">
          {item.firmwareVersionDisplay}
        </SizableText>
      );
    }

    return null;
  }, [
    gtMd,
    item.isQrWallet,
    item.shouldUpdate,
    item.updateVersionDisplay,
    item.firmwareVersionDisplay,
  ]);

  return (
    <ListItem
      mx="$0"
      px="$pagePadding"
      minHeight={80}
      borderRadius="$0"
      $gtMd={{
        px: '$pagePadding',
        minHeight: 88,
      }}
      renderAvatar={() => (
        <Stack
          w={48}
          h={48}
          justifyContent="center"
          alignItems="center"
          borderRadius="$3"
          bg="$bgStrong"
          $gtMd={{
            w: 56,
            h: 56,
          }}
        >
          <WalletAvatar
            {...walletAvatarProps}
            size={gtMd ? 44 : 36}
            status={isConnected ? 'connected' : 'default'}
          />
        </Stack>
      )}
      renderItemText={() => (
        <YStack gap="$0" flex={1}>
          <XStack gap="$1" ai="center">
            <SizableText
              size="$bodyLgMedium"
              color="$text"
              numberOfLines={1}
              flexShrink={1}
            >
              {item.wallet.name}
            </SizableText>
            {item.isQrWallet ? null : <VerifiedBadge isVerified={isVerified} />}
          </XStack>
          {bleName ? (
            <SizableText size="$bodyMd" color="$textSubdued">
              {bleName}
            </SizableText>
          ) : null}
        </YStack>
      )}
      onPress={() => onPress(item.wallet)}
      drillIn
    >
      {renderItemText}
    </ListItem>
  );
}

const ItemSeparatorComponent = () => <Divider borderColor="$neutral4" />;

const ListEmptyComponent = () => (
  <Stack p="$16">
    <Spinner size="large" />
  </Stack>
);

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
          skipDuplicateDeviceSameType: true,
        });
      const devices: Array<IDeviceManagementListItem> = Object.values(r)
        .filter(
          (item): item is IHwQrWalletWithDevice =>
            Boolean(item.device) && !item.wallet.deprecated,
        )
        .toSorted((a, b) => {
          const orderA = a.wallet.walletOrder || a.wallet.walletNo;
          const orderB = b.wallet.walletOrder || b.wallet.walletNo;
          return orderA - orderB;
        });

      for (const item of devices) {
        const firmwareTypeBadge = await deviceUtils.getFirmwareType({
          features: item.device?.featuresInfo,
        });
        const deviceVersion = await deviceUtils.getDeviceVersion({
          device: item.device,
          features: item.device?.featuresInfo,
        });
        const deviceDetectStatus = detectStatus?.[item.device?.connectId ?? ''];
        const shouldUpdate = deviceDetectStatus?.hasUpgrade;
        const updateVersionDisplay = deviceDetectStatus?.toVersion;
        item.isQrWallet = accountUtils.isQrWallet({
          walletId: item.wallet.id,
        });
        item.firmwareTypeBadge = firmwareTypeBadge;
        item.firmwareVersionDisplay = `v${
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
      checkIsFocused: false,
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
    const fn = () => {
      void refreshHwQrWalletList();
    };
    appEventBus.on(EAppEventBusNames.WalletUpdate, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.WalletUpdate, fn);
    };
  }, [refreshHwQrWalletList]);

  const onWalletPressed = useCallback(
    (wallet: IHwQrWalletWithDevice['wallet']) => {
      if (wallet.id) {
        pushToDeviceDetail({
          walletId: wallet.id,
        });
      }
    },
    [pushToDeviceDetail],
  );

  const renderItem = useCallback(
    ({ item }: { item: IDeviceManagementListItem }) => (
      <DeviceListItem
        key={item.wallet.id}
        item={item}
        onPress={onWalletPressed}
        isConnected={walletConnectionMap.get(item.wallet.id) ?? false}
      />
    ),
    [onWalletPressed, walletConnectionMap],
  );

  const existingDevices = useMemo(() => {
    return hwQrWalletList.length > 0;
  }, [hwQrWalletList]);

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
            <YStack
              flex={1}
              w="100%"
              px="$0"
              py="$0"
              gap="$6"
              bg="$bgApp"
              $gtMd={{
                px: '$pagePadding',
                py: '$8',
              }}
            >
              <SectionHeader />
              <ListView
                flex={1}
                contentContainerStyle={
                  gtMd
                    ? {
                        paddingTop: 0,
                        borderRadius: '$4',
                        bg: '$bgApp',
                        borderColor: '$borderSubdued',
                        overflow: 'hidden',
                        borderWidth: '$px',
                      }
                    : {
                        paddingTop: 0,
                        bg: '$bgApp',
                      }
                }
                keyExtractor={(item) => item.wallet.id}
                data={hwQrWalletList}
                renderItem={renderItem}
                estimatedItemSize={88}
                ListEmptyComponent={ListEmptyComponent}
                ItemSeparatorComponent={ItemSeparatorComponent}
              />
            </YStack>
          </Page.Container>
        ) : null}
        {!existingDevices && !isLoading ? <DeviceGuideView /> : null}
      </Page.Body>
      {showHeader && !gtMd ? (
        <Page.Footer>
          <Page.FooterActions
            onConfirm={toOnBoardingPage}
            onConfirmText={intl.formatMessage({
              id: ETranslations.global_add_new_device,
            })}
            confirmButtonProps={{
              icon: 'PlusSmallOutline',
              variant: 'secondary',
            }}
          />
        </Page.Footer>
      ) : null}
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
