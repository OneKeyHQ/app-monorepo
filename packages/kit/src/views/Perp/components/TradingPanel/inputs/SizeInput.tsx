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
    side,
    label,
    isMobile = false,
  }: ISizeInputProps) => {
    const intl = useIntl();
    const szDecimals = activeAsset?.universe?.szDecimals ?? 2;
    const isDisabled = disabled || !activeAssetCtx || !activeAsset;

    const [inputMode, setInputMode] = useState<'token' | 'usd'>('usd');
    const [tokenAmount, setTokenAmount] = useState('');
    const [usdAmount, setUsdAmount] = useState('');
    const [isUserTyping, setIsUserTyping] = useState(false);

    const prevValueRef = useRef(value);

    const isSliderMode = sizeInputMode === 'slider';

    const sliderDisplay = useMemo(() => {
      if (!isSliderMode) return '';
      if (!Number.isFinite(sliderPercent)) return '0%';
      return `${new BigNumber(sliderPercent || 0).toFixed()}%`;
    }, [isSliderMode, sliderPercent]);

    const priceBN = useMemo(
      () => new BigNumber(referencePrice),
      [referencePrice],
    );
    const hasValidPrice = useMemo(
      () => priceBN.isFinite() && priceBN.gt(0),
      [priceBN],
    );

    useEffect(() => {
      if (isSliderMode) {
        setTokenAmount('');
        setUsdAmount('');
        prevValueRef.current = '';
        setIsUserTyping(false);
      }
    }, [isSliderMode]);

    useEffect(() => {
      if (value !== prevValueRef.current) {
        setTokenAmount(value);
        prevValueRef.current = value;

        if (!value) {
          setUsdAmount('');
          setIsUserTyping(false);
        } else if (hasValidPrice && !isUserTyping) {
          const valueBN = new BigNumber(value);
          if (valueBN.isFinite()) {
            const usdValue = formatWithPrecision(
              valueBN.multipliedBy(priceBN),
              2,
              true,
            );
            setUsdAmount(usdValue);
          }
        }
      }
    }, [value, hasValidPrice, priceBN, isUserTyping]);

    useEffect(() => {
      if (isSliderMode) return;
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
    }, [inputMode, tokenAmount, hasValidPrice, priceBN, isSliderMode]);

    useEffect(() => {
      if (isSliderMode) return;
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
      isSliderMode,
    ]);

    const validator = useCallback(
      (text: string) => {
        if (isSliderMode) return true;
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
      [szDecimals, inputMode, isSliderMode],
    );

    const formatLabel = useMemo(() => {
      if (label) return label;
      return intl.formatMessage({
        id: ETranslations.dexmarket_details_history_amount,
      });
    }, [label, intl]);

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
      [
        isSliderMode,
        onRequestManualMode,
        inputMode,
        onChange,
        hasValidPrice,
        priceBN,
        szDecimals,
      ],
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

        onRequestManualMode?.();
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
      [
        inputMode,
        hasValidPrice,
        tokenAmount,
        priceBN,
        setUsdAmount,
        onRequestManualMode,
      ],
    );

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
      if (isSliderMode) {
        return sliderDisplay;
      }
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
