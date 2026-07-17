import { useCallback, useEffect, useMemo, useRef } from 'react';

import { useIntl } from 'react-intl';
import { InputAccessoryView } from 'react-native';

import { Input, SizableText, Skeleton, YStack } from '@onekeyhq/components';
import type { IInputRef } from '@onekeyhq/components';
import {
  useSwapFromTokenAmountAtom,
  useSwapProInputAmountAtom,
  useSwapProTradeTypeAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { validateAmountInput } from '@onekeyhq/kit/src/utils/validateAmountInput';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  ESwapProTradeType,
  SwapAmountInputAccessoryViewID,
} from '@onekeyhq/shared/types/swap/types';

import {
  useSwapLimitPriceCheck,
  useSwapProInputToken,
  useSwapProToToken,
} from '../../hooks/useSwapPro';
import { useSwapProAmountSlider } from '../../hooks/useSwapProAmountSlider';
import { SwapTestIDs } from '../../testIDs';

import { PercentageStageOnKeyboard } from './SwapInputContainer';
import SwapProAmountSlider from './SwapProAmountSlider';

import type { TextInput } from 'react-native';

interface ISwapProInputContainerProps {
  isLoading?: boolean;
  onSelectPercentageStage: (stage: number) => void;
}

const SwapProInputContainer = ({
  isLoading,
  onSelectPercentageStage,
}: ISwapProInputContainerProps) => {
  const intl = useIntl();
  const [swapProTradeType] = useSwapProTradeTypeAtom();
  const [fromInputAmount, setFromInputAmount] = useSwapFromTokenAmountAtom();
  const [swapProInputAmount, setSwapProInputAmount] =
    useSwapProInputAmountAtom();
  const inputRef = useRef<IInputRef & TextInput>(null);
  const inputToken = useSwapProInputToken();
  const toToken = useSwapProToToken();
  const handleInputChange = useCallback(
    (text: string) => {
      if (validateAmountInput(text, inputToken?.decimals)) {
        if (swapProTradeType === ESwapProTradeType.MARKET) {
          setSwapProInputAmount(text);
        } else {
          setFromInputAmount({
            value: text,
            isInput: true,
          });
        }
      }
    },
    [
      inputToken?.decimals,
      setFromInputAmount,
      setSwapProInputAmount,
      swapProTradeType,
    ],
  );

  const isFocusedRef = useRef(false);
  const inputValue = useMemo(() => {
    return swapProTradeType === ESwapProTradeType.MARKET
      ? swapProInputAmount
      : fromInputAmount.value;
  }, [swapProTradeType, swapProInputAmount, fromInputAmount.value]);

  const { sliderValue, sliderDisabled, onSliderChange, onSlideComplete } =
    useSwapProAmountSlider({
      inputAmount: inputValue,
      onAmountChange: handleInputChange,
    });

  // Reset scroll position to show text from the beginning when value changes and input is not focused
  useEffect(() => {
    if (!isFocusedRef.current) {
      inputRef.current?.setSelection?.(0, 0);
    }
  }, [inputValue]);

  const onInputBlur = useCallback(() => {
    isFocusedRef.current = false;
    inputRef.current?.setSelection?.(0, 0);
  }, []);

  const onInputFocus = useCallback(() => {
    isFocusedRef.current = true;
  }, []);

  useSwapLimitPriceCheck(inputToken, toToken);

  return (
    <YStack gap="$1" mb="$2">
      <YStack
        borderRadius="$2"
        bg="$bgStrong"
        alignItems="center"
        pt="$1.5"
        pb="$0.5"
      >
        {isLoading ? (
          <Skeleton width="$10" height="$4" borderRadius="$full" />
        ) : (
          <SizableText
            size="$bodySm"
            color="$textDisabled"
            textAlign="center"
            numberOfLines={1}
            maxWidth="$40"
          >
            {inputToken?.symbol ?? '-'}
          </SizableText>
        )}
        <Input
          ref={inputRef}
          testID={SwapTestIDs.fromAmountInput}
          size="small"
          textAlign="center"
          containerProps={{
            width: '100%',
            borderWidth: 0,
            bg: '$transparent',
          }}
          keyboardType="decimal-pad"
          value={inputValue}
          onBlur={onInputBlur}
          onFocus={onInputFocus}
          onChangeText={handleInputChange}
          inputAccessoryViewID={
            platformEnv.isNativeIOS ? SwapAmountInputAccessoryViewID : undefined
          }
          placeholder={intl.formatMessage({
            id: ETranslations.content__amount,
          })}
        />
      </YStack>
      <SwapProAmountSlider
        value={sliderValue}
        disabled={sliderDisabled}
        onChange={onSliderChange}
        onSlideComplete={onSlideComplete}
      />
      {platformEnv.isNativeIOS ? (
        <InputAccessoryView nativeID={SwapAmountInputAccessoryViewID}>
          <PercentageStageOnKeyboard
            onSelectPercentageStage={onSelectPercentageStage}
          />
        </InputAccessoryView>
      ) : null}
    </YStack>
  );
};

export default SwapProInputContainer;
