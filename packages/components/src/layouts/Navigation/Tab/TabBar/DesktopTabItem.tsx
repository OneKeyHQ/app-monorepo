import { ActionList, IconButton } from '../../../../actions';
import { Avatar } from '../../../../content';
import { Icon, Text, XStack } from '../../../../primitives';

import type { IActionListSection } from '../../../../actions';
import type { IKeyOfIcons, Stack } from '../../../../primitives';
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
        <Avatar borderRadius="$1" size="$4.5" m="$px">
          <Avatar.Image src={avatarSrc} />
          <Avatar.Fallback>
            <Icon
              size="$4.5"
              name="GlobusOutline"
              color={selected ? '$iconActive' : '$iconSubdued'}
            />
          </Avatar.Fallback>
        </Avatar>
      )}
      {label && (
        <Text
          flex={1}
          numberOfLines={1}
          ml="$2"
          color="$text"
          variant="$bodyMd"
        >
          {label}
        </Text>
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
