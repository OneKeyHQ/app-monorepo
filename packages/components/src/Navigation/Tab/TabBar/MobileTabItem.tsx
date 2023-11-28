import { type GetProps } from 'tamagui';

import { Icon } from '../../../Icon';
import { YStack } from '../../../Stack';
import { Text } from '../../../Text';

import type { IKeyOfIcons } from '../../../Icon';
import type { Animated, StyleProp, ViewStyle } from 'react-native';

interface IMobileTabItemProps {
  icon?: IKeyOfIcons;
  label?: string;
  selected?: boolean;
  tabBarStyle?: Animated.WithAnimatedValue<StyleProp<ViewStyle>>;
}

export function MobileTabItem(
  props: IMobileTabItemProps & GetProps<typeof YStack>,
) {
  const { icon, label, selected, tabBarStyle, ...rest } = props;
  return (
    <YStack alignItems="center" py="$1.5" {...rest}>
      {icon && (
        <Icon
          flexShrink={0}
          name={icon}
          color={selected ? '$iconActive' : '$iconSubdued'}
          size="$7"
        />
      )}
      {label && (
        <Text
          numberOfLines={1}
          mt="$0.5"
          variant="$headingXxs"
          color={selected ? '$text' : '$textSubdued'}
          userSelect="none"
        >
          {label}
        </Text>
      )}
    </YStack>
  );
}
