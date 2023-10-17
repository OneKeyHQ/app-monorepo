import { useCallback, useState } from 'react';

import { AnimatePresence } from 'tamagui';

import { Icon } from '../Icon';
import { Input } from '../Input';
import { Stack, XStack } from '../Stack';

import type {
  NativeSyntheticEvent,
  TextInputFocusEventData,
  TextInputSubmitEditingEventData,
} from 'react-native';

interface SearchBarProps {
  height?: string;
  value?: string;
  placeholder?: string;
  onBlur?: (e: NativeSyntheticEvent<TextInputFocusEventData>) => void;
  onFocus?: (e: NativeSyntheticEvent<TextInputFocusEventData>) => void;
  onChange?: (value: string) => void;
  onSubmitEditing?: (
    e: NativeSyntheticEvent<TextInputSubmitEditingEventData>,
  ) => void;
}

export function SearchBar({
  height,
  value,
  placeholder,
  onChange,
  onBlur,
  onFocus,
  onSubmitEditing,
}: SearchBarProps) {
  const [isFocus, setIsFocus] = useState(false);
  const handleOnFocus = useCallback(
    (e: NativeSyntheticEvent<TextInputFocusEventData>) => {
      setIsFocus(true);
      onFocus?.(e);
    },
    [onFocus],
  );

  const handleOnBlur = useCallback(
    (e: NativeSyntheticEvent<TextInputFocusEventData>) => {
      setIsFocus(false);
      onBlur?.(e);
    },
    [onBlur],
  );

  const handleClearValue = useCallback(() => {
    onChange?.('');
  }, [onChange]);

  return (
    <XStack
      width="100%"
      borderColor="$border"
      borderWidth="$px"
      borderRadius="$2"
      alignItems="center"
      paddingHorizontal="$1.5"
      outlineStyle={isFocus ? 'solid' : 'none'}
    >
      <AnimatePresence>
        <Stack
          animation="quick"
          hoverStyle={{
            scale: 0.9,
          }}
        >
          <Icon name="SearchOutline" size="$6" />
        </Stack>
      </AnimatePresence>
      <Input
        value={value}
        placeholder={placeholder}
        onFocus={handleOnFocus}
        onBlur={handleOnBlur}
        onSubmitEditing={onSubmitEditing}
        focusStyle={{ outlineStyle: 'none' }}
        onChangeText={onChange}
        h={height ?? '$7'}
        returnKeyType="search"
        // remove basic border width
        borderWidth={0}
        // remove border on right
        borderRightWidth={0}
      />
      <AnimatePresence>
        {value?.length ? (
          <Stack
            cursor="pointer"
            animation="quick"
            enterStyle={{
              scale: 0.9,
            }}
            pressStyle={{
              scale: 0.9,
            }}
            hoverStyle={{
              scale: 0.9,
            }}
            exitStyle={{
              scale: 0.9,
            }}
            onPress={handleClearValue}
          >
            <Icon name="XCircleOutline" size="$6" />
          </Stack>
        ) : null}
      </AnimatePresence>
    </XStack>
  );
}
