import { Suspense, lazy, useCallback, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';

import type { IKeyOfIcons } from '@onekeyhq/components';
import {
  Icon,
  IconButton,
  ScrollView,
  SizableText,
  Spinner,
  Stack,
  XStack,
  YStack,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import { usePasswordPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/passwordLock';
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
const IDENTITY_PRESS_STYLE = { opacity: 0.6 } as const;
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
  ariaNote,
  disabled,
  ignorePress,
  loading,
  subdued = false,
  testID,
}: {
  icon: IKeyOfIcons;
  label: string;
  item: IProfileDrawerItem;
  trackID: string;
  onPress: () => void;
  // Sits right after the label.
  badge?: ReactNode;
  // What the badge says, for screen readers.
  ariaNote?: string;
  disabled?: boolean;
  // Looks and presses as usual but does nothing, like the More menu's
  // entries in travel mode.
  ignorePress?: boolean;
  // A spinner at the row's end while the entry is still on its way.
  loading?: boolean;
  subdued?: boolean;
  testID?: string;
}) {
  const hadMark = !!badge;
  const handlePress = useCallback(() => {
    if (disabled || ignorePress || loading) return;
    defaultLogger.ui.button.click({ trackId: trackID });
    defaultLogger.wallet.profileDrawer.profileDrawerItemClicked({
      item,
      hadMark,
    });
    onPress();
  }, [disabled, hadMark, ignorePress, item, loading, onPress, trackID]);
  return (
    <XStack
      testID={testID}
      // One element for screen readers, so the label below is what they read.
      accessible
      role="button"
      aria-label={ariaNote ? `${label}, ${ariaNote}` : label}
      aria-disabled={disabled}
      aria-busy={loading}
      minHeight={56}
      mx="$-3"
      px="$3"
      py="$2"
      gap="$4"
      alignItems="center"
      borderRadius="$3"
      borderCurve="continuous"
      opacity={disabled ? 0.5 : 1}
      pressStyle={disabled || loading ? undefined : ROW_PRESS_STYLE}
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
      {loading ? <Spinner size="small" /> : null}
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
      // A single digit stays a 20pt circle; more digits stretch it.
      px="$1.5"
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

// The header's 36pt secondary buttons reach 48pt under a finger.
const HEADER_BUTTON_HIT_SLOP = 6;

function DrawerScanButton() {
  const intl = useIntl();
  const {
    activeAccount: { account, network },
  } = useActiveAccount({ num: 0 });
  const { tokens, keys, map } = useHomeTokenListSnapshot();
  const scanQrCode = useScanQrCodeLazy();
  const handleScan = useCallback(() => {
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
    <IconButton
      testID="profile-drawer-scan"
      trackID="wallet-scan"
      variant="secondary"
      icon="ScanOutline"
      accessible
      aria-label={intl.formatMessage({ id: ETranslations.scan_scan_qr_code })}
      hitSlop={HEADER_BUTTON_HIT_SLOP}
      onPress={handleScan}
    />
  );
}

// Lock sits beside scan: both are one-tap actions, and the bottom of the
// drawer stays free for support. Shown only with a passcode, like Settings ›
// Auto-lock: without one nothing can lock, and the tap would only start
// passcode setup. In travel mode it looks as usual but does nothing, as in
// the More menu.
function DrawerLockButton() {
  const intl = useIntl();
  const onLock = useOnLock();
  const [{ isPasswordSet }] = usePasswordPersistAtom();
  const isTravelMode = isTravelModeActive();
  const handleLock = useCallback(() => {
    if (isTravelMode) return;
    defaultLogger.wallet.profileDrawer.profileDrawerItemClicked({
      item: 'lock',
      hadMark: false,
    });
    closeProfileDrawer();
    void onLock();
  }, [isTravelMode, onLock]);
  if (!isPasswordSet) return null;
  return (
    <IconButton
      testID="profile-drawer-lock"
      trackID="wallet-lock-now"
      variant="secondary"
      icon="LockOutline"
      // An icon has nothing for a screen reader to read, so the button must
      // be the element itself.
      accessible
      aria-label={intl.formatMessage({ id: ETranslations.settings_lock_now })}
      hitSlop={HEADER_BUTTON_HIT_SLOP}
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
    // Travel mode rejects Prime calls, and the content mounts without the
    // drawer being opened.
    if (isLoggedIn && !isTravelMode) {
      void backgroundApiProxy.servicePrime.apiFetchPrimeUserInfo();
    }
  }, [isLoggedIn, isTravelMode]);

  const handleOneKeyId = useCallback(() => {
    // Signing in looks as usual but does nothing in travel mode, as in the
    // More menu.
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
  const label = isLoggedIn ? `${name}, OneKey ID` : signIn;

  return (
    <YStack gap="$3">
      <XStack alignItems="flex-start" justifyContent="space-between">
        {/* Hidden from screen readers: the name or sign-in line below is the
            same button with words. */}
        <Stack
          aria-hidden
          hitSlop={4}
          pressStyle={IDENTITY_PRESS_STYLE}
          onPress={handleOneKeyId}
        >
          <OneKeyIdAvatar size="$14" showSocialBadge={false} />
        </Stack>
        {/* 20 apart: the 48pt touch areas keep 8 between them, so lock,
            whose mis-tap costs an unlock, stays clear of the busier scan. */}
        <XStack gap="$5">
          <DrawerLockButton />
          <DrawerScanButton />
        </XStack>
      </XStack>
      {isLoggedIn ? (
        <XStack
          testID="profile-drawer-onekey-id"
          accessible
          role="button"
          aria-label={label}
          alignSelf="flex-start"
          maxWidth="100%"
          alignItems="center"
          gap="$2"
          py="$1"
          hitSlop={8}
          pressStyle={IDENTITY_PRESS_STYLE}
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
          accessible
          role="button"
          aria-label={label}
          alignSelf="flex-start"
          alignItems="center"
          gap="$1"
          py="$1"
          hitSlop={8}
          pressStyle={IDENTITY_PRESS_STYLE}
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
      accessible
      role="button"
      aria-label={[title, walletName].filter(Boolean).join(', ')}
      minHeight={56}
      mx="$-3"
      px="$3"
      py="$2"
      gap="$4"
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
      {/* The chevron stays with the name, as on the sign-in line above:
          ⌄ switches accounts, › goes to adding the first wallet. */}
      <XStack flexShrink={1} alignItems="center" gap="$1">
        <SizableText
          size="$headingLg"
          color="$text"
          numberOfLines={1}
          flexShrink={1}
          y={labelNudge(title)}
        >
          {title}
        </SizableText>
        <Icon
          name={
            hasNoUsableWallet
              ? 'ChevronRightSmallOutline'
              : 'ChevronDownSmallOutline'
          }
          size="$5"
          color="$iconSubdued"
        />
      </XStack>
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
  // The never-opened dot has no number, so it reads as "New".
  let notificationsNote: string | undefined;
  if (marks.notifications) {
    notificationsNote = marks.notifications.count
      ? String(marks.notifications.count)
      : intl.formatMessage({ id: ETranslations.explore_badge_new });
  }
  const beforeReferralNavigate = useCallback(async () => {
    closeProfileDrawer();
  }, []);
  const { toReferFriendsPage, isReferralEntryPending, isReferralEntryLoading } =
    useReferFriends({
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
          // Dimmed in travel mode like the header bell it replaces; the
          // More menu's entries below keep their look instead.
          disabled={isTravelMode}
          badge={
            marks.notifications ? (
              <NotificationCount count={marks.notifications.count} />
            ) : null
          }
          ariaNote={notificationsNote}
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
          // Waiting on the sign-in check keeps the row as it is; the
          // spinner comes in if the wait gets noticeable.
          ignorePress={isTravelMode || isReferralEntryPending}
          loading={isReferralEntryLoading}
        />
        {showRedeem ? (
          <DrawerRow
            testID="profile-drawer-redeem"
            icon="TicketOutline"
            label={intl.formatMessage({ id: ETranslations.global_redeem })}
            item="redeem"
            trackID="wallet-redeem"
            onPress={handlers.redeem}
            ignorePress={isTravelMode}
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
          ignorePress={isTravelMode}
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
