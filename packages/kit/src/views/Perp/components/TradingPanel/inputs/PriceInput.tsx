import { memo, useCallback } from 'react';

import { validatePriceInput } from '@onekeyhq/shared/src/utils/perpsUtils';

import { TradingFormInput } from './TradingFormInput';

interface IPriceInputProps {
  value: string;
  onChange: (value: string) => void;
  marketPrice?: string;
  error?: string;
  disabled?: boolean;
  onUseMarketPrice?: () => void;
  szDecimals?: number;
  label?: string;
}

export const PriceInput = memo(
  ({
    value,
    onChange,
    error,
    disabled = false,
    onUseMarketPrice,
    szDecimals,
    label = 'Limit Price',
  }: IPriceInputProps) => {
    const handleInputChange = useCallback(
      (text: string) => {
        const processedText = text.replace(/。/g, '.');
        onChange(processedText);
      },
      [onChange],
    );

    const validator = useCallback(
      (text: string) => {
        const processedText = text.replace(/。/g, '.');
        return validatePriceInput(processedText, szDecimals);
      },
      [szDecimals],
    );

    const actions = onUseMarketPrice
      ? [
          {
            label: 'Mid',
            onPress: onUseMarketPrice,
            disabled: false,
          },
        ]
      : undefined;

    return (
      <TradingFormInput
        value={value}
        onChange={handleInputChange}
        label={label}
        disabled={disabled}
        error={error}
        validator={validator}
        actions={actions}
      />
    );
  },
);

PriceInput.displayName = 'PriceInput';
