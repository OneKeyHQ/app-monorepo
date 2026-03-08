import { useCallback, useEffect, useMemo, useRef } from 'react';

import { Icon, SizableText, Stack, XStack } from '@onekeyhq/components';
import { Haptics } from '@onekeyhq/components/src/primitives/Haptics';

const BACKSPACE_KEY = 'backspace';

// Repeat delay/interval for long-press backspace (similar to iOS native keyboard)
const LONG_PRESS_INITIAL_DELAY = 400;
const LONG_PRESS_REPEAT_INTERVAL = 80;

type INumericKeyboardProps = {
  onKeyPress: (key: string) => void;
  onBackspace: () => void;
  decimalEnabled?: boolean;
  decimalSeparator?: string;
};

function NumericKeyboardKey({
  label,
  onPress,
  onLongPressStart,
  onLongPressEnd,
}: {
  label: string | 'backspace' | 'empty';
  onPress: () => void;
  onLongPressStart?: () => void;
  onLongPressEnd?: () => void;
}) {
  const handlePress = useCallback(() => {
    Haptics.selection();
    onPress();
  }, [onPress]);

  if (label === 'empty') {
    return (
      <Stack
        h="$12"
        justifyContent="center"
        alignItems="center"
        bg="$bgApp"
        $platform-native={{ flex: 1 }}
        $platform-web={{ width: '33.333%' }}
      />
    );
  }

  const isBackspace = label === BACKSPACE_KEY;

  return (
    <Stack
      h="$12"
      justifyContent="center"
      alignItems="center"
      bg="$bgApp"
      hoverStyle={{ bg: '$bgHover' }}
      pressStyle={{ bg: '$bgActive' }}
      onPress={handlePress}
      {...(isBackspace && onLongPressStart && onLongPressEnd
        ? {
            onPressIn: onLongPressStart,
            onPressOut: onLongPressEnd,
          }
        : {})}
      userSelect="none"
      cursor="pointer"
      borderRadius="$2"
      $platform-native={{ flex: 1 }}
      $platform-web={{ width: '33.333%' }}
    >
      {isBackspace ? (
        <Icon name="XBackspaceOutline" size="$7" color="$icon" />
      ) : (
        <SizableText size="$heading2xl" userSelect="none">
          {label}
        </SizableText>
      )}
    </Stack>
  );
}

export function NumericKeyboard({
  onKeyPress,
  onBackspace,
  decimalEnabled = true,
  decimalSeparator = '.',
}: INumericKeyboardProps) {
  const rows = useMemo(
    () => [
      ['1', '2', '3'],
      ['4', '5', '6'],
      ['7', '8', '9'],
      [decimalEnabled ? decimalSeparator : 'empty', '0', BACKSPACE_KEY],
    ],
    [decimalEnabled, decimalSeparator],
  );

  const handleKeyPress = useCallback(
    (key: string) => {
      if (key === BACKSPACE_KEY) {
        onBackspace();
      } else {
        onKeyPress(key);
      }
    },
    [onKeyPress, onBackspace],
  );

  // Long-press backspace repeat logic
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (longPressIntervalRef.current) {
      clearInterval(longPressIntervalRef.current);
      longPressIntervalRef.current = null;
    }
  }, []);

  const handleBackspaceLongPressStart = useCallback(() => {
    clearLongPress();
    longPressTimerRef.current = setTimeout(() => {
      longPressIntervalRef.current = setInterval(() => {
        Haptics.selection();
        onBackspace();
      }, LONG_PRESS_REPEAT_INTERVAL);
    }, LONG_PRESS_INITIAL_DELAY);
  }, [onBackspace, clearLongPress]);

  const handleBackspaceLongPressEnd = useCallback(() => {
    clearLongPress();
  }, [clearLongPress]);

  // Cleanup on unmount
  useEffect(() => clearLongPress, [clearLongPress]);

  return (
    <Stack w="100%" $gtMd={{ maxWidth: 400, alignSelf: 'center' }}>
      {rows.map((row, rowIndex) => (
        <XStack key={rowIndex} flexWrap="wrap">
          {row.map((key) => (
            <NumericKeyboardKey
              key={key}
              label={key}
              onPress={() => handleKeyPress(key)}
              onLongPressStart={
                key === BACKSPACE_KEY
                  ? handleBackspaceLongPressStart
                  : undefined
              }
              onLongPressEnd={
                key === BACKSPACE_KEY ? handleBackspaceLongPressEnd : undefined
              }
            />
          ))}
        </XStack>
      ))}
    </Stack>
  );
}
