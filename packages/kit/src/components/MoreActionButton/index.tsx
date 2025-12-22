import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { PropsWithChildren } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import type {
  IButtonProps,
  IIconButtonProps,
  IKeyOfIcons,
  IStackProps,
  IStackStyle,
} from '@onekeyhq/components';
import {
  Divider,
  HeaderIconButton,
  Icon,
  IconButton,
  LottieView,
  ScrollView,
  SizableText,
  Stack,
  Tooltip,
  XStack,
  YStack,
  useIsDesktopModeUIInTabPages,
  useIsWebHorizontalLayout,
  useMedia,
  usePopoverContext,
} from '@onekeyhq/components';
import { useTooltipContext } from '@onekeyhq/components/src/actions/Tooltip/context';
import GiftExpandOnDark from '@onekeyhq/kit/assets/animations/gift-expand-on-dark.json';
import GiftExpandOnLight from '@onekeyhq/kit/assets/animations/gift-expand-on-light.json';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useShowAddressBook } from '@onekeyhq/kit/src/hooks/useShowAddressBook';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  useAllTokenListAtom,
  useAllTokenListMapAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/tokenList';
import { useToMyOneKeyModal } from '@onekeyhq/kit/src/views/DeviceManagement/hooks/useToMyOneKeyModal';
import { HomeTokenListProviderMirror } from '@onekeyhq/kit/src/views/Home/components/HomeTokenListProvider/HomeTokenListProviderMirror';
import {
  useAppSideBarStatusAtom,
  useFirmwareUpdatesDetectStatusPersistAtom,
  useHardwareWalletXfpStatusAtom,
  useNotificationsAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { showIntercom } from '@onekeyhq/shared/src/modules3rdParty/intercom';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes, EModalSettingRoutes } from '@onekeyhq/shared/src/routes';
import { EModalBulkCopyAddressesRoutes } from '@onekeyhq/shared/src/routes/bulkCopyAddresses';
import { EModalNotificationsRoutes } from '@onekeyhq/shared/src/routes/notifications';
import { EPrimeFeatures, EPrimePages } from '@onekeyhq/shared/src/routes/prime';
import extUtils from '@onekeyhq/shared/src/utils/extUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useOnLock } from '../../hooks/useOnLock';
import { usePromiseResult } from '../../hooks/usePromiseResult';
import { useReferFriends } from '../../hooks/useReferFriends';
import { useThemeVariant } from '../../hooks/useThemeVariant';
import { HomeFirmwareUpdateReminder } from '../../views/FirmwareUpdate/components/HomeFirmwareUpdateReminder';
import { WalletXfpStatusReminder } from '../../views/Home/components/WalletXfpStatusReminder/WalletXfpStatusReminder';
import { PrimeHeaderIconButtonLazy } from '../../views/Prime/components/PrimeHeaderIconButton';
import { useOnPrimeButtonPressed } from '../../views/Prime/components/PrimeHeaderIconButton/PrimeHeaderIconButton';
import { usePrimeAvailable } from '../../views/Prime/hooks/usePrimeAvailable';
import useScanQrCode from '../../views/ScanQrCode/hooks/useScanQrCode';
import { OneKeyIdAvatar } from '../../views/Setting/pages/OneKeyId';
import { AccountSelectorProviderMirror } from '../AccountSelector';
import { UpdateReminder } from '../UpdateReminder';
import {
  isShowAppUpdateUIWhenUpdating,
  useAppUpdateInfo,
} from '../UpdateReminder/hooks';

import type { GestureResponderEvent } from 'react-native';

const pressStyle = {
  bg: '$bgActive',
  borderRadius: '$2.5',
} as const;
const hoverStyle = { bg: '$bgHover', borderRadius: '$2.5' } as const;

function MoreActionProvider({ children }: PropsWithChildren) {
  return (
    <AccountSelectorProviderMirror
      enabledNum={[0]}
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
    >
      <HomeTokenListProviderMirror>{children}</HomeTokenListProviderMirror>
    </AccountSelectorProviderMirror>
  );
}

