import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  ActionList,
  IconButton,
  LazyTooltip,
} from '@onekeyhq/components/src/actions';
import type { IActionListSection } from '@onekeyhq/components/src/actions';
import { useNetInfo } from '@onekeyhq/components/src/hooks/useNetInfo';
import {
  Icon,
  Image,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components/src/primitives';
import type {
  IIconProps,
  IKeyOfIcons,
  ISizableTextProps,
  IStackStyle,
} from '@onekeyhq/components/src/primitives';
import type {
  AvatarImage,
  GetProps,
  TamaguiElement,
} from '@onekeyhq/components/src/shared/tamagui';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import {
  EPerpPageEnterSource,
  setPerpPageEnterSource,
} from '@onekeyhq/shared/src/logger/scopes/perp/perpPageSource';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EShortcutEvents } from '@onekeyhq/shared/src/shortcuts/shortcuts.enum';

import { useBrowserSubmenu } from './BrowserSubmenuColumn/BrowserSubmenuContext';
import { EXPANDED_SUBMENU_WIDTH } from './BrowserSubmenuColumn/SubmenuColumn';

import type {
  Animated,
  GestureResponderEvent,
  StyleProp,
  ViewStyle,
} from 'react-native';

const emptyFragment = <></>;
const CLOSE_PRESS_MOVE_TOLERANCE_PX = 4;
const leadingIconFadeStyle = { transition: 'opacity 150ms ease' };
const hiddenStyle = { opacity: 0 };
const visibleStyle = { opacity: 1 };
// The leading close button's right edge sits 42px from the left of the
// expanded browser column. Push its tooltip just past the column's right edge
// so it covers no tab title.
const leadingCloseTooltipProps = { offset: EXPANDED_SUBMENU_WIDTH - 42 + 8 };

export interface IDesktopTabItemProps {
  hideCloseButton?: boolean;
  size?: 'small' | 'medium';
  icon?: IKeyOfIcons;
  showAvatar?: boolean;
  avatarSrc?: GetProps<typeof AvatarImage>['src'];
  label?: string;
  selected?: boolean;
  tabBarStyle?: Animated.WithAnimatedValue<StyleProp<ViewStyle>>;
  tabBarItemStyle?: IStackStyle;
  tabBarIconStyle?: IIconProps;
  tabBarLabelStyle?: ISizableTextProps;
  actionList?: IActionListSection[];
  shortcutKey?: EShortcutEvents | string[];
  showTooltip?: boolean;
  onClose?: () => void;
  children?: React.ReactNode;
  trackId?: string;
  showDot?: boolean;
  isContainerHovered?: boolean;
  onPressWhenSelected?: () => void; // New: Click event when already selected
  closeButtonIcon?: IKeyOfIcons;
  closeButtonTitle?: React.ReactNode;
  alwaysShowCloseButton?: boolean;
  /**
   * Show the close button over the leading icon while hovered, instead of at
   * the trailing edge, so closing needs no travel across the row.
   */
  leadingCloseButton?: boolean;
}

function BasicDesktopTabItemImage({
  avatarSrc,
  selected,
}: {
  avatarSrc?: string;
  selected?: boolean;
}) {
  const { isRawInternetReachable } = useNetInfo(Boolean(avatarSrc));
  const previousInternetReachableRef = useRef(isRawInternetReachable);
  const [imageReloadVersion, setImageReloadVersion] = useState(0);

  useEffect(() => {
    if (
      previousInternetReachableRef.current === false &&
      isRawInternetReachable === true
    ) {
      setImageReloadVersion((version) => version + 1);
    }
    previousInternetReachableRef.current = isRawInternetReachable;
  }, [isRawInternetReachable]);

  const imageKey = useMemo(
    () => `${avatarSrc ?? ''}:${imageReloadVersion}`,
    [avatarSrc, imageReloadVersion],
  );
  const fallbackElement = useMemo(
    () => (
      <Image.Fallback bg="$bgSidebar" delayMs={180}>
        <Icon
          size="$4.5"
          name="GlobusOutline"
          color={selected ? '$iconActive' : '$iconSubdued'}
        />
      </Image.Fallback>
    ),
    [selected],
  );
  return (
    <Image
      key={imageKey}
      borderRadius="$1"
      size="$4.5"
      m="$px"
      source={avatarSrc}
      fallback={fallbackElement}
    />
  );
}

