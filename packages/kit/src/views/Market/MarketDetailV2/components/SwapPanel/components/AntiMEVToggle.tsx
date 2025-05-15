import { SizableText, Switch, XStack } from '@onekeyhq/components';

export function AntiMEVToggle({
  value,
  onToggle,
}: {
  value: boolean;
  onToggle: () => void;
}) {
  return (
    <XStack justifyContent="space-between" alignItems="center">
      <SizableText size="$bodyMd" color="$textSubdued">
        Anti-MEV
      </SizableText>
      <Switch size="large" value={value} onChange={onToggle} />
    </XStack>
  );
}
