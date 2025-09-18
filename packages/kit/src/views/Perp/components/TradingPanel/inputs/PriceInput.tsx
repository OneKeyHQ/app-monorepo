import { memo, useCallback } from 'react';

import { useIntl } from 'react-intl';

import { ETranslations } from '@onekeyhq/shared/src/locale';
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
  ifOnDialog?: boolean;
}

export const PriceInput = memo(
  ({
    value,
    onChange,
    error,
    disabled = false,
    onUseMarketPrice,
    szDecimals,
    label,
    ifOnDialog = false,
  }: IPriceInputProps) => {
    const intl = useIntl();
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
            labelColor: '$green11',
            onPress: onUseMarketPrice,
            disabled: false,
          },
        ]
      : undefined;

    return (
      <TradingFormInput
        value={value}
        onChange={handleInputChange}
        label={
          label ??
          intl.formatMessage({
            id: ETranslations.perp_trade_limit_pirce,
          })
        }
        disabled={disabled}
        error={error}
        validator={validator}
        actions={actions}
        ifOnDialog={ifOnDialog}
      />
    );
  },
);

PriceInput.displayName = 'PriceInput';
