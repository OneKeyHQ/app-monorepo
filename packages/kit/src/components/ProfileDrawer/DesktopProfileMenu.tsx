import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import type { CSSProperties, KeyboardEvent, ReactNode } from 'react';

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
import { EModalRoutes, EModalSettingRoutes } from '@onekeyhq/shared/src/routes';
import { EPrimePages } from '@onekeyhq/shared/src/routes/prime';
import { shortcutsKeys } from '@onekeyhq/shared/src/shortcuts/shortcutsKeys.enum';
import { travelModeManager } from '@onekeyhq/shared/src/travelMode';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../hooks/useAppNavigation';
import { useOnLock } from '../../hooks/useOnLock';
import { useActiveAccount } from '../../states/jotai/contexts/accountSelector';
import { useHomeTokenListSnapshot } from '../../states/jotai/contexts/tokenList/cells';
import { WalletXfpStatusReminder } from '../../views/Home/components/WalletXfpStatusReminder/WalletXfpStatusReminder';
import { showIntercom } from '../../views/Intercom/client';
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
const MENU_PANEL_PROPS = { width: 288, trapFocus: true } as const;
// From the avatar's edge to 8 past the 72-wide rail.
const MENU_OFFSET = 24;
const MENU_NAV_KEYS = new Set(['ArrowDown', 'ArrowUp', 'Home', 'End']);
const PRIME_MARK_TOOLTIP = { hovering: true, placement: 'top-start' } as const;
const PRIME_MARK_TOOLTIP_OPEN = { ...PRIME_MARK_TOOLTIP, open: true } as const;
// The unread dot is cut out of the avatar: a ring's fixed color would show as
// a halo on the button's hover fill.
const AVATAR_DOT_CUTOUT =
  'radial-gradient(circle 5px at 21px 3px, transparent 90%, #000 100%)';
const AVATAR_STYLE: CSSProperties = { width: 24, height: 24 };
const AVATAR_WITH_DOT_STYLE: CSSProperties = {
  ...AVATAR_STYLE,
  maskImage: AVATAR_DOT_CUTOUT,
  WebkitMaskImage: AVATAR_DOT_CUTOUT,
};
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

function isPointerOver(element: HTMLElement, event: PointerEvent) {
  const { left, right, top, bottom } = element.getBoundingClientRect();
  return (
    event.clientX >= left &&
    event.clientX <= right &&
    event.clientY >= top &&
    event.clientY <= bottom
  );
}

function handleMenuKeyDown(event: KeyboardEvent<HTMLElement>) {
  if (!MENU_NAV_KEYS.has(event.key)) return;
  const rows = Array.from(
    event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled)'),
  );
  if (rows.length === 0) return;
  event.preventDefault();
  const current = rows.indexOf(document.activeElement as HTMLElement);
  let next = 0;
  if (event.key === 'End') next = rows.length - 1;
  if (event.key === 'ArrowDown') next = (current + 1) % rows.length;
  if (event.key === 'ArrowUp') {
    next = (current <= 0 ? rows.length : current) - 1;
  }
  rows[next].focus();
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
  // Keyboard users get the Prime mark's explanation without hovering it.
  const [isKeyboardFocused, setIsKeyboardFocused] = useState(false);
  const handleFocus = useCallback(() => {
    setIsKeyboardFocused(!!document.activeElement?.matches(':focus-visible'));
  }, []);
  const handleBlur = useCallback(() => {
    setIsKeyboardFocused(false);
  }, []);

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
  const primeStatus = isPrimeUser
    ? intl.formatMessage({
        id: user?.isPrimeDeviceLimitExceeded
          ? ETranslations.prime_device_limit_reached
          : ETranslations.prime_status_prime,
      })
    : undefined;
  const rowLabel = isLoggedIn
    ? [name, 'OneKey ID', primeStatus].filter(Boolean).join(', ')
    : signIn;
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
      onFocus={handleFocus}
      onBlur={handleBlur}
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
              <LazyPrimeUserBadge
                showFreeStatus={false}
                iconOnly
                tooltipProps={
                  isKeyboardFocused
                    ? PRIME_MARK_TOOLTIP_OPEN
                    : PRIME_MARK_TOOLTIP
                }
              />
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

