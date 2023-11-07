import { type GetProps } from 'tamagui';

import { Icon } from '../../../Icon';
import { Stack } from '../../../Stack';
import { Text } from '../../../Text';

import type { ICON_NAMES } from '../../../Icon';

interface StackProps {
  icon?: ICON_NAMES;
  label?: string;
  selected?: boolean;
}

export function TabItem(props: StackProps & GetProps<typeof Stack>) {
  const { icon, label, selected, ...rest } = props;

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
