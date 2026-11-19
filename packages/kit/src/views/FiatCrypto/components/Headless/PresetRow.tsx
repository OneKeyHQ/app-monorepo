import { Button, XStack } from '@onekeyhq/components';

const PRESETS = [50, 100, 200];

type IProps = {
  onSelect: (value: string) => void;
};

// Quick fiat presets shown directly above the keypad. Tapping one only fills
// the amount (no state change, no highlight). Sized like the preview button
// below the keypad: same `large` height, the row spans the full width.
export function PresetRow({ onSelect }: IProps) {
  return (
    <XStack gap="$2">
      {PRESETS.map((value) => (
        <Button
          key={value}
          testID={`fiat-preset-${value}`}
          flex={1}
          size="large"
          variant="secondary"
          onPress={() => onSelect(String(value))}
        >
          {`$${value}`}
        </Button>
      ))}
    </XStack>
  );
}