function MoreActionContentHeaderItem({ onPress, ...props }: IIconButtonProps) {
  const { closeTooltip } = useTooltipContext();
  const handlePress = useCallback(
    async (event: GestureResponderEvent) => {
      await closeTooltip?.();
      onPress?.(event);
    },
    [closeTooltip, onPress],
  );
  return <IconButton {...props} variant="tertiary" onPress={handlePress} />;
}

function MoreActionContentHeader() {
  const intl = useIntl();
  const onLock = useOnLock();
  const handleLock = useCallback(async () => {
    await onLock();
  }, [onLock]);

  const handleCustomerSupport = useCallback(() => {
    void showIntercom();
  }, []);

  const popupMenu = useMemo(() => {
    if (platformEnv.isExtensionUiPopup || platformEnv.isExtensionUiSidePanel) {
      const routeInfo = {
        routes: '',
      };
      return [
        platformEnv.isExtensionUiPopup
          ? {
              title: intl.formatMessage({
                id: ETranslations.open_as_sidebar,
              }),
              icon: 'LayoutRightOutline' as const,
              onPress: async () => {
                defaultLogger.account.wallet.openSidePanel();
                await extUtils.openPanelOnActionClick(true);
                await extUtils.openSidePanel(routeInfo);
                window.close();
              },
              trackID: 'wallet-side-panel-mode',
            }
          : {
              title: intl.formatMessage({
                id: ETranslations.open_as_popup,
              }),
              icon: 'LayoutTopOutline' as const,
              onPress: async () => {
                await extUtils.openPanelOnActionClick(false);
                window.close();
              },
            },
        {
          title: intl.formatMessage({
            id: ETranslations.global_expand_view,
          }),
          icon: 'ExpandOutline' as const,
          onPress: async () => {
            defaultLogger.account.wallet.openExpandView();
            window.close();
            await backgroundApiProxy.serviceApp.openExtensionExpandTab(
              routeInfo,
            );
          },
          trackID: 'wallet-expand-view',
        },
      ];
    }
    return [];
  }, [intl]);
  const items = useMemo(() => {
    return [
      ...popupMenu,
      {
        title: intl.formatMessage({
          id: ETranslations.settings_contact_us,
        }),
        icon: 'HelpSupportOutline',
        onPress: handleCustomerSupport,
        trackID: 'wallet-customer-support',
      },
      {
        title: intl.formatMessage({ id: ETranslations.settings_lock_now }),
        icon: 'LockOutline' as const,
        onPress: handleLock,
        trackID: 'wallet-lock-now',
      },
    ];
  }, [handleCustomerSupport, handleLock, intl, popupMenu]);

  return (
    <XStack px="$5" pt="$3" my={1} ai="center" jc="space-between">
      <SizableText size="$headingXl">
        {intl.formatMessage({ id: ETranslations.address_book_menu_title })}
      </SizableText>
      <XStack jc="flex-end" gap="$6">
        {items.map((item) => (
          <MoreActionContentHeaderItem
            key={item.title}
            icon={item.icon as IKeyOfIcons}
            onPress={item.onPress}
            trackID={item.trackID}
          />
        ))}
      </XStack>
    </XStack>
  );
}

function MoreActionContentFooterItem({ onPress, ...props }: IIconButtonProps) {
  const { closePopover } = usePopoverContext();
  const handlePress = useCallback(
    async (event: GestureResponderEvent) => {
      await closePopover?.();
      onPress?.(event);
    },
    [closePopover, onPress],
  );
  return <IconButton {...props} variant="tertiary" onPress={handlePress} />;
}

