import { useIntl } from 'react-intl';

import {
  Button,
  Icon,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

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

export function PerpsNativeAmountKeypad({
  onKeyPress,
  onBackspaceLongPress,
  ctaLabel,
  ctaDisabled,
  ctaLoading,
  onCtaPress,
  hideCta = false,
  disabled = false,
  compact = false,
}: {
  onKeyPress: (key: string) => void;
  onBackspaceLongPress: () => void;
  ctaLabel: string;
  ctaDisabled?: boolean;
  ctaLoading?: boolean;
  onCtaPress: () => void;
  hideCta?: boolean;
  disabled?: boolean;
  compact?: boolean;
}) {
  const intl = useIntl();
  return (
    <YStack
      mt={compact ? '$1' : '$2'}
      gap={compact ? '$1' : '$2'}
      pb={platformEnv.isNativeAndroid ? '$3' : '$0'}
    >
      {CUSTOM_AMOUNT_KEYPAD_ROWS.map((row) => (
        <XStack key={row.join('-')} gap="$2">
          {row.map((item) => (
            <Stack
              key={item}
              disabled={disabled}
              accessible
              accessibilityRole="button"
              accessibilityLabel={
                item === 'backspace'
                  ? intl.formatMessage({
                      id: ETranslations.perp_simple_delete_digit__action,
                    })
                  : item
              }
              flex={1}
              h={compact ? '$11' : '$14'}
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
                <SizableText
                  size={compact ? '$headingXl' : '$heading2xl'}
                  fontWeight="400"
                  color="$text"
                >
                  {item}
                </SizableText>
              )}
            </Stack>
          ))}
        </XStack>
      ))}
      {hideCta ? null : (
        <Button
          testID="perp-native-amount-cta"
          size="large"
          variant="primary"
          disabled={ctaDisabled}
          loading={ctaLoading}
          onPress={onCtaPress}
        >
          {ctaLabel}
        </Button>
      )}
    </YStack>
  );
}
