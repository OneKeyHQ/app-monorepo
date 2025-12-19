import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Button } from '@onekeyhq/components';
import { useDebouncedCallback } from '@onekeyhq/kit/src/hooks/useDebounce';
import {
  useSwapProDirectionAtom,
  useSwapProSelectTokenAtom,
  useSwapProTradeTypeAtom,
  useSwapQuoteCurrentSelectAtom,
  useSwapSpeedQuoteFetchingAtom,
  useSwapSpeedQuoteResultAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ESwapProTradeType } from '@onekeyhq/shared/types/swap/types';

import { ESwapDirection } from '../../../Market/MarketDetailV2/components/SwapPanel/hooks/useTradeType';
import { useSwapProAccount } from '../../hooks/useSwapPro';
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
  const [swapProSelectToken] = useSwapProSelectTokenAtom();
  const quoteLoading = useSwapQuoteLoading();
  const [quoteFetching] = useSwapSpeedQuoteFetchingAtom();

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
    })} ${swapProSelectToken?.symbol ?? ''}`;
  }, [
    hasEnoughBalance,
    intl,
    swapProAccount?.result?.addressDetail.address,
    swapProDirection,
    swapProSelectToken?.symbol,
  ]);

  return (
    <Button
      disabled={actionButtonDisabled}
      onPress={debouncedOnSwapProActionClick}
      variant="primary"
      size="small"
      color="$textOnColor"
      py={5}
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
