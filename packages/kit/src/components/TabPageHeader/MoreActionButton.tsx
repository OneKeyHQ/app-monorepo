import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import type {
  IActionListItemProps,
  IIconButtonProps,
} from '@onekeyhq/components';
import {
  ActionList,
  Divider,
  HeaderIconButton,
  Icon,
  IconButton,
  Popover,
  SizableText,
  XStack,
  YStack,
  useMedia,
  usePopoverContext,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useShowAddressBook } from '@onekeyhq/kit/src/hooks/useShowAddressBook';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  useAllTokenListAtom,
  useAllTokenListMapAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/tokenList';
import {
  useIsShowMyOneKeyOnTabbar,
  useToMyOneKeyModal,
} from '@onekeyhq/kit/src/views/DeviceManagement/hooks/useToMyOneKeyModal';
import { HomeTokenListProviderMirror } from '@onekeyhq/kit/src/views/Home/components/HomeTokenListProvider/HomeTokenListProviderMirror';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes, EModalSettingRoutes } from '@onekeyhq/shared/src/routes';
import { EModalNotificationsRoutes } from '@onekeyhq/shared/src/routes/notifications';
import extUtils from '@onekeyhq/shared/src/utils/extUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useLoginOneKeyId } from '../../hooks/useLoginOneKeyId';
import { useReferFriends } from '../../hooks/useReferFriends';
import { PrimeHeaderIconButtonLazy } from '../../views/Prime/components/PrimeHeaderIconButton';
import { usePrimeAuthV2 } from '../../views/Prime/hooks/usePrimeAuthV2';
import useScanQrCode from '../../views/ScanQrCode/hooks/useScanQrCode';
import { useOnLock } from '../../views/Setting/pages/List/DefaultSection';
import { AccountSelectorProviderMirror } from '../AccountSelector';

import type { GestureResponderEvent } from 'react-native';

const pressStyle = {
  bg: '$bgActive',
  borderRadius: '$2.5',
} as const;
const hoverStyle = { bg: '$bgHover', borderRadius: '$2.5' } as const;

function MoreActionContentHeader() {
  const intl = useIntl();
  const { user } = usePrimeAuthV2();
  const [devSettings] = useDevSettingsPersistAtom();
  const { closePopover } = usePopoverContext();

  const { shareReferRewards } = useReferFriends();
  const { loginOneKeyId } = useLoginOneKeyId();

  const handleLogin = useCallback(async () => {
    await closePopover?.();
    await loginOneKeyId({
      toOneKeyIdPageOnLoginSuccess: true,
    });
  }, [closePopover, loginOneKeyId]);

  const handleShareReferRewards = useCallback(async () => {
    await closePopover?.();
    await shareReferRewards();
  }, [closePopover, shareReferRewards]);
  return (
    <XStack
      pl="$3"
      pr="$5"
      h="$16"
      bg="$bgSubdued"
      ai="center"
      jc="space-between"
      borderBottomWidth={StyleSheet.hairlineWidth}
      borderColor="$borderSubdued"
    >
      <XStack
        gap="$1"
        ai="center"
        pl="$2"
        pr={0}
        py="$1.5"
        onPress={handleLogin}
        pressStyle={pressStyle}
        hoverStyle={hoverStyle}
      >
        <SizableText>{user?.displayEmail || `Sign in / Register`}</SizableText>
        <Icon name="ChevronRightSmallOutline" size="$5" color="$iconSubdued" />
      </XStack>
      <XStack gap="$5" ai="center">
        {devSettings?.enabled && devSettings?.settings?.showPrimeTest ? (
          <PrimeHeaderIconButtonLazy
            key="prime"
            visible
            onPress={closePopover}
          />
        ) : null}
        <IconButton
          variant="tertiary"
          title={intl.formatMessage({ id: ETranslations.referral_title })}
          icon="GiftOutline"
          onPress={handleShareReferRewards}
        />
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
  const [allTokens] = useAllTokenListAtom();
  const [map] = useAllTokenListMapAtom();
  const {
    activeAccount: { account, network },
  } = useActiveAccount({ num: 0 });
  const scanQrCode = useScanQrCode();
  const onLock = useOnLock();
  const handleLock = useCallback(async () => {
    await onLock();
  }, [onLock]);
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
              label: intl.formatMessage({
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
        title: intl.formatMessage({ id: ETranslations.scan_scan_qr_code }),
        icon: 'ScanOutline' as const,
        onPress: handleScan,
      },
      {
        title: intl.formatMessage({ id: ETranslations.settings_lock_now }),
        icon: 'LockOutline' as const,
        onPress: handleLock,
      },
    ];
  }, [handleLock, handleScan, intl, popupMenu]);
  return (
    <XStack p="$5" ai="center" jc="flex-end" gap="$5">
      {items.map((item) => (
        <MoreActionContentFooterItem key={item.title} {...item} />
      ))}
    </XStack>
  );
}

