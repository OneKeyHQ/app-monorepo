import { useCallback, useEffect, useMemo } from 'react';
import type { PropsWithChildren } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import type {
  IButtonProps,
  IIconButtonProps,
  IKeyOfIcons,
  IStackProps,
  IStackStyle,
  IYStackProps,
} from '@onekeyhq/components';
import {
  Divider,
  HeaderIconButton,
  Icon,
  IconButton,
  Image,
  LottieView,
  NavBackButton,
  Popover,
  ScrollView,
  SizableText,
  Stack,
  Tooltip,
  XStack,
  YStack,
  rootNavigationRef,
  useIsDesktopModeUIInTabPages,
  useIsWebHorizontalLayout,
  useMedia,
  usePopoverContext,
} from '@onekeyhq/components';
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
import {
  EModalDeviceManagementRoutes,
  EModalRoutes,
  EModalSettingRoutes,
  EOnboardingPagesV2,
  EOnboardingV2Routes,
  ERootRoutes,
} from '@onekeyhq/shared/src/routes';
import { EModalBulkCopyAddressesRoutes } from '@onekeyhq/shared/src/routes/bulkCopyAddresses';
import { EPrimeFeatures, EPrimePages } from '@onekeyhq/shared/src/routes/prime';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
import extUtils from '@onekeyhq/shared/src/utils/extUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IHwQrWalletWithDevice } from '@onekeyhq/shared/types/account';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useOnLock } from '../../hooks/useOnLock';
import { usePromiseResult } from '../../hooks/usePromiseResult';
import { useReferFriends } from '../../hooks/useReferFriends';
import { useThemeVariant } from '../../hooks/useThemeVariant';
import { HomeFirmwareUpdateReminder } from '../../views/FirmwareUpdate/components/HomeFirmwareUpdateReminder';
import { WalletXfpStatusReminder } from '../../views/Home/components/WalletXfpStatusReminder/WalletXfpStatusReminder';
import { useOnPrimeButtonPressed } from '../../views/Prime/components/PrimeHeaderIconButton/PrimeHeaderIconButton';
import { usePrimeAvailable } from '../../views/Prime/hooks/usePrimeAvailable';
import useScanQrCode from '../../views/ScanQrCode/hooks/useScanQrCode';
import { OneKeyIdAvatar } from '../../views/Setting/pages/OneKeyId';
import { ESettingsTabNames } from '../../views/Setting/pages/Tab/config';
import { AccountSelectorProviderMirror } from '../AccountSelector';
import { useEditPrimeProfileDialog } from '../RenameDialog';
import { UpdateReminder } from '../UpdateReminder';
import {
  isShowAppUpdateUIWhenUpdating,
  useAppUpdateInfo,
} from '../UpdateReminder/hooks';
import { WalletAvatar } from '../WalletAvatar';

import type { IDeviceManagementListModalItem } from '../../views/DeviceManagement/pages/DeviceManagementListModal';
import type { GestureResponderEvent } from 'react-native';

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
  const { closePopover } = usePopoverContext();
  const handlePress = useCallback(
    async (event: GestureResponderEvent) => {
      await closePopover?.();
      onPress?.(event);
    },
    [closePopover, onPress],
  );
  return (
    <IconButton
      {...props}
      variant="tertiary"
      size="medium"
      onPress={handlePress}
    />
  );
}