function MoreActionContentFooter() {
  const intl = useIntl();
  const onLock = useOnLock();
  const handleLock = useCallback(async () => {
    await onLock();
  }, [onLock]);

  const popupMenu = useMemo(() => {
    if (platformEnv.isExtensionUiPopup || platformEnv.isExtensionUiSidePanel) {
      const routeInfo = {
        routes: '',
      };
      return [
        platformEnv.isExtensionUiPopup
          ? {
              title: intl.formatMessage({
                id: ETranslations.open_as_sidebar,
              }),
              icon: 'LayoutRightOutline' as const,
              onPress: async () => {
                defaultLogger.account.wallet.openSidePanel();
                await extUtils.openPanelOnActionClick(true);
                await extUtils.openSidePanel(routeInfo);
                window.close();
              },
              trackID: 'wallet-side-panel-mode',
            }
          : {
              title: intl.formatMessage({
                id: ETranslations.open_as_popup,
              }),
              icon: 'LayoutTopOutline' as const,
              onPress: async () => {
                await extUtils.openPanelOnActionClick(false);
                window.close();
              },
            },
        {
          title: intl.formatMessage({
            id: ETranslations.global_expand_view,
          }),
          icon: 'ExpandOutline' as const,
          onPress: async () => {
            defaultLogger.account.wallet.openExpandView();
            window.close();
            await backgroundApiProxy.serviceApp.openExtensionExpandTab(
              routeInfo,
            );
          },
          trackID: 'wallet-expand-view',
        },
      ];
    }
    return [];
  }, [intl]);
  const items = useMemo(() => {
    return [
      ...popupMenu,
      {
        title: intl.formatMessage({ id: ETranslations.settings_lock_now }),
        icon: 'LockOutline' as const,
        onPress: handleLock,
        testID: 'lock-now',
        trackID: 'wallet-lock-now',
      },
    ];
  }, [handleLock, intl, popupMenu]);
  return (
    <XStack jc="flex-end" gap="$5">
      {items.map((item) => (
        <MoreActionContentFooterItem key={item.title} {...item} />
      ))}
    </XStack>
  );
}

interface IMoreActionContentGridItemProps {
  title: IIconButtonProps['title'];
  icon: IIconButtonProps['icon'];
  testID?: string;
  trackID?: string;
  onPress: () => void;
  showRedDot?: boolean;
  showBadges?: boolean;
  badges?: number;
  lottieSrc?: string;
  isPrimeFeature?: boolean;
}

function MoreActionContentGridItem({
  title,
  icon,
  onPress,
  testID,
  trackID,
  showRedDot,
  showBadges,
  badges = 0,
  lottieSrc,
  isPrimeFeature,
}: IMoreActionContentGridItemProps) {
  const { closePopover } = usePopoverContext();
  const { isPrimeAvailable } = usePrimeAvailable();

  const handlePress = useCallback(async () => {
    await closePopover?.();
    onPress();
    if (trackID) {
      defaultLogger.ui.button.click({
        trackId: trackID,
      });
    }
  }, [closePopover, onPress, trackID]);

  const { user } = useOneKeyAuth();
  const isPrimeUser = user?.primeSubscription?.isActive && user?.onekeyUserId;

  if (isPrimeFeature && !isPrimeAvailable) {
    return null;
  }

  return (
    <YStack
      testID={testID}
      onPress={handlePress}
      group
      flexBasis="25%"
      ai="center"
      jc="center"
      gap="$2"
      m="$1"
      h={64}
      borderRadius="$2"
      hoverStyle={{
        bg: '$bgHover',
      }}
      userSelect="none"
    >
      <YStack>
        {icon ? <Icon name={icon} /> : null}
        {lottieSrc ? (
          <LottieView width={32} height={32} source={lottieSrc} />
        ) : null}
        {showRedDot ? (
          <Stack
            position="absolute"
            right="$-2"
            top="$-2"
            alignItems="flex-end"
            w="$10"
            pointerEvents="none"
          >
            <Stack
              bg="$bgApp"
              borderRadius="$full"
              borderWidth={2}
              borderColor="$transparent"
            >
              <Stack
                px="$1"
                borderRadius="$full"
                bg="$bgCriticalStrong"
                minWidth="$4"
                height="$4"
                alignItems="center"
                justifyContent="center"
              >
                {showBadges ? (
                  <SizableText color="$textOnColor" size="$bodySm">
                    {badges && badges > 99 ? '99+' : badges}
                  </SizableText>
                ) : (
                  <Stack
                    width="$1"
                    height="$1"
                    backgroundColor="white"
                    borderRadius="$full"
                  />
                )}
              </Stack>
            </Stack>
          </Stack>
        ) : null}
        {/* Only show Prime badge for non-Prime users */}
        {isPrimeFeature && !isPrimeUser ? (
          <Stack
            position="absolute"
            left={-1}
            top={-1}
            backgroundColor="$bgStrong"
            paddingLeft={5}
            paddingRight={4}
            py={1.5}
            borderBottomRightRadius="$2"
          >
            <Icon
              color="$iconDisabled"
              width={10}
              height={10}
              name="PrimeOutline"
            />
          </Stack>
        ) : null}
      </YStack>
      <SizableText size="$bodySm" textAlign="center">
        {title}
      </SizableText>
    </YStack>
  );
}

