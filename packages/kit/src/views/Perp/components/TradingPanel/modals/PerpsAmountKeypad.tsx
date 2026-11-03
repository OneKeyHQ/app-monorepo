import { Icon, SizableText, Stack, XStack, YStack } from '@onekeyhq/components';

const CUSTOM_AMOUNT_KEYPAD_ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['.', '0', 'backspace'],
] as const;

const PERPS_KEYPAD_KEY_INTERACTIVE_STYLE = {
  opacity: 1,
  bg: '$bgStrong',
} as const;

export function PerpsAmountKeypad({
  onKeyPress,
  onBackspaceLongPress,
}: {
  onKeyPress: (key: string) => void;
  onBackspaceLongPress: () => void;
}) {
  return (
    <YStack gap="$2">
      {CUSTOM_AMOUNT_KEYPAD_ROWS.map((row) => (
        <XStack key={row.join('-')} gap="$2">
          {row.map((item) => (
            <Stack
              key={item}
              accessibilityRole="button"
              accessibilityLabel={item === 'backspace' ? 'Delete' : item}
              flex={1}
              h="$14"
              alignItems="center"
              justifyContent="center"
              borderRadius="$2.5"
              pressStyle={PERPS_KEYPAD_KEY_INTERACTIVE_STYLE}
              hoverStyle={PERPS_KEYPAD_KEY_INTERACTIVE_STYLE}
              onPress={() => onKeyPress(item)}
              onLongPress={
                item === 'backspace' ? onBackspaceLongPress : undefined
              }
            >
              {item === 'backspace' ? (
                <Icon name="XBackspaceOutline" size="$5" color="$iconSubdued" />
              ) : (
                <SizableText size="$heading2xl" fontWeight="400" color="$text">
                  {item}
                </SizableText>
              )}
            </Stack>
          ))}
        </XStack>
      ))}
    </YStack>
  );
}