function MoreActionContentHeader({
  showBackButton,
}: {
  showBackButton?: boolean;
}) {
  const intl = useIntl();
  const media = useMedia();
  const onLock = useOnLock();
  const isDesktopMode = useIsDesktopModeUIInTabPages();

  const handleLock = useCallback(async () => {
    await onLock();
  }, [onLock]);

  const handleCustomerSupport = useCallback(() => {
    void showIntercom();
  }, []);

  const {
    activeAccount: { account, network },
  } = useActiveAccount({ num: 0 });
  const [allTokens] = useAllTokenListAtom();
  const [map] = useAllTokenListMapAtom();
  const scanQrCode = useScanQrCode();
  const { closePopover } = usePopoverContext();

  const handleScan = useCallback(async () => {
    await closePopover?.();
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
  }, [
    closePopover,
    scanQrCode,
    account,
    network,
    allTokens.tokens,
    allTokens.keys,
    map,
  ]);

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

  // Desktop (>= gtMd): show lock; Mobile (< gtMd): show scan
  const firstActionItem = useMemo(() => {
    if (media.gtMd) {
      return {
        title: intl.formatMessage({ id: ETranslations.settings_lock_now }),
        icon: 'LockOutline' as const,
        onPress: handleLock,
        trackID: 'wallet-lock-now',
      };
    }
    return {
      title: intl.formatMessage({ id: ETranslations.scan_scan_qr_code }),
      icon: 'ScanOutline' as const,
      onPress: handleScan,
      trackID: 'wallet-scan',
    };
  }, [media.gtMd, intl, handleLock, handleScan]);

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
      firstActionItem,
    ];
  }, [handleCustomerSupport, intl, popupMenu, firstActionItem]);

  const handleBack = useCallback(() => {
    if (rootNavigationRef.current?.canGoBack?.()) {
      rootNavigationRef.current?.goBack();
    }
  }, []);

  return (
    <XStack
      px="$5"
      pt="$4"
      pb="$2"
      ai="center"
      jc="space-between"
      bg={isDesktopMode ? '$bg' : '$bgApp'}
      zIndex={10}
      borderTopLeftRadius="$3"
      borderTopRightRadius="$3"
      $platform-web={{
        position: 'sticky',
        top: 0,
      }}
    >
      {showBackButton ? (
        <NavBackButton onPress={handleBack} />
      ) : (
        <SizableText size="$headingXl" color="$text" userSelect="none">
          {intl.formatMessage({ id: ETranslations.address_book_menu_title })}
        </SizableText>
      )}
      <XStack jc="flex-end" gap="$5">
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

function MoreActionContentFooter() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { closePopover } = usePopoverContext();
  const isDesktopMode = useIsDesktopModeUIInTabPages();
  const version = useMemo(() => {
    return `${platformEnv.version ?? ''} ${platformEnv.buildNumber ?? ''}`;
  }, []);
  const versionString = intl.formatMessage(
    {
      id: ETranslations.settings_version_versionnum,
    },
    {
      'versionNum': version,
    },
  );

  const handleAbout = useCallback(async () => {
    await closePopover?.();
    navigation.pushModal(EModalRoutes.SettingModal, {
      screen: EModalSettingRoutes.SettingListSubModal,
      params: {
        name: ESettingsTabNames.About,
      },
    });
  }, [closePopover, navigation]);

  return (
    <XStack
      px="$1"
      pb="$1"
      bg={isDesktopMode ? '$bg' : '$bgApp'}
      borderBottomLeftRadius="$3"
      borderBottomRightRadius="$3"
      borderTopWidth={StyleSheet.hairlineWidth}
      borderTopColor={isDesktopMode ? '$neutral3' : '$borderSubdued'}
      $platform-web={{
        position: 'sticky',
        bottom: 0,
      }}
    >
      <XStack
        flex={1}
        px="$4"
        py="$2"
        mt="$1"
        jc="space-between"
        onPress={handleAbout}
        borderRadius="$2"
        userSelect="none"
        hoverStyle={{
          bg: '$bgHover',
        }}
        pressStyle={{
          bg: '$bgActive',
        }}
      >
        <XStack gap="$1" ai="center" jc="center">
          <Icon name="InfoCircleOutline" color="$icon" size="$4" />
          <SizableText size="$bodyMdMedium" color="$textSubdued">
            {`${intl.formatMessage({ id: ETranslations.global_about })} OneKey`}
          </SizableText>
        </XStack>
        <XStack gap="$1" ai="center" jc="center">
          <SizableText size="$bodyMdMedium" color="$textDisabled">
            {versionString}
          </SizableText>
          <Icon
            name="ChevronRightSmallOutline"
            color="$iconSubdued"
            size="$4"
          />
        </XStack>
      </XStack>
    </XStack>
  );
}