function MoreActionContentGridRender({
  items,
}: {
  items: IMoreActionContentGridItemProps[];
}) {
  const displayItems = useMemo(() => {
    const remainder = items.length % 4;
    if (remainder !== 0) {
      const paddingCount = 4 - remainder;
      return [
        ...items,
        ...Array(paddingCount).fill(null),
      ] as IMoreActionContentGridItemProps[];
    }
    return items;
  }, [items]);
  return (
    <>
      {displayItems.map((item, index) =>
        item ? (
          <MoreActionContentGridItem key={index} {...item} />
        ) : (
          <XStack key={index} />
        ),
      )}
    </>
  );
}

function MoreActionDivider() {
  return (
    <XStack py="$2" mx="$-5">
      <Divider />
    </XStack>
  );
}

function MoreActionOneKeyId() {
  const intl = useIntl();
  const { user, isLoggedIn, loginOneKeyId } = useOneKeyAuth();
  const { isPrimeAvailable } = usePrimeAvailable();
  const {
    activeAccount: { network },
  } = useActiveAccount({ num: 0 });

  const { closeTooltip } = useTooltipContext();

  const displayName = useMemo(() => {
    if (!isLoggedIn) {
      return intl.formatMessage({ id: ETranslations.prime_signup_login });
    }
    return user?.displayEmail || 'OneKey ID';
  }, [isLoggedIn, user?.displayEmail, intl]);

  const handlePress = useCallback(async () => {
    await closeTooltip();
    // Trigger login flow directly
    void loginOneKeyId();
    await loginOneKeyId({
      toOneKeyIdPageOnLoginSuccess: true,
    });
  }, [closeTooltip, loginOneKeyId]);

  const { icon, onPrimeButtonPressed } = useOnPrimeButtonPressed({
    onPress: closeTooltip,
    networkId: network?.id,
  });

  return (
    <XStack
      alignItems="center"
      py="$4"
      userSelect="none"
      justifyContent="space-between"
      onPress={handlePress}
    >
      <XStack alignItems="center" gap="$3" flex={1}>
        {/* Avatar */}
        <OneKeyIdAvatar size="$16" />

        {/* Username and Label */}
        <YStack flex={1} gap="$0.5">
          <XStack alignItems="center" gap="$2.5">
            <SizableText
              size="$headingXl"
              color="$text"
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              OneKey ID
            </SizableText>
            {isPrimeAvailable ? (
              <XStack
                ai="center"
                jc="center"
                gap="$1"
                px="$2"
                h={22}
                bg="rgba(1, 239, 13, 0.06)"
                borderRadius="$full"
                borderWidth={StyleSheet.hairlineWidth}
                borderColor="rgba(22, 67, 30, 0.09)"
                onPress={onPrimeButtonPressed}
              >
                <Icon name={icon} size="$4" />
                <SizableText size="$bodyMdMedium">Prime</SizableText>
              </XStack>
            ) : null}
          </XStack>
          <SizableText size="$bodyMd" color="$textSubdued" numberOfLines={1}>
            {displayName}
          </SizableText>
        </YStack>
      </XStack>
      {isLoggedIn ? (
        <Icon name="ChevronRightSmallOutline" size="$5" color="$iconSubdued" />
      ) : null}
    </XStack>
  );
}

