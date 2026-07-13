import { useCallback } from 'react';

import type { IButtonProps, IStackProps } from '@onekeyhq/components';
import { Button, SizableText, XStack, YStack } from '@onekeyhq/components';

function OptionButton({
  label,
  value,
  onPress,
  variant,
  testID,
  ...props
}: {
  label: string;
  value: string;
  onPress: (value: string) => void;
  variant: IButtonProps['variant'];
  testID?: string;
} & Omit<IStackProps, 'onPress'>) {
  const handlePress = useCallback(() => {
    onPress(value);
  }, [onPress, value]);
  return (
    <Button testID={testID} variant={variant} onPress={handlePress} {...props}>
      {label}
    </Button>
  );
}

export function ToggleButton({
  value: selectedValue,
  title,
  options,
  onChange,
  testIDPrefix,
}: {
  value?: string;
  title?: string;
  options: { label: string; value: string }[];
  onChange: (value: string) => void;
  testIDPrefix?: string;
}) {
  return (
    <YStack>
      <SizableText size="$bodyMdMedium">{title}</SizableText>
      <XStack flexWrap="wrap" gap="$3">
        {options.map(({ label, value }) => (
          <OptionButton
            mt="$2"
            variant={value === selectedValue ? 'primary' : undefined}
            key={value}
            label={label}
            value={value}
            onPress={onChange}
            testID={testIDPrefix ? `${testIDPrefix}-${value}` : undefined}
          />
        ))}
      </XStack>
    </YStack>
  );
}
