import { Suspense, lazy, useCallback, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';

import type { IKeyOfIcons } from '@onekeyhq/components';
import {
  Button,
  Divider,
  Icon,
  ScrollView,
  SizableText,
  Stack,
  XStack,
  YStack,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import { useNotificationsAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { WALLET_TYPE_HD } from '@onekeyhq/shared/src/consts/dbConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { showIntercom } from '@onekeyhq/shared/src/modules3rdParty/intercom';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EModalRoutes,
  EModalSettingRoutes,
  ESettingsTabNames,
  ETabDeveloperRoutes,
} from '@onekeyhq/shared/src/routes';
import { EModalNotificationsRoutes } from '@onekeyhq/shared/src/routes/notifications';
import { EPrimePages } from '@onekeyhq/shared/src/routes/prime';
import { travelModeManager } from '@onekeyhq/shared/src/travelMode';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../hooks/useAppNavigation';
import { useIntercomUnreadCount } from '../../hooks/useIntercomUnreadCount';
import { useOnLock } from '../../hooks/useOnLock';
import { useReferFriends } from '../../hooks/useReferFriends';
import { useShowAddressBook } from '../../hooks/useShowAddressBook';
import { useActiveAccount } from '../../states/jotai/contexts/accountSelector';
import { useHomeTokenListSnapshot } from '../../states/jotai/contexts/tokenList/cells';
import { useDeviceManagerNavigation } from '../../views/DeviceManagement/hooks/useDeviceManagerNavigation';
import useScanQrCodeLazy from '../../views/ScanQrCode/hooks/useScanQrCodeLazy';
import { logSettingCategoryOpened } from '../../views/Setting/pages/Tab/settingsAnalytics';
import { AccountAvatar } from '../AccountAvatar';
import { AccountSelectorActiveAccountHome } from '../AccountSelector/AccountSelectorActiveAccount';
import { useAccountSelectorTrigger } from '../AccountSelector/hooks/useAccountSelectorTrigger';
import { MoreActionProvider, UpdateReminders } from '../MoreActionButton';
import { useOneKeyAuth } from '../OneKeyAuth/useOneKeyAuth';
import { OneKeyIdAvatar } from '../OneKeyIdAvatar';

import {
  closeProfileDrawer,
  useIsProfileDrawerOpen,
} from './profileDrawerStore';

const LazyPrimeUserBadge = lazy(async () => {
  const { PrimeUserBadge } =
    await import('../../views/Prime/components/PrimeUserBadge');
  return { default: PrimeUserBadge };
});

const ROW_PRESS_STYLE = { bg: '$bgActive' } as const;
const NOTIFICATION_COUNT_CAP = 99;
// Native development opens Developer from this drawer, as from the More page.
const showDevModeEntry = platformEnv.isDev && platformEnv.isNative;

function isTravelModeActive() {
  return (
    travelModeManager.getRuntimeEnvironmentSync().profile.kind === 'travel-mode'
  );
}

function DrawerRow({
  icon,
  label,
  trackID,
  onPress,
  detail,
  detailCritical,
  trailing,
  disabled,
  testID,
}: {
  icon: IKeyOfIcons;
  label: string;
  trackID: string;
  onPress: () => void;
  detail?: string;
  detailCritical?: boolean;
  trailing?: ReactNode;
  disabled?: boolean;
  testID?: string;
}) {
  const handlePress = useCallback(() => {
    if (disabled) return;
    defaultLogger.ui.button.click({ trackId: trackID });
    onPress();
  }, [disabled, onPress, trackID]);
  return (
    <XStack
      testID={testID}
      role="button"
      aria-label={detail ? `${label}, ${detail}` : label}
      aria-disabled={disabled}
      minHeight={44}
      mx="$-3"
      px="$3"
      py="$2.5"
      gap="$3"
      alignItems="center"
      borderRadius="$3"
      borderCurve="continuous"
      opacity={disabled ? 0.5 : 1}
      pressStyle={disabled ? undefined : ROW_PRESS_STYLE}
      onPress={handlePress}
    >
      <Icon name={icon} size="$6" color="$icon" />
      <SizableText
        flex={1}
        size="$bodyLgMedium"
        color="$text"
        numberOfLines={1}
      >
        {label}
      </SizableText>
      {detail ? (
        <SizableText
          size="$bodyMd"
          color={detailCritical ? '$textCritical' : '$textSubdued'}
          numberOfLines={1}
          maxWidth="50%"
        >
          {detail}
        </SizableText>
      ) : null}
      {trailing}
    </XStack>
  );
}

function UnreadDot() {
  return <Stack w="$2" h="$2" borderRadius="$full" bg="$bgCriticalStrong" />;
}

function NotificationCount({ count }: { count?: number }) {
  if (!count) return <UnreadDot />;
  return (
    <XStack
      minWidth="$4"
      h="$4"
      px="$1"
      borderRadius="$full"
      bg="$bgCriticalStrong"
      alignItems="center"
      justifyContent="center"
    >
      <SizableText size="$bodySmMedium" color="$textOnColor">
        {count > NOTIFICATION_COUNT_CAP
          ? `${NOTIFICATION_COUNT_CAP}+`
          : String(count)}
      </SizableText>
    </XStack>
  );
}

function DrawerScanButton() {
  const intl = useIntl();
  const {
    activeAccount: { account, network },
  } = useActiveAccount({ num: 0 });
  const { tokens, keys, map } = useHomeTokenListSnapshot();
  const scanQrCode = useScanQrCodeLazy();
  const label = intl.formatMessage({ id: ETranslations.scan_scan_qr_code });
  const handleScan = useCallback(() => {
    defaultLogger.ui.button.click({ trackId: 'wallet-scan' });
    closeProfileDrawer();
    void scanQrCode.start({
      handlers: scanQrCode.PARSE_HANDLER_NAMES.all,
      autoExecuteParsedAction: true,
      account,
      network,
      tokens: { data: tokens, keys, map },
    });
  }, [account, keys, map, network, scanQrCode, tokens]);
  return (
    <Stack
      testID="profile-drawer-scan"
      role="button"
      aria-label={label}
      w="$9"
      h="$9"
      borderRadius="$full"
      bg="$bgStrong"
      alignItems="center"
      justifyContent="center"
      // The 36 circle reaches 44 under a finger.
      hitSlop={4}
      pressStyle={{ bg: '$bgStrongActive' }}
      onPress={handleScan}
    >
      <Icon name="ScanOutline" size="$6" color="$icon" />
    </Stack>
  );
}

function DrawerIdentity() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { user, isLoggedIn, loginOneKeyId } = useOneKeyAuth();
  const isTravelMode = isTravelModeActive();

  useEffect(() => {
    if (isLoggedIn) {
      void backgroundApiProxy.servicePrime.apiFetchPrimeUserInfo();
    }
  }, [isLoggedIn]);

  const handleOneKeyId = useCallback(() => {
    defaultLogger.ui.button.click({ trackId: 'wallet-onekey-id' });
    closeProfileDrawer();
    navigation.pushModal(EModalRoutes.PrimeModal, {
      screen: EPrimePages.OneKeyId,
    });
  }, [navigation]);

  const handleLogin = useCallback(() => {
    if (isTravelMode) return;
    defaultLogger.ui.button.click({ trackId: 'wallet-onekey-id' });
    closeProfileDrawer();
    void loginOneKeyId({ toOneKeyIdPageOnLoginSuccess: false });
  }, [isTravelMode, loginOneKeyId]);

  if (!isLoggedIn) {
    return (
      <YStack gap="$3">
        <XStack alignItems="center" justifyContent="space-between">
          <OneKeyIdAvatar size="$14" showSocialBadge={false} />
          <DrawerScanButton />
        </XStack>
        <Button
          testID="profile-drawer-sign-in"
          alignSelf="flex-start"
          size="medium"
          variant="primary"
          disabled={isTravelMode}
          onPress={handleLogin}
        >
          {intl.formatMessage({
            id: ETranslations.sign_in_to_onekey_id__title,
          })}
        </Button>
      </YStack>
    );
  }

  const name = user?.nickname || 'OneKey ID';
  const email = user?.displayEmail?.trim();
  const isPrimeUser = user?.primeSubscription?.isActive && user?.onekeyUserId;
  return (
    <XStack alignItems="flex-start" justifyContent="space-between" gap="$2">
      <YStack
        testID="profile-drawer-onekey-id"
        role="button"
        aria-label={[name, email, 'OneKey ID'].filter(Boolean).join(', ')}
        flex={1}
        minWidth={0}
        gap="$3"
        p="$2"
        m="$-2"
        borderRadius="$4"
        borderCurve="continuous"
        pressStyle={ROW_PRESS_STYLE}
        onPress={handleOneKeyId}
      >
        <OneKeyIdAvatar size="$14" showSocialBadge={false} />
        <XStack alignItems="center" gap="$2">
          <YStack flex={1} minWidth={0} gap="$1">
            <XStack alignItems="center" gap="$1.5" minWidth={0}>
              <SizableText
                size="$headingLg"
                color="$text"
                numberOfLines={1}
                flexShrink={1}
              >
                {name}
              </SizableText>
              {isPrimeUser ? (
                <Suspense fallback={null}>
                  <LazyPrimeUserBadge showFreeStatus={false} />
                </Suspense>
              ) : null}
            </XStack>
            {email ? (
              <SizableText
                size="$bodyMd"
                color="$textSubdued"
                numberOfLines={1}
              >
                {email}
              </SizableText>
            ) : null}
          </YStack>
          <Icon
            name="ChevronRightSmallOutline"
            size="$5"
            color="$iconSubdued"
          />
        </XStack>
      </YStack>
      <DrawerScanButton />
    </XStack>
  );
}

function DrawerAccountRow() {
  const intl = useIntl();
  const {
    activeAccount: {
      wallet,
      account,
      indexedAccount,
      dbAccount,
      accountName,
      network,
      vaultSettings,
    },
  } = useActiveAccount({ num: 0 });
  const { showAccountSelector } = useAccountSelectorTrigger({
    num: 0,
    editable: true,
    linkNetwork: !network?.isAllNetworks,
    linkNetworkId: network?.isAllNetworks ? undefined : network?.id,
    hideAddress: vaultSettings?.mergeDeriveAssetsEnabled,
    keepAllOtherAccounts: true,
    allowSelectEmptyAccount: true,
  });
  const hasNoUsableWallet = accountUtils.hasNoUsableWallet({
    wallet,
    account,
  });
  const isNotBackedUp = wallet?.type === WALLET_TYPE_HD && !wallet.backuped;
  const title = hasNoUsableWallet
    ? intl.formatMessage({
        id: ETranslations.onboarding_create_or_import_wallet,
      })
    : accountName || intl.formatMessage({ id: ETranslations.no_account });
  // Every wallet has an "Account #1"; the wallet name tells them apart, and
  // All Networks has no single address to show.
  const subtitle = hasNoUsableWallet ? undefined : wallet?.name;

  const handlePress = useCallback(() => {
    closeProfileDrawer();
    showAccountSelector();
  }, [showAccountSelector]);

  return (
    <XStack
      testID="profile-drawer-account"
      role="button"
      aria-label={[title, subtitle].filter(Boolean).join(', ')}
      minHeight={56}
      mx="$-3"
      px="$3"
      py="$2"
      gap="$3"
      alignItems="center"
      borderRadius="$3"
      borderCurve="continuous"
      pressStyle={ROW_PRESS_STYLE}
      onPress={handlePress}
    >
      {hasNoUsableWallet ? (
        <Stack
          w="$8"
          h="$8"
          borderRadius="$2"
          bg="$bgStrong"
          alignItems="center"
          justifyContent="center"
        >
          <Icon name="PlusLargeOutline" size="$5" color="$icon" />
        </Stack>
      ) : (
        <AccountAvatar
          size="medium"
          borderRadius="$2"
          indexedAccount={indexedAccount}
          account={account}
          dbAccount={dbAccount}
          wallet={wallet}
        />
      )}
      <YStack flex={1} minWidth={0}>
        <SizableText size="$bodyLgMedium" color="$text" numberOfLines={1}>
          {title}
        </SizableText>
        {subtitle ? (
          <SizableText size="$bodySm" color="$textSubdued" numberOfLines={1}>
            {subtitle}
          </SizableText>
        ) : null}
      </YStack>
      {hasNoUsableWallet || isNotBackedUp ? null : (
        // Copies like the old home header: All Networks opens the address
        // list, hardware wallets verify on the device.
        <Stack p="$1.5">
          <AccountSelectorActiveAccountHome
            num={0}
            showAccountAddress={false}
            showCopyButton
            showCreateAddressButton={false}
            showNoAddressTip={false}
          />
        </Stack>
      )}
      <Icon name="ChevronRightSmallOutline" size="$5" color="$iconSubdued" />
    </XStack>
  );
}

function ProfileDrawerBody() {
  const intl = useIntl();
  const { top, bottom } = useSafeAreaInsets();
  const navigation = useAppNavigation();
  const isOpen = useIsProfileDrawerOpen();
  const isTravelMode = isTravelModeActive();
  const onLock = useOnLock();
  const { pushToDeviceList } = useDeviceManagerNavigation();
  const onPressAddressBook = useShowAddressBook({ useNewModal: true });
  const hasUnreadSupportMessages = useIntercomUnreadCount() > 0;
  const [{ firstTimeGuideOpened, badge }] = useNotificationsAtom();
  const { user, isPrimeActive } = useOneKeyAuth();
  const isPrimeUser = Boolean(isPrimeActive && user?.onekeyUserId);
  const {
    activeAccount: { wallet, network },
  } = useActiveAccount({ num: 0 });
  const isNotBackedUp = wallet?.type === WALLET_TYPE_HD && !wallet.backuped;
  const beforeReferralNavigate = useCallback(async () => {
    closeProfileDrawer();
  }, []);
  const { toReferFriendsPage, isReferralEntryPending } = useReferFriends({
    isEntryActive: isOpen,
    beforeNavigate: beforeReferralNavigate,
  });

  const openSettingsCategory = useCallback(
    (category: ESettingsTabNames) => {
      closeProfileDrawer();
      logSettingCategoryOpened({ category, source: 'moreActions' });
      navigation.pushModal(EModalRoutes.SettingModal, {
        screen: EModalSettingRoutes.SettingListSubModal,
        params: { name: category },
      });
    },
    [navigation],
  );

  const handlers = useMemo(
    () => ({
      notifications: () => {
        closeProfileDrawer();
        navigation.pushModal(EModalRoutes.NotificationsModal, {
          screen: EModalNotificationsRoutes.NotificationList,
        });
      },
      devices: () => {
        closeProfileDrawer();
        void pushToDeviceList();
      },
      backup: () => openSettingsCategory(ESettingsTabNames.Backup),
      addressBook: () => {
        closeProfileDrawer();
        void onPressAddressBook(navigation);
      },
      prime: () => {
        closeProfileDrawer();
        navigation.pushFullModal(EModalRoutes.PrimeModal, {
          screen: EPrimePages.PrimeDashboard,
          params: { networkId: network?.id },
        });
      },
      referral: () => {
        void toReferFriendsPage();
      },
      settings: () => {
        closeProfileDrawer();
        navigation.pushModal(EModalRoutes.SettingModal, {
          screen: EModalSettingRoutes.SettingListModal,
        });
      },
      support: () => {
        closeProfileDrawer();
        void showIntercom();
      },
      lock: () => {
        closeProfileDrawer();
        void onLock();
      },
      devMode: () => {
        closeProfileDrawer();
        navigation.pushModal(EModalRoutes.DeveloperModal, {
          screen: ETabDeveloperRoutes.TabDeveloper,
        });
      },
    }),
    [
      navigation,
      network?.id,
      onLock,
      onPressAddressBook,
      openSettingsCategory,
      pushToDeviceList,
      toReferFriendsPage,
    ],
  );

  const showNotificationMark = !firstTimeGuideOpened || !!badge;
  const notificationCount = firstTimeGuideOpened ? badge : undefined;
  const primeDetail = isPrimeUser
    ? [
        intl.formatMessage({ id: ETranslations.wallet_bulk_send_title }),
        intl.formatMessage({ id: ETranslations.address_risk_check__title }),
      ].join(' · ')
    : intl.formatMessage({ id: ETranslations.global_learn_more });

  return (
    <ScrollView
      flex={1}
      // The drawer shares the app's background; the pushed page reads as
      // the card.
      bg="$bgApp"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        flexGrow: 1,
        paddingTop: top + 20,
        paddingBottom: bottom + 16,
      }}
    >
      <YStack px="$5">
        <DrawerIdentity />
      </YStack>
      <YStack mt="$4">
        <UpdateReminders />
      </YStack>
      {/* Grows on tall screens so the last group sits at the bottom; on
          short ones everything scrolls together. */}
      <YStack px="$5" flexGrow={1}>
        <DrawerAccountRow />
        <Divider my="$2" />
        <DrawerRow
          testID="profile-drawer-notifications"
          icon="BellOutline"
          label={intl.formatMessage({ id: ETranslations.global_notifications })}
          trackID="wallet-notifications"
          onPress={handlers.notifications}
          disabled={isTravelMode}
          trailing={
            showNotificationMark ? (
              <NotificationCount count={notificationCount} />
            ) : null
          }
        />
        {isTravelMode ? null : (
          <DrawerRow
            testID="profile-drawer-devices"
            icon="PhoneOutline"
            label={intl.formatMessage({ id: ETranslations.global_my_device })}
            trackID="wallet-device"
            onPress={handlers.devices}
          />
        )}
        <DrawerRow
          testID="profile-drawer-backup"
          icon="CloudUploadOutline"
          label={intl.formatMessage({ id: ETranslations.global_backup })}
          trackID="wallet-backup"
          onPress={handlers.backup}
          disabled={isTravelMode}
          detail={
            isNotBackedUp
              ? intl.formatMessage({
                  id: ETranslations.wallet_backup_status_not_backed_up,
                })
              : undefined
          }
          detailCritical
        />
        <DrawerRow
          testID="profile-drawer-address-book"
          icon="ContactsOutline"
          label={intl.formatMessage({
            id: ETranslations.settings_address_book,
          })}
          trackID="wallet-address-book"
          onPress={handlers.addressBook}
          disabled={isTravelMode}
        />
        <Divider my="$2" />
        <DrawerRow
          testID="profile-drawer-prime"
          icon="PrimeOutline"
          label="Prime"
          trackID="wallet-prime"
          onPress={handlers.prime}
          detail={primeDetail}
        />
        <DrawerRow
          testID="profile-drawer-referral"
          icon="GiftOutline"
          label={intl.formatMessage({
            id: ETranslations.sidebar_refer_a_friend,
          })}
          trackID="wallet-referral"
          onPress={handlers.referral}
          disabled={isTravelMode || isReferralEntryPending}
        />
        <Stack flexGrow={1} minHeight="$4" />
        <DrawerRow
          testID="profile-drawer-settings"
          icon="SettingsOutline"
          label={intl.formatMessage({ id: ETranslations.settings_settings })}
          trackID="wallet-settings"
          onPress={handlers.settings}
        />
        <DrawerRow
          testID="profile-drawer-support"
          icon="HelpSupportOutline"
          label={intl.formatMessage({ id: ETranslations.settings_contact_us })}
          trackID="wallet-customer-support"
          onPress={handlers.support}
          disabled={isTravelMode}
          trailing={hasUnreadSupportMessages ? <UnreadDot /> : null}
        />
        <DrawerRow
          testID="profile-drawer-lock"
          icon="LockOutline"
          label={intl.formatMessage({ id: ETranslations.settings_lock_now })}
          trackID="wallet-lock-now"
          onPress={handlers.lock}
          disabled={isTravelMode}
        />
        {showDevModeEntry ? (
          <DrawerRow
            testID="profile-drawer-dev-mode"
            icon="CodeBracketsOutline"
            label={intl.formatMessage({ id: ETranslations.global_dev_mode })}
            trackID="wallet-dev-mode"
            onPress={handlers.devMode}
          />
        ) : null}
      </YStack>
    </ScrollView>
  );
}

export default function ProfileDrawerContent() {
  return (
    <MoreActionProvider>
      <ProfileDrawerBody />
    </MoreActionProvider>
  );
}