interface IMoreActionContentGridItemProps {
  title: IIconButtonProps['title'];
  icon: IIconButtonProps['icon'];
  onPress: () => void;
}

function MoreActionContentGridItem({
  title,
  icon,
  onPress,
}: IMoreActionContentGridItemProps) {
  const { closePopover } = usePopoverContext();
  const handlePress = useCallback(async () => {
    await closePopover?.();
    onPress();
  }, [closePopover, onPress]);
  return (
    <YStack
      onPress={handlePress}
      pressStyle={pressStyle}
      hoverStyle={hoverStyle}
      mt="$2.5"
      py="$2"
      w="30%"
      ai="center"
      jc="center"
      gap="$2"
    >
      <Icon name={icon} size="$10" />
      <SizableText size="$bodyMd">{title}</SizableText>
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
  const openAddressBook = useShowAddressBook({
    useNewModal: true,
  });
  const toMyOneKeyModal = useToMyOneKeyModal();
  const handleDeviceManagement = useCallback(async () => {
    await toMyOneKeyModal();
  }, [toMyOneKeyModal]);

  const navigation = useAppNavigation();
  const handleSettings = useCallback(() => {
    navigation.pushModal(EModalRoutes.SettingModal, {
      screen: EModalSettingRoutes.SettingListModal,
    });
  }, [navigation]);

  const openNotificationsModal = useCallback(async () => {
    navigation.pushModal(EModalRoutes.NotificationsModal, {
      screen: EModalNotificationsRoutes.NotificationList,
    });
  }, [navigation]);

  const items = useMemo(() => {
    return [
      {
        title: intl.formatMessage({
          id: ETranslations.address_book_title,
        }),
        icon: 'ContactsOutline',
        onPress: openAddressBook,
      },
      {
        title: intl.formatMessage({
          id: ETranslations.global_my_onekey,
        }),
        icon: 'OnekeyDeviceCustom',
        onPress: handleDeviceManagement,
      },
      {
        title: intl.formatMessage({
          id: ETranslations.settings_settings,
        }),
        icon: 'SettingsOutline',
        onPress: handleSettings,
      },
      {
        title: intl.formatMessage({
          id: ETranslations.global_notifications,
        }),
        icon: 'BellOutline',
        onPress: openNotificationsModal,
      },
    ] as IMoreActionContentGridItemProps[];
  }, [
    handleDeviceManagement,
    handleSettings,
    intl,
    openAddressBook,
    openNotificationsModal,
  ]);

  return (
    <YStack px="$5">
      <XStack pt="$2.5" pb="$5" jc="space-between" flexWrap="wrap">
        <MoreActionContentGridRender items={items} />
      </XStack>
      <Divider />
    </YStack>
  );
}

function MoreActionContent() {
  return (
    <YStack>
      <MoreActionContentHeader />
      <MoreActionContentGrid />
      <MoreActionContentFooter />
    </YStack>
  );
}

function MoreActionButtonCmp() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const onLock = useOnLock();
  const scanQrCode = useScanQrCode();
  const {
    activeAccount: { account, network },
  } = useActiveAccount({ num: 0 });
  const [allTokens] = useAllTokenListAtom();
  const [map] = useAllTokenListMapAtom();
  const openAddressBook = useShowAddressBook({
    useNewModal: true,
  });

  const handleScan = useCallback(
    async (close: () => void) => {
      close();
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
    },
    [scanQrCode, account, allTokens, map, network],
  );

  const handleSettings = useCallback(
    (close: () => void) => {
      close();
      navigation.pushModal(EModalRoutes.SettingModal, {
        screen: EModalSettingRoutes.SettingListModal,
      });
    },
    [navigation],
  );

  const toMyOneKeyModal = useToMyOneKeyModal();
  const isShowMyOneKeyOnTabbar = useIsShowMyOneKeyOnTabbar();
  const handleDeviceManagement = useCallback(
    async (close: () => void) => {
      close();
      void toMyOneKeyModal();
    },
    [toMyOneKeyModal],
  );

  const handleAddressBook = useCallback(
    (close: () => void) => {
      close();
      void openAddressBook();
    },
    [openAddressBook],
  );
  const { toReferFriendsPage } = useReferFriends();
  const { loginOneKeyId } = useLoginOneKeyId();
  const media = useMedia();
  const popupMenu = useMemo(() => {
    if (platformEnv.isExtensionUiPopup || platformEnv.isExtensionUiSidePanel) {
      const routeInfo = {
        routes: '',
      };
      return [
        platformEnv.isExtensionUiPopup
          ? {
              label: intl.formatMessage({
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
              label: intl.formatMessage({
                id: ETranslations.open_as_popup,
              }),
              icon: 'LayoutTopOutline' as const,
              onPress: async () => {
                await extUtils.openPanelOnActionClick(false);
                window.close();
              },
            },
        {
          label: intl.formatMessage({
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

  return (
    <Popover
      title={intl.formatMessage({ id: ETranslations.explore_options })}
      placement="bottom-end"
      renderTrigger={
        <HeaderIconButton
          title={intl.formatMessage({ id: ETranslations.explore_options })}
          icon="DotGridOutline"
        />
      }
      renderContent={MoreActionContent}
    />
  );
  return (
    <ActionList
      key="more-action"
      title={intl.formatMessage({ id: ETranslations.explore_options })}
      renderTrigger={
        <HeaderIconButton
          title={intl.formatMessage({ id: ETranslations.explore_options })}
          icon="DotGridOutline"
        />
      }
      sections={[
        {
          items: [
            {
              label: intl.formatMessage({
                id: ETranslations.settings_lock_now,
              }),
              icon: 'LockOutline' as const,
              onPress: () => {
                void onLock();
              },
              testID: 'lock-now',
              trackID: 'wallet-lock-now',
            },
            {
              label: intl.formatMessage({
                id: ETranslations.scan_scan_qr_code,
              }),
              icon: 'ScanOutline' as const,
              onPress: handleScan,
              testID: 'scan-qr-code',
              trackID: 'wallet-scan',
            },
            ...popupMenu,
          ].filter(Boolean),
        },
        {
          items: [
            media.md
              ? {
                  label: 'OneKey ID',
                  icon: 'PeopleOutline',
                  onPress: async () => {
                    await loginOneKeyId({
                      toOneKeyIdPageOnLoginSuccess: true,
                    });
                  },
                  testID: 'onekey_id',
                }
              : null,
            !isShowMyOneKeyOnTabbar
              ? {
                  label: intl.formatMessage({
                    id: ETranslations.id_refer_a_friend,
                  }),
                  icon: 'GiftOutline',
                  onPress: toReferFriendsPage,
                  testID: 'refer-a-friend',
                }
              : null,
          ].filter(Boolean) as IActionListItemProps[],
        },
        {
          items: !isShowMyOneKeyOnTabbar
            ? [
                {
                  label: intl.formatMessage({
                    id: ETranslations.global_my_onekey,
                  }),
                  icon: 'OnekeyDeviceCustom',
                  onPress: handleDeviceManagement,
                  testID: 'my-onekey',
                },
                {
                  label: intl.formatMessage({
                    id: ETranslations.address_book_title,
                  }),
                  icon: 'ContactsOutline',
                  onPress: handleAddressBook,
                  testID: 'address-book',
                  trackID: 'wallet-address-book',
                },
              ]
            : [
                {
                  label: intl.formatMessage({
                    id: ETranslations.address_book_title,
                  }),
                  icon: 'ContactsOutline',
                  onPress: handleAddressBook,
                  testID: 'address-book',
                  trackID: 'wallet-address-book',
                },
              ],
        },
        !isShowMyOneKeyOnTabbar
          ? {
              items: [
                {
                  label: intl.formatMessage({
                    id: ETranslations.settings_settings,
                  }),
                  icon: 'SettingsOutline',
                  onPress: handleSettings,
                  trackID: 'wallet-settings',
                },
              ],
            }
          : null,
      ].filter(Boolean)}
    />
  );
}

export function MoreActionButton() {
  return (
    <AccountSelectorProviderMirror
      enabledNum={[0]}
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
    >
      <HomeTokenListProviderMirror>
        <MoreActionButtonCmp />
      </HomeTokenListProviderMirror>
    </AccountSelectorProviderMirror>
  );
}
