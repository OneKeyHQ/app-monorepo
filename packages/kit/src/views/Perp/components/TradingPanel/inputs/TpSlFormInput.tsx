import { memo, useCallback, useMemo, useState } from 'react';

import { BigNumber } from 'bignumber.js';
import { useIntl } from 'react-intl';

import type { ISelectItem } from '@onekeyhq/components';
import {
  Icon,
  Select,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { validateSizeInput } from '@onekeyhq/shared/src/utils/perpsUtils';

import { TradingFormInput } from './TradingFormInput';

interface ITpSlFormInputProps {
  type: 'tp' | 'sl';
  label: string;
  value: string;
  inputType: 'price' | 'percentage';
  referencePrice: string;
  szDecimals?: number;
  onChange: (value: string) => void;
  onTypeChange: (type: 'price' | 'percentage') => void;
  disabled?: boolean;
  error?: string;
  isMobile?: boolean;
}

export const TpSlFormInput = memo(
  ({
    type: _type,
    label,
    value,
    inputType,
    referencePrice,
    szDecimals = 2,
    onChange,
    onTypeChange,
    disabled = false,
    error,
    isMobile = false,
  }: ITpSlFormInputProps) => {
    const intl = useIntl();
    const [internalValue, setInternalValue] = useState(value);

    const priceBN = useMemo(
      () => new BigNumber(referencePrice),
      [referencePrice],
    );
    const hasValidPrice = useMemo(
      () => priceBN.isFinite() && priceBN.gt(0),
      [priceBN],
    );

    const validator = useCallback(
      (text: string) => {
        const decimals = inputType === 'percentage' ? 2 : szDecimals;
        return validateSizeInput(text, decimals);
      },
      [inputType, szDecimals],
    );

    const handleChange = useCallback(
      (text: string) => {
        setInternalValue(text);
        onChange(text);
      },
      [onChange],
    );

    const selectItems = useMemo(
      (): ISelectItem[] => [
        {
          label: 'Price',
          value: 'price',
        },
        {
          label: '%',
          value: 'percentage',
        },
      ],
      [],
    );

    const handleModeChange = useCallback(
      (newMode: string) => {
        const mode = newMode as 'price' | 'percentage';
        if (mode === inputType || !hasValidPrice) return;

        onTypeChange(mode);

        // Clear value when switching modes
        setInternalValue('');
        onChange('');
      },
      [inputType, hasValidPrice, onTypeChange, onChange],
    );

    const customSuffix = useMemo(
      () => (
        <Select
          items={selectItems}
          value={inputType}
          onChange={handleModeChange}
          title={intl.formatMessage({
            id: ETranslations.perp_unit_preferrence,
          })}
          floatingPanelProps={{
            width: 120,
          }}
          renderTrigger={({ label: triggerLabel }) => (
            <XStack alignItems="center" gap="$1" cursor="pointer">
              <SizableText
                size={isMobile ? '$bodySm' : '$bodyMdMedium'}
                color={disabled ? '$textDisabled' : '$textSubdued'}
                cursor={disabled ? 'not-allowed' : 'pointer'}
                userSelect="none"
              >
                {triggerLabel}
              </SizableText>
              <Icon
                name="ChevronDownSmallOutline"
                size={isMobile ? '$3.5' : '$4'}
                color={disabled ? '$iconDisabled' : '$iconSubdued'}
              />
            </XStack>
          )}
        />
      ),
      [selectItems, inputType, handleModeChange, intl, disabled, isMobile],
    );

    if (isMobile) {
      return (
        <YStack gap="$1">
          <SizableText size="$bodySm" color="$textSubdued">
            {label}
          </SizableText>
          <TradingFormInput
            label={label}
            value={internalValue}
            onChange={handleChange}
            validator={validator}
            error={error}
            disabled={disabled}
            customSuffix={customSuffix}
            keyboardType="decimal-pad"
            isMobile={isMobile}
          />
        </YStack>
      );
    }

    return (
      <TradingFormInput
        label={label}
        value={internalValue}
        onChange={handleChange}
        validator={validator}
        error={error}
        disabled={disabled}
        customSuffix={customSuffix}
        keyboardType="decimal-pad"
        isMobile={isMobile}
      />
    );
  },
);

TpSlFormInput.displayName = 'TpSlFormInput';
