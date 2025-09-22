import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  formatWithPrecision,
  validateSizeInput,
} from '@onekeyhq/shared/src/utils/perpsUtils';

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
  isMobile?: boolean;
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
    isMobile = false,
  }: ISizeInputProps) => {
    const intl = useIntl();
    const szDecimals = tokenInfo?.szDecimals ?? 2;
    const isDisabled = disabled || !tokenInfo;

    const [inputMode, setInputMode] = useState<'token' | 'usd'>('token');
    const [tokenAmount, setTokenAmount] = useState('');
    const [usdAmount, setUsdAmount] = useState('');
    const [isUserTyping, setIsUserTyping] = useState(false);

    const prevValueRef = useRef(value);

    const currentPrice = tokenInfo?.markPx || '0';

    const priceBN = useMemo(() => new BigNumber(currentPrice), [currentPrice]);
    const hasValidPrice = useMemo(
      () => priceBN.isFinite() && priceBN.gt(0),
      [priceBN],
    );

    useEffect(() => {
      if (value !== prevValueRef.current) {
        setTokenAmount(value);
        prevValueRef.current = value;
      }
    }, [value]);

    useEffect(() => {
      if (inputMode === 'token' && hasValidPrice && tokenAmount) {
        const tokenBN = new BigNumber(tokenAmount);
        if (tokenBN.isFinite()) {
          const usdValue = formatWithPrecision(
            tokenBN.multipliedBy(priceBN),
            2,
            true,
          );
          setUsdAmount(usdValue);
        }
      }
    }, [inputMode, tokenAmount, hasValidPrice, priceBN]);

    useEffect(() => {
      if (inputMode === 'usd' && hasValidPrice && usdAmount && !isUserTyping) {
        const usdBN = new BigNumber(usdAmount);
        if (usdBN.isFinite()) {
          const newTokenValue = formatWithPrecision(
            usdBN.dividedBy(priceBN),
            szDecimals,
            true,
          );
          setTokenAmount((prevTokenAmount) => {
            if (newTokenValue !== prevTokenAmount) {
              onChange(newTokenValue);
              return newTokenValue;
            }
            return prevTokenAmount;
          });
        }
      }
    }, [
      inputMode,
      usdAmount,
      hasValidPrice,
      szDecimals,
      onChange,
      isUserTyping,
      priceBN,
    ]);

    const validator = useCallback(
      (text: string) => {
        if (!validateSizeInput(text, inputMode === 'token' ? szDecimals : 2)) {
          return false;
        }

        if (inputMode === 'usd' && text) {
          const [integerPart] = text.split('.');
          if (integerPart && integerPart.length > 12) {
            return false;
          }
        }

        return true;
      },
      [szDecimals, inputMode],
    );

    const formatLabel = useMemo(() => {
      if (label) return label;
      return side === 'long'
        ? intl.formatMessage({
            id: ETranslations.perp_trade_buy_amount,
          })
        : intl.formatMessage({
            id: ETranslations.perp_trade_sell_amount,
          });
    }, [side, label, intl]);

    useEffect(() => {
      if (isUserTyping) {
        const timer = setTimeout(() => {
          setIsUserTyping(false);
        }, 500);
        return () => clearTimeout(timer);
      }
    }, [isUserTyping]);

    const handleInputChange = useCallback(
      (newValue: string) => {
        setIsUserTyping(true);

        if (inputMode === 'token') {
          setTokenAmount(newValue);
          onChange(newValue);
        } else {
          setUsdAmount(newValue);

          if (hasValidPrice && newValue) {
            const usdBN = new BigNumber(newValue);
            if (usdBN.isFinite()) {
              const tokenValue = formatWithPrecision(
                usdBN.dividedBy(priceBN),
                szDecimals,
                true,
              );
              setTokenAmount(tokenValue);
              onChange(tokenValue);
            }
          } else {
            setTokenAmount('');
            onChange('');
          }
        }
      },
      [inputMode, hasValidPrice, szDecimals, onChange, priceBN],
    );

    const actions = useMemo(() => {
      const unitDisplay = inputMode === 'token' ? tokenInfo?.name || '' : 'USD';

      return [
        {
          labelColor: '$textSubdued',
          label: unitDisplay,
          onPress: () => {
            const newMode = inputMode === 'token' ? 'usd' : 'token';
            setInputMode(newMode);
            setIsUserTyping(false);

            if (newMode === 'usd' && hasValidPrice && tokenAmount) {
              const tokenBN = new BigNumber(tokenAmount);
              if (tokenBN.isFinite()) {
                const usdValue = formatWithPrecision(
                  tokenBN.multipliedBy(priceBN),
                  2,
                  true,
                );
                setUsdAmount(usdValue);
              }
            }
          },
          disabled: !hasValidPrice,
        },
      ];
    }, [inputMode, tokenInfo?.name, hasValidPrice, tokenAmount, priceBN]);

    const displayValue = inputMode === 'token' ? tokenAmount : usdAmount;

    return (
      <TradingFormInput
        value={displayValue}
        onChange={handleInputChange}
        label={formatLabel}
        disabled={isDisabled}
        error={error}
        validator={validator}
        actions={actions}
        isMobile={isMobile}
        placeholder={
          isMobile
            ? intl.formatMessage({ id: ETranslations.send_amount })
            : '0.0'
        }
      />
    );
  },
);

SizeInput.displayName = 'SizeInput';
