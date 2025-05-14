import { SizableText, Switch, XStack } from '@onekeyhq/components';

export function AntiMEVToggle() {
  return (
    <XStack justifyContent="space-between" alignItems="center">
      <SizableText size="$bodyMd" color="$textSubdued">
        Anti-MEV
      </SizableText>
      <Switch size="large" />
    </XStack>
  );
}
