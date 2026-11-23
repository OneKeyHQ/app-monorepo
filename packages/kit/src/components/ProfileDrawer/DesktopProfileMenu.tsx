import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';

import type { IKeyOfIcons } from '@onekeyhq/components';
import {
  ActionListItem,
  Divider,
  Icon,
  Popover,
  SizableText,
  Stack,
  Tooltip,
  XStack,
  YStack,
  runAfterActionListClose,
  usePopoverContext,
} from '@onekeyhq/components';
import { usePasswordPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/passwordLock';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { IProfileDrawerItem } from '@onekeyhq/shared/src/logger/scopes/wallet/scenes/profileDrawer';
import { showIntercom } from '@onekeyhq/shared/src/modules3rdParty/intercom';
import { EModalRoutes, EModalSettingRoutes } from '@onekeyhq/shared/src/routes';
import { EPrimePages } from '@onekeyhq/shared/src/routes/prime';
import { shortcutsKeys } from '@onekeyhq/shared/src/shortcuts/shortcutsKeys.enum';
import { travelModeManager } from '@onekeyhq/shared/src/travelMode';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../hooks/useAppNavigation';
import { useOnLock } from '../../hooks/useOnLock';
import { useActiveAccount } from '../../states/jotai/contexts/accountSelector';
import { useHomeTokenListSnapshot } from '../../states/jotai/contexts/tokenList/cells';
import useScanQrCodeLazy from '../../views/ScanQrCode/hooks/useScanQrCodeLazy';
import {
  HomeFirmwareUpdateDetectHost,
  MoreActionProvider,
  useClosePopoverOnNavigate,
  useWalletMetaSilentRepair,
} from '../MoreActionButton';
import { useOneKeyAuth } from '../OneKeyAuth/useOneKeyAuth';
import { OneKeyIdAvatar } from '../OneKeyIdAvatar';
import { useReviewControl } from '../ReviewControl';

import {
  useFirmwareUpdateKeys,
  useProfileDrawerMarks,
} from './useProfileDrawerMarks';

import type {
  IProfileDrawerAppUpdate,
  IProfileDrawerMarks,
} from './profileDrawerMarks';

const LazyPrimeUserBadge = lazy(async () => {
  const { PrimeUserBadge } =
    await import('../../views/Prime/components/PrimeUserBadge');
  return { default: PrimeUserBadge };
});

const ROW_HOVER_STYLE = { bg: '$bgHover' } as const;
const ROW_PRESS_STYLE = { bg: '$bgActive' } as const;
const FOCUS_RING = {
  outlineColor: '$focusRing',
  outlineStyle: 'solid',
  outlineWidth: 2,
} as const;
const MENU_PANEL_PROPS = { width: 288 } as const;
const NOTIFICATION_COUNT_CAP = 99;
const UPDATE_LABEL_IDS: Record<IProfileDrawerAppUpdate, ETranslations> = {
  available: ETranslations.hardware_status_update_available,
  updating: ETranslations.global_updating,
  failed: ETranslations.global_update_failed,
};

function isTravelModeActive() {
  return (
    travelModeManager.getRuntimeEnvironmentSync().profile.kind === 'travel-mode'
  );
}

function UpdatePill({ label, failed }: { label: string; failed: boolean }) {
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

function UnreadCount({ count }: { count: number }) {
  return (
    <XStack
      minWidth="$5"
      h="$5"
      px="$1.5"
      flexShrink={0}
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

function MenuRow({
  icon,
  label,
  item,
  trackID,
  testID,
  badge,
  shortcutKeys,
  ignorePress,
  onPress,
}: {
  icon: IKeyOfIcons;
  label: string;
  item: IProfileDrawerItem;
  trackID: string;
  testID: string;
  // Sits right after the label.
  badge?: ReactNode;
  // Shown in Electron only, where these keys are the app's own.
  shortcutKeys?: string[];
  // Looks and presses as usual but does nothing, as in travel mode.
  ignorePress?: boolean;
  onPress: () => void;
}) {
  const { closePopover } = usePopoverContext();
  const close = useCallback(() => closePopover?.(), [closePopover]);
  const hadMark = !!badge;
  const renderLabel = useCallback(
    () => (
      <XStack flex={1} minWidth={0} alignItems="center" gap="$2">
        <SizableText
          size="$bodyMd"
          color="$text"
          numberOfLines={1}
          flexShrink={0}
        >
          {label}
        </SizableText>
        {badge}
      </XStack>
    ),
    [badge, label],
  );
  return (
    <ActionListItem
      testID={testID}
      trackID={trackID}
      icon={icon}
      label={label}
      shortcutKeys={shortcutKeys}
      renderLabel={badge ? renderLabel : undefined}
      onClose={close}
      // Taking `closeMenu` keeps the menu open when the press is ignored.
      onPress={async (closeMenu) => {
        if (ignorePress) return;
        defaultLogger.wallet.profileDrawer.profileDrawerItemClicked({
          item,
          hadMark,
        });
        await runAfterActionListClose(closeMenu, onPress, {
          waitForAnimation: false,
        });
      }}
    />
  );
}

function IdentityRow() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { user, isLoggedIn, loginOneKeyId } = useOneKeyAuth();
  const { closePopover } = usePopoverContext();
  const isTravelMode = isTravelModeActive();

  useEffect(() => {
    // Travel mode rejects Prime calls.
    if (isLoggedIn && !isTravelMode) {
      void backgroundApiProxy.servicePrime.apiFetchPrimeUserInfo();
    }
  }, [isLoggedIn, isTravelMode]);

  const handlePress = useCallback(() => {
    if (!isLoggedIn && isTravelMode) return;
    defaultLogger.ui.button.click({ trackId: 'wallet-onekey-id' });
    defaultLogger.wallet.profileDrawer.profileDrawerItemClicked({
      item: isLoggedIn ? 'oneKeyId' : 'signIn',
      hadMark: false,
    });
    void runAfterActionListClose(
      () => closePopover?.(),
      () => {
        if (isLoggedIn) {
          navigation.pushModal(EModalRoutes.PrimeModal, {
            screen: EPrimePages.OneKeyId,
          });
          return;
        }
        void loginOneKeyId({ toOneKeyIdPageOnLoginSuccess: false });
      },
      { waitForAnimation: false },
    );
  }, [closePopover, isLoggedIn, isTravelMode, loginOneKeyId, navigation]);

  const signIn = intl.formatMessage({
    id: ETranslations.sign_in_to_onekey_id__title,
  });
  const name = user?.nickname || 'OneKey ID';
  const isPrimeUser = user?.primeSubscription?.isActive && user?.onekeyUserId;
  const rowLabel = isLoggedIn ? `${name}, OneKey ID` : signIn;
  return (
    <XStack
      testID="desktop-profile-menu-identity"
      render={<button type="button" aria-label={rowLabel} />}
      role="button"
      aria-label={rowLabel}
      bg="$transparent"
      borderWidth={0}
      alignItems="center"
      gap="$3"
      px="$2"
      py="$1.5"
      borderRadius="$2"
      borderCurve="continuous"
      userSelect="none"
      hoverStyle={ROW_HOVER_STYLE}
      pressStyle={ROW_PRESS_STYLE}
      focusVisibleStyle={FOCUS_RING}
      onPress={handlePress}
    >
      <OneKeyIdAvatar size="$8" showSocialBadge={false} />
      {isLoggedIn ? (
        <XStack flex={1} minWidth={0} alignItems="center" gap="$1.5">
          <SizableText
            size="$bodyMdMedium"
            color="$text"
            numberOfLines={1}
            flexShrink={1}
          >
            {name}
          </SizableText>
          {isPrimeUser ? (
            <Suspense fallback={null}>
              <LazyPrimeUserBadge showFreeStatus={false} iconOnly />
            </Suspense>
          ) : null}
        </XStack>
      ) : (
        <XStack flex={1} minWidth={0} alignItems="center" gap="$0.5">
          <SizableText
            size="$bodyMdMedium"
            color="$text"
            numberOfLines={1}
            flexShrink={1}
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
    </XStack>
  );
}

function MenuBody({ marks }: { marks: IProfileDrawerMarks }) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const onLock = useOnLock();
  const [{ isPasswordSet }] = usePasswordPersistAtom();
  // Hidden in review builds, as on the More page.
  const showRedeem = useReviewControl();
  const scanQrCode = useScanQrCodeLazy();
  const {
    activeAccount: { account, network },
  } = useActiveAccount({ num: 0 });
  const { tokens, keys, map } = useHomeTokenListSnapshot();
  const isTravelMode = isTravelModeActive();
  useClosePopoverOnNavigate();

  const appUpdateLabel = marks.appUpdate
    ? intl.formatMessage({ id: UPDATE_LABEL_IDS[marks.appUpdate] })
    : undefined;

  return (
    <YStack p="$1" testID="desktop-profile-menu">
      <IdentityRow />
      <Divider mx="$2" my="$1" borderColor="$borderSubdued" />
      <MenuRow
        testID="desktop-profile-menu-scan"
        trackID="wallet-scan"
        item="scan"
        icon="ScanOutline"
        label={intl.formatMessage({ id: ETranslations.scan_scan_qr_code })}
        onPress={() => {
          void scanQrCode.start({
            handlers: scanQrCode.PARSE_HANDLER_NAMES.all,
            autoExecuteParsedAction: true,
            account,
            network,
            tokens: { data: tokens, keys, map },
          });
        }}
      />
      <MenuRow
        testID="desktop-profile-menu-prime"
        trackID="wallet-prime"
        item="prime"
        icon="PrimeOutline"
        label="Prime"
        onPress={() => {
          navigation.pushFullModal(EModalRoutes.PrimeModal, {
            screen: EPrimePages.PrimeDashboard,
            params: { networkId: network?.id },
          });
        }}
      />
      {showRedeem ? (
        <MenuRow
          testID="desktop-profile-menu-redeem"
          trackID="wallet-redeem"
          item="redeem"
          icon="TicketOutline"
          label={intl.formatMessage({ id: ETranslations.global_redeem })}
          ignorePress={isTravelMode}
          onPress={() => {
            void import('../../views/Redemption/components/RedemptionCenterDialog').then(
              ({ showRedemptionCenterDialog }) => {
                showRedemptionCenterDialog({ source: 'more_action' });
              },
            );
          }}
        />
      ) : null}
      <Divider mx="$2" my="$1" borderColor="$borderSubdued" />
      <MenuRow
        testID="desktop-profile-menu-settings"
        trackID="wallet-settings"
        item="settings"
        icon="SettingsOutline"
        label={intl.formatMessage({ id: ETranslations.settings_settings })}
        shortcutKeys={[shortcutsKeys.CmdOrCtrl, ',']}
        badge={
          appUpdateLabel ? (
            <UpdatePill
              label={appUpdateLabel}
              failed={marks.appUpdate === 'failed'}
            />
          ) : null
        }
        onPress={() => {
          navigation.pushModal(EModalRoutes.SettingModal, {
            screen: EModalSettingRoutes.SettingListModal,
          });
        }}
      />
      <MenuRow
        testID="desktop-profile-menu-support"
        trackID="wallet-customer-support"
        item="support"
        icon="HelpSupportOutline"
        label={intl.formatMessage({ id: ETranslations.settings_contact_us })}
        ignorePress={isTravelMode}
        badge={marks.support ? <UnreadCount count={marks.support} /> : null}
        onPress={() => {
          void showIntercom();
        }}
      />
      {/* Without a passcode nothing can lock. */}
      {isPasswordSet ? (
        <MenuRow
          testID="desktop-profile-menu-lock"
          trackID="wallet-lock-now"
          item="lock"
          icon="LockOutline"
          label={intl.formatMessage({ id: ETranslations.settings_lock_now })}
          shortcutKeys={[shortcutsKeys.CmdOrCtrl, shortcutsKeys.Shift, 'L']}
          ignorePress={isTravelMode}
          onPress={() => {
            void onLock();
          }}
        />
      ) : null}
    </YStack>
  );
}

function ProfileMenuButton() {
  const intl = useIntl();
  const { user, isLoggedIn } = useOneKeyAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [anchor, setAnchor] = useState<HTMLElement | undefined>();
  const handleAnchorRef = useCallback((node: unknown) => {
    setAnchor((node as HTMLElement | null) ?? undefined);
  }, []);
  const handlePress = useCallback(() => {
    setIsOpen((open) => !open);
  }, []);
  const marks = useProfileDrawerMarks({
    trackSeen: true,
    desktopMenuOpen: isOpen,
  });
  useWalletMetaSilentRepair();

  const hasDot = marks.avatarReasons.length > 0;
  const menuLabel = intl.formatMessage({
    id: ETranslations.address_book_menu_title,
  });
  const label = hasDot
    ? `${menuLabel}, ${intl.formatMessage({
        id: ETranslations.settings_contact_us,
      })}`
    : menuLabel;
  // The button sits outside the tooltip and popover triggers: those swap in
  // their real component on first use, which would remount it and drop
  // keyboard focus.
  return (
    <>
      <Stack
        ref={handleAnchorRef}
        testID="desktop-profile-menu-button"
        render={
          <button type="button" aria-label={label} aria-expanded={isOpen} />
        }
        role="button"
        aria-label={label}
        bg={isOpen ? '$bgActive' : '$transparent'}
        borderWidth={0}
        w={40}
        h={40}
        p={0}
        borderRadius="$2"
        hoverStyle={isOpen ? undefined : ROW_HOVER_STYLE}
        pressStyle={ROW_PRESS_STYLE}
        focusVisibleStyle={FOCUS_RING}
        onPress={handlePress}
      >
        <Tooltip
          placement="right"
          disabled={isOpen}
          renderTrigger={
            <Stack position="relative" w={40} h={40} p="$2">
              <OneKeyIdAvatar size="$6" showSocialBadge={false} />
              {hasDot ? (
                <Stack
                  testID="desktop-profile-menu-dot"
                  position="absolute"
                  top={6}
                  right={6}
                  w="$2.5"
                  h="$2.5"
                  borderRadius="$full"
                  borderWidth="$0.5"
                  borderColor="$bgSidebar"
                  bg="$bgCriticalStrong"
                  pointerEvents="none"
                />
              ) : null}
            </Stack>
          }
          renderContent={
            isLoggedIn ? user?.nickname || 'OneKey ID' : 'OneKey ID'
          }
        />
      </Stack>
      <Popover
        title={menuLabel}
        showHeader={false}
        placement="right-end"
        open={isOpen}
        onOpenChange={setIsOpen}
        webAnchorElement={anchor}
        floatingPanelProps={MENU_PANEL_PROPS}
        renderTrigger={null}
        renderContent={
          <MoreActionProvider>
            <MenuBody marks={marks} />
          </MoreActionProvider>
        }
      />
    </>
  );
}

// The avatar at the bottom of the desktop rail, with the app menu behind it.
export function DesktopProfileMenu() {
  return (
    <MoreActionProvider>
      <HomeFirmwareUpdateDetectHost />
      <ProfileMenuButton />
    </MoreActionProvider>
  );
}

// Firmware updates show on the rail's device tab, the page that handles them.
export function DesktopDeviceUpdateDot() {
  const firmwareUpdateKeys = useFirmwareUpdateKeys(isTravelModeActive());
  if (firmwareUpdateKeys.length === 0) return null;
  return (
    // No cut-out ring: its fixed color would show as a halo on the tab's hover
    // and selected fills.
    <Stack
      testID="device-tab-update-dot"
      position="absolute"
      top="$1"
      right="$1"
      w="$1.5"
      h="$1.5"
      borderRadius="$full"
      bg="$bgAccent"
      pointerEvents="none"
    />
  );
}