function MoreActionContentGrid() {
  const intl = useIntl();
  const themeVariant = useThemeVariant();

  const openAddressBook = useShowAddressBook({
    useNewModal: true,
  });
  const { gtMd } = useMedia();
  const toMyOneKeyModal = useToMyOneKeyModal();
  const { user } = useOneKeyAuth();

  const handleDeviceManagement = useCallback(async () => {
    await toMyOneKeyModal();
  }, [toMyOneKeyModal]);

  const navigation = useAppNavigation();
  const {
    activeAccount: { wallet, account, network },
  } = useActiveAccount({ num: 0 });

  const handleSettings = useCallback(() => {
    navigation.pushModal(EModalRoutes.SettingModal, {
      screen: EModalSettingRoutes.SettingListModal,
    });
  }, [navigation]);

  const checkIsPrimeUser = useCallback(
    (showFeature: EPrimeFeatures) => {
      if (user?.primeSubscription?.isActive && user?.onekeyUserId) {
        return true;
      }
      navigation.pushFullModal(EModalRoutes.PrimeModal, {
        screen: EPrimePages.PrimeFeatures,
        params: {
          showAllFeatures: false,
          selectedFeature: showFeature,
          selectedSubscriptionPeriod: 'P1Y',
          networkId: network?.id,
        },
      });
      return false;
    },
    [navigation, user, network?.id],
  );

  const handleCustomerSupport = useCallback(() => {
    void showIntercom();
  }, []);

  const openNotificationsModal = useCallback(async () => {
    navigation.pushModal(EModalRoutes.NotificationsModal, {
      screen: EModalNotificationsRoutes.NotificationList,
    });
  }, [navigation]);

  const openBulkCopyAddressesModal = useCallback(async () => {
    const networkId = networkUtils.toNetworkIdFallback({
      networkId: network?.id,
      allNetworkFallbackToBtc: true,
    });

    if (!networkId) return;

    if (!checkIsPrimeUser(EPrimeFeatures.BulkCopyAddresses)) return;

    navigation.pushModal(EModalRoutes.BulkCopyAddressesModal, {
      screen: EModalBulkCopyAddressesRoutes.BulkCopyAddressesModal,
      params: {
        walletId: wallet?.id,
        networkId,
      },
    });
  }, [network?.id, checkIsPrimeUser, navigation, wallet?.id]);

  const { toReferFriendsPage } = useReferFriends();

  const [allTokens] = useAllTokenListAtom();
  const [map] = useAllTokenListMapAtom();

  const scanQrCode = useScanQrCode();

  const isPrimeUser = user?.primeSubscription?.isActive && user?.onekeyUserId;

  const handleScan = useCallback(async () => {
    await scanQrCode.start({
      handlers: scanQrCode.PARSE_HANDLER_NAMES.all,
      autoHandleResult: true,
      account,
      network,
      tokens: {
        data: allTokens.tokens,
        keys: allTokens.keys,
        map,
      },
    });
  }, [scanQrCode, account, network, allTokens.tokens, allTokens.keys, map]);

  const [{ firstTimeGuideOpened, badge }] = useNotificationsAtom();
  const items = useMemo(() => {
    return [
      platformEnv.isWebDappMode
        ? undefined
        : {
            title: intl.formatMessage({
              id: ETranslations.address_book_title,
            }),
            icon: 'ContactsOutline',
            onPress: openAddressBook,
            testID: 'address-book',
            trackID: 'wallet-address-book',
          },
      platformEnv.isWebDappMode
        ? undefined
        : {
            title: intl.formatMessage({
              id: ETranslations.global_my_onekey,
            }),
            icon: 'OnekeyDeviceCustom',
            onPress: handleDeviceManagement,
            testID: 'my-onekey',
          },
      {
        title: intl.formatMessage({
          id: ETranslations.settings_settings,
        }),
        icon: 'SettingsOutline',
        onPress: handleSettings,
        trackID: 'wallet-settings',
      },
      {
        title: intl.formatMessage({
          id: ETranslations.settings_contact_us,
        }),
        icon: 'HelpSupportOutline',
        onPress: handleCustomerSupport,
        testID: 'customer-support',
        trackID: 'wallet-customer-support',
      },
      {
        title: intl.formatMessage({ id: ETranslations.sidebar_refer_a_friend }),
        lottieSrc:
          themeVariant === 'light' ? GiftExpandOnLight : GiftExpandOnDark,
        testID: 'referral',
        onPress: toReferFriendsPage,
      },
      platformEnv.isWebDappMode
        ? undefined
        : {
            title: intl.formatMessage({ id: ETranslations.scan_scan_qr_code }),
            icon: 'ScanOutline' as const,
            onPress: handleScan,
            testID: 'scan-qr-code',
            trackID: 'wallet-scan',
          },
      gtMd
        ? undefined
        : {
            title: intl.formatMessage({
              id: ETranslations.global_notifications,
            }),
            icon: 'BellOutline',
            onPress: openNotificationsModal,
            showRedDot: !firstTimeGuideOpened || badge,
            showBadges: firstTimeGuideOpened,
            badges: badge,
            trackID: 'notification-in-more-action',
          },
      platformEnv.isWebDappMode
        ? undefined
        : {
            title: intl.formatMessage({
              id: ETranslations.global_bulk_copy_addresses,
            }),
            icon: 'Copy3Outline',
            onPress: () => {
              if (!isPrimeUser) {
                defaultLogger.prime.subscription.primeEntryClick({
                  featureName: EPrimeFeatures.BulkCopyAddresses,
                  entryPoint: 'moreActions',
                });
              }
              void openBulkCopyAddressesModal();
            },
            trackID: 'bulk-copy-addresses-in-more-action',
            isPrimeFeature: true,
          },
    ].filter(Boolean) as IMoreActionContentGridItemProps[];
  }, [
    badge,
    firstTimeGuideOpened,
    gtMd,
    handleCustomerSupport,
    handleDeviceManagement,
    handleScan,
    handleSettings,
    intl,
    openAddressBook,
    openNotificationsModal,
    openBulkCopyAddressesModal,
    themeVariant,
    toReferFriendsPage,
    isPrimeUser,
  ]);

  return (
    <YStack gap="$5">
      <XStack flexWrap="wrap" mx="$-3" my="$-2.5">
        <MoreActionContentGridRender items={items} />
      </XStack>
      <Divider />
    </YStack>
  );
}

