import { Suspense, lazy, useCallback, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';

import type { IKeyOfIcons } from '@onekeyhq/components';
import {
  Icon,
  ScrollView,
  SizableText,
  Stack,
  XStack,
  YStack,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { IProfileDrawerItem } from '@onekeyhq/shared/src/logger/scopes/wallet/scenes/profileDrawer';
import { showIntercom } from '@onekeyhq/shared/src/modules3rdParty/intercom';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes, EModalSettingRoutes } from '@onekeyhq/shared/src/routes';
import { EModalNotificationsRoutes } from '@onekeyhq/shared/src/routes/notifications';
import { EPrimePages } from '@onekeyhq/shared/src/routes/prime';
import { travelModeManager } from '@onekeyhq/shared/src/travelMode';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../hooks/useAppNavigation';
import { useOnLock } from '../../hooks/useOnLock';
import { useReferFriends } from '../../hooks/useReferFriends';
import { useActiveAccount } from '../../states/jotai/contexts/accountSelector';
import { useHomeTokenListSnapshot } from '../../states/jotai/contexts/tokenList/cells';
import { useDeviceManagerNavigation } from '../../views/DeviceManagement/hooks/useDeviceManagerNavigation';
import useScanQrCodeLazy from '../../views/ScanQrCode/hooks/useScanQrCodeLazy';
import { AccountAvatar } from '../AccountAvatar';
import { useAccountSelectorTrigger } from '../AccountSelector/hooks/useAccountSelectorTrigger';
import { MoreActionProvider } from '../MoreActionButton';
import { useOneKeyAuth } from '../OneKeyAuth/useOneKeyAuth';
import { OneKeyIdAvatar } from '../OneKeyIdAvatar';
import { useReviewControl } from '../ReviewControl';

import {
  closeProfileDrawer,
  useIsProfileDrawerOpen,
} from './profileDrawerStore';
import { useProfileDrawerMarks } from './useProfileDrawerMarks';

import type { IProfileDrawerAppUpdate } from './profileDrawerMarks';

const LazyPrimeUserBadge = lazy(async () => {
  const { PrimeUserBadge } =
    await import('../../views/Prime/components/PrimeUserBadge');
  return { default: PrimeUserBadge };
});

const ROW_PRESS_STYLE = { bg: '$bgActive' } as const;
const NOTIFICATION_COUNT_CAP = 99;

// On iOS a CJK label (PingFang glyphs inside the brand font's line box) sits
// about 0.8pt above the icon's center while Latin labels sit centered;
// 2/3pt is two device pixels at 3x.
const CJK_PATTERN = /[⺀-鿿가-힯豈-﫿]/;
const CJK_LABEL_NUDGE = 2 / 3;
function labelNudge(text: string) {
  return platformEnv.isNativeIOS && CJK_PATTERN.test(text)
    ? CJK_LABEL_NUDGE
    : 0;
}

function isTravelModeActive() {
  return (
    travelModeManager.getRuntimeEnvironmentSync().profile.kind === 'travel-mode'
  );
}

function DrawerRow({
  icon,
  label,
  item,
  trackID,
  onPress,
  badge,
  trailing,
  ariaNote,
  disabled,
  subdued = false,
  testID,
}: {
  icon: IKeyOfIcons;
  label: string;
  item: IProfileDrawerItem;
  trackID: string;
  onPress: () => void;
  // Sits right after the label, unlike trailing at the far end.
  badge?: ReactNode;
  trailing?: ReactNode;
  // What a trailing dot means, for screen readers.
  ariaNote?: string;
  disabled?: boolean;
  subdued?: boolean;
  testID?: string;
}) {
  const hadMark = !!badge || !!trailing;
  const handlePress = useCallback(() => {
    if (disabled) return;
    defaultLogger.ui.button.click({ trackId: trackID });
    defaultLogger.wallet.profileDrawer.profileDrawerItemClicked({
      item,
      hadMark,
    });
    onPress();
  }, [disabled, hadMark, item, onPress, trackID]);
  return (
    <XStack
      testID={testID}
      role="button"
      aria-label={ariaNote ? `${label}, ${ariaNote}` : label}
      aria-disabled={disabled}
      minHeight={56}
      mx="$-3"
      px="$3"
      py="$2"
      gap="$3"
      alignItems="center"
      borderRadius="$3"
      borderCurve="continuous"
      opacity={disabled ? 0.5 : 1}
      pressStyle={disabled ? undefined : ROW_PRESS_STYLE}
      onPress={handlePress}
    >
      <Icon name={icon} size="$6" color={subdued ? '$iconSubdued' : '$icon'} />
      <XStack flexShrink={1} alignItems="center" gap="$2">
        {/* With a badge, the row name keeps its width and the badge gives
            way, so long translations cut the badge, not the name. */}
        <SizableText
          flexShrink={badge ? 0 : 1}
          size="$headingLg"
          color={subdued ? '$textSubdued' : '$text'}
          numberOfLines={1}
          y={labelNudge(label)}
        >
          {label}
        </SizableText>
        {badge}
      </XStack>
      <Stack flex={1} />
      {trailing}
    </XStack>
  );
}

function UnreadDot() {
  return <Stack w="$2" h="$2" borderRadius="$full" bg="$bgCriticalStrong" />;
}

// A soft count beside the label, so it doesn't pull the eye across the
// whole drawer.
function NotificationCount({ count }: { count?: number }) {
  if (!count) return <UnreadDot />;
  return (
    <XStack
      minWidth="$5"
      h="$5"
      px="$2"
      borderRadius="$full"
      bg="$bgCriticalSubdued"
      alignItems="center"
      justifyContent="center"
    >
      <SizableText size="$bodySmMedium" color="$textCritical">
        {count > NOTIFICATION_COUNT_CAP
          ? `${NOTIFICATION_COUNT_CAP}+`
          : String(count)}
      </SizableText>
    </XStack>
  );
}

// The count's pill in the success tone, with words: an update is a status to
// act on, not something unread.
const UPDATE_PILL_LABEL_IDS: Record<IProfileDrawerAppUpdate, ETranslations> = {
  available: ETranslations.hardware_status_update_available,
  updating: ETranslations.global_updating,
  failed: ETranslations.global_update_failed,
};

// The count's pill in the success tone, with words: an update is a status to
// act on, not something unread. A failed download turns critical.
function UpdatePill({ label, failed }: { label: string; failed?: boolean }) {
  return (
    <XStack
      h="$5"
      px="$2"
      flexShrink={1}
      minWidth={0}
      borderRadius="$full"
      bg={failed ? '$bgCriticalSubdued' : '$bgSuccessSubdued'}
      alignItems="center"
      justifyContent="center"
    >
      <SizableText
        size="$bodySmMedium"
        color={failed ? '$textCritical' : '$textSuccess'}
        numberOfLines={1}
      >
        {label}
      </SizableText>
    </XStack>
  );
}

function DrawerHeaderButton({
  icon,
  label,
  onPress,
  disabled,
  testID,
}: {
  icon: IKeyOfIcons;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  testID: string;
}) {
  return (
    <Stack
      testID={testID}
      role="button"
      aria-label={label}
      aria-disabled={disabled}
      w="$9"
      h="$9"
      borderRadius="$full"
      bg="$bgStrong"
      alignItems="center"
      justifyContent="center"
      // The 36 circle reaches 44 under a finger.
      hitSlop={4}
      opacity={disabled ? 0.5 : 1}
      pressStyle={disabled ? undefined : { bg: '$bgStrongActive' }}
      onPress={disabled ? undefined : onPress}
    >
      <Icon name={icon} size="$6" color="$icon" />
    </Stack>
  );
}

function DrawerScanButton() {
  const intl = useIntl();
  const {
    activeAccount: { account, network },
  } = useActiveAccount({ num: 0 });
  const { tokens, keys, map } = useHomeTokenListSnapshot();
  const scanQrCode = useScanQrCodeLazy();
  const handleScan = useCallback(() => {
    defaultLogger.ui.button.click({ trackId: 'wallet-scan' });
    defaultLogger.wallet.profileDrawer.profileDrawerItemClicked({
      item: 'scan',
      hadMark: false,
    });
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
    <DrawerHeaderButton
      testID="profile-drawer-scan"
      icon="ScanOutline"
      label={intl.formatMessage({ id: ETranslations.scan_scan_qr_code })}
      onPress={handleScan}
    />
  );
}

// Lock sits beside scan: both are one-tap actions, and the bottom of the
// drawer stays free for support.
function DrawerLockButton() {
  const intl = useIntl();
  const onLock = useOnLock();
  const isTravelMode = isTravelModeActive();
  const handleLock = useCallback(() => {
    defaultLogger.ui.button.click({ trackId: 'wallet-lock-now' });
    defaultLogger.wallet.profileDrawer.profileDrawerItemClicked({
      item: 'lock',
      hadMark: false,
    });
    closeProfileDrawer();
    void onLock();
  }, [onLock]);
  return (
    <DrawerHeaderButton
      testID="profile-drawer-lock"
      icon="LockOutline"
      label={intl.formatMessage({ id: ETranslations.settings_lock_now })}
      disabled={isTravelMode}
      onPress={handleLock}
    />
  );
}

// The person on top (the same avatar the home button shows): a nickname, or
// a plain sign-in line when signed out.
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
    if (!isLoggedIn && isTravelMode) return;
    defaultLogger.ui.button.click({ trackId: 'wallet-onekey-id' });
    defaultLogger.wallet.profileDrawer.profileDrawerItemClicked({
      item: isLoggedIn ? 'oneKeyId' : 'signIn',
      hadMark: false,
    });
    closeProfileDrawer();
    if (isLoggedIn) {
      navigation.pushModal(EModalRoutes.PrimeModal, {
        screen: EPrimePages.OneKeyId,
      });
      return;
    }
    void loginOneKeyId({ toOneKeyIdPageOnLoginSuccess: false });
  }, [isLoggedIn, isTravelMode, loginOneKeyId, navigation]);

  const signIn = intl.formatMessage({
    id: ETranslations.sign_in_to_onekey_id__title,
  });
  const name = user?.nickname || 'OneKey ID';
  const isPrimeUser = user?.primeSubscription?.isActive && user?.onekeyUserId;
  const signInDisabled = !isLoggedIn && isTravelMode;
  const label = isLoggedIn ? `${name}, OneKey ID` : signIn;

  return (
    <YStack gap="$3">
      <XStack alignItems="flex-start" justifyContent="space-between">
        <Stack
          role="button"
          aria-label={label}
          aria-disabled={signInDisabled}
          hitSlop={4}
          pressStyle={{ opacity: 0.7 }}
          onPress={handleOneKeyId}
        >
          <OneKeyIdAvatar size="$14" showSocialBadge={false} />
        </Stack>
        {/* 12 apart: a mis-tap on lock costs a password, so the two 44pt
            touch areas must not meet. */}
        <XStack gap="$3">
          <DrawerLockButton />
          <DrawerScanButton />
        </XStack>
      </XStack>
      {isLoggedIn ? (
        <XStack
          testID="profile-drawer-onekey-id"
          role="button"
          aria-label={label}
          alignSelf="flex-start"
          maxWidth="100%"
          alignItems="center"
          gap="$2"
          py="$1"
          hitSlop={8}
          pressStyle={{ opacity: 0.6 }}
          onPress={handleOneKeyId}
        >
          <SizableText
            size="$heading3xl"
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
      ) : (
        <XStack
          testID="profile-drawer-sign-in"
          role="button"
          aria-label={label}
          aria-disabled={signInDisabled}
          alignSelf="flex-start"
          alignItems="center"
          gap="$1"
          py="$1"
          hitSlop={8}
          opacity={signInDisabled ? 0.5 : 1}
          pressStyle={signInDisabled ? undefined : { opacity: 0.6 }}
          onPress={handleOneKeyId}
        >
          <SizableText
            size="$bodyLgMedium"
            color="$text"
            y={labelNudge(signIn)}
          >
            {signIn}
          </SizableText>
          <Icon
            name="ChevronRightSmallOutline"
            size="$5"
            color="$iconSubdued"
          />
        </XStack>
      )}
    </YStack>
  );
}

