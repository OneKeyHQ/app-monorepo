import { Icon, SizableText, Stack, XStack } from '@onekeyhq/components';
import type { ColorTokens, IIconProps } from '@onekeyhq/components';

interface IStatItem {
  label: string;
  value: string;
  icon?: IIconProps['name'];
  iconColor?: ColorTokens;
}

export function StatCard({ label, value, icon, iconColor }: IStatItem) {
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
      <SizableText
        size="$bodyMd"
        color="$textSubdued"
        mb="$2"
        textAlign="center"
      >
        {label}
      </SizableText>
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