const useIsShowRedDot = () => {
  const isHorizontal = useIsWebHorizontalLayout();
  const [{ firstTimeGuideOpened, badge: notificationBadges }] =
    useNotificationsAtom();
  if (isHorizontal) {
    return false;
  }
  const isShowNotificationDot = !firstTimeGuideOpened || notificationBadges;
  return isShowNotificationDot;
};

const useIsNeedUpgradeFirmware = () => {
  const { activeAccount } = useActiveAccount({ num: 0 });
  const connectId = activeAccount.device?.connectId;
  const [detectStatus] = useFirmwareUpdatesDetectStatusPersistAtom();
  const { result } = usePromiseResult(async () => {
    if (!connectId) return undefined;
    const detectResult = detectStatus?.[connectId];
    const shouldUpdate =
      detectResult?.connectId === connectId && detectResult?.hasUpgrade;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const detectInfo =
      await backgroundApiProxy.serviceFirmwareUpdate.getFirmwareUpdateDetectInfo(
        {
          connectId,
        },
      );
    return {
      shouldUpdate,
      detectResult,
    };
  }, [connectId, detectStatus]);

  return result?.shouldUpdate;
};

const useIsShowWalletXfpStatus = () => {
  const { activeAccount } = useActiveAccount({ num: 0 });
  const walletId = activeAccount?.wallet?.id;
  const deprecated = activeAccount?.wallet?.deprecated;

  const [hardwareWalletXfpStatus] = useHardwareWalletXfpStatusAtom();

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const navigation = useAppNavigation();

  useEffect(() => {
    void (async () => {
      if (!deprecated && walletId) {
        await backgroundApiProxy.serviceAccount.generateWalletsMissingMetaSilently(
          {
            walletId,
          },
        );
      }
    })();
  }, [walletId, deprecated]);
  return (
    !deprecated && walletId && hardwareWalletXfpStatus?.[walletId]?.xfpMissing
  );
};

