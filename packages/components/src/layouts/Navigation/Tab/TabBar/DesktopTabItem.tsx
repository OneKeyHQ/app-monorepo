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

import type {
  Animated,
  GestureResponderEvent,
  StyleProp,
  ViewStyle,
} from 'react-native';

const emptyFragment = <></>;

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
   * Show the close button over the leading icon slot (on hover) instead of at
   * the trailing edge, so closing needs no horizontal travel.
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
  const { reportPopoverOpen } = useBrowserSubmenu();
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
  // Leading close mode shows the close button only while hovered, so hover
  // must reflect the real pointer after a click or a context menu closes,
  // instead of being force-cleared while the cursor is still on the row.
  const isPointerOverItem = useCallback(
    () =>
      leadingCloseButton &&
      !platformEnv.isNative &&
      !!(stackRef.current as HTMLElement | null)?.matches?.(':hover'),
    [leadingCloseButton],
  );
  const reloadOnPress = useCallback(
    (e: GestureResponderEvent) => {
      setIsHovered(isPointerOverItem());
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
    [onPress, selected, trackId, onPressWhenSelected, isPointerOverItem],
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
      setIsHovered(isOpened || isPointerOverItem());
    },
    [reportPopoverOpen, isPointerOverItem],
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
      // The CloseTab shortcut closes the active tab, so only advertise it on
      // the selected item.
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
  const showLeadingCloseButton = leadingCloseButton && canClose && isHovered;
  const showTrailingCloseButton =
    !leadingCloseButton &&
    canClose &&
    (alwaysShowCloseButton || selected || isHovered || isContainerHovered);
  // The leading icon stays mounted (only faded) while the close button
  // overlays it, so hovering does not reload the favicon image.
  const leadingIconOpacity = showLeadingCloseButton ? 0 : 1;
  const closeButton = useMemo(
    () => (
      <IconButton
        size="small"
        icon={closeButtonIcon ?? 'CrossedSmallOutline'}
        {...(closeButtonIcon ? { iconSize: '$4', p: '$1' } : { p: '$0.5' })}
        variant="tertiary"
        focusVisibleStyle={undefined}
        title={closeButtonTitle ?? defaultCloseButtonTitle}
        m={-3}
        testID="browser-bar-options"
        onPress={onClose}
      />
    ),
    [closeButtonIcon, closeButtonTitle, defaultCloseButtonTitle, onClose],
  );
  const trigger = useMemo(
    () => (
      <YStack
        {...tabBarItemStyle}
        alignItems="center"
        py="$2"
        // Anchor the leading close overlay to this row.
        position={leadingCloseButton ? 'relative' : undefined}
        $gtMd={tabItemGtMdStyle}
        userSelect="none"
        {...((!selected && {
          pressStyle: {
            bg: '$bgActive',
          },
        }) as any)}
        {...(((isContextMenuOpened || isHovered || isContainerHovered) && {
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
        {icon ? (
          <XStack
            className="sidebar-tab-item-icon"
            flexShrink={0}
            opacity={leadingIconOpacity}
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
          <Stack opacity={leadingIconOpacity}>
            <DesktopTabItemImage avatarSrc={avatarSrc} selected={selected} />
          </Stack>
        ) : null}
        {showLeadingCloseButton ? (
          <XStack
            position="absolute"
            left="$2"
            top={0}
            bottom={0}
            width="$5"
            alignItems="center"
            justifyContent="center"
          >
            {closeButton}
          </XStack>
        ) : null}
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
      size,
      tabBarIconStyle,
      showDot,
      showAvatar,
      avatarSrc,
      label,
      tabBarLabelStyle,
      leadingIconOpacity,
      showLeadingCloseButton,
      showTrailingCloseButton,
      leadingCloseButton,
      closeButton,
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
