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
}

export function StatCard({
  label,
  value,
  icon,
  iconColor,
  tooltip,
}: IStatItem) {
  return (
    <Stack
      bg="$bgSubdued"
      borderRadius="$3"
      p="$3"
      flexGrow={1}
      flexShrink={1}
      flexBasis={0}
      minHeight="$16"
      justifyContent="space-between"
      alignItems="center"
    >
      <XStack alignItems="center" gap="$1" mb="$2" justifyContent="center">
        <SizableText size="$bodyMd" color="$textSubdued" textAlign="center">
          {label}
        </SizableText>
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
        <SizableText size="$headingMd" color="$text" fontWeight="600">
          {value}
        </SizableText>
      </XStack>
    </Stack>
  );
}

export type { IStatItem };
