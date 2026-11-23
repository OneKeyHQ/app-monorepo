import { useCallback, useRef } from 'react';

import { useIntl } from 'react-intl';

import { Button, Haptics, XStack, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { PerpsAmountKeypadKey } from './PerpsAmountKeypadKey';

const CUSTOM_AMOUNT_KEYPAD_ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['.', '0', 'backspace'],
] as const;

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
  onKeyPress: (key: string) => boolean | void;
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
  const callbacks = useRef({ onKeyPress, onBackspaceLongPress, disabled });
  callbacks.current = { onKeyPress, onBackspaceLongPress, disabled };
  const press = useCallback((key: string) => {
    if (callbacks.current.disabled) return;
    if (callbacks.current.onKeyPress(key) !== false) Haptics.selection();
  }, []);
  const clear = useCallback(() => {
    if (callbacks.current.disabled) return;
    callbacks.current.onBackspaceLongPress();
    Haptics.selection();
  }, []);
  return (
    <YStack
      mt={compact ? '$1' : '$2'}
      pb={platformEnv.isNativeAndroid ? '$3' : '$0'}
    >
      {CUSTOM_AMOUNT_KEYPAD_ROWS.map((row) => (
        <XStack key={row.join('-')} mx="$-1">
          {row.map((item) => (
            <PerpsAmountKeypadKey
              key={item}
              value={item}
              compact={compact}
              disabled={disabled}
              label={
                item === 'backspace'
                  ? intl.formatMessage({
                      id: ETranslations.perp_simple_delete_digit__action,
                    })
                  : item
              }
              onPress={press}
              onClear={clear}
            />
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
