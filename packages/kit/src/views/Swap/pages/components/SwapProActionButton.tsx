import { useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Button, SizableText, YStack } from '@onekeyhq/components';
import { useCurrency } from '@onekeyhq/kit/src/components/Currency';
import { useDebouncedCallback } from '@onekeyhq/kit/src/hooks/useDebounce';
import {
  useSwapActions,
  useSwapFromTokenAmountAtom,
  useSwapLimitPriceUseRateAtom,
  useSwapProDirectionAtom,
  useSwapProInputAmountAtom,
  useSwapProSelectTokenAtom,
  useSwapProTradeTypeAtom,
  useSwapQuoteCurrentSelectAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapSpeedQuoteFetchingAtom,
  useSwapSpeedQuoteResultAtom,
  useSwapTypeSwitchAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import {
  ESwapProTradeType,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';

import { ESwapDirection } from '../../../Market/MarketDetailV2/components/SwapPanel/hooks/useTradeType';
import {
  useSwapProAccount,
  useSwapProInputToken,
  useSwapProToToken,
} from '../../hooks/useSwapPro';
import { useSwapQuoteLoading } from '../../hooks/useSwapState';

const MAX_BUTTON_CHARS = 25;

/**
 * Format value with compact notation (k, M, B, T)
 */
const formatCompactValue = (value: string, currencySymbol: string): string => {
  const valueBN = new BigNumber(value);
  if (valueBN.isNaN() || valueBN.isZero()) {
    return '';
  }

  let formatted: string;
  if (valueBN.gte(1e12)) {
    formatted = `${valueBN.dividedBy(1e12).toFixed(1)}T`;
  } else if (valueBN.gte(1e9)) {
    formatted = `${valueBN.dividedBy(1e9).toFixed(1)}B`;
  } else if (valueBN.gte(1e6)) {
    formatted = `${valueBN.dividedBy(1e6).toFixed(1)}M`;
  } else if (valueBN.gte(1e3)) {
    formatted = `${valueBN.dividedBy(1e3).toFixed(1)}k`;
  } else if (valueBN.gte(1)) {
    formatted = valueBN.toFixed(2);
  } else {
    // For very small values, use 2 significant figures
    formatted = valueBN.toPrecision(2);
  }

  return `(${currencySymbol}${formatted})`;
};

/**
 * Format amount within character limit
 * Rules:
 * 1. Display as much as possible within the character limit
 * 2. Use rounding for truncation
 * 3. Special cases (may exceed limit, accept line break):
 *    - At least 1 significant digit must be shown (e.g., 0.00000001)
 *    - At least 4 decimal places if the number has decimals
 */
const formatAmountWithLimit = (amount: string, maxChars: number): string => {
  if (!amount) return '';

  const amountBN = new BigNumber(amount);
  if (amountBN.isNaN() || amountBN.isZero()) {
    return '';
  }

  // Get full precision string
  const fullPrecision = amountBN.toFixed();

  // If full precision fits, return it
  if (fullPrecision.length <= maxChars) {
    return fullPrecision;
  }

  // Check if original number has decimals
  const hasDecimal = !amountBN.isInteger();

  // Calculate minimum required decimals
  let minDecimals = 0;

  if (amountBN.lt(1) && amountBN.gt(0)) {
    // For numbers < 1, find first significant digit position
    const decimalPart = fullPrecision.split('.')[1] || '';
    let significantDecimalPos = decimalPart.length;

    for (let i = 0; i < decimalPart.length; i += 1) {
      if (decimalPart[i] !== '0') {
        significantDecimalPos = i + 1;
        break;
      }
    }

    // At least show first significant digit, and at least 4 decimals
    minDecimals = Math.max(4, significantDecimalPos);
  } else if (hasDecimal) {
    // For numbers >= 1 with decimals, at least 4 decimals
    minDecimals = 4;
  }

  // Calculate available decimals based on character limit
  const integerPartStr = amountBN.integerValue(BigNumber.ROUND_DOWN).toFixed();
  // Available for decimals = maxChars - integerPart.length - 1 (for the dot)
  const maxAvailableDecimals = maxChars - integerPartStr.length - 1;

  // Determine final decimals to use
  // If maxAvailable >= min, use maxAvailable to show as much as possible
  // If maxAvailable < min, use min (accept line break)
  const finalDecimals =
    maxAvailableDecimals >= minDecimals ? maxAvailableDecimals : minDecimals;

  if (finalDecimals > 0 && hasDecimal) {
    return amountBN.toFixed(finalDecimals, BigNumber.ROUND_HALF_UP);
  }

  // No decimals
  return integerPartStr;
};

interface ISwapProActionButtonProps {
  onSwapProActionClick: () => void;
  hasEnoughBalance: boolean;
  balanceLoading: boolean;
  supportSpeedSwap: boolean;
  onlySupportCrossChain: boolean;
}

const SwapProActionButton = ({
  onSwapProActionClick,
  hasEnoughBalance,
  balanceLoading,
  supportSpeedSwap,
  onlySupportCrossChain,
}: ISwapProActionButtonProps) => {
  const intl = useIntl();
  const [swapProTradeType] = useSwapProTradeTypeAtom();
  const [swapProDirection] = useSwapProDirectionAtom();
  const [swapProSelectToken] = useSwapProSelectTokenAtom();
  const [swapQuoteResult] = useSwapQuoteCurrentSelectAtom();
  const [swapProQuoteResult] = useSwapSpeedQuoteResultAtom();
  const swapProAccount = useSwapProAccount();
  const quoteLoading = useSwapQuoteLoading();
  const currencyInfo = useCurrency();
  const [quoteFetching] = useSwapSpeedQuoteFetchingAtom();
  const [swapProInputAmount] = useSwapProInputAmountAtom();
  const [limitPriceUseRate] = useSwapLimitPriceUseRateAtom();
  const [swapFromInputAmount] = useSwapFromTokenAmountAtom();
  const inputToken = useSwapProInputToken();
  const toToken = useSwapProToToken();
  const inputAmount = useMemo(() => {
    if (swapProTradeType === ESwapProTradeType.MARKET) {
      return swapProInputAmount;
    }
    return swapFromInputAmount.value;
  }, [swapProTradeType, swapProInputAmount, swapFromInputAmount.value]);
  const quoteToAmount = useMemo(() => {
    if (swapProTradeType === ESwapProTradeType.MARKET) {
      return swapProQuoteResult?.toAmount || '0';
    }
    // For limit order, calculate toAmount based on limitPriceUseRate
    if (
      swapProTradeType === ESwapProTradeType.LIMIT &&
      limitPriceUseRate?.rate
    ) {
      const inputAmountBN = new BigNumber(swapFromInputAmount.value || '0');
      if (!inputAmountBN.isNaN() && !inputAmountBN.isZero()) {
        return inputAmountBN.multipliedBy(limitPriceUseRate.rate).toFixed();
      }
    }
    return swapQuoteResult?.toAmount || '0';
  }, [
    swapProTradeType,
    swapQuoteResult?.toAmount,
    swapProQuoteResult?.toAmount,
    limitPriceUseRate?.rate,
    swapFromInputAmount.value,
  ]);

  const inputTokenValue = useMemo(() => {
    const inputPrice = new BigNumber(inputToken?.price || '0');
    const toPrice = new BigNumber(toToken?.price || '0');
    if (swapProDirection === ESwapDirection.BUY) {
      if (toPrice.isZero() || toPrice.isNaN()) {
        return '';
      }
      // For limit order, calculate toAmount based on limitPriceUseRate
      if (
        swapProTradeType === ESwapProTradeType.LIMIT &&
        limitPriceUseRate?.rate
      ) {
        const inputFromAmountBN = new BigNumber(
          swapFromInputAmount.value || '0',
        );
        if (inputFromAmountBN.isNaN() || inputFromAmountBN.isZero()) {
          return '';
        }
        const limitToAmount = inputFromAmountBN.multipliedBy(
          limitPriceUseRate.rate,
        );
        return limitToAmount.multipliedBy(toPrice).toFixed();
      }
      const quoteToAmountBN = new BigNumber(quoteToAmount || '0');
      if (quoteToAmountBN.isNaN() || quoteToAmountBN.isZero()) {
        return '';
      }
      return quoteToAmountBN.multipliedBy(toPrice).toFixed();
    }
    // For limit order SELL direction - use limitPriceUseRate to calculate value
    if (
      swapProTradeType === ESwapProTradeType.LIMIT &&
      limitPriceUseRate?.rate
    ) {
      if (toPrice.isZero() || toPrice.isNaN()) {
        return '';
      }
      const inputFromAmountBN = new BigNumber(swapFromInputAmount.value || '0');
      if (inputFromAmountBN.isNaN() || inputFromAmountBN.isZero()) {
        return '';
      }
      const limitToAmount = inputFromAmountBN.multipliedBy(
        limitPriceUseRate.rate,
      );
      return limitToAmount.multipliedBy(toPrice).toFixed();
    }
    // For market order SELL direction
    if (inputPrice.isNaN() || inputPrice.isZero()) {
      return '';
    }
    const inputProAmountBN = new BigNumber(inputAmount || '0');
    if (inputProAmountBN.isNaN() || inputProAmountBN.isZero()) {
      return '';
    }
    return inputPrice.multipliedBy(inputProAmountBN).toFixed();
  }, [
    inputToken?.price,
    toToken?.price,
    swapProDirection,
    swapProTradeType,
    swapFromInputAmount.value,
    quoteToAmount,
    inputAmount,
    limitPriceUseRate?.rate,
  ]);

  const [, setSwapTypeSwitch] = useSwapTypeSwitchAtom();
  const { selectToToken, selectFromToken } = useSwapActions().current;
  const [swapSelectToken, setSwapSelectFromToken] =
    useSwapSelectFromTokenAtom();
  const [swapSelectToToken, setSwapSelectToToken] = useSwapSelectToTokenAtom();
  const [, setSwapFromInputAmount] = useSwapFromTokenAmountAtom();

  const handleJumpToSwapAction = useCallback(() => {
    if (onlySupportCrossChain) {
      void setSwapTypeSwitch(ESwapTabSwitchType.BRIDGE);
    } else {
      void setSwapTypeSwitch(ESwapTabSwitchType.SWAP);
    }
    if (swapProDirection === ESwapDirection.BUY) {
      if (
        equalTokenNoCaseSensitive({
          token1: swapSelectToken,
          token2: swapProSelectToken,
        }) &&
        swapProSelectToken
      ) {
        void setSwapSelectFromToken(undefined);
      }
      if (inputToken) {
        void setSwapSelectFromToken(inputToken);
      }
      if (swapProSelectToken) {
        void selectToToken(swapProSelectToken);
      }
    } else {
      if (
        equalTokenNoCaseSensitive({
          token1: swapSelectToToken,
          token2: swapProSelectToken,
        }) &&
        swapProSelectToken
      ) {
        void setSwapSelectToToken(undefined);
      }
      if (toToken) {
        void setSwapSelectToToken(toToken);
      }
      if (swapProSelectToken) {
        void selectFromToken(swapProSelectToken);
      }
    }
    if (swapProInputAmount) {
      void setSwapFromInputAmount({
        value: swapProInputAmount,
        isInput: true,
      });
    }
  }, [
    onlySupportCrossChain,
    swapProDirection,
    swapProInputAmount,
    setSwapTypeSwitch,
    swapSelectToken,
    swapProSelectToken,
    inputToken,
    setSwapSelectFromToken,
    selectToToken,
    swapSelectToToken,
    toToken,
    setSwapSelectToToken,
    selectFromToken,
    setSwapFromInputAmount,
  ]);
  const onPressActionButton = useCallback(() => {
    if (!supportSpeedSwap) {
      handleJumpToSwapAction();
    } else {
      onSwapProActionClick();
    }
  }, [supportSpeedSwap, handleJumpToSwapAction, onSwapProActionClick]);

  const debouncedOnSwapProActionClick = useDebouncedCallback(
    onPressActionButton,
    500,
    { leading: true, trailing: false },
  );
  const currentQuoteRes = useMemo(() => {
    if (swapProTradeType === ESwapProTradeType.MARKET) {
      return swapProQuoteResult;
    }
    return swapQuoteResult;
  }, [swapProTradeType, swapProQuoteResult, swapQuoteResult]);
  const currentQuoteLoading = useMemo(() => {
    if (swapProTradeType === ESwapProTradeType.MARKET) {
      return quoteFetching;
    }
    return quoteLoading;
  }, [swapProTradeType, quoteLoading, quoteFetching]);
  const actionButtonDisabled = useMemo(() => {
    let originalDisabled =
      !hasEnoughBalance ||
      !currentQuoteRes?.toAmount ||
      balanceLoading ||
      currentQuoteLoading;
    if (!supportSpeedSwap) {
      originalDisabled = !hasEnoughBalance;
    }
    return originalDisabled;
  }, [
    hasEnoughBalance,
    currentQuoteRes,
    balanceLoading,
    currentQuoteLoading,
    supportSpeedSwap,
  ]);

  const actionButtonText = useMemo(() => {
    const directionText = intl.formatMessage({
      id:
        swapProDirection === ESwapDirection.BUY
          ? ETranslations.global_buy
          : ETranslations.global_sell,
    });

    let tokenSymbol = inputToken?.symbol ?? '-';
    const currencySymbol = currencyInfo?.symbol ?? '$';
    if (swapProDirection === ESwapDirection.BUY) {
      tokenSymbol = toToken?.symbol ?? '-';
    }

    if (!hasEnoughBalance) {
      return {
        resValue: intl.formatMessage({
          id: ETranslations.swap_page_button_insufficient_balance,
        }),
        subValue: '',
      };
    }

    if (!swapProAccount?.result?.addressDetail.address) {
      return {
        resValue: intl.formatMessage({
          id: ETranslations.global_select_wallet,
        }),
        subValue: '',
      };
    }

    if (
      currentQuoteRes &&
      !currentQuoteRes.toAmount &&
      !currentQuoteRes.limit
    ) {
      return {
        resValue: intl.formatMessage({
          id: ETranslations.swap_page_alert_no_provider_supports_trade,
        }),
        subValue: '',
      };
    }
    // Format value with compact notation (k, M, B, T)
    const formattedValue = inputTokenValue
      ? formatCompactValue(inputTokenValue, currencySymbol)
      : '';

    // Calculate fixed parts length
    // Format: "{direction} {amount} {symbol} {value}"
    // Fixed length = direction + space + symbol + (space + value if exists)
    const fixedLength =
      directionText.length +
      1 +
      tokenSymbol.length +
      (formattedValue ? 1 + formattedValue.length : 0);

    // Available characters for amount (subtract 1 for space before symbol)
    const availableForAmount = MAX_BUTTON_CHARS - fixedLength - 1;

    // Format amount within limit
    let amountFromDirection = '';
    if (swapProDirection === ESwapDirection.BUY) {
      amountFromDirection = quoteToAmount || '';
    } else {
      amountFromDirection = inputAmount || '';
    }

    const formattedAmount = formatAmountWithLimit(
      amountFromDirection,
      availableForAmount,
    );
    const resValue = `${directionText} ${formattedAmount} ${tokenSymbol}`;
    const subValue = formattedValue;
    // Build final text
    return {
      resValue,
      subValue,
    };
  }, [
    intl,
    swapProDirection,
    inputToken?.symbol,
    currencyInfo?.symbol,
    hasEnoughBalance,
    swapProAccount?.result?.addressDetail.address,
    currentQuoteRes,
    inputTokenValue,
    toToken?.symbol,
    quoteToAmount,
    inputAmount,
  ]);

  return (
    <Button
      disabled={actionButtonDisabled}
      onPress={debouncedOnSwapProActionClick}
      variant="primary"
      size="small"
      childrenAsText={false}
      color="$textOnColor"
      py={5}
      backgroundColor={
        swapProDirection === ESwapDirection.BUY
          ? '$bgSuccessStrong'
          : '$bgCriticalStrong'
      }
    >
      <YStack alignItems="center">
        <SizableText
          size="$bodyMdMedium"
          color="$textOnColor"
          textAlign="center"
        >
          {actionButtonText.resValue}
        </SizableText>
        {actionButtonText.subValue ? (
          <SizableText
            size="$bodyMdMedium"
            color="$textOnColor"
            textAlign="center"
          >
            {actionButtonText.subValue}
          </SizableText>
        ) : null}
      </YStack>
    </Button>
  );
};

export default SwapProActionButton;
