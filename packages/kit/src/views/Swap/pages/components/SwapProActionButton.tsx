import { useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Button, SizableText } from '@onekeyhq/components';
import { useCurrency } from '@onekeyhq/kit/src/components/Currency';
import { useDebouncedCallback } from '@onekeyhq/kit/src/hooks/useDebounce';
import {
  useSwapFromTokenAmountAtom,
  useSwapProDirectionAtom,
  useSwapProInputAmountAtom,
  useSwapProTradeTypeAtom,
  useSwapQuoteCurrentSelectAtom,
  useSwapSpeedQuoteFetchingAtom,
  useSwapSpeedQuoteResultAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ESwapProTradeType } from '@onekeyhq/shared/types/swap/types';

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
    return '0';
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
}

const SwapProActionButton = ({
  onSwapProActionClick,
  hasEnoughBalance,
  balanceLoading,
}: ISwapProActionButtonProps) => {
  const intl = useIntl();
  const [swapProTradeType] = useSwapProTradeTypeAtom();
  const [swapProDirection] = useSwapProDirectionAtom();
  const [swapQuoteResult] = useSwapQuoteCurrentSelectAtom();
  const [swapProQuoteResult] = useSwapSpeedQuoteResultAtom();
  const swapProAccount = useSwapProAccount();
  const quoteLoading = useSwapQuoteLoading();
  const currencyInfo = useCurrency();
  const [quoteFetching] = useSwapSpeedQuoteFetchingAtom();
  const [swapProInputAmount] = useSwapProInputAmountAtom();
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
    return swapQuoteResult?.toAmount || '0';
  }, [
    swapProTradeType,
    swapQuoteResult?.toAmount,
    swapProQuoteResult?.toAmount,
  ]);

  const inputTokenValue = useMemo(() => {
    const inputPrice = new BigNumber(inputToken?.price || '0');
    const toPrice = new BigNumber(toToken?.price || '0');
    if (swapProDirection === ESwapDirection.BUY) {
      if (toPrice.isZero() || toPrice.isNaN()) {
        return '';
      }
      const quoteToAmountBN = new BigNumber(quoteToAmount || '0');
      if (quoteToAmountBN.isNaN() || quoteToAmountBN.isZero()) {
        return '';
      }
      return quoteToAmountBN.dividedBy(toPrice).toFixed();
    }
    if (inputPrice.isNaN() || inputPrice.isZero()) {
      return '';
    }
    if (swapProTradeType === ESwapProTradeType.MARKET) {
      const inputProAmountBN = new BigNumber(inputAmount || '0');
      if (inputProAmountBN.isNaN() || inputProAmountBN.isZero()) {
        return '';
      }
      return inputPrice.multipliedBy(inputProAmountBN).toFixed();
    }
    const inputFromAmountBN = new BigNumber(swapFromInputAmount.value || '0');
    if (inputFromAmountBN.isNaN() || inputFromAmountBN.isZero()) {
      return '';
    }
    return inputPrice.multipliedBy(inputFromAmountBN).toFixed();
  }, [
    inputToken?.price,
    toToken?.price,
    swapProDirection,
    swapProTradeType,
    swapFromInputAmount.value,
    quoteToAmount,
    inputAmount,
  ]);
  const debouncedOnSwapProActionClick = useDebouncedCallback(
    onSwapProActionClick,
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
    return (
      !hasEnoughBalance ||
      !currentQuoteRes?.toAmount ||
      balanceLoading ||
      currentQuoteLoading
    );
  }, [hasEnoughBalance, currentQuoteRes, balanceLoading, currentQuoteLoading]);

  const actionButtonText = useMemo(() => {
    if (!hasEnoughBalance) {
      return intl.formatMessage({
        id: ETranslations.swap_page_button_insufficient_balance,
      });
    }

    if (!swapProAccount?.result?.addressDetail.address) {
      return intl.formatMessage({
        id: ETranslations.global_select_wallet,
      });
    }

    // Format: "Buy {amount} {fromToken} ({Value})"
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

    // Build final text
    if (formattedValue) {
      return `${directionText} ${formattedAmount} ${tokenSymbol} ${formattedValue}`;
    }
    return `${directionText} ${formattedAmount} ${tokenSymbol}`;
  }, [
    hasEnoughBalance,
    swapProAccount?.result?.addressDetail.address,
    intl,
    swapProDirection,
    inputToken?.symbol,
    currencyInfo?.symbol,
    inputTokenValue,
    toToken?.symbol,
    inputAmount,
    quoteToAmount,
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
      <SizableText size="$bodyMdMedium" color="$textInverse" textAlign="center">
        {actionButtonText}
      </SizableText>
    </Button>
  );
};

export default SwapProActionButton;
