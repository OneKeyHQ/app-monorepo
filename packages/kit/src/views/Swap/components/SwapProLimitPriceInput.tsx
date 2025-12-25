import { useCallback, useEffect, useMemo, useRef } from 'react';

import { InputAccessoryView, type TextInput } from 'react-native';

import { Input, SizableText, XStack, YStack } from '@onekeyhq/components';
import type { IInputRef } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  SwapLimitPriceInputAccessoryViewID,
  SwapLimitPriceInputStageBuyForNative,
  SwapLimitPriceInputStageSellForNative,
} from '@onekeyhq/shared/types/swap/types';

import { useSwapProDirectionAtom } from '../../../states/jotai/contexts/swap';
import { ESwapDirection } from '../../Market/MarketDetailV2/components/SwapPanel/hooks/useTradeType';
import { PercentageStageOnKeyboard } from '../pages/components/SwapInputContainer';

interface ISwapProLimitPriceInputProps {
  value: string;
  currencySymbol: string;
  onChangeText: (text: string) => void;
  onBlur?: () => void;
  onSelectPercentageStage: (stage: number) => void;
}

const SwapProLimitPriceInput = ({
  value,
  currencySymbol,
  onChangeText,
  onBlur,
  onSelectPercentageStage,
}: ISwapProLimitPriceInputProps) => {
  const inputRef = useRef<IInputRef & TextInput>(null);
  const isFocusedRef = useRef(false);
  const [swapProDirection] = useSwapProDirectionAtom();
  const stageList = useMemo(() => {
    if (swapProDirection === ESwapDirection.BUY) {
      return SwapLimitPriceInputStageBuyForNative;
    }
    return SwapLimitPriceInputStageSellForNative;
  }, [swapProDirection]);
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
        inputAccessoryViewID={
          platformEnv.isNativeIOS
            ? SwapLimitPriceInputAccessoryViewID
            : undefined
        }
        containerProps={{
          borderWidth: 0,
          flex: 1,
        }}
        addOns={[{ renderContent: currencySymbolAddOn }]}
      />
      {platformEnv.isNativeIOS ? (
        <InputAccessoryView nativeID={SwapLimitPriceInputAccessoryViewID}>
          <PercentageStageOnKeyboard
            onSelectPercentageStage={onSelectPercentageStage}
            stageList={stageList}
          />
        </InputAccessoryView>
      ) : null}
    </YStack>
  );
};

export default SwapProLimitPriceInput;
