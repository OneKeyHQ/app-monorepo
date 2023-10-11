import { useCallback, useState } from 'react';

import { AnimatePresence } from 'tamagui';

import { Icon } from '../Icon';
import { Input } from '../Input';
import { Stack, XStack } from '../Stack';

interface SearchBarProps {
  value?: string;
  onBlur?: () => void;
  onChange?: (value: string) => void;
}

export function SearchBar({ value, onChange, onBlur }: SearchBarProps) {
  const [isFocus, setIsFocus] = useState(false);
  const handleOnFocus = useCallback(() => {
    setIsFocus(true);
  }, []);

  const handleOnBlur = useCallback(() => {
    setIsFocus(false);
    onBlur?.();
  }, [onBlur]);

  const handleClearValue = useCallback(() => {
    onChange?.('');
  }, [onChange]);

  return (
    <XStack
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
        onFocus={handleOnFocus}
        onBlur={handleOnBlur}
        focusStyle={{ outlineStyle: 'none' }}
        onChangeText={onChange}
        h="$7"
        returnKeyType="search"
        borderWidth={0}
        flex={1}
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
