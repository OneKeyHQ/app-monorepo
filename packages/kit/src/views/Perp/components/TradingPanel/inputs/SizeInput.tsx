import { memo, useCallback, useMemo } from 'react';

import { validateSizeInput } from '../../../utils/tokenUtils';

import { TradingFormInput } from './TradingFormInput';

import type { ISide } from '../selectors/TradeSideToggle';
import type { ICurrentTokenData } from '../../../hooks/usePerpMarketData';

interface ISizeInputProps {
  value: string;
  side: ISide;
  onChange: (value: string) => void;
  tokenInfo?: ICurrentTokenData | null;
  error?: string;
  disabled?: boolean;
  label?: string;
}

export const SizeInput = memo(
  ({
    value,
    onChange,
    tokenInfo,
    error,
    disabled = false,
    side,
    label,
  }: ISizeInputProps) => {
    const szDecimals = tokenInfo?.szDecimals || 4;
    const isDisabled = disabled || !tokenInfo;
    const maxSzs = tokenInfo?.maxTradeSzs || [0, 0];
    const maxSize = maxSzs[side === 'long' ? 0 : 1];

    const validator = useCallback(
      (text: string) => validateSizeInput(text, szDecimals),
      [szDecimals],
    );

    const formatLabel = useMemo(() => {
      if (label) return label;
      return side === 'long' ? 'Buy amount' : 'Sell amount';
    }, [side, label]);

    const helper = useMemo(() => {
      if (Number(maxSize) <= 0) return undefined;

      return {
        text: `Max: ${Number(maxSize).toLocaleString('en-US', {
          minimumFractionDigits: 0,
          maximumFractionDigits: szDecimals,
        })}`,
        align: 'right' as const,
      };
    }, [maxSize, szDecimals]);

    return (
      <TradingFormInput
        value={value}
        onChange={onChange}
        label={formatLabel}
        disabled={isDisabled}
        error={error}
        validator={validator}
        suffix={tokenInfo?.name || ''}
      />
    );
  },
);

SizeInput.displayName = 'SizeInput';
