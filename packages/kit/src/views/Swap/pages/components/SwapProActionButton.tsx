import { useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Button,
  NumberSizeableText,
  SizableText,
  YStack,
} from '@onekeyhq/components';
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
  useSwapQuoteFetchingAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapToTokenAmountAtom,
  useSwapTypeSwitchAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { isSwapQuoteInputAmountMatched } from '@onekeyhq/kit/src/states/jotai/contexts/swap/quoteProgress';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  checkWrappedTokenPair,
  equalTokenNoCaseSensitive,
} from '@onekeyhq/shared/src/utils/tokenUtils';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';
import {
  ESwapProTradeType,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';

import { ESwapDirection } from '../../../Market/MarketDetailV2/components/SwapPanel/hooks/useTradeType';
import { resolveStockBalanceSeed } from '../../hooks/swapStockChannelUtils';
import {
  useSwapProAccount,
  useSwapProInputToken,
  useSwapProToToken,
} from '../../hooks/useSwapPro';
import {
  useSwapQuoteProgressState,
  useSwapZeroProviderQuoteCompleted,
} from '../../hooks/useSwapState';
import { shouldOfferSwapDepositAction } from '../../utils/swapDepositActionUtils';
import { ESwapProAccountStatus } from '../../utils/swapProAccountUtils';

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

interface ISwapProActionButtonProps {
  onSwapProActionClick: () => void;
  onDepositToTrade: () => void;
  hasEnoughBalance: boolean;
  balanceLoading: boolean;
  supportSpeedSwap: boolean;
  isActionDisabled?: boolean;
}

const SwapProActionButton = ({
  onSwapProActionClick,
  onDepositToTrade,
  hasEnoughBalance,
  balanceLoading,
  supportSpeedSwap,
  isActionDisabled,
}: ISwapProActionButtonProps) => {
  const intl = useIntl();
  const [swapProTradeType] = useSwapProTradeTypeAtom();
  const [swapProDirection] = useSwapProDirectionAtom();
  const [swapProSelectToken] = useSwapProSelectTokenAtom();
  const [swapQuoteResult] = useSwapQuoteCurrentSelectAtom();
  const swapProAccount = useSwapProAccount();
  const { isWaitingActionableQuote, hasPreviousActionableQuote } =
    useSwapQuoteProgressState();
  const isZeroProviderQuoteCompleted = useSwapZeroProviderQuoteCompleted();
  const currencyInfo = useCurrency();
  const [quoteFetching] = useSwapQuoteFetchingAtom();
  const [swapProInputAmount] = useSwapProInputAmountAtom();
  const [limitPriceUseRate] = useSwapLimitPriceUseRateAtom();
  const [swapFromInputAmount] = useSwapFromTokenAmountAtom();
  const [toTokenAmount] = useSwapToTokenAmountAtom();
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
      return swapQuoteResult?.toAmount || '0';
    }
    if (swapProTradeType === ESwapProTradeType.LIMIT) {
      // Single source with the Est. Receive row (synced from the computed
      // limit to-amount atom), so the button can never disagree with it.
      if (toTokenAmount.value) {
        return toTokenAmount.value;
      }
      // Fallback while the sync hasn't landed yet.
      if (limitPriceUseRate?.rate) {
        const inputAmountBN = new BigNumber(swapFromInputAmount.value || '0');
        if (!inputAmountBN.isNaN() && !inputAmountBN.isZero()) {
          return inputAmountBN.multipliedBy(limitPriceUseRate.rate).toFixed();
        }
      }
    }
    return swapQuoteResult?.toAmount || '0';
  }, [
    swapProTradeType,
    swapQuoteResult?.toAmount,
    toTokenAmount.value,
    limitPriceUseRate?.rate,
    swapFromInputAmount.value,
  ]);

  // The parenthesized fiat value is always what the user PAYS (input amount ×
  // pay-token market price). A limit-derived receive quantity priced at the
  // market unit price would mix two price systems into a meaningless number.
  const inputTokenValue = useMemo(() => {
    const inputPrice = new BigNumber(inputToken?.price || '0');
    const inputAmountBN = new BigNumber(inputAmount || '0');
    if (
      inputPrice.isNaN() ||
      inputPrice.lte(0) ||
      inputAmountBN.isNaN() ||
      inputAmountBN.lte(0)
    ) {
      return '';
    }
    return inputPrice.multipliedBy(inputAmountBN).toFixed();
  }, [inputToken?.price, inputAmount]);

  const [, setSwapTypeSwitch] = useSwapTypeSwitchAtom();
  const { clearSwapTokenCarryIntent, selectToToken, selectFromToken } =
    useSwapActions().current;
  const [swapSelectToken, setSwapSelectFromToken] =
    useSwapSelectFromTokenAtom();
  const [swapSelectToToken, setSwapSelectToToken] = useSwapSelectToTokenAtom();
  const [, setSwapFromInputAmount] = useSwapFromTokenAmountAtom();
  const currentQuoteRes = useMemo(() => {
    return swapQuoteResult;
  }, [swapQuoteResult]);
  const isWrapped = useMemo(
    () =>
      checkWrappedTokenPair({
        fromToken: inputToken,
        toToken,
      }),
    [inputToken, toToken],
  );
  const canExecuteInPro = supportSpeedSwap || isWrapped;

  const handleJumpToSwapAction = useCallback(() => {
    clearSwapTokenCarryIntent();
    void setSwapTypeSwitch(ESwapTabSwitchType.SWAP);
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
    swapProDirection,
    swapProInputAmount,
    clearSwapTokenCarryIntent,
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
  const shouldShowNoProviderSupport = useMemo(
    () =>
      (swapProTradeType !== ESwapProTradeType.MARKET &&
        isZeroProviderQuoteCompleted) ||
      Boolean(
        currentQuoteRes && !currentQuoteRes.toAmount && !currentQuoteRes.limit,
      ),
    [currentQuoteRes, isZeroProviderQuoteCompleted, swapProTradeType],
  );
  const swapProAccountAddress = swapProAccount?.result?.addressDetail.address;
  // Same verdict as the Swap page (OK-63470): a loaded zero pay-token balance
  // turns the button into the deposit entry, whatever the amount or the
  // execution route. Missing account and unsupported pairs still win. Pro
  // stamps the balance with the account it was fetched for, so only a stamp
  // matching the current account counts (a fresh pick or another account's
  // figure stays unknown until the next sync lands).
  const shouldDepositToTrade = useMemo(
    () =>
      shouldOfferSwapDepositAction({
        balance: resolveStockBalanceSeed({
          hasActiveAccount: true,
          networkAccountAddress: swapProAccountAddress,
          token: inputToken as ISwapToken | undefined,
        }),
        hasFromToken: !!inputToken,
        hasToToken: !!toToken,
        hasFromAddress: !!swapProAccountAddress,
        noProviderSupportsTrade: shouldShowNoProviderSupport,
      }),
    [inputToken, shouldShowNoProviderSupport, swapProAccountAddress, toToken],
  );

  const onPressActionButton = useCallback(() => {
    if (shouldDepositToTrade) {
      onDepositToTrade();
      return;
    }
    if (!canExecuteInPro) {
      handleJumpToSwapAction();
    } else {
      onSwapProActionClick();
    }
  }, [
    shouldDepositToTrade,
    onDepositToTrade,
    canExecuteInPro,
    handleJumpToSwapAction,
    onSwapProActionClick,
  ]);

  const debouncedOnSwapProActionClick = useDebouncedCallback(
    onPressActionButton,
    500,
    { leading: true, trailing: false },
  );
  const currentQuoteLoading = useMemo(() => {
    if (swapProTradeType === ESwapProTradeType.MARKET) {
      return quoteFetching;
    }
    return isWaitingActionableQuote;
  }, [swapProTradeType, isWaitingActionableQuote, quoteFetching]);
  const actionButtonDisabled = useMemo(() => {
    if (shouldDepositToTrade) {
      return false;
    }
    let originalDisabled =
      !!isActionDisabled ||
      !hasEnoughBalance ||
      shouldShowNoProviderSupport ||
      !currentQuoteRes?.toAmount ||
      balanceLoading ||
      currentQuoteLoading;
    if (!canExecuteInPro) {
      originalDisabled = !!isActionDisabled || !hasEnoughBalance;
    }
    return originalDisabled;
  }, [
    shouldDepositToTrade,
    isActionDisabled,
    hasEnoughBalance,
    currentQuoteRes?.toAmount,
    shouldShowNoProviderSupport,
    balanceLoading,
    currentQuoteLoading,
    canExecuteInPro,
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

    if (shouldDepositToTrade) {
      return {
        plainText: intl.formatMessage({
          id: ETranslations.perp_trade_deposit_to_trade__action,
        }),
        subValue: '',
      };
    }

    if (!hasEnoughBalance) {
      return {
        plainText: intl.formatMessage({
          id: ETranslations.swap_page_button_insufficient_balance,
        }),
        subValue: '',
      };
    }

    // Only truly missing/unsupported accounts read as "Select wallet"; a
    // connected account still resolving (PENDING) is covered by the loading
    // spinner instead of flashing this label on every panel mount.
    if (
      !swapProAccount?.result?.addressDetail.address &&
      swapProAccount?.accountStatus !== ESwapProAccountStatus.PENDING
    ) {
      return {
        plainText: intl.formatMessage({
          id: ETranslations.global_select_wallet,
        }),
        subValue: '',
      };
    }

    if (isWrapped) {
      return {
        plainText: intl.formatMessage({
          id: ETranslations.swap_page_button_wrap,
        }),
        subValue: '',
      };
    }

    if (shouldShowNoProviderSupport) {
      return {
        plainText: intl.formatMessage({
          id: ETranslations.swap_page_alert_no_provider_supports_trade,
        }),
        subValue: '',
      };
    }
    // Format value with compact notation (k, M, B, T)
    const formattedValue = inputTokenValue
      ? formatCompactValue(inputTokenValue, currencySymbol)
      : '';

    let amountFromDirection = '';
    if (swapProDirection === ESwapDirection.BUY) {
      amountFromDirection = quoteToAmount || '';
    } else {
      amountFromDirection = inputAmount || '';
    }

    const amountBN = new BigNumber(amountFromDirection || '0');
    return {
      directionText,
      // Rendered via NumberSizeableText so tiny amounts keep the
      // leading-zero subscript (0.0₅157) and >= 1M amounts abbreviate to
      // K/M/B — matching the Est. Receive row and staying one line.
      amountValue:
        !amountBN.isNaN() && amountBN.gt(0) ? amountBN.toFixed() : '',
      tokenSymbol,
      subValue: formattedValue,
    };
  }, [
    intl,
    swapProDirection,
    inputToken?.symbol,
    currencyInfo?.symbol,
    shouldDepositToTrade,
    hasEnoughBalance,
    swapProAccount?.result?.addressDetail.address,
    swapProAccount?.accountStatus,
    isWrapped,
    shouldShowNoProviderSupport,
    inputTokenValue,
    toToken?.symbol,
    quoteToAmount,
    inputAmount,
  ]);

  const isBuy = swapProDirection === ESwapDirection.BUY;
  // Match the design-system accent (buy) / destructive (sell) buttons; the
  // deposit entry uses the neutral primary button like the Swap page. Accent
  // and primary labels use $textInverse, destructive uses $textOnColor;
  // childrenAsText is false, so the label color must be set explicitly.
  const tradeVariant = isBuy ? 'accent' : 'destructive';
  const buttonVariant = shouldDepositToTrade ? 'primary' : tradeVariant;
  const labelColor =
    buttonVariant === 'destructive' ? '$textOnColor' : '$textInverse';
  // The current quote must belong to the typed amount (kind-aware: BUY-kind
  // quotes match on toAmount). An unmatched or missing quote means the next
  // one is still on its way — the debounce window before it fires, the
  // one-frame gap after the old quote is cleaned, or the initial wait — so
  // show only the spinner (no stale label) instead of a broken-looking
  // locked button.
  const isQuoteAmountMatched = isSwapQuoteInputAmountMatched({
    quote: currentQuoteRes,
    fromAmount: inputAmount,
    toAmount: toTokenAmount.value,
  });
  // Zero/invalid amounts never produce a quote, and an ordinary pair without
  // speed-swap support is a jump-to-Swap CTA — neither may spin forever.
  // LIMIT interval refreshes keep the previous quote's label instead of
  // blanking to a spinner on every cycle (previous-quote state belongs to
  // the standard quote stream, so it only applies to LIMIT).
  const inputAmountBN = new BigNumber(inputAmount || '0');
  const hasPositiveInputAmount = !inputAmountBN.isNaN() && inputAmountBN.gt(0);
  const isQuoting =
    !shouldDepositToTrade &&
    canExecuteInPro &&
    hasPositiveInputAmount &&
    hasEnoughBalance &&
    !shouldShowNoProviderSupport &&
    (currentQuoteLoading || !isQuoteAmountMatched) &&
    !(
      swapProTradeType === ESwapProTradeType.LIMIT && hasPreviousActionableQuote
    );
  // A connected account still resolving shows the spinner too, so panel
  // mounts don't flash "Select wallet" before the account lands.
  const isAccountPending =
    swapProAccount?.accountStatus === ESwapProAccountStatus.PENDING;
  const showButtonLoading = isQuoting || isAccountPending;

  return (
    <Button
      testID="swap-sub-value-btn"
      disabled={actionButtonDisabled}
      loading={showButtonLoading}
      onPress={debouncedOnSwapProActionClick}
      variant={buttonVariant}
      size="small"
      childrenAsText={false}
      height={50}
      py={5}
    >
      {showButtonLoading ? null : (
        <YStack alignItems="center">
          <SizableText
            size="$bodyMdMedium"
            color={labelColor}
            textAlign="center"
          >
            {actionButtonText.plainText || (
              <>
                {`${actionButtonText.directionText ?? ''} `}
                {actionButtonText.amountValue ? (
                  <>
                    <NumberSizeableText
                      size="$bodyMdMedium"
                      color={labelColor}
                      autoFormatter="balance-marketCap"
                      subTextStyle={{ color: labelColor }}
                    >
                      {actionButtonText.amountValue}
                    </NumberSizeableText>{' '}
                  </>
                ) : null}
                {actionButtonText.tokenSymbol}
              </>
            )}
          </SizableText>
          {actionButtonText.subValue ? (
            <SizableText
              size="$bodyMdMedium"
              color={labelColor}
              textAlign="center"
            >
              {actionButtonText.subValue}
            </SizableText>
          ) : null}
        </YStack>
      )}
    </Button>
  );
};

export default SwapProActionButton;
