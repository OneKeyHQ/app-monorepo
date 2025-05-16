import { SizableText, Switch, XStack } from '@onekeyhq/components';

export interface IAntiMEVToggleProps {
  value: boolean;
  onToggle: () => void;
}

export function AntiMEVToggle({ value, onToggle }: IAntiMEVToggleProps) {
  return (
    <XStack justifyContent="space-between" alignItems="center">
      <SizableText size="$bodyMd" color="$textSubdued">
        Anti-MEV
      </SizableText>
      <Switch size="large" value={value} onChange={onToggle} />
    </XStack>
  );
}
