import { useCallback, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';

import { Input, SizableText, XStack } from '@onekeyhq/components';

import { PerpsSlider } from '../../../Perp/components/PerpsSlider';

interface ISwapProLimitPriceSliderProps {
  percentValue: string;
  percentValueColor: string;
  onChangePercent: (value: number) => void;
}

const SwapProLimitPriceSlider = ({
  percentValue,
  onChangePercent,
  percentValueColor,
}: ISwapProLimitPriceSliderProps) => {
  // Track if user is currently editing the input
  const [isInputEditing, setIsInputEditing] = useState(false);
  const [inputText, setInputText] = useState('');
  const lastExternalPercentRef = useRef<string>('');

  // Parse the percent value from props (e.g., "5.00%" -> 5)
  const percentValueNumber = useMemo(() => {
    if (percentValue) {
      const percentV = percentValue.replace('%', '');
      const bn = new BigNumber(percentV);
      return bn.isNaN() ? 0 : bn.toNumber();
    }
    return 0;
  }, [percentValue]);

  // Use parsed percent value for slider (clamped to -100 to 100)
  const sliderValue = useMemo(() => {
    let value = percentValueNumber;
    if (value > 100) {
      value = 100;
    } else if (value < -100) {
      value = -100;
    }
    return value;
  }, [percentValueNumber]);

  // Display value for input: use inputText when editing, otherwise use parsed percent
  const displayValue = useMemo(() => {
    if (isInputEditing) {
      return inputText;
    }
    // When not editing, show the calculated percent value from limit price
    if (percentValue !== lastExternalPercentRef.current) {
      lastExternalPercentRef.current = percentValue;
    }
    // If value is 0, return empty string to show placeholder
    if (
      new BigNumber(percentValueNumber).isZero() ||
      new BigNumber(percentValueNumber).isNaN()
    ) {
      return '';
    }
    return new BigNumber(percentValueNumber).toFixed(2);
  }, [isInputEditing, inputText, percentValue, percentValueNumber]);

  // Handle slider change - directly update limit price via percent
  const handleSliderChange = useCallback(
    (value: number) => {
      let newValue = value;
      if (newValue > 100) {
        newValue = 100;
      } else if (newValue < -100) {
        newValue = -100;
      }
      onChangePercent(newValue);
    },
    [onChangePercent],
  );

  // Handle input text change
  const handleInputChange = useCallback((value: string) => {
    setInputText(value);
  }, []);

  // Handle input focus
  const handleInputFocus = useCallback(() => {
    setIsInputEditing(true);
    setInputText(displayValue);
  }, [displayValue]);

  // Handle input blur - apply the value
  const handleInputBlur = useCallback(() => {
    setIsInputEditing(false);
    const inputBN = new BigNumber(inputText);
    if (!inputBN.isNaN()) {
      let newValue = inputBN.toNumber();
      if (newValue > 100) {
        newValue = 100;
      } else if (newValue < -100) {
        newValue = -100;
      }
      onChangePercent(newValue);
    }
  }, [inputText, onChangePercent]);

  return (
    <XStack flex={1} gap="$2" alignItems="center">
      <XStack flex={0.6}>
        <PerpsSlider
          min={-100}
          max={100}
          value={sliderValue}
          showBubble={false}
          onChange={handleSliderChange}
          segments={4}
          sliderHeight={2}
          centerOrigin
        />
      </XStack>
      <Input
        containerProps={{
          flex: 0.4,
          borderWidth: 0,
          backgroundColor: '$bgStrong',
        }}
        value={displayValue}
        keyboardType="decimal-pad"
        textAlign="left"
        color={percentValueColor}
        placeholder="0.00"
        onChangeText={handleInputChange}
        onFocus={handleInputFocus}
        onBlur={handleInputBlur}
        addOns={[
          {
            renderContent: (
              <XStack alignItems="center" justifyContent="center" mr="$2">
                <SizableText
                  size="$bodyMd"
                  color="$textSubdued"
                  alignItems="center"
                >
                  %
                </SizableText>
              </XStack>
            ),
          },
        ]}
      />
    </XStack>
  );
};

export default SwapProLimitPriceSlider;