interface IMoreActionContentGridItemProps {
  title: IIconButtonProps['title'];
  icon?: IIconButtonProps['icon'];
  testID?: string;
  trackID?: string;
  onPress: () => void;
  showRedDot?: boolean;
  showBadges?: boolean;
  badges?: number;
  lottieSrc?: any;
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
    setTimeout(() => {
      if (trackID) {
        defaultLogger.ui.button.click({
          trackId: trackID,
        });
      }
    });
    onPress();
  }, [closePopover, onPress, trackID]);

  const { user } = useOneKeyAuth();
  const isPrimeUser = user?.primeSubscription?.isActive && user?.onekeyUserId;
  const themeVariant = useThemeVariant();

  if (isPrimeFeature && !isPrimeAvailable) {
    return null;
  }

  return (
    <YStack
      testID={testID}
      onPress={handlePress}
      group
      flexBasis="25%"
      py="$2.5"
      ai="center"
      jc="flex-start"
      gap="$1"
      borderRadius="$2"
      hoverStyle={{
        bg: '$bgHover',
      }}
      pressStyle={{
        bg: '$bgActive',
      }}
      userSelect="none"
    >
      <YStack>
        {icon ? <Icon size="$6" color="$icon" name={icon} /> : null}
        {lottieSrc ? (
          <Stack w="$6" h="$6" ai="center" jc="center">
            <LottieView width={32} height={32} source={lottieSrc} />
          </Stack>
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
            right={-10}
            top={-4}
            backgroundColor={themeVariant === 'light' ? '#F1F1F1' : '#3A3A3A'}
            px="$1"
            borderRadius="$full"
            borderWidth="$px"
            borderColor="$bgApp"
          >
            <Icon color="$iconSubdued" size="$3" name="PrimeOutline" />
          </Stack>
        ) : null}
      </YStack>
      <SizableText
        size="$bodySmMedium"
        color="$textSubdued"
        numberOfLines={2}
        textAlign="center"
      >
        {title}
      </SizableText>
    </YStack>
  );
}

function MoreActionDivider() {
  const isDesktopMode = useIsDesktopModeUIInTabPages();
  return (
    <XStack py="$2">
      <Divider borderColor={isDesktopMode ? '$neutral3' : '$borderSubdued'} />
    </XStack>
  );
}