// The account as the list's first row: its avatar in the icon slot and ⌄,
// because it switches rather than navigates. The wallet name and copying
// live in the account selector and on the home Receive button.
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
  const title = hasNoUsableWallet
    ? intl.formatMessage({
        id: ETranslations.onboarding_create_or_import_wallet,
      })
    : accountName || intl.formatMessage({ id: ETranslations.no_account });
  const walletName = hasNoUsableWallet ? undefined : wallet?.name;

  const handlePress = useCallback(() => {
    defaultLogger.wallet.profileDrawer.profileDrawerItemClicked({
      item: 'account',
      hadMark: false,
    });
    closeProfileDrawer();
    showAccountSelector();
  }, [showAccountSelector]);

  return (
    <XStack
      testID="profile-drawer-account"
      role="button"
      aria-label={[title, walletName].filter(Boolean).join(', ')}
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
        <Icon name="PlusLargeOutline" size="$6" color="$icon" />
      ) : (
        <AccountAvatar
          size="small"
          indexedAccount={indexedAccount}
          account={account}
          dbAccount={dbAccount}
          wallet={wallet}
        />
      )}
      <SizableText
        size="$headingLg"
        color="$text"
        numberOfLines={1}
        flexShrink={1}
        y={labelNudge(title)}
      >
        {title}
      </SizableText>
      <Icon name="ChevronDownSmallOutline" size="$5" color="$iconSubdued" />
    </XStack>
  );
}

