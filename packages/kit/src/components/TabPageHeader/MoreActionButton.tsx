import { useCallback, useEffect, useMemo } from 'react';
import type { PropsWithChildren } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import type {
  IButtonProps,
  IIconButtonProps,
  IStackStyle,
} from '@onekeyhq/components';
import {
  Divider,
  HeaderIconButton,
  Icon,
  IconButton,
  LottieView,
  Popover,
  ScrollView,
  SizableText,
  Stack,
  XStack,
  YStack,
  useIsHorizontalLayout,
  useMedia,
  usePopoverContext,
} from '@onekeyhq/components';
import GiftExpandOnDark from '@onekeyhq/kit/assets/animations/gift-expand-on-dark.json';
import GiftExpandOnLight from '@onekeyhq/kit/assets/animations/gift-expand-on-light.json';
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
import { useLoginOneKeyId } from '../../hooks/useLoginOneKeyId';
import { useOnLock } from '../../hooks/useOnLock';
import { usePromiseResult } from '../../hooks/usePromiseResult';
import { useReferFriends } from '../../hooks/useReferFriends';
import { useThemeVariant } from '../../hooks/useThemeVariant';
import { HomeFirmwareUpdateReminder } from '../../views/FirmwareUpdate/components/HomeFirmwareUpdateReminder';
import { WalletXfpStatusReminder } from '../../views/Home/components/WalletXfpStatusReminder/WalletXfpStatusReminder';
import { PrimeHeaderIconButtonLazy } from '../../views/Prime/components/PrimeHeaderIconButton';
import { usePrimeAuthV2 } from '../../views/Prime/hooks/usePrimeAuthV2';
import { usePrimeAvailable } from '../../views/Prime/hooks/usePrimeAvailable';
import useScanQrCode from '../../views/ScanQrCode/hooks/useScanQrCode';
import { AccountSelectorProviderMirror } from '../AccountSelector';
import { UpdateReminder } from '../UpdateReminder';
import { useAppUpdateInfo } from '../UpdateReminder/hooks';

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