function MenuBody({
  marks,
  xfpMissing,
}: {
  marks: IProfileDrawerMarks;
  xfpMissing: boolean;
}) {
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
    <YStack p="$1" testID="desktop-profile-menu" onKeyDown={handleMenuKeyDown}>
      {/* Only the user can update a hardware wallet's legacy data; the More
          menu this replaced carried the same reminder. */}
      {xfpMissing ? (
        <Stack mb="$1">
          <WalletXfpStatusReminder />
        </Stack>
      ) : null}
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
        label={intl.formatMessage({ id: ETranslations.global_prime })}
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
        // Longer languages need the row's width for the update label.
        shortcutKeys={
          appUpdateLabel ? undefined : [shortcutsKeys.CmdOrCtrl, ',']
        }
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
  // After Esc the avatar keeps its keyboard focus; a mouse press would carry
  // that ring over to the menu's first row.
  useEffect(() => {
    if (!anchor) return undefined;
    const handlePointerDown = () => {
      if (document.activeElement === anchor) anchor.blur();
    };
    anchor.addEventListener('pointerdown', handlePointerDown);
    return () => anchor.removeEventListener('pointerdown', handlePointerDown);
  }, [anchor]);
  // The press that closes the menu lands on its backdrop, out of the tooltip's
  // reach, so the tooltip is held until the pointer moves off the avatar.
  const [isTooltipHeld, setIsTooltipHeld] = useState(false);
  useEffect(() => {
    if (!anchor || !isOpen) return undefined;
    const handlePointerDown = (event: PointerEvent) => {
      if (isPointerOver(anchor, event)) setIsTooltipHeld(true);
    };
    document.addEventListener('pointerdown', handlePointerDown, true);
    return () =>
      document.removeEventListener('pointerdown', handlePointerDown, true);
  }, [anchor, isOpen]);
  useEffect(() => {
    if (!anchor || !isTooltipHeld) return undefined;
    const handlePointerMove = (event: PointerEvent) => {
      if (!isPointerOver(anchor, event)) setIsTooltipHeld(false);
    };
    document.addEventListener('pointermove', handlePointerMove, true);
    return () =>
      document.removeEventListener('pointermove', handlePointerMove, true);
  }, [anchor, isTooltipHeld]);
  const marks = useProfileDrawerMarks({
    trackSeen: true,
    desktopMenuOpen: isOpen,
  });
  const xfpMissing = useWalletMetaSilentRepair();

  const hasDot = marks.avatarReasons.length > 0 || xfpMissing;
  const menuLabel = intl.formatMessage({
    id: ETranslations.address_book_menu_title,
  });
  const label = [
    menuLabel,
    marks.avatarReasons.length > 0
      ? intl.formatMessage({ id: ETranslations.settings_contact_us })
      : undefined,
    xfpMissing
      ? intl.formatMessage({
          id: ETranslations.global_hardware_legacy_data_update_banner_title,
        })
      : undefined,
  ]
    .filter(Boolean)
    .join(', ');
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
          disabled={isOpen || isTooltipHeld}
          renderTrigger={
            <Stack position="relative" w={40} h={40} p="$2">
              <div style={hasDot ? AVATAR_WITH_DOT_STYLE : AVATAR_STYLE}>
                <OneKeyIdAvatar size="$6" showSocialBadge={false} />
              </div>
              {hasDot ? (
                <Stack
                  testID="desktop-profile-menu-dot"
                  position="absolute"
                  top="$2"
                  right="$2"
                  w="$1.5"
                  h="$1.5"
                  borderRadius="$full"
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
        offset={MENU_OFFSET}
        open={isOpen}
        onOpenChange={setIsOpen}
        webAnchorElement={anchor}
        floatingPanelProps={MENU_PANEL_PROPS}
        renderTrigger={null}
        renderContent={
          <MoreActionProvider>
            <MenuBody marks={marks} xfpMissing={xfpMissing} />
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
