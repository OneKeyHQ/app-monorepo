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
} from '@onekeyhq/components';
import {
  Divider,
  HeaderIconButton,
  Icon,
  IconButton,
  LottieView,
  NavBackButton,
  ScrollView,
  SizableText,
  Stack,
  Tooltip,
  XStack,
  YStack,
  rootNavigationRef,
  useIsDesktopModeUIInTabPages,
  useIsWebHorizontalLayout,
  useTooltipContext,
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
import { UpdateReminder } from '../UpdateReminder';
import {
  isShowAppUpdateUIWhenUpdating,
  useAppUpdateInfo,
} from '../UpdateReminder/hooks';

import type { IDeviceManagementListModalItem } from '../../views/DeviceManagement/pages/DeviceManagementListModal';
import type { GestureResponderEvent } from 'react-native';
import { WalletAvatar } from '../WalletAvatar';

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

function MoreActionContentHeader({
  showBackButton,
}: {
  showBackButton?: boolean;
}) {
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

  const handleBack = useCallback(() => {
    if (rootNavigationRef.current?.canGoBack?.()) {
      rootNavigationRef.current?.goBack();
    }
  }, []);

  return (
    <XStack px="$5" pt="$3" my={1} ai="center" jc="space-between">
      {showBackButton ? (
        <NavBackButton onPress={handleBack} />
      ) : (
        <SizableText size="$headingXl">
          {intl.formatMessage({ id: ETranslations.address_book_menu_title })}
        </SizableText>
      )}
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

function MoreActionContentFooter() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { closeTooltip } = useTooltipContext();
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
    await closeTooltip();
    navigation.pushModal(EModalRoutes.SettingModal, {
      screen: EModalSettingRoutes.SettingListSubModal,
      params: {
        name: ESettingsTabNames.About,
      },
    });
  }, [closeTooltip, navigation]);
  return (
    <XStack px="$5" py="$2" jc="space-between" onPress={handleAbout}>
      <XStack gap="$2" ai="center" jc="center">
        <Icon name="InfoCircleOutline" size="$4" />
        <SizableText size="$bodySm">
          {`${intl.formatMessage({ id: ETranslations.global_about })} OneKey`}
        </SizableText>
      </XStack>
      <XStack gap="$2" ai="center" jc="center">
        <SizableText size="$bodySm">{versionString}</SizableText>
        <Icon name="ChevronRightSmallOutline" size="$4" />
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
  const { closeTooltip } = useTooltipContext();
  const { isPrimeAvailable } = usePrimeAvailable();

  const handlePress = useCallback(async () => {
    await closeTooltip?.();
    setTimeout(() => {
      if (trackID) {
        defaultLogger.ui.button.click({
          trackId: trackID,
        });
      }
    });
    onPress();
  }, [closeTooltip, onPress, trackID]);

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
      h={64}
      borderRadius="$2"
      hoverStyle={{
        bg: '$bgHover',
      }}
      userSelect="none"
    >
      <YStack m="$1">
        {icon ? <Icon name={icon} /> : null}
        {lottieSrc ? (
          <LottieView width={24} height={24} source={lottieSrc} />
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

function MoreActionDivider() {
  return (
    <XStack py="$2">
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
      px="$5"
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
      {
        title: 'Prime',
        icon: 'PrimeOutline' as const,
        onPress: handlePrime,
        trackID: 'wallet-prime',
      },
    ];
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
      {
        title: intl.formatMessage({ id: ETranslations.global_backup }),
        icon: 'CloudUploadOutline' as const,
        onPress: handleBackup,
      },
      {
        title: intl.formatMessage({ id: ETranslations.settings_address_book }),
        icon: 'ContactsOutline' as const,
        onPress: handleAddressBook,
      },
      {
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
      {
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
    ];
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
  return hwQrWalletList.length > 0 ? (
    <YStack
      bg="$bgSubdued"
      mx="$5"
      my="41"
      px="$3"
      py="$5"
      gap="$3"
      borderRadius="$4"
      borderWidth={StyleSheet.hairlineWidth}
      borderColor="$neutral3"
      onPress={handleDevice}
    >
      <SizableText
        size="$headingMd"
        color="$text"
        numberOfLines={1}
        ellipsizeMode="middle"
      >
        {`${intl.formatMessage({ id: ETranslations.global_device })} (3)`}
      </SizableText>
      <XStack>
        <XStack>
          {hwQrWalletList.map((item) => (
            <WalletAvatar key={item.wallet.id} wallet={item.wallet} />
          ))}
        </XStack>
        <IconButton
          variant="tertiary"
          icon="ChevronRightOutline"
          size="small"
          onPress={handleDevice}
        />
      </XStack>
    </YStack>
  ) : null;
}

function BaseMoreActionContent() {
  const isDesktopMode = useIsDesktopModeUIInTabPages();
  return (
    <ScrollView
      overflow="scroll"
      h={462}
      contentContainerStyle={{
        py: '$2',
      }}
    >
      <UpdateReminders />
      <MoreActionOneKeyId />
      {isDesktopMode ? null : <MoreActionDevice />}
      <MoreActionDivider />
      <MoreActionGeneralGrid />
      <MoreActionDivider />
      <MoreActionWalletGrid />
      <MoreActionDivider />
      <MoreActionMoreGrid />
    </ScrollView>
  );
}

export function MoreActionContentPage() {
  return (
    <MoreActionProvider>
      <MoreActionContentHeader showBackButton />
      <BaseMoreActionContent />
    </MoreActionProvider>
  );
}

function MoreActionContent() {
  return (
    <MoreActionProvider>
      <YStack>
        <MoreActionContentHeader />
        <BaseMoreActionContent />
        <MoreActionDivider />
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
  const isShowRedDot = useIsShowRedDot();
  const isShowUpgradeDot = useIsShowAppUpdateDot();
  const dot = useMemo(() => {
    if (isShowUpgradeDot) {
      return <Dot color="$blue8" top={isDesktopMode ? 0 : '$-2'} />;
    }
    return isShowRedDot ? <Dot color="$bgCriticalStrong" /> : null;
  }, [isDesktopMode, isShowRedDot, isShowUpgradeDot]);

  const handleMoreActionPage = useCallback(() => {
    rootNavigationRef.current?.navigate(ERootRoutes.Onboarding, {
      screen: EOnboardingV2Routes.OnboardingV2,
      params: {
        screen: EOnboardingPagesV2.MoreAction,
      },
    });
  }, []);
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
        onPress={handleMoreActionPage}
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
      hovering
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
