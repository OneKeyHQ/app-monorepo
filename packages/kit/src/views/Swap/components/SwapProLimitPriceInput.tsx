import { useCallback, useEffect, useMemo, useRef } from 'react';

import { useIntl } from 'react-intl';
import { InputAccessoryView, type TextInput } from 'react-native';

import { Input, SizableText, YStack } from '@onekeyhq/components';
import type { IInputRef } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
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
  const intl = useIntl();
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

  // Mirror the amount box's centered two-line layout: a small "Price ($)"
  // label on top, the centered input below.
  return (
    <YStack
      borderRadius="$2"
      bg="$bgStrong"
      alignItems="center"
      pt="$1.5"
      pb="$0.5"
    >
      <SizableText
        size="$bodySm"
        color="$textDisabled"
        textAlign="center"
        numberOfLines={1}
        maxWidth="$40"
      >
        {`${intl.formatMessage({
          id: ETranslations.global_price,
        })} (${currencySymbol})`}
      </SizableText>
      <Input
        testID="swap-currency-symbol-add-on-input"
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder="0.0"
        textAlign="center"
        keyboardType="decimal-pad"
        size="small"
        inputAccessoryViewID={
          platformEnv.isNativeIOS
            ? SwapLimitPriceInputAccessoryViewID
            : undefined
        }
        containerProps={{
          width: '100%',
          borderWidth: 0,
          bg: '$transparent',
        }}
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
