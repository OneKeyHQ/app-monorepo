import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Divider, XStack } from '@onekeyhq/components';
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

import { SizeInputModeSelector } from '../selectors/SizeInputModeSelector';

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
  leverage: number;
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
    leverage,
  }: ISizeInputProps) => {
    const intl = useIntl();
    const szDecimals = activeAsset?.universe?.szDecimals ?? 2;
    const isDisabled = disabled || !activeAssetCtx || !activeAsset;

    const [tradingPreferences, setTradingPreferences] =
      usePerpsTradingPreferencesAtom();
    const inputMode = tradingPreferences.sizeInputUnit ?? 'usd';
    const setInputMode = useCallback(
      (mode: 'token' | 'usd' | 'margin') => {
        setTradingPreferences((prev) => ({ ...prev, sizeInputUnit: mode }));
      },
      [setTradingPreferences],
    );

    const [tokenAmount, setTokenAmount] = useState('');
    const [usdAmount, setUsdAmount] = useState('');
    const [marginAmount, setMarginAmount] = useState('');
    const [isUserTyping, setIsUserTyping] = useState(false);

    const prevValueRef = useRef(value);
    const prevPriceRef = useRef(referencePrice);
    const prevLeverageRef = useRef(leverage);

    const isSliderMode = sizeInputMode === 'slider';

    const priceBN = useMemo(
      () => new BigNumber(referencePrice),
      [referencePrice],
    );
    const hasValidPrice = useMemo(
      () => priceBN.isFinite() && priceBN.gt(0),
      [priceBN],
    );
    const leverageBN = useMemo(() => new BigNumber(leverage || 1), [leverage]);

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

    const calcMarginFromToken = useCallback(
      (tokenValue: string) => {
        if (!hasValidPrice) return '';
        const tokenBN = new BigNumber(tokenValue);
        if (!tokenBN.isFinite()) return '';
        const marginValue = tokenBN.multipliedBy(priceBN).dividedBy(leverageBN);
        return formatWithPrecision(marginValue, 2, true);
      },
      [hasValidPrice, priceBN, leverageBN],
    );

    const calcTokenFromMargin = useCallback(
      (marginValue: string) => {
        if (!hasValidPrice) return '';
        const marginBN = new BigNumber(marginValue);
        if (!marginBN.isFinite()) return '';
        const tokenValue = marginBN.multipliedBy(leverageBN).dividedBy(priceBN);
        return formatWithPrecision(tokenValue, szDecimals, true);
      },
      [hasValidPrice, priceBN, leverageBN, szDecimals],
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
        setMarginAmount('');
        prevValueRef.current = '';
        setIsUserTyping(false);
      }
    }, [isSliderMode]);

    // Effect: Sync external value changes + Token→USD/Margin calculation
    useEffect(() => {
      const valueChanged = value !== prevValueRef.current;
      if (!valueChanged) return;

      setTokenAmount(value);
      prevValueRef.current = value;

      if (!value) {
        setUsdAmount('');
        setMarginAmount('');
        setIsUserTyping(false);
        return;
      }

      if (!isUserTyping) {
        if (inputMode === 'token') {
          const usdValue = calcUsdFromToken(value);
          if (usdValue) setUsdAmount(usdValue);
          const marginValue = calcMarginFromToken(value);
          if (marginValue) setMarginAmount(marginValue);
        } else if (inputMode === 'usd') {
          const marginValue = calcMarginFromToken(value);
          if (marginValue) setMarginAmount(marginValue);
        } else if (inputMode === 'margin') {
          const usdValue = calcUsdFromToken(value);
          if (usdValue) setUsdAmount(usdValue);
        }
      }
    }, [value, inputMode, isUserTyping, calcUsdFromToken, calcMarginFromToken]);

    // Effect: Leverage change handling
    useEffect(() => {
      const leverageChanged = prevLeverageRef.current !== leverage;
      if (!leverageChanged) return;
      prevLeverageRef.current = leverage;

      if (inputMode === 'margin' && marginAmount && !isSliderMode) {
        const newTokenValue = calcTokenFromMargin(marginAmount);
        if (newTokenValue && newTokenValue !== tokenAmount) {
          setTokenAmount(newTokenValue);
          onChange(newTokenValue);
          const usdValue = calcUsdFromToken(newTokenValue);
          if (usdValue) setUsdAmount(usdValue);
        }
        return;
      }

      if (tokenAmount) {
        const marginValue = calcMarginFromToken(tokenAmount);
        if (marginValue) setMarginAmount(marginValue);
      }
    }, [
      leverage,
      inputMode,
      marginAmount,
      isSliderMode,
      calcTokenFromMargin,
      calcMarginFromToken,
      tokenAmount,
      calcUsdFromToken,
      onChange,
    ]);

    // Effect: Price change handling + USD/Margin→Token recalculation
    useEffect(() => {
      if (isSliderMode) return;

      const priceChanged = prevPriceRef.current !== referencePrice;
      if (priceChanged) {
        prevPriceRef.current = referencePrice;

        if (inputMode === 'token' && tokenAmount) {
          const usdValue = calcUsdFromToken(tokenAmount);
          if (usdValue) setUsdAmount(usdValue);
          const marginValue = calcMarginFromToken(tokenAmount);
          if (marginValue) setMarginAmount(marginValue);
        } else if (inputMode === 'usd' && usdAmount) {
          const newTokenValue = calcTokenFromUsd(usdAmount);
          if (newTokenValue) {
            setTokenAmount(newTokenValue);
            onChange(newTokenValue);
            const marginValue = calcMarginFromToken(newTokenValue);
            if (marginValue) setMarginAmount(marginValue);
          }
        } else if (inputMode === 'margin' && marginAmount) {
          const newTokenValue = calcTokenFromMargin(marginAmount);
          if (newTokenValue) {
            setTokenAmount(newTokenValue);
            onChange(newTokenValue);
            const usdValue = calcUsdFromToken(newTokenValue);
            if (usdValue) setUsdAmount(usdValue);
          }
        }
        return;
      }

      if (!isUserTyping) {
        if (inputMode === 'usd' && usdAmount) {
          const newTokenValue = calcTokenFromUsd(usdAmount);
          if (newTokenValue && newTokenValue !== tokenAmount) {
            setTokenAmount(newTokenValue);
            onChange(newTokenValue);
          }
        } else if (inputMode === 'margin' && marginAmount) {
          const newTokenValue = calcTokenFromMargin(marginAmount);
          if (newTokenValue && newTokenValue !== tokenAmount) {
            setTokenAmount(newTokenValue);
            onChange(newTokenValue);
          }
        }
      }
    }, [
      isSliderMode,
      inputMode,
      referencePrice,
      tokenAmount,
      usdAmount,
      marginAmount,
      isUserTyping,
      calcUsdFromToken,
      calcTokenFromUsd,
      calcMarginFromToken,
      calcTokenFromMargin,
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
        } else if (inputMode === 'usd') {
          setUsdAmount(newValue);
          const tokenValue = calcTokenFromUsd(newValue);
          setTokenAmount(tokenValue);
          onChange(tokenValue);
        } else {
          setMarginAmount(newValue);
          const tokenValue = calcTokenFromMargin(newValue);
          setTokenAmount(tokenValue);
          onChange(tokenValue);
        }
      },
      [
        isSliderMode,
        inputMode,
        onChange,
        calcTokenFromUsd,
        calcTokenFromMargin,
        onRequestManualMode,
      ],
    );

    const handleModeChange = useCallback(
      (newMode: string) => {
        const mode = newMode as 'token' | 'usd' | 'margin';
        if (mode === inputMode) return;

        onRequestManualMode?.();
        setInputMode(mode);
        setIsUserTyping(false);

        if (mode === 'usd' && tokenAmount) {
          const usdValue = calcUsdFromToken(tokenAmount);
          if (usdValue) setUsdAmount(usdValue);
          const marginValue = calcMarginFromToken(tokenAmount);
          if (marginValue) setMarginAmount(marginValue);
        } else if (mode === 'token' && tokenAmount) {
          const marginValue = calcMarginFromToken(tokenAmount);
          if (marginValue) setMarginAmount(marginValue);
        } else if (mode === 'margin' && tokenAmount) {
          const marginValue = calcMarginFromToken(tokenAmount);
          if (marginValue) setMarginAmount(marginValue);
        }
      },
      [
        inputMode,
        tokenAmount,
        calcUsdFromToken,
        calcMarginFromToken,
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

        if ((inputMode === 'usd' || inputMode === 'margin') && text) {
          const [integerPart] = text.split('.');
          if (integerPart && integerPart.length > 12) return false;
        }

        return true;
      },
      [szDecimals, inputMode, isSliderMode],
    );

    const formatLabel = useMemo(() => {
      if (label) return label;
      if (inputMode === 'margin')
        return intl.formatMessage({
          id: ETranslations.perp_size_input_usd_order_cost,
        });
      return intl.formatMessage({
        id: ETranslations.perp_orderbook_size,
      });
    }, [label, intl, inputMode]);

    const customSuffix = useMemo(
      () => (
        <XStack alignItems="center" gap="$2">
          {isMobile ? <Divider vertical h={24} /> : null}
          <SizeInputModeSelector
            value={inputMode}
            onChange={handleModeChange}
            tokenSymbol={symbol || ''}
          />
        </XStack>
      ),
      [inputMode, handleModeChange, symbol, isMobile],
    );

    const displayValue = useMemo(() => {
      if (isSliderMode) return sliderDisplay;
      if (inputMode === 'margin') return marginAmount;
      return inputMode === 'token' ? tokenAmount : usdAmount;
    }, [
      isSliderMode,
      sliderDisplay,
      inputMode,
      tokenAmount,
      usdAmount,
      marginAmount,
    ]);

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
