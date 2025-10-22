import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import type { ISelectItem } from '@onekeyhq/components';
import {
  Divider,
  Icon,
  Select,
  SizableText,
  XStack,
} from '@onekeyhq/components';
import type {
  IPerpsActiveAssetAtom,
  IPerpsActiveAssetCtxAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { usePerpsTradingPreferencesAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  formatWithPrecision,
  validateSizeInput,
} from '@onekeyhq/shared/src/utils/perpsUtils';
import type { EPerpsSizeInputMode } from '@onekeyhq/shared/types/hyperliquid';

import { TradingFormInput } from './TradingFormInput';

import type { ISide } from '../selectors/TradeSideToggle';

interface ISizeInputProps {
  value: string;
  side: ISide;
  symbol: string;
  onChange: (value: string) => void;
  activeAsset: IPerpsActiveAssetAtom;
  activeAssetCtx: IPerpsActiveAssetCtxAtom;
  referencePrice: string;
  sizeInputMode: EPerpsSizeInputMode;
  sliderPercent: number;
  onRequestManualMode?: () => void;
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
    activeAsset,
    activeAssetCtx,
    referencePrice,
    sizeInputMode,
    sliderPercent,
    onRequestManualMode,
    error,
    disabled = false,
    side: _side,
    label,
    isMobile = false,
  }: ISizeInputProps) => {
    const intl = useIntl();
    const szDecimals = activeAsset?.universe?.szDecimals ?? 2;
    const isDisabled = disabled || !activeAssetCtx || !activeAsset;

    const [tradingPreferences, setTradingPreferences] =
      usePerpsTradingPreferencesAtom();
    const inputMode = tradingPreferences.sizeInputUnit;
    const setInputMode = useCallback(
      (mode: 'token' | 'usd') => {
        setTradingPreferences((prev) => ({ ...prev, sizeInputUnit: mode }));
      },
      [setTradingPreferences],
    );

    const [tokenAmount, setTokenAmount] = useState('');
    const [usdAmount, setUsdAmount] = useState('');
    const [isUserTyping, setIsUserTyping] = useState(false);

    const prevValueRef = useRef(value);
    const prevPriceRef = useRef(referencePrice);

    const isSliderMode = sizeInputMode === 'slider';

    const priceBN = useMemo(
      () => new BigNumber(referencePrice),
      [referencePrice],
    );
    const hasValidPrice = useMemo(
      () => priceBN.isFinite() && priceBN.gt(0),
      [priceBN],
    );

    // Helper: Calculate USD from Token
    const calcUsdFromToken = useCallback(
      (tokenValue: string) => {
        if (!hasValidPrice) return '';
        const tokenBN = new BigNumber(tokenValue);
        if (!tokenBN.isFinite()) return '';
        return formatWithPrecision(tokenBN.multipliedBy(priceBN), 2, true);
      },
      [hasValidPrice, priceBN],
    );

    // Helper: Calculate Token from USD
    const calcTokenFromUsd = useCallback(
      (usdValue: string) => {
        if (!hasValidPrice) return '';
        const usdBN = new BigNumber(usdValue);
        if (!usdBN.isFinite()) return '';
        return formatWithPrecision(usdBN.dividedBy(priceBN), szDecimals, true);
      },
      [hasValidPrice, priceBN, szDecimals],
    );

    const sliderDisplay = useMemo(() => {
      if (!isSliderMode) return '';
      if (!Number.isFinite(sliderPercent)) return '0%';
      return `${new BigNumber(sliderPercent || 0).toFixed()}%`;
    }, [isSliderMode, sliderPercent]);

    // Effect: Slider mode reset
    useEffect(() => {
      if (isSliderMode) {
        setTokenAmount('');
        setUsdAmount('');
        prevValueRef.current = '';
        setIsUserTyping(false);
      }
    }, [isSliderMode]);

    // Effect: Sync external value changes + Token→USD calculation
    useEffect(() => {
      const valueChanged = value !== prevValueRef.current;
      if (!valueChanged) return;

      setTokenAmount(value);
      prevValueRef.current = value;

      if (!value) {
        setUsdAmount('');
        setIsUserTyping(false);
        return;
      }

      // Only update USD in token mode when not actively typing
      if (inputMode === 'token' && !isUserTyping) {
        const usdValue = calcUsdFromToken(value);
        if (usdValue) setUsdAmount(usdValue);
      }
    }, [value, inputMode, isUserTyping, calcUsdFromToken]);

    // Effect: Price change handling + USD→Token recalculation
    useEffect(() => {
      if (isSliderMode) return;

      const priceChanged = prevPriceRef.current !== referencePrice;
      if (priceChanged) {
        prevPriceRef.current = referencePrice;

        if (inputMode === 'token' && tokenAmount) {
          const usdValue = calcUsdFromToken(tokenAmount);
          if (usdValue) setUsdAmount(usdValue);
        } else if (inputMode === 'usd' && usdAmount) {
          const newTokenValue = calcTokenFromUsd(usdAmount);
          if (newTokenValue) {
            setTokenAmount(newTokenValue);
            onChange(newTokenValue);
          }
        }
        return;
      }

      if (inputMode === 'usd' && usdAmount && !isUserTyping) {
        const newTokenValue = calcTokenFromUsd(usdAmount);
        if (newTokenValue && newTokenValue !== tokenAmount) {
          setTokenAmount(newTokenValue);
          onChange(newTokenValue);
        }
      }
    }, [
      isSliderMode,
      inputMode,
      referencePrice,
      tokenAmount,
      usdAmount,
      isUserTyping,
      calcUsdFromToken,
      calcTokenFromUsd,
      onChange,
    ]);

    // Effect: User typing debounce
    useEffect(() => {
      if (!isUserTyping) return;
      const timer = setTimeout(() => setIsUserTyping(false), 500);
      return () => clearTimeout(timer);
    }, [isUserTyping]);

    const handleInputChange = useCallback(
      (newValue: string) => {
        if (isSliderMode) {
          setTokenAmount('');
          onChange('');
          return;
        }

        setIsUserTyping(true);
        onRequestManualMode?.();

        if (inputMode === 'token') {
          setTokenAmount(newValue);
          onChange(newValue);
        } else {
          setUsdAmount(newValue);
          const tokenValue = calcTokenFromUsd(newValue);
          setTokenAmount(tokenValue);
          onChange(tokenValue);
        }
      },
      [
        isSliderMode,
        inputMode,
        onChange,
        calcTokenFromUsd,
        onRequestManualMode,
      ],
    );

    const handleModeChange = useCallback(
      (newMode: string) => {
        const mode = newMode as 'token' | 'usd';
        if (mode === inputMode) return;

        onRequestManualMode?.();
        setInputMode(mode);
        setIsUserTyping(false);

        // Switching to USD mode: calculate USD from current token
        if (mode === 'usd' && tokenAmount) {
          const usdValue = calcUsdFromToken(tokenAmount);
          if (usdValue) setUsdAmount(usdValue);
        }
      },
      [
        inputMode,
        tokenAmount,
        calcUsdFromToken,
        onRequestManualMode,
        setInputMode,
      ],
    );

    const validator = useCallback(
      (text: string) => {
        if (isSliderMode) return true;
        if (!validateSizeInput(text, inputMode === 'token' ? szDecimals : 2)) {
          return false;
        }

        // USD mode: limit integer part to 12 digits
        if (inputMode === 'usd' && text) {
          const [integerPart] = text.split('.');
          if (integerPart && integerPart.length > 12) return false;
        }

        return true;
      },
      [szDecimals, inputMode, isSliderMode],
    );

    const formatLabel = useMemo(() => {
      if (label) return label;
      return intl.formatMessage({
        id: ETranslations.dexmarket_details_history_amount,
      });
    }, [label, intl]);

    const selectItems = useMemo(
      (): ISelectItem[] => [
        { label: symbol || '', value: 'token' },
        { label: 'USD', value: 'usd' },
      ],
      [symbol],
    );

    const selectWidth = useMemo(() => {
      const tokenName = symbol || '';
      return tokenName.length > 5 ? 140 : 100;
    }, [symbol]);

    const customSuffix = useMemo(
      () => (
        <Select
          items={selectItems}
          value={inputMode}
          onChange={handleModeChange}
          title={intl.formatMessage({
            id: ETranslations.perp_unit_preferrence,
          })}
          floatingPanelProps={{
            width: selectWidth,
          }}
          renderTrigger={({ label: selectedLabel }) => (
            <XStack alignItems="center" gap="$2" cursor="pointer">
              {isMobile ? <Divider vertical h={24} /> : null}
              <SizableText size="$bodyMdMedium" color="$textSubdued">
                {selectedLabel}
              </SizableText>
              <Icon
                ml="$-2"
                name="ChevronTriangleDownSmallOutline"
                size="$4"
                color="$iconSubdued"
              />
            </XStack>
          )}
        />
      ),
      [selectItems, inputMode, handleModeChange, selectWidth, intl, isMobile],
    );

    const displayValue = useMemo(() => {
      if (isSliderMode) return sliderDisplay;
      return inputMode === 'token' ? tokenAmount : usdAmount;
    }, [isSliderMode, sliderDisplay, inputMode, tokenAmount, usdAmount]);

    return (
      <TradingFormInput
        value={displayValue}
        onChange={handleInputChange}
        label={formatLabel}
        disabled={isDisabled}
        error={error}
        validator={validator}
        customSuffix={customSuffix}
        onFocus={onRequestManualMode}
        isMobile={isMobile}
        keyboardType="decimal-pad"
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
