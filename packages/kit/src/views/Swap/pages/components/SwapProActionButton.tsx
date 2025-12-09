import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Button, SizableText } from '@onekeyhq/components';
import {
  useSwapProDirectionAtom,
  useSwapProSelectTokenAtom,
  useSwapProTradeTypeAtom,
  useSwapQuoteCurrentSelectAtom,
  useSwapSpeedQuoteResultAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ESwapProTradeType } from '@onekeyhq/shared/types/swap/types';

import { ESwapDirection } from '../../../Market/MarketDetailV2/components/SwapPanel/hooks/useTradeType';
import { useSwapProAccount } from '../../hooks/useSwapPro';

interface ISwapProActionButtonProps {
  onSwapProActionClick: () => void;
  hasEnoughBalance: boolean;
}

const SwapProActionButton = ({
  onSwapProActionClick,
  hasEnoughBalance,
}: ISwapProActionButtonProps) => {
  const intl = useIntl();
  const [swapProTradeType] = useSwapProTradeTypeAtom();
  const [swapProDirection] = useSwapProDirectionAtom();
  const [swapQuoteResult] = useSwapQuoteCurrentSelectAtom();
  const [swapProQuoteResult] = useSwapSpeedQuoteResultAtom();
  const swapProAccount = useSwapProAccount();
  const [swapProSelectToken] = useSwapProSelectTokenAtom();
  const currentQuoteRes = useMemo(() => {
    if (swapProTradeType === ESwapProTradeType.MARKET) {
      return swapProQuoteResult;
    }
    return swapQuoteResult;
  }, [swapProTradeType, swapProQuoteResult, swapQuoteResult]);

  const actionButtonDisabled = useMemo(() => {
    return !hasEnoughBalance || !currentQuoteRes?.toAmount;
  }, [hasEnoughBalance, currentQuoteRes]);

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
      onPress={onSwapProActionClick}
      variant={actionButtonDisabled ? 'secondary' : 'primary'}
      backgroundColor={
        actionButtonDisabled ? '$bgDisabled' : '$bgSuccessStrong'
      }
    >
      {actionButtonText}
    </Button>
  );
};

export default SwapProActionButton;