// TODO: Handle potential duplicate update detection requests
// This component may trigger multiple update checks simultaneously
// Deduplicate or throttle API requests.
// to prevent unnecessary API calls and improve performance
const useIsShowAppUpdateDot = () => {
  const appUpdateInfo = useAppUpdateInfo(true);
  const isAppNeedUpdate = appUpdateInfo.isNeedUpdate;
  const isShowAppUpdateUI = useMemo(() => {
    return isShowAppUpdateUIWhenUpdating({
      updateStrategy: appUpdateInfo.data.updateStrategy,
      updateStatus: appUpdateInfo.data.status,
    });
  }, [appUpdateInfo.data.updateStrategy, appUpdateInfo.data.status]);
  const isNeedUpgradeFirmware = useIsNeedUpgradeFirmware();
  const isShowWalletXfpStatus = useIsShowWalletXfpStatus();
  return (
    (isShowAppUpdateUI && isAppNeedUpdate) ||
    isNeedUpgradeFirmware ||
    isShowWalletXfpStatus
  );
};

function UpdateReminders() {
  const isShowUpgradeComponents = useIsShowAppUpdateDot();
  return isShowUpgradeComponents ? (
    <YStack gap="$2">
      <UpdateReminder />
      <HomeFirmwareUpdateReminder />
      <WalletXfpStatusReminder />
    </YStack>
  ) : null;
}

function BaseMoreActionGrid({
  title,
  items,
}: {
  title: string;
  items: IMoreActionContentGridItemProps[];
}) {
  const displayItems = useMemo(() => {
    const remainder = items.length % 4;
    if (remainder !== 0) {
      const paddingCount = 4 - remainder;
      return [
        ...items,
        ...Array(paddingCount).fill(null),
      ] as IMoreActionContentGridItemProps[];
    }
    return items;
  }, [items]);
  console.log('displayItems', displayItems);
  return (
    <YStack>
      <SizableText
        size="$headingMd"
        color="$text"
        numberOfLines={1}
        ellipsizeMode="middle"
      >
        {title}
      </SizableText>
      <YStack gap="$2">
        {Array.from({ length: Math.ceil(displayItems.length / 4) }).map(
          (_, rowIndex) => (
            <XStack key={rowIndex} justifyContent="space-between">
              {displayItems
                .slice(rowIndex * 4, (rowIndex + 1) * 4)
                .map((item, colIndex) =>
                  item ? (
                    <MoreActionContentGridItem
                      key={rowIndex * 4 + colIndex}
                      {...item}
                    />
                  ) : (
                    <XStack flexBasis="25%" key={rowIndex * 4 + colIndex} />
                  ),
                )}
            </XStack>
          ),
        )}
      </YStack>
    </YStack>
  );
}

function MoreActionGeneralGrid() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const handleSettings = useCallback(() => {
    navigation.pushModal(EModalRoutes.SettingModal, {
      screen: EModalSettingRoutes.SettingListModal,
    });
  }, [navigation]);
  const handleCustomerSupport = useCallback(() => {
    void showIntercom();
  }, []);
  const items = useMemo(() => {
    return [
      {
        title: intl.formatMessage({ id: ETranslations.settings_settings }),
        icon: 'SettingsOutline' as const,
        onPress: handleSettings,
        trackID: 'wallet-settings',
      },
      {
        title: intl.formatMessage({ id: ETranslations.settings_contact_us }),
        icon: 'HelpSupportOutline' as const,
        onPress: handleCustomerSupport,
        trackID: 'wallet-customer-support',
      },
    ];
  }, [handleCustomerSupport, handleSettings, intl]);
  return <BaseMoreActionGrid title="General" items={items} />;
}

