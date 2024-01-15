import { ActionList, IconButton } from '@onekeyhq/components/src/actions';
import type { IActionListSection } from '@onekeyhq/components/src/actions';
import {
  Icon,
  Image,
  SizableText,
  XStack,
} from '@onekeyhq/components/src/primitives';
import type { IKeyOfIcons, Stack } from '@onekeyhq/components/src/primitives';

import type { Animated, StyleProp, ViewStyle } from 'react-native';
import type { AvatarImage, GetProps } from 'tamagui';

export interface IDesktopTabItemProps {
  icon?: IKeyOfIcons;
  avatarSrc?: GetProps<typeof AvatarImage>['src'];
  label?: string;
  selected?: boolean;
  tabBarStyle?: Animated.WithAnimatedValue<StyleProp<ViewStyle>>;
  actionList?: IActionListSection[];
  onActionListOpenChange?: (isOpen: boolean) => void;
}

export function DesktopTabItem(
  props: IDesktopTabItemProps & GetProps<typeof Stack>,
) {
  const {
    icon,
    label,
    selected,
    tabBarStyle,
    actionList,
    avatarSrc,
    onActionListOpenChange,
    ...rest
  } = props;
  return (
    <XStack
      alignItems="center"
      py="$1.5"
      $gtMd={{
        flexDirection: 'row',
        px: '$2',
        bg: selected ? '$bgActive' : undefined,
        borderRadius: '$2',
      }}
      style={tabBarStyle as ViewStyle}
      {...rest}
    >
      {icon && (
        <Icon
          flexShrink={0}
          name={icon}
          color={selected ? '$iconActive' : '$iconSubdued'}
          size="$5"
        />
      )}
      {avatarSrc && (
        <Image borderRadius="$1" size="$4.5" m="$px">
          <Image.Source src={avatarSrc} />
          <Image.Fallback>
            <Icon
              size="$4.5"
              name="GlobusOutline"
              color={selected ? '$iconActive' : '$iconSubdued'}
            />
          </Image.Fallback>
        </Image>
      )}
      {label && (
        <SizableText
          flex={1}
          numberOfLines={1}
          ml="$2"
          color="$text"
          size="$bodyMd"
        >
          {label}
        </SizableText>
      )}
      {actionList && (
        <ActionList
          title="Action List"
          placement="right-start"
          onOpenChange={onActionListOpenChange}
          renderTrigger={
            selected && (
              <IconButton
                size="small"
                icon="DotHorOutline"
                variant="tertiary"
                focusStyle={undefined}
                p="$0.5"
                m={-3}
                testID="browser-bar-options"
              />
            )
          }
          sections={actionList}
        />
      )}
    </XStack>
  );
}
