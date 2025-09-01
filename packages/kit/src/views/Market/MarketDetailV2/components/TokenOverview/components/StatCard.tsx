import {
  Icon,
  Popover,
  SizableText,
  Stack,
  XStack,
} from '@onekeyhq/components';
import type { ColorTokens, IIconProps } from '@onekeyhq/components';

interface IStatItem {
  label: string;
  value: string;
  icon?: IIconProps['name'];
  iconColor?: ColorTokens;
  tooltip?: string;
  onPress?: () => void;
}

export function StatCard({
  label,
  value,
  icon,
  iconColor,
  tooltip,
  onPress,
}: IStatItem) {
  const content = (
    <Stack
      onPress={onPress}
      bg="$bgStrong"
      borderRadius="$3"
      p="$3"
      flexGrow={1}
      flexShrink={1}
      flexBasis={0}
      minHeight="$16"
      justifyContent="space-between"
      alignItems="center"
    >
      <XStack alignItems="center" gap="$1" mb="$1" justifyContent="center">
        <SizableText size="$bodyMd" color="$textSubdued" textAlign="center">
          {label}
        </SizableText>
        {onPress ? (
          <Icon
            name="ChevronRightSmallOutline"
            size="$4"
            color="$textSubdued"
          />
        ) : null}

        {tooltip ? (
          <Popover.Tooltip
            iconSize="$4"
            title={label}
            tooltip={tooltip}
            placement="top"
          />
        ) : null}
      </XStack>
      <XStack alignItems="center" gap="$1">
        {icon ? (
          <Icon name={icon} size="$4" color={iconColor || '$iconSuccess'} />
        ) : null}
        <SizableText size="$bodyLgMedium" color="$text">
          {value}
        </SizableText>
      </XStack>
    </Stack>
  );

  return content;
}

export type { IStatItem };