function MoreActionContent() {
  return (
    <MoreActionProvider>
      <YStack>
        <MoreActionContentHeader />
        <ScrollView
          contentContainerStyle={{
            py: '$2',
            px: '$5',
          }}
        >
          <UpdateReminders />
          <MoreActionOneKeyId />
          <MoreActionDivider />
          <MoreActionGeneralGrid />
          <MoreActionDivider />
          <MoreActionContentFooter />
        </ScrollView>
      </YStack>
    </MoreActionProvider>
  );
}

function Dot({
  color,
  ...props
}: { color: IStackStyle['bg'] } & Omit<IStackProps, 'color'>) {
  return (
    <Stack
      position="absolute"
      right="$-2.5"
      top="$-2"
      alignItems="flex-end"
      w="$10"
      pointerEvents="none"
      {...props}
    >
      <Stack
        bg="$bgApp"
        borderRadius="$full"
        borderWidth={2}
        borderColor="$transparent"
      >
        <Stack
          px="$1"
          borderRadius="$full"
          bg={color}
          minWidth="$4"
          height="$4"
          alignItems="center"
          justifyContent="center"
        >
          <Stack
            width="$1"
            height="$1"
            backgroundColor="white"
            borderRadius="$full"
          />
        </Stack>
      </Stack>
    </Stack>
  );
}

function MoreButtonWithDot({ onPress }: { onPress?: IButtonProps['onPress'] }) {
  const intl = useIntl();
  const [{ isCollapsed }] = useAppSideBarStatusAtom();
  const isDesktopMode = useIsDesktopModeUIInTabPages();
  const isShowRedDot = useIsShowRedDot();
  const isShowUpgradeDot = useIsShowAppUpdateDot();
  const dot = useMemo(() => {
    if (isShowUpgradeDot) {
      return <Dot color="$blue8" top={isDesktopMode ? 0 : '$-2'} />;
    }
    return isShowRedDot ? <Dot color="$bgCriticalStrong" /> : null;
  }, [isDesktopMode, isShowRedDot, isShowUpgradeDot]);
  return isDesktopMode ? (
    <XStack userSelect="none" py="$1.5">
      <XStack gap="$0.5">
        <YStack p="$2" borderRadius="$2" hoverStyle={{ bg: '$bgHover' }}>
          <Icon name="DotGridOutline" size="$5" />
        </YStack>
        {isCollapsed ? null : (
          <SizableText
            flex={1}
            numberOfLines={1}
            cursor="default"
            color="$text"
            textAlign="center"
            size="$bodyXsMedium"
          >
            {intl.formatMessage({
              id: ETranslations.global_more,
            })}
          </SizableText>
        )}
      </XStack>
      {dot}
    </XStack>
  ) : (
    <XStack>
      <HeaderIconButton
        testID="moreActions"
        onPress={onPress}
        title={intl.formatMessage({ id: ETranslations.explore_options })}
        icon="DotGridOutline"
      />
      {dot}
    </XStack>
  );
}

function MoreActionButtonCmp() {
  const isDesktopMode = useIsDesktopModeUIInTabPages();
  return isDesktopMode ? (
    <Tooltip
      open
      contentProps={{
        maxWidth: 384,
        width: 384,
        height: 560,
        p: 0,
      }}
      placement="right-end"
      renderTrigger={<MoreButtonWithDot />}
      renderContent={<MoreActionContent />}
    />
  ) : (
    <MoreButtonWithDot />
  );
}

export function MoreActionButton() {
  return (
    <MoreActionProvider>
      <MoreActionButtonCmp />
    </MoreActionProvider>
  );
}
