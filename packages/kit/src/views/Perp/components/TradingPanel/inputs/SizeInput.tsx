import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import type { ISelectItem } from '@onekeyhq/components';
import { Icon, Select, SizableText, XStack } from '@onekeyhq/components';
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
  symbol: string;
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
    symbol,
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

    const selectItems = useMemo((): ISelectItem[] => {
      const tokenName = symbol || '';
      return [
        { label: tokenName, value: 'token' },
        { label: 'USD', value: 'usd' },
      ];
    }, [symbol]);

    const selectWidth = useMemo(() => {
      const tokenName = symbol || '';
      return tokenName.length > 5 ? 140 : 100;
    }, [symbol]);

    const handleModeChange = useCallback(
      (newMode: string) => {
        const mode = newMode as 'token' | 'usd';
        if (mode === inputMode) return;

        setInputMode(mode);
        setIsUserTyping(false);

        if (mode === 'usd' && hasValidPrice && tokenAmount) {
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
      [inputMode, hasValidPrice, tokenAmount, priceBN, setUsdAmount],
    );

    const customSuffix = useMemo(
      () => (
        <Select
          items={selectItems}
          value={inputMode}
          onChange={handleModeChange}
          title="Select Unit"
          floatingPanelProps={{
            width: selectWidth,
          }}
          renderTrigger={({ label: selectedLabel }) => (
            <XStack alignItems="center" gap="$1" cursor="pointer">
              <SizableText size="$bodyMdMedium" color="$textSubdued">
                {selectedLabel}
              </SizableText>
              <Icon
                name="ChevronDownSmallOutline"
                size="$4"
                color="$iconSubdued"
              />
            </XStack>
          )}
        />
      ),
      [selectItems, inputMode, handleModeChange, selectWidth],
    );

    const displayValue = inputMode === 'token' ? tokenAmount : usdAmount;

    return (
      <TradingFormInput
        value={displayValue}
        onChange={handleInputChange}
        label={formatLabel}
        disabled={isDisabled}
        error={error}
        validator={validator}
        customSuffix={customSuffix}
        isMobile={isMobile}
        placeholder={
          isMobile
            ? intl.formatMessage({
                id: ETranslations.perp_trade_amount_place_holder,
              })
            : '0.0'
        }
      />
    );
  },
);

SizeInput.displayName = 'SizeInput';