export const DesktopTabItemImage = memo(BasicDesktopTabItemImage);

export function DesktopTabItem(
  props: IDesktopTabItemProps & GetProps<typeof Stack>,
) {
  const {
    icon,
    label,
    selected,
    tabBarStyle,
    tabBarItemStyle,
    tabBarIconStyle,
    tabBarLabelStyle,
    actionList,
    avatarSrc,
    showAvatar = false,
    onPress,
    onClose,
    shortcutKey,
    showTooltip = true,
    trackId,
    size = 'medium',
    children,
    showDot,
    isContainerHovered = false,
    hideCloseButton = false,
    onPressWhenSelected,
    closeButtonIcon,
    closeButtonTitle,
    alwaysShowCloseButton = false,
    leadingCloseButton = false,
    ...rest
  } = props;

  const intl = useIntl();
  const { reportPopoverOpen, isCloseArmed } = useBrowserSubmenu();
  const stackRef = useRef<TamaguiElement>(null);
  const openActionList = useRef<() => void | undefined>(undefined);
  const [isHovered, setIsHovered] = useState(false);
  const [isContextMenuOpened, setIsContextMenuOpened] = useState(false);
  const onOpenContextMenu = useCallback((e: Event) => {
    e.preventDefault();
    openActionList?.current?.();
  }, []);

  useEffect(() => {
    if (!platformEnv.isNative) {
      const stackValue = stackRef?.current as HTMLElement;
      stackValue?.addEventListener('contextmenu', onOpenContextMenu);
      return () => {
        stackValue?.removeEventListener('contextmenu', onOpenContextMenu);
      };
    }
  }, [onOpenContextMenu]);
  const onMouseEnter = useCallback(() => {
    setIsHovered(true);
  }, []);
  const onMouseLeave = useCallback(() => {
    setIsHovered(false);
  }, []);
  const reloadOnPress = useCallback(
    (e: GestureResponderEvent) => {
      setIsHovered(false);
      if (selected) {
        // If there's a specific "when selected" callback, use it first
        if (onPressWhenSelected) {
          onPressWhenSelected();
        }
        // Removed: openActionList?.current?.() to avoid conflict with hover popover
      } else {
        onPress?.(e);
      }
      if (trackId === 'global-perp' && !selected) {
        setPerpPageEnterSource(EPerpPageEnterSource.TabBar);
      }
      if (trackId) {
        defaultLogger.app.page.tabBarClick(trackId);
      }
    },
    [onPress, selected, trackId, onPressWhenSelected],
  );
  const handleRenderItems = useCallback(
    ({ handleActionListOpen }: { handleActionListOpen: () => void }) => {
      openActionList.current = handleActionListOpen;
      return undefined;
    },
    [],
  );
  const handleActionListOpenChange = useCallback(
    (isOpened: boolean) => {
      reportPopoverOpen(isOpened);
      setIsContextMenuOpened(isOpened);
      setIsHovered(isOpened);
    },
    [reportPopoverOpen],
  );
  const tabItemGtMdStyle = useMemo(
    () =>
      ({
        flexDirection: 'row',
        px: '$2',
        bg: selected ? '$bgActive' : undefined,
        borderRadius: '$2',
      }) as IStackStyle,
    [selected],
  );
  const defaultCloseButtonTitle = useMemo(
    () => (
      // The CloseTab shortcut closes the active tab only.
      <LazyTooltip.Text
        shortcutKey={selected ? EShortcutEvents.CloseTab : undefined}
      >
        {intl.formatMessage({
          id: ETranslations.global_close,
        })}
      </LazyTooltip.Text>
    ),
    [intl, selected],
  );
  const canClose = !hideCloseButton && !!actionList;
  // Shown through CSS :hover rather than hover state: React misses enter and
  // leave events when rows slide under a still pointer (the matching mouseout
  // goes to a removed node), which left rows without a button or stuck with one.
  const showLeadingCloseButton = leadingCloseButton && canClose && isCloseArmed;
  const showTrailingCloseButton =
    !leadingCloseButton &&
    canClose &&
    (alwaysShowCloseButton || selected || isHovered || isContainerHovered);
  // The leading close button sits where a row is usually grabbed to reorder
  // it. Drag sorting does not start from a button, so a press that moved at
  // any point is a drag attempt and must not close the tab.
  const closePressMovedRef = useRef(false);
  const closePressTrackingRef = useRef<AbortController | null>(null);
  useEffect(() => () => closePressTrackingRef.current?.abort(), []);
  const handleClosePressIn = useCallback(
    (e: GestureResponderEvent) => {
      closePressTrackingRef.current?.abort();
      closePressMovedRef.current = false;
      if (!leadingCloseButton || platformEnv.isNative) return;
      const { pageX, pageY } = e.nativeEvent;
      const tracking = new AbortController();
      closePressTrackingRef.current = tracking;
      const { signal } = tracking;
      const stopTracking = () => tracking.abort();
      document.addEventListener(
        'pointermove',
        (event: PointerEvent) => {
          if (
            Math.hypot(event.pageX - pageX, event.pageY - pageY) >
            CLOSE_PRESS_MOVE_TOLERANCE_PX
          ) {
            closePressMovedRef.current = true;
            stopTracking();
          }
        },
        { signal },
      );
      // Capture phase, so tracking ends before the click that fires onPress.
      document.addEventListener('pointerup', stopTracking, {
        capture: true,
        signal,
      });
      document.addEventListener('pointercancel', stopTracking, {
        capture: true,
        signal,
      });
      globalThis.addEventListener('blur', stopTracking, { signal });
    },
    [leadingCloseButton],
  );
  const handleClosePress = useCallback(() => {
    if (closePressMovedRef.current) return;
    onClose?.();
  }, [onClose]);
  const closeButton = useMemo(
    () => (
      <IconButton
        size="small"
        icon={closeButtonIcon ?? 'CrossedSmallOutline'}
        {...(closeButtonIcon ? { iconSize: '$4', p: '$1' } : { p: '$0.5' })}
        variant="tertiary"
        focusVisibleStyle={undefined}
        title={closeButtonTitle ?? defaultCloseButtonTitle}
        // Above or below, the tooltip would cover a nearby row; on the
        // left it flips to the right whenever a shortcut makes it wider.
        titlePlacement={leadingCloseButton ? 'right' : undefined}
        tooltipProps={leadingCloseButton ? leadingCloseTooltipProps : undefined}
        // A div, not a <button>, so drag sorting can still start from the
        // favicon spot the leading button covers.
        render={leadingCloseButton ? 'div' : undefined}
        m={-3}
        testID="browser-bar-options"
        onPressIn={handleClosePressIn}
        onPress={handleClosePress}
      />
    ),
    [
      closeButtonIcon,
      closeButtonTitle,
      defaultCloseButtonTitle,
      leadingCloseButton,
      handleClosePressIn,
      handleClosePress,
    ],
  );
  const leadingIcon = useMemo(
    () => (
      <>
        {icon ? (
          <XStack
            className="sidebar-tab-item-icon"
            flexShrink={0}
            width={size === 'small' ? '$5' : '$6'}
            height={size === 'small' ? '$5' : '$6'}
            alignItems="center"
            justifyContent="center"
          >
            <Icon
              flexShrink={0}
              name={icon}
              color={selected ? '$iconActive' : '$iconSubdued'}
              size={size === 'small' ? '$5' : '$6'}
              {...tabBarIconStyle}
            />
            {showDot ? (
              <Stack
                width="$2.5"
                height="$2.5"
                bg="$bgAccent"
                borderRadius="$full"
                position="absolute"
                right={-3}
                top={-2}
                borderWidth="$0.5"
                borderColor="$bgSubdued"
              />
            ) : null}
          </XStack>
        ) : null}
        {showAvatar ? (
          <DesktopTabItemImage avatarSrc={avatarSrc} selected={selected} />
        ) : null}
      </>
    ),
    [icon, size, selected, tabBarIconStyle, showDot, showAvatar, avatarSrc],
  );
  const trigger = useMemo(
    () => (
      <YStack
        {...tabBarItemStyle}
        alignItems="center"
        py="$2"
        $gtMd={tabItemGtMdStyle}
        userSelect="none"
        {...((!selected && {
          pressStyle: {
            bg: '$bgActive',
          },
        }) as any)}
        {...((leadingCloseButton && {
          group: 'browserTabItem',
          hoverStyle: { bg: '$bgHover' },
        }) as any)}
        {...(((isContextMenuOpened ||
          (isHovered && !leadingCloseButton) ||
          isContainerHovered) && {
          bg: '$bgHover',
        }) as any)}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onPress={reloadOnPress}
        {...rest}
        testID={
          selected
            ? `tab-modal-active-item-${rest.id || icon || ''}`
            : `tab-modal-no-active-item-${rest.id || icon || ''}`
        }
      >
        {leadingCloseButton ? (
          <Stack flexShrink={0}>
            {/* Keep the icon mounted (only hidden) so the favicon does not reload. */}
            <XStack
              style={leadingIconFadeStyle}
              {...(showLeadingCloseButton && {
                '$group-browserTabItem-hover': hiddenStyle,
              })}
            >
              {leadingIcon}
            </XStack>
            {showLeadingCloseButton ? (
              <Stack
                position="absolute"
                top={0}
                right={0}
                bottom={0}
                left={0}
                alignItems="center"
                justifyContent="center"
                opacity={0}
                $group-browserTabItem-hover={visibleStyle}
                style={leadingIconFadeStyle}
              >
                {closeButton}
              </Stack>
            ) : null}
          </Stack>
        ) : (
          leadingIcon
        )}
        {label ? (
          <SizableText
            flex={1}
            numberOfLines={1}
            mx="$2"
            color="$text"
            size="$bodyMd"
            {...tabBarLabelStyle}
          >
            {label}
          </SizableText>
        ) : null}
        {showTrailingCloseButton ? closeButton : null}
        {actionList ? (
          <ActionList
            title=""
            placement="right-start"
            sections={actionList}
            renderTrigger={emptyFragment}
            renderItems={handleRenderItems}
            onOpenChange={handleActionListOpenChange}
          />
        ) : null}
        {children}
      </YStack>
    ),
    [
      tabBarItemStyle,
      tabItemGtMdStyle,
      selected,
      isContextMenuOpened,
      isHovered,
      isContainerHovered,
      onMouseEnter,
      onMouseLeave,
      reloadOnPress,
      rest,
      icon,
      leadingCloseButton,
      showLeadingCloseButton,
      leadingIcon,
      closeButton,
      label,
      tabBarLabelStyle,
      showTrailingCloseButton,
      actionList,
      handleRenderItems,
      handleActionListOpenChange,
      children,
    ],
  );
  return (
    <YStack
      testID={rest.testID}
      ref={stackRef}
      style={tabBarStyle as ViewStyle}
    >
      {platformEnv.isDesktop && shortcutKey && showTooltip ? (
        <LazyTooltip
          shortcutKey={shortcutKey}
          renderTrigger={trigger}
          renderContent={label}
          placement="right"
        />
      ) : (
        trigger
      )}
    </YStack>
  );
}
