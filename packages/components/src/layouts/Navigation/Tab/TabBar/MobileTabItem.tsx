import { type GetProps } from 'tamagui';

import { Icon, SizableText, YStack } from '@onekeyhq/components/src/primitives';
import type { IKeyOfIcons } from '@onekeyhq/components/src/primitives';

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
        <SizableText
          numberOfLines={1}
          mt="$0.5"
          size="$headingXxs"
          color={selected ? '$text' : '$textSubdued'}
        >
          {label}
        </SizableText>
      )}
    </YStack>
  );
}
