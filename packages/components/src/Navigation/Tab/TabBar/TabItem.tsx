import { type GetProps } from 'tamagui';

import { Icon } from '../../../Icon';
import { Stack } from '../../../Stack';
import { Text } from '../../../Text';

import type { IICON_NAMES } from '../../../Icon';
import type { Animated, StyleProp, ViewStyle } from 'react-native';

interface ITabItemProps {
  icon?: IICON_NAMES;
  label?: string;
  selected?: boolean;
  tabBarStyle?: Animated.WithAnimatedValue<StyleProp<ViewStyle>>;
}

export function TabItem(props: ITabItemProps & GetProps<typeof Stack>) {
  const { icon, label, selected, tabBarStyle, ...rest } = props;

  return (
    <Stack
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
          size="$7"
          $gtMd={{
            size: '$5',
          }}
        />
      )}
      {label && (
        <Text
          numberOfLines={1}
          mt="$0.5"
          variant="$headingXxs"
          color={selected ? '$text' : '$textSubdued'}
          $gtMd={{
            mt: '$0',
            ml: '$2',
            color: '$text',
            variant: '$bodyMd',
          }}
          userSelect="none"
        >
          {label}
        </Text>
      )}
    </Stack>
  );
}
