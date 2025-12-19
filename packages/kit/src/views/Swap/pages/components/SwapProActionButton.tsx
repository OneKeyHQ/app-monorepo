import { useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Button } from '@onekeyhq/components';
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
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import { ESwapProTradeType } from '@onekeyhq/shared/types/swap/types';

import { ESwapDirection } from '../../../Market/MarketDetailV2/components/SwapPanel/hooks/useTradeType';
import {
  useSwapProAccount,
  useSwapProInputToken,
} from '../../hooks/useSwapPro';
import { useSwapQuoteLoading } from '../../hooks/useSwapState';

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
  const inputAmount = useMemo(() => {
    if (swapProTradeType === ESwapProTradeType.MARKET) {
      return swapProInputAmount;
    }
    return swapFromInputAmount.value;
  }, [swapProTradeType, swapProInputAmount, swapFromInputAmount.value]);

  const inputTokenValue = useMemo(() => {
    const inputPrice = new BigNumber(inputToken?.price || '0');
    if (swapProTradeType === ESwapProTradeType.MARKET) {
      const inputAmountBN = new BigNumber(inputAmount || '0');
      if (
        inputPrice.isNaN() ||
        inputAmountBN.isNaN() ||
        inputPrice.isZero() ||
        inputAmountBN.isZero()
      ) {
        return '';
      }
      return `(${numberFormat(
        inputPrice.multipliedBy(inputAmountBN).toFixed(),
        {
          formatter: 'value',
          formatterOptions: {
            currency: currencyInfo.symbol,
          },
        },
      )})`;
    }
    const inputAmountBN = new BigNumber(swapFromInputAmount.value || '0');
    if (
      inputPrice.isNaN() ||
      inputAmountBN.isNaN() ||
      inputPrice.isZero() ||
      inputAmountBN.isZero()
    ) {
      return '';
    }
    return `(${numberFormat(inputPrice.multipliedBy(inputAmountBN).toFixed(), {
      formatter: 'value',
      formatterOptions: {
        tokenSymbol: currencyInfo.symbol,
      },
    })})`;
  }, [
    inputToken?.price,
    swapProTradeType,
    swapFromInputAmount.value,
    inputAmount,
    currencyInfo.symbol,
  ]);
  const inputTokenAmountValue = useMemo(() => {
    if (swapProTradeType === ESwapProTradeType.MARKET) {
      const swapProInputAmountValue = new BigNumber(swapProInputAmount || '0');
      return `${
        swapProInputAmountValue.isZero() || swapProInputAmountValue.isNaN()
          ? ''
          : swapProInputAmountValue.toFixed()
      } ${inputToken?.symbol ?? '-'}`;
    }
    const swapFromInputAmountValue = new BigNumber(
      swapFromInputAmount.value || '0',
    );
    return `${
      swapFromInputAmountValue.isZero() || swapFromInputAmountValue.isNaN()
        ? ''
        : swapFromInputAmountValue.toFixed()
    } ${inputToken?.symbol ?? '-'}`;
  }, [
    swapProTradeType,
    swapFromInputAmount.value,
    swapProInputAmount,
    inputToken?.symbol,
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

    return `${intl.formatMessage({
      id:
        swapProDirection === ESwapDirection.BUY
          ? ETranslations.global_buy
          : ETranslations.global_sell,
    })} ${inputTokenAmountValue} ${inputTokenValue}`;
  }, [
    hasEnoughBalance,
    inputTokenAmountValue,
    inputTokenValue,
    intl,
    swapProAccount?.result?.addressDetail.address,
    swapProDirection,
  ]);

  return (
    <Button
      disabled={actionButtonDisabled}
      onPress={debouncedOnSwapProActionClick}
      variant="primary"
      size="small"
      backgroundColor={
        swapProDirection === ESwapDirection.BUY
          ? '$bgSuccessStrong'
          : '$bgCriticalStrong'
      }
    >
      {actionButtonText}
    </Button>
  );
};

export default SwapProActionButton;
