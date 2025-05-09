import { useCallback, useMemo } from 'react';
import type { PropsWithChildren } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import type { IIconButtonProps } from '@onekeyhq/components';
import {
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
import { useToMyOneKeyModal } from '@onekeyhq/kit/src/views/DeviceManagement/hooks/useToMyOneKeyModal';
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
      px="$5"
      py="$4"
      bg="$bgSubdued"
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
        <SizableText size="$bodyMd" userSelect="none">
          {user?.displayEmail ||
            intl.formatMessage({ id: ETranslations.prime_signup_login })}
        </SizableText>
        <Icon name="ChevronRightSmallOutline" size="$5" color="$iconSubdued" />
      </XStack>
      <XStack gap="$5">
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
          icon="ColorfulGiftCustom"
          testID="refer-a-friend"
          trackID="gift-in-more-action"
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
        testID: 'scan-qr-code',
        trackID: 'wallet-scan',
      },
      {
        title: intl.formatMessage({ id: ETranslations.settings_lock_now }),
        icon: 'LockOutline' as const,
        onPress: handleLock,
        testID: 'lock-now',
        trackID: 'wallet-lock-now',
      },
    ];
  }, [handleLock, handleScan, intl, popupMenu]);
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
}

function MoreActionContentGridItem({
  title,
  icon,
  onPress,
  testID,
  trackID,
}: IMoreActionContentGridItemProps) {
  const { closePopover } = usePopoverContext();
  const handlePress = useCallback(async () => {
    await closePopover?.();
    onPress();
    if (trackID) {
      defaultLogger.ui.button.click({
        trackId: trackID,
      });
    }
  }, [closePopover, onPress, trackID]);
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
        p="$3"
        borderRadius="$2"
        borderCurve="continuous"
        bg="$bgStrong"
        $group-hover={{
          bg: '$neutral4',
        }}
        $group-press={{
          bg: '$neutral5',
        }}
      >
        <Icon name={icon} />
      </YStack>
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
  const { gtMd } = useMedia();
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
      gtMd
        ? undefined
        : {
            title: intl.formatMessage({
              id: ETranslations.global_notifications,
            }),
            icon: 'BellOutline',
            onPress: openNotificationsModal,
            trackID: 'notification-in-more-action',
          },
    ].filter(Boolean) as IMoreActionContentGridItemProps[];
  }, [
    gtMd,
    handleDeviceManagement,
    handleSettings,
    intl,
    openAddressBook,
    openNotificationsModal,
  ]);

  return (
    <YStack gap="$5">
      <XStack flexWrap="wrap" mx={-5} my="$-2.5">
        <MoreActionContentGridRender items={items} />
      </XStack>
      <Divider />
    </YStack>
  );
}

function MoreActionContent() {
  return (
    <MoreActionProvider>
      <YStack>
        <MoreActionContentHeader />
        <YStack p="$5" gap="$5">
          <MoreActionContentGrid />
          <MoreActionContentFooter />
        </YStack>
      </YStack>
    </MoreActionProvider>
  );
}

function MoreActionButtonCmp() {
  const intl = useIntl();
  return (
    <Popover
      title=""
      offset={{
        mainAxis: 12,
        crossAxis: 20,
      }}
      showHeader={false}
      placement="bottom-end"
      floatingPanelProps={{
        overflow: 'hidden',
      }}
      renderTrigger={
        <HeaderIconButton
          title={intl.formatMessage({ id: ETranslations.explore_options })}
          icon="DotGridOutline"
        />
      }
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