function MoreActionContentHeader() {
  const intl = useIntl();
  const { user } = usePrimeAuthV2();

  const { closePopover } = usePopoverContext();
  const { isPrimeAvailable } = usePrimeAvailable();
  const {
    activeAccount: { network },
  } = useActiveAccount({ num: 0 });

  const { loginOneKeyId } = useLoginOneKeyId();

  const handleLogin = useCallback(async () => {
    await closePopover?.();
    await loginOneKeyId({
      toOneKeyIdPageOnLoginSuccess: true,
    });
  }, [closePopover, loginOneKeyId]);

  return (
    <XStack
      px="$5"
      py="$4"
      ai="center"
      jc="space-between"
      borderBottomWidth={StyleSheet.hairlineWidth}
      borderColor="$borderSubdued"
    >
      <XStack
        gap="$1"
        ai="center"
        p="$1"
        pl="$1.5"
        m="$-1"
        ml="$-1.5"
        onPress={handleLogin}
        pressStyle={pressStyle}
        hoverStyle={hoverStyle}
      >
        <SizableText
          size="$bodyLgMedium"
          $gtMd={{
            size: '$bodyMdMedium',
          }}
          userSelect="none"
        >
          {user?.displayEmail ||
            intl.formatMessage({ id: ETranslations.prime_signup_login })}
        </SizableText>
        <Icon name="ChevronRightSmallOutline" size="$5" color="$iconSubdued" />
      </XStack>
      <XStack gap="$5">
        {isPrimeAvailable ? (
          <PrimeHeaderIconButtonLazy
            key="prime"
            visible
            onPress={closePopover}
            networkId={network?.id}
          />
        ) : null}
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

  const { user } = usePrimeAuthV2();
  const isPrimeUser = user?.primeSubscription?.isActive && user?.privyUserId;

  if (isPrimeFeature && !isPrimeAvailable) {
    return null;
  }

  return (
    <YStack
      testID={testID}
      onPress={handlePress}
      group
      flexBasis="33.33%"
      ai="center"
      gap="$2"
      py="$2.5"
      px={5}
      userSelect="none"
    >
      <YStack
        p={lottieSrc ? '$2' : '$3'}
        borderWidth={1}
        borderColor="$borderSubdued"
        borderRadius="$2"
        borderCurve="continuous"
        $group-hover={{
          bg: '$bgHover',
        }}
        $group-press={{
          bg: '$bgActive',
        }}
        overflow={showRedDot ? 'visible' : 'hidden'}
      >
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
    const remainder = items.length % 3;
    if (remainder !== 0) {
      const paddingCount = 3 - remainder;
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

function MoreActionContentGrid() {
  const intl = useIntl();
  const themeVariant = useThemeVariant();

  const openAddressBook = useShowAddressBook({
    useNewModal: true,
  });
  const { gtMd } = useMedia();
  const toMyOneKeyModal = useToMyOneKeyModal();
  const { user } = usePrimeAuthV2();

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
      if (user?.primeSubscription?.isActive && user?.privyUserId) {
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
      {
        title: intl.formatMessage({
          id: ETranslations.address_book_title,
        }),
        icon: 'ContactsOutline',
        onPress: openAddressBook,
        testID: 'address-book',
        trackID: 'wallet-address-book',
      },
      {
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
      {
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
      {
        title: intl.formatMessage({
          id: ETranslations.global_bulk_copy_addresses,
        }),
        icon: 'Copy3Outline',
        onPress: openBulkCopyAddressesModal,
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
  const isHorizontal = useIsHorizontalLayout();
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
const useIsShowUpgradeDot = () => {
  const appUpdateInfo = useAppUpdateInfo(true);
  const isAppNeedUpdate = appUpdateInfo.isNeedUpdate;
  const isNeedUpgradeFirmware = useIsNeedUpgradeFirmware();
  const isShowWalletXfpStatus = useIsShowWalletXfpStatus();
  return isAppNeedUpdate || isNeedUpgradeFirmware || isShowWalletXfpStatus;
};

function UpdateReminders() {
  const isShowUpgradeComponents = useIsShowUpgradeDot();
  return isShowUpgradeComponents ? (
    <YStack gap="$2">
      <UpdateReminder />
      <HomeFirmwareUpdateReminder />
      <WalletXfpStatusReminder />
    </YStack>
  ) : null;
}

function MoreActionContent() {
  return (
    <MoreActionProvider>
      <YStack>
        <MoreActionContentHeader />
        <ScrollView
          contentContainerStyle={{
            p: '$5',
            gap: '$5',
          }}
        >
          <UpdateReminders />
          <MoreActionContentGrid />
          <MoreActionContentFooter />
        </ScrollView>
      </YStack>
    </MoreActionProvider>
  );
}

function Dot({ color }: { color: IStackStyle['bg'] }) {
  return (
    <Stack
      position="absolute"
      right="$-2.5"
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
  const isShowRedDot = useIsShowRedDot();
  const isShowUpgradeDot = useIsShowUpgradeDot();
  const dot = useMemo(() => {
    if (isShowUpgradeDot) {
      return <Dot color="$blue8" />;
    }
    return isShowRedDot ? <Dot color="$bgCriticalStrong" /> : null;
  }, [isShowRedDot, isShowUpgradeDot]);
  return (
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
  return (
    <Popover
      title=""
      showHeader={false}
      offset={{
        mainAxis: 12,
        crossAxis: 20,
      }}
      placement="bottom-end"
      floatingPanelProps={{
        overflow: 'hidden',
      }}
      renderTrigger={<MoreButtonWithDot />}
      renderContent={MoreActionContent}
    />
  );
}

export function MoreActionButton() {
  return (
    <MoreActionProvider>
      <MoreActionButtonCmp />
    </MoreActionProvider>
  );
}
