import { SizableText, YStack } from '@onekeyhq/components';

export interface ISettingsGroupHeaderProps {
  label: string;
}

export function SettingsGroupHeader({ label }: ISettingsGroupHeaderProps) {
  return (
    <YStack py="$2" px="$2">
      <SizableText size="$headingMd" color="$text">
        {label}
      </SizableText>
    </YStack>
  );
}
