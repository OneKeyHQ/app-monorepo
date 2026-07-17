import {
  Haptics,
  Icon,
  ImpactFeedbackStyle,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

// Numeric keypad grid, forked from the Perps deposit keypad
// (PerpsNativeAmountKeypad) WITHOUT its baked-in CTA, so the buy action zone can
// render separately below it. Presentational only — all state lives in the parent.
export const AMOUNT_KEYPAD_ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['.', '0', 'backspace'],
] as const;

const KEY_INTERACTIVE_STYLE = { opacity: 1, bg: '$bgStrong' } as const;

type IProps = {
  onKeyPress: (key: string) => void;
  onBackspaceLongPress: () => void;
};

export function NativeAmountKeypad({
  onKeyPress,
  onBackspaceLongPress,
}: IProps) {
  return (
    <YStack gap="$2" pb={platformEnv.isNativeAndroid ? '$3' : '$0'}>
      {AMOUNT_KEYPAD_ROWS.map((row) => (
        <XStack key={row.join('-')} gap="$2">
          {row.map((item) => (
            <Stack
              key={item}
              flex={1}
              h="$14"
              alignItems="center"
              justifyContent="center"
              borderRadius="$full"
              pressStyle={KEY_INTERACTIVE_STYLE}
              hoverStyle={KEY_INTERACTIVE_STYLE}
              onPress={() => {
                // Selection-grade tick per key (no-op off-native); the
                // clear-all long-press below gets a firmer impact instead.
                Haptics.selection();
                onKeyPress(item);
              }}
              // Native-only: tamagui's web build folds onLongPress into the
              // same composed click handler as onPress, so on web/desktop a
              // single backspace click would also fire the clear-all.
              onLongPress={
                item === 'backspace' && platformEnv.isNative
                  ? () => {
                      Haptics.impact(ImpactFeedbackStyle.Medium);
                      onBackspaceLongPress();
                    }
                  : undefined
              }
            >
              {item === 'backspace' ? (
                <Icon name="ChevronLeftOutline" size="$5" color="$text" />
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
