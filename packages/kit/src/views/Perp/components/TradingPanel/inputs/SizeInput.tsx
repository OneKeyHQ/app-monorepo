import { memo, useCallback, useMemo } from 'react';

import { validateSizeInput } from '@onekeyhq/shared/src/utils/perpsUtils';

import { TradingFormInput } from './TradingFormInput';

import type { ICurrentTokenData } from '../../../hooks/usePerpMarketData';
import type { ISide } from '../selectors/TradeSideToggle';

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
    const szDecimals = tokenInfo?.szDecimals ?? 2;
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
