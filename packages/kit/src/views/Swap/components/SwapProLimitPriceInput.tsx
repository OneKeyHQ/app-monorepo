import { useCallback, useEffect, useMemo, useRef } from 'react';

import { Input, SizableText, XStack, YStack } from '@onekeyhq/components';
import type { IInputRef } from '@onekeyhq/components';

import type { TextInput } from 'react-native';

interface ISwapProLimitPriceInputProps {
  value: string;
  currencySymbol: string;
  onChangeText: (text: string) => void;
  onBlur?: () => void;
}

const SwapProLimitPriceInput = ({
  value,
  currencySymbol,
  onChangeText,
  onBlur,
}: ISwapProLimitPriceInputProps) => {
  const inputRef = useRef<IInputRef & TextInput>(null);
  const isFocusedRef = useRef(false);

  // Reset scroll position to show text from the beginning when value changes and input is not focused
  useEffect(() => {
    if (!isFocusedRef.current) {
      inputRef.current?.setSelection?.(0, 0);
    }
  }, [value]);

  const handleFocus = useCallback(() => {
    isFocusedRef.current = true;
  }, []);

  const handleBlur = useCallback(() => {
    isFocusedRef.current = false;
    // Reset scroll position to show text from the beginning when unfocused
    inputRef.current?.setSelection?.(0, 0);
    // Trigger onBlur callback if provided
    onBlur?.();
  }, [onBlur]);

  const currencySymbolAddOn = useMemo(() => {
    return (
      <XStack alignItems="center" px="$1" mr="$2">
        <SizableText
          size="$bodySm"
          color="$textSubdued"
          maxWidth="$16"
          numberOfLines={1}
        >
          {currencySymbol}
        </SizableText>
      </XStack>
    );
  }, [currencySymbol]);

  return (
    <YStack borderRadius="$2" bg="$bgStrong" py="$2">
      <Input
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder="0.0"
        textAlign="left"
        keyboardType="decimal-pad"
        size="small"
        containerProps={{
          borderWidth: 0,
          flex: 1,
        }}
        addOns={[{ renderContent: currencySymbolAddOn }]}
      />
    </YStack>
  );
};

export default SwapProLimitPriceInput;
