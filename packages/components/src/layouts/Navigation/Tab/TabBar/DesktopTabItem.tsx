import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  ActionList,
  IconButton,
  Tooltip,
} from '@onekeyhq/components/src/actions';
import type { IActionListSection } from '@onekeyhq/components/src/actions';
import {
  Icon,
  Image,
  SizableText,
  Skeleton,
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
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EShortcutEvents } from '@onekeyhq/shared/src/shortcuts/shortcuts.enum';

import type {
  Animated,
  GestureResponderEvent,
  StyleProp,
  ViewStyle,
} from 'react-native';
import type { AvatarImage, GetProps, TamaguiElement } from 'tamagui';

export interface IDesktopTabItemProps {
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
  onPressWhenSelected?: () => void; // New: Click event when already selected
}

function BasicDesktopTabItemImage({
  avatarSrc,
  selected,
}: {
  avatarSrc?: string;
  selected?: boolean;
}) {
  return (
    <Image
      borderRadius="$1"
      size="$4.5"
      m="$px"
      source={avatarSrc}
      fallback={
        <Image.Fallback bg="$bgSidebar" delayMs={180}>
          <Icon
            size="$4.5"
            name="GlobusOutline"
            color={selected ? '$iconActive' : '$iconSubdued'}
          />
        </Image.Fallback>
      }
    />
  );
}

const DesktopTabItemImage = memo(BasicDesktopTabItemImage);

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
    onPressWhenSelected,
    ...rest
  } = props;

  const intl = useIntl();
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
      if (selected) {
        // If there's a specific "when selected" callback, use it first
        if (onPressWhenSelected) {
          onPressWhenSelected();
        } else {
          openActionList?.current?.();
        }
      } else {
        onPress?.(e);
      }
      if (trackId) {
        defaultLogger.app.page.tabBarClick(trackId);
      }
    },
    [onPress, selected, trackId, onPressWhenSelected],
  );
  const trigger = useMemo(
    () => (
      <XStack
        {...tabBarItemStyle}
        alignItems="center"
        py={size === 'small' ? '$1.5' : '$2'}
        $gtMd={
          {
            flexDirection: 'row',
            px: '$2',
            bg: selected ? '$bgActive' : undefined,
            borderRadius: '$2',
          } as any
        }
        userSelect="none"
        {...((!selected && {
          pressStyle: {
            bg: '$bgActive',
          },
        }) as any)}
        {...(((isContextMenuOpened || isHovered) && {
          bg: '$bgHover',
        }) as any)}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onPress={reloadOnPress}
        {...rest}
        testID={
          selected
            ? `tab-modal-active-item-${rest.id || ''}`
            : `tab-modal-no-active-item-${rest.id || ''}`
        }
      >
        {icon ? (
          <XStack flexShrink={0}>
            <Icon
              flexShrink={0}
              name={icon}
              color={selected ? '$iconActive' : '$iconSubdued'}
              size="$5"
              {...tabBarIconStyle}
            />
            {showDot ? (
              <Stack
                width="$2.5"
                height="$2.5"
                bg="$iconInfo"
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
        {(selected || isHovered) && actionList ? (
          <IconButton
            size="small"
            icon="CrossedSmallOutline"
            variant="tertiary"
            focusVisibleStyle={undefined}
            title={
              <Tooltip.Text shortcutKey={EShortcutEvents.CloseTab}>
                {intl.formatMessage({
                  id: ETranslations.global_close,
                })}
              </Tooltip.Text>
            }
            p="$0.5"
            m={-3}
            testID="browser-bar-options"
            onPress={onClose}
          />
        ) : null}
        {actionList ? (
          <ActionList
            title=""
            placement="right-start"
            sections={actionList}
            renderTrigger={<></>}
            renderItems={({ handleActionListOpen }) => {
              openActionList.current = handleActionListOpen;
              return undefined;
            }}
            onOpenChange={(isOpened) => {
              setIsContextMenuOpened(isOpened);
              setIsHovered(isOpened);
            }}
          />
        ) : null}
        {children}
      </XStack>
    ),
    [
      tabBarItemStyle,
      size,
      selected,
      isContextMenuOpened,
      isHovered,
      onMouseEnter,
      onMouseLeave,
      reloadOnPress,
      rest,
      icon,
      tabBarIconStyle,
      showDot,
      showAvatar,
      avatarSrc,
      label,
      tabBarLabelStyle,
      actionList,
      intl,
      onClose,
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
        <Tooltip
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