function ProfileDrawerBody() {
  const intl = useIntl();
  const { top, bottom } = useSafeAreaInsets();
  const navigation = useAppNavigation();
  const isOpen = useIsProfileDrawerOpen();
  const isTravelMode = isTravelModeActive();
  const { pushToDeviceList } = useDeviceManagerNavigation();
  // Hidden in review builds, as on the More page.
  const showRedeem = useReviewControl();
  const {
    activeAccount: { network },
  } = useActiveAccount({ num: 0 });
  const marks = useProfileDrawerMarks();
  const updateAvailable = intl.formatMessage({
    id: UPDATE_PILL_LABEL_IDS.available,
  });
  const appUpdateLabel = marks.appUpdate
    ? intl.formatMessage({ id: UPDATE_PILL_LABEL_IDS[marks.appUpdate] })
    : undefined;
  const beforeReferralNavigate = useCallback(async () => {
    closeProfileDrawer();
  }, []);
  const { toReferFriendsPage, isReferralEntryPending } = useReferFriends({
    isEntryActive: isOpen,
    beforeNavigate: beforeReferralNavigate,
  });

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
      // The redemption center (not the Prime-only redeem in the Prime page
      // menu); the More page was its only entry.
      redeem: () => {
        closeProfileDrawer();
        void import('../../views/Redemption/components/RedemptionCenterDialog').then(
          ({ showRedemptionCenterDialog }) => {
            showRedemptionCenterDialog({ source: 'more_action' });
          },
        );
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
    }),
    [navigation, network?.id, pushToDeviceList, toReferFriendsPage],
  );

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
      {/* Grows on tall screens so settings and support sit at the bottom;
          on short ones everything scrolls together. */}
      <YStack px="$5" mt="$6" flexGrow={1}>
        <DrawerAccountRow />
        <DrawerRow
          testID="profile-drawer-notifications"
          icon="BellOutline"
          label={intl.formatMessage({ id: ETranslations.global_notifications })}
          item="notifications"
          trackID="wallet-notifications"
          onPress={handlers.notifications}
          disabled={isTravelMode}
          badge={
            marks.notifications ? (
              <NotificationCount count={marks.notifications.count} />
            ) : null
          }
          ariaNote={
            marks.notifications?.count
              ? String(marks.notifications.count)
              : undefined
          }
        />
        {isTravelMode ? null : (
          <DrawerRow
            testID="profile-drawer-devices"
            icon="PhoneOutline"
            label={intl.formatMessage({ id: ETranslations.global_my_device })}
            item="devices"
            trackID="wallet-device"
            onPress={handlers.devices}
            badge={
              marks.firmwareUpdate ? (
                <UpdatePill label={updateAvailable} />
              ) : null
            }
            ariaNote={marks.firmwareUpdate ? updateAvailable : undefined}
          />
        )}
        <DrawerRow
          testID="profile-drawer-prime"
          icon="PrimeOutline"
          label="Prime"
          item="prime"
          trackID="wallet-prime"
          onPress={handlers.prime}
        />
        <DrawerRow
          testID="profile-drawer-referral"
          icon="GiftOutline"
          label={intl.formatMessage({
            id: ETranslations.sidebar_refer_a_friend,
          })}
          item="referral"
          trackID="wallet-referral"
          onPress={handlers.referral}
          disabled={isTravelMode || isReferralEntryPending}
        />
        {showRedeem ? (
          <DrawerRow
            testID="profile-drawer-redeem"
            icon="TicketOutline"
            label={intl.formatMessage({ id: ETranslations.global_redeem })}
            item="redeem"
            trackID="wallet-redeem"
            onPress={handlers.redeem}
            disabled={isTravelMode}
          />
        ) : null}
        <Stack flexGrow={1} minHeight="$6" />
        <DrawerRow
          testID="profile-drawer-settings"
          icon="SettingsOutline"
          label={intl.formatMessage({ id: ETranslations.settings_settings })}
          item="settings"
          trackID="wallet-settings"
          onPress={handlers.settings}
          subdued
          badge={
            appUpdateLabel ? (
              <UpdatePill
                label={appUpdateLabel}
                failed={marks.appUpdate === 'failed'}
              />
            ) : null
          }
          ariaNote={appUpdateLabel}
        />
        <DrawerRow
          testID="profile-drawer-support"
          icon="HelpSupportOutline"
          label={intl.formatMessage({ id: ETranslations.settings_contact_us })}
          item="support"
          trackID="wallet-customer-support"
          onPress={handlers.support}
          disabled={isTravelMode}
          subdued
          badge={
            marks.support ? <NotificationCount count={marks.support} /> : null
          }
          ariaNote={marks.support ? String(marks.support) : undefined}
        />
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