function MoreActionOneKeyId() {
  const intl = useIntl();
  const { user, isLoggedIn, loginOneKeyId } = useOneKeyAuth();
  const {
    activeAccount: { network },
  } = useActiveAccount({ num: 0 });

  const { closePopover } = usePopoverContext();

  useEffect(() => {
    if (isLoggedIn) {
      void backgroundApiProxy.servicePrime.apiFetchPrimeUserInfo();
    }
  }, [isLoggedIn]);

  const displayName = useMemo(() => {
    if (!isLoggedIn) {
      return intl.formatMessage({ id: ETranslations.prime_signup_login });
    }
    return user?.nickname ?? 'OneKey ID';
  }, [isLoggedIn, user?.nickname, intl]);
  const email = useMemo(() => {
    if (!isLoggedIn) {
      return intl.formatMessage({ id: ETranslations.prime_signup_login });
    }
    return user?.displayEmail || 'OneKey ID';
  }, [isLoggedIn, user?.displayEmail, intl]);

  const navigation = useAppNavigation();
  const showEditPrimeProfileDialog = useEditPrimeProfileDialog();

  const handleAvatarPress = useCallback(
    async (e: GestureResponderEvent) => {
      e.stopPropagation();
      await closePopover?.();
      await showEditPrimeProfileDialog();
    },
    [closePopover, showEditPrimeProfileDialog],
  );

  const handleNavigateToOneKeyId = useCallback(async () => {
    await closePopover?.();
    navigation.pushModal(EModalRoutes.PrimeModal, {
      screen: EPrimePages.OneKeyId,
    });
  }, [closePopover, navigation]);

  const handlePress = useCallback(async () => {
    if (isLoggedIn) {
      await handleNavigateToOneKeyId();
    } else {
      await closePopover?.();
      await loginOneKeyId({
        toOneKeyIdPageOnLoginSuccess: false,
      });
    }
  }, [isLoggedIn, handleNavigateToOneKeyId, closePopover, loginOneKeyId]);

  const { icon, onPrimeButtonPressed } = useOnPrimeButtonPressed({
    onPress: closePopover,
    networkId: network?.id,
  });

  const handlePrimeButtonPressed = useCallback(
    async (e: GestureResponderEvent) => {
      e.stopPropagation();
      await closePopover?.();
      await onPrimeButtonPressed();
    },
    [closePopover, onPrimeButtonPressed],
  );

  const isPrimeUser = user?.primeSubscription?.isActive && user?.onekeyUserId;
  const isPrimeDeviceLimitExceeded = user?.isPrimeDeviceLimitExceeded === true;

  if (!isLoggedIn) {
    return (
      <XStack
        alignItems="center"
        py="$4"
        px="$4"
        mx="$1"
        mt="$1"
        userSelect="none"
        justifyContent="space-between"
        onPress={handlePress}
        borderRadius="$2"
        hoverStyle={{
          bg: '$bgHover',
        }}
        pressStyle={{
          bg: '$bgActive',
        }}
      >
        <XStack alignItems="center" gap="$3" flex={1}>
          <OneKeyIdAvatar size="$10" />
          <SizableText
            size="$headingLg"
            color="$text"
            numberOfLines={1}
            userSelect="none"
          >
            OneKey ID
          </SizableText>
        </XStack>
        <XStack
          alignItems="center"
          gap="$0.5"
          pl="$3"
          pr="$1.5"
          py="$1.5"
          borderRadius="$full"
          borderWidth={StyleSheet.hairlineWidth}
          borderColor="$border"
          hoverStyle={{ borderColor: '$borderHover' }}
        >
          <SizableText size="$bodyMdMedium" color="$text" userSelect="none">
            {intl.formatMessage({ id: ETranslations.prime_signup_login })}
          </SizableText>
          <Icon name="ChevronRightSmallOutline" size="$4" color="$icon" />
        </XStack>
      </XStack>
    );
  }

  return (
    <XStack
      alignItems="center"
      py="$4"
      px="$4"
      mx="$1"
      mt="$1"
      gap="$5"
      userSelect="none"
      justifyContent="space-between"
      onPress={handleNavigateToOneKeyId}
      borderRadius="$2"
      hoverStyle={{
        bg: '$bgHover',
      }}
      pressStyle={{
        bg: '$bgActive',
      }}
    >
      <XStack alignItems="center" gap="$3" flex={1}>
        <Stack onPress={handleAvatarPress}>
          <OneKeyIdAvatar size="$14" />
        </Stack>

        <YStack flex={1} gap="$1">
          <XStack
            alignItems="center"
            gap="$1.5"
            alignSelf="flex-start"
            maxWidth="100%"
          >
            <SizableText
              size="$headingLg"
              color="$text"
              numberOfLines={1}
              ellipsizeMode="tail"
              userSelect="none"
              flexShrink={1}
            >
              {displayName}
            </SizableText>
            {isPrimeUser ? (
              <XStack
                ai="center"
                jc="center"
                gap="$1"
                px="$2"
                h={22}
                opacity={isPrimeDeviceLimitExceeded ? 0.7 : 1}
                bg={
                  isPrimeDeviceLimitExceeded ? '$bgCautionSubdued' : '$brand2'
                }
                borderRadius="$full"
                borderWidth={StyleSheet.hairlineWidth}
                borderColor={
                  isPrimeDeviceLimitExceeded
                    ? '$borderCautionSubdued'
                    : '$brand4'
                }
                flexShrink={0}
                onPress={handlePrimeButtonPressed}
              >
                <Icon
                  name={isPrimeDeviceLimitExceeded ? 'PrimeSolid' : icon}
                  size="$4"
                  color={
                    isPrimeDeviceLimitExceeded ? '$iconCaution' : undefined
                  }
                />
                <SizableText
                  size="$bodyMdMedium"
                  color={
                    isPrimeDeviceLimitExceeded ? '$textCaution' : '$brand12'
                  }
                >
                  Prime
                </SizableText>
              </XStack>
            ) : null}
          </XStack>
          <SizableText
            size="$bodyMd"
            color="$textSubdued"
            numberOfLines={1}
            userSelect="none"
          >
            {email}
          </SizableText>
        </YStack>
      </XStack>
      <Icon name="ChevronRightSmallOutline" size="$5" color="$iconSubdued" />
    </XStack>
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
  return (
    <YStack>
      <SizableText
        size="$headingMd"
        color="$text"
        numberOfLines={1}
        ellipsizeMode="middle"
        px="$5"
        pb="$1"
        userSelect="none"
      >
        {title}
      </SizableText>
      <YStack gap="$2" px="$4">
        {Array.from({ length: Math.ceil(displayItems.length / 4) }).map(
          (_, rowIndex) => (
            <XStack
              key={rowIndex}
              justifyContent="space-evenly"
              flexWrap="nowrap"
            >
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
  const {
    activeAccount: { account, network },
  } = useActiveAccount({ num: 0 });
  const scanQrCode = useScanQrCode();

  const [allTokens] = useAllTokenListAtom();
  const [map] = useAllTokenListMapAtom();

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

  const handlePrime = useCallback(() => {
    navigation.pushFullModal(EModalRoutes.PrimeModal, {
      screen: EPrimePages.PrimeDashboard,
      params: {
        networkId: network?.id,
      },
    });
  }, [navigation, network?.id]);
  const items = useMemo(() => {
    return [
      {
        title: intl.formatMessage({ id: ETranslations.settings_settings }),
        icon: 'SettingsOutline' as const,
        onPress: handleSettings,
        trackID: 'wallet-settings',
      },
      {
        title: intl.formatMessage({ id: ETranslations.scan_scan_qr_code }),
        icon: 'ScanOutline' as const,
        onPress: handleScan,
        trackID: 'wallet-scan',
      },
      !platformEnv.isWebDappMode
        ? {
            title: 'Prime',
            icon: 'PrimeOutline' as const,
            onPress: handlePrime,
            trackID: 'wallet-prime',
          }
        : undefined,
    ].filter(Boolean);
  }, [handlePrime, handleScan, handleSettings, intl]);
  return (
    <BaseMoreActionGrid
      title={intl.formatMessage({ id: ETranslations.global_general })}
      items={items}
    />
  );
}

const MoreActionWalletGrid = () => {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const handleBackup = useCallback(() => {
    navigation.pushModal(EModalRoutes.SettingModal, {
      screen: EModalSettingRoutes.SettingListSubModal,
      params: {
        name: ESettingsTabNames.Backup,
      },
    });
  }, [navigation]);
  const onPressAddressBook = useShowAddressBook({
    useNewModal: true,
  });
  const handleAddressBook = useCallback(() => {
    void onPressAddressBook(navigation);
  }, [onPressAddressBook, navigation]);

  const handleNetwork = useCallback(() => {
    navigation.pushModal(EModalRoutes.SettingModal, {
      screen: EModalSettingRoutes.SettingListSubModal,
      params: {
        name: ESettingsTabNames.Network,
      },
    });
  }, [navigation]);

  const handleSecurity = useCallback(() => {
    navigation.pushModal(EModalRoutes.SettingModal, {
      screen: EModalSettingRoutes.SettingListSubModal,
      params: {
        name: ESettingsTabNames.Security,
      },
    });
  }, [navigation]);

  const handlePreferences = useCallback(() => {
    navigation.pushModal(EModalRoutes.SettingModal, {
      screen: EModalSettingRoutes.SettingListSubModal,
      params: {
        name: ESettingsTabNames.Preferences,
      },
    });
  }, [navigation]);

  const { user } = useOneKeyAuth();
  const isPrimeUser = user?.primeSubscription?.isActive && user?.onekeyUserId;
  const {
    activeAccount: { wallet, network },
  } = useActiveAccount({ num: 0 });
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

  const items = useMemo(() => {
    return [
      platformEnv.isWebDappMode
        ? undefined
        : {
            title: intl.formatMessage({ id: ETranslations.global_backup }),
            icon: 'CloudUploadOutline' as const,
            onPress: handleBackup,
          },
      platformEnv.isWebDappMode
        ? undefined
        : {
            title: intl.formatMessage({
              id: ETranslations.settings_address_book,
            }),
            icon: 'ContactsOutline' as const,
            onPress: handleAddressBook,
          },
      platformEnv.isWebDappMode
        ? undefined
        : {
            title: intl.formatMessage({ id: ETranslations.global_network }),
            icon: 'GlobusOutline' as const,
            onPress: handleNetwork,
          },
      {
        title: intl.formatMessage({ id: ETranslations.global_preferences }),
        icon: 'SliderThreeOutline' as const,
        onPress: handlePreferences,
      },
      {
        title: intl.formatMessage({ id: ETranslations.global_security }),
        icon: 'Shield2CheckOutline' as const,
        onPress: handleSecurity,
      },
      platformEnv.isWebDappMode
        ? undefined
        : {
            title: intl.formatMessage({
              id: ETranslations.global_bulk_copy_addresses,
            }),
            icon: 'Copy3Outline' as const,
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
    ].filter(Boolean);
  }, [
    handleAddressBook,
    handleBackup,
    handleNetwork,
    handlePreferences,
    handleSecurity,
    intl,
    isPrimeUser,
    openBulkCopyAddressesModal,
  ]);
  return (
    <BaseMoreActionGrid
      title={intl.formatMessage({ id: ETranslations.global_wallet })}
      items={items}
    />
  );
};

const MoreActionMoreGrid = () => {
  const intl = useIntl();
  const handleHelpAndSupport = useCallback(() => {
    void showIntercom();
  }, []);
  const themeVariant = useThemeVariant();
  const { toReferFriendsPage } = useReferFriends();
  const handleReferFriends = useCallback(() => {
    void toReferFriendsPage();
  }, [toReferFriendsPage]);
  const items = useMemo(() => {
    return [
      {
        title: intl.formatMessage({ id: ETranslations.settings_contact_us }),
        icon: 'HelpSupportOutline' as const,
        onPress: handleHelpAndSupport,
        trackID: 'wallet-customer-support',
      },

      {
        title: intl.formatMessage({ id: ETranslations.sidebar_refer_a_friend }),
        lottieSrc:
          themeVariant === 'light' ? GiftExpandOnLight : GiftExpandOnDark,
        testID: 'referral' as const,
        onPress: handleReferFriends,
      },
    ];
  }, [handleHelpAndSupport, intl, themeVariant, handleReferFriends]);
  return (
    <BaseMoreActionGrid
      title={intl.formatMessage({ id: ETranslations.global_more })}
      items={items}
    />
  );
};

function MoreActionDevice() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { result: hwQrWalletList = [] } = usePromiseResult<
    Array<IDeviceManagementListModalItem>
  >(
    async () => {
      const r =
        await backgroundApiProxy.serviceAccount.getAllHwQrWalletWithDevice({
          filterHiddenWallet: true,
          skipDuplicateDevice: true,
        });
      const devices: Array<IDeviceManagementListModalItem> = Object.values(r)
        .filter(
          (item): item is IHwQrWalletWithDevice =>
            Boolean(item.device) && !item.wallet.deprecated,
        )
        .sort((a, b) => {
          // Sort by walletOrder or fallback to walletNo
          const orderA = a.wallet.walletOrder || a.wallet.walletNo;
          const orderB = b.wallet.walletOrder || b.wallet.walletNo;
          return orderA - orderB;
        });

      for (const item of devices) {
        const firmwareTypeBadge = await deviceUtils.getFirmwareType({
          features: item.device?.featuresInfo,
        });
        item.firmwareTypeBadge = firmwareTypeBadge;
      }
      return devices;
    },
    [],
    {
      checkIsFocused: false,
    },
  );

  const handleDevice = useCallback(() => {
    navigation.pushModal(EModalRoutes.DeviceManagementModal, {
      screen: EModalDeviceManagementRoutes.DeviceListModal,
    });
  }, [navigation]);
  return (
    <YStack
      bg="$bgSubdued"
      borderRadius="$4"
      borderWidth={StyleSheet.hairlineWidth}
      borderColor="$neutral3"
      mx="$5"
      mt="$1"
      mb="$2"
      px="$4"
      onPress={handleDevice}
    >
      {hwQrWalletList.length > 0 ? (
        <>
          {/* Header */}
          <XStack jc="space-between" ai="center" py="$3">
            <XStack ai="center" gap="$1">
              <SizableText size="$headingSm" color="$text">
                {intl.formatMessage({ id: ETranslations.global_device })}
              </SizableText>
              <SizableText size="$headingSm" color="$textSubdued">
                ({hwQrWalletList.length})
              </SizableText>
            </XStack>
            <SizableText size="$bodyMdMedium" color="$textSubdued">
              {intl.formatMessage({ id: ETranslations.global_manage })}
            </SizableText>
          </XStack>
          {/* Avatars */}
          <XStack gap="$1" pb="$4" pt="$0.5" ai="center">
            {hwQrWalletList.slice(0, 5).map((item) => (
              <WalletAvatar
                size={44}
                key={item.wallet.id}
                wallet={item.wallet}
              />
            ))}
            {hwQrWalletList.length > 5 ? (
              <Stack
                w={32}
                h={44}
                bg="$bgStrong"
                borderRadius="$2"
                ai="center"
                jc="center"
                ml="$2"
              >
                <SizableText size="$bodyMdMedium" color="$textDisabled">
                  +{hwQrWalletList.length - 5}
                </SizableText>
              </Stack>
            ) : null}
          </XStack>
        </>
      ) : (
        <XStack jc="space-between" ai="center" gap="$6" py="$3">
          <XStack ai="center" gap="$2" flex={1}>
            <Image
              w="$11"
              h="$11"
              source={require('@onekeyhq/kit/assets/hardwallet_together_logo.png')}
            />
            <SizableText
              size="$headingSm"
              numberOfLines={1}
              color="$text"
              flex={1}
            >
              {intl.formatMessage({
                id: ETranslations.wallet_connect_hardware_wallet,
              })}
            </SizableText>
          </XStack>
          <SizableText size="$bodyMdMedium" color="$textSubdued">
            {intl.formatMessage({ id: ETranslations.global_add })}
          </SizableText>
        </XStack>
      )}
    </YStack>
  );
}

function BaseMoreActionContent() {
  const isDesktopMode = useIsDesktopModeUIInTabPages();
  return (
    <YStack flex={1}>
      <ScrollView overflow="scroll" flex={1}>
        {platformEnv.isWebDappMode ? null : <UpdateReminders />}
        {platformEnv.isWebDappMode ? null : <MoreActionOneKeyId />}
        {isDesktopMode ? null : <MoreActionDevice />}
        <MoreActionDivider />
        <MoreActionGeneralGrid />
        <MoreActionDivider />
        <MoreActionWalletGrid />
        <MoreActionDivider />
        <MoreActionMoreGrid />
      </ScrollView>
      <MoreActionContentFooter />
    </YStack>
  );
}

export function MoreActionContentPage() {
  return (
    <MoreActionProvider>
      <YStack flex={1}>
        <MoreActionContentHeader showBackButton />
        <BaseMoreActionContent />
      </YStack>
    </MoreActionProvider>
  );
}

function MoreActionContent({
  containerStyle,
}: {
  containerStyle?: IYStackProps;
}) {
  const isDesktopMode = useIsDesktopModeUIInTabPages();
  return (
    <MoreActionProvider>
      <YStack minHeight={560} {...containerStyle}>
        <MoreActionContentHeader />
        {platformEnv.isWebDappMode ? null : <UpdateReminders />}
        {platformEnv.isWebDappMode ? null : <MoreActionOneKeyId />}
        {isDesktopMode ? null : <MoreActionDevice />}
        <MoreActionDivider />
        <MoreActionGeneralGrid />
        <MoreActionDivider />
        <MoreActionWalletGrid />
        <MoreActionDivider />
        <MoreActionMoreGrid />
        <YStack flex={1} />
        <MoreActionContentFooter />
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
  const isShowUpgradeDot = useIsShowAppUpdateDot();
  const isShowRedDot = useIsShowRedDot();

  // Large dot for mobile
  const dot = useMemo(() => {
    if (isShowUpgradeDot) {
      return (
        <Dot
          color="$blue8"
          top={isDesktopMode ? 0 : '$-2'}
          right={isDesktopMode && isCollapsed ? undefined : '$-2.5'}
        />
      );
    }
    return null;
  }, [isCollapsed, isDesktopMode, isShowUpgradeDot]);

  // Small dot for desktop (similar to DesktopTabItem)
  const desktopDot = useMemo(() => {
    if (!isShowUpgradeDot && !isShowRedDot) return null;
    return (
      <Stack
        width="$3"
        height="$3"
        bg={isShowUpgradeDot ? '$iconInfo' : '$bgCriticalStrong'}
        borderRadius="$full"
        position="absolute"
        right={-4}
        top={-3}
        borderWidth="$0.5"
        borderColor="$bgSidebar"
      />
    );
  }, [isShowUpgradeDot, isShowRedDot]);

  const handleMoreActionPage = useCallback(() => {
    rootNavigationRef.current?.navigate(ERootRoutes.Onboarding, {
      screen: EOnboardingV2Routes.OnboardingV2,
      params: {
        screen: EOnboardingPagesV2.MoreAction,
      },
    });
  }, []);

  if (isDesktopMode) {
    // Collapsed: icon only (no text below)
    if (isCollapsed) {
      return (
        <YStack p="$2" borderRadius="$2" hoverStyle={{ bg: '$bgHover' }}>
          <Stack position="relative">
            <Icon name="DotGridOutline" size="$5" />
            {desktopDot}
          </Stack>
        </YStack>
      );
    }

    // Expanded: horizontal layout (icon + text)
    return (
      <YStack
        userSelect="none"
        flexDirection="row"
        alignItems="center"
        px="$2"
        py="$2"
        borderRadius="$2"
        hoverStyle={{ bg: '$bgHover' }}
      >
        <Stack position="relative">
          <Icon name="DotGridOutline" size="$5" />
          {desktopDot}
        </Stack>
        <SizableText
          flex={1}
          numberOfLines={1}
          mx="$2"
          cursor="default"
          color="$text"
          size="$bodyMd"
        >
          {intl.formatMessage({ id: ETranslations.address_book_menu_title })}
        </SizableText>
      </YStack>
    );
  }

  return (
    <XStack>
      <HeaderIconButton
        testID="moreActions"
        onPress={handleMoreActionPage}
        title={intl.formatMessage({ id: ETranslations.explore_options })}
        icon="DotGridOutline"
      />
      {dot}
    </XStack>
  );
}

function MoreActionButtonCmp() {
  const intl = useIntl();
  const isDesktopMode = useIsDesktopModeUIInTabPages();
  const [{ isCollapsed }] = useAppSideBarStatusAtom();

  if (!isDesktopMode) {
    return <MoreButtonWithDot />;
  }

  // Collapsed: show tooltip; Expanded: no tooltip (text is visible)
  const trigger = isCollapsed ? (
    <Tooltip
      placement="right"
      renderTrigger={<MoreButtonWithDot />}
      renderContent={intl.formatMessage({
        id: ETranslations.address_book_menu_title,
      })}
    />
  ) : (
    <MoreButtonWithDot />
  );

  return (
    <Popover
      title={intl.formatMessage({ id: ETranslations.address_book_menu_title })}
      showHeader={false}
      keepChildrenMounted
      floatingPanelProps={{
        maxWidth: 384,
        width: 384,
        height: 560,
        p: 0,
        overflow: 'hidden',
        style: { transformOrigin: 'bottom left' },
      }}
      placement={platformEnv.isWebDappMode ? 'bottom-end' : 'right-end'}
      renderTrigger={trigger}
      renderContent={
        <MoreActionContent containerStyle={{ maxWidth: 384, width: 384 }} />
      }
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
