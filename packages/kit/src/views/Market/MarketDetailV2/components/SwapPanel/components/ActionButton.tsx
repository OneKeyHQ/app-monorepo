import { useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Button } from '@onekeyhq/components';
import type { IButtonProps } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useTokenDetail } from '../../../hooks/useTokenDetail';
import { usePaymentTokenPrice } from '../hooks/usePaymentTokenPrice';
import { ESwapDirection, type ITradeType } from '../hooks/useTradeType';

import type { IToken } from '../types';

export interface IActionButtonProps extends IButtonProps {
  tradeType: ITradeType;
  amount: string;
  token?: {
    symbol: string;
  };
  balance?: BigNumber;
  paymentToken?: IToken;
  networkId?: string;
}

export function ActionButton({
  tradeType,
  amount,
  token,
  balance,
  disabled,
  onPress,
  paymentToken,
  networkId,
  ...otherProps
}: IActionButtonProps) {
  const intl = useIntl();
  const { tokenDetail } = useTokenDetail();

  // Get payment token price for buy orders
  const { price: paymentTokenPrice } = usePaymentTokenPrice(
    tradeType === ESwapDirection.BUY ? paymentToken : undefined,
    networkId,
  );

  const actionText =
    tradeType === ESwapDirection.BUY
      ? intl.formatMessage({ id: ETranslations.global_buy })
      : intl.formatMessage({ id: ETranslations.global_sell });

  const amountBN = useMemo(() => new BigNumber(amount || 0), [amount]);
  const isValidAmount = amountBN.isFinite() && !amountBN.isNaN();
  const displayAmount = isValidAmount ? amount : '';

  const totalValue = useMemo(() => {
    if (!amount || !isValidAmount || amountBN.lte(0)) {
      return undefined;
    }

    if (tradeType === ESwapDirection.BUY && paymentTokenPrice) {
      // For buy orders: payment amount × payment token price
      return amountBN.multipliedBy(paymentTokenPrice).toNumber();
    }

    if (tradeType === ESwapDirection.SELL && tokenDetail?.price) {
      // For sell orders: target token amount × target token price
      return amountBN.multipliedBy(tokenDetail.price).toNumber();
    }

    return undefined;
  }, [
    tradeType,
    tokenDetail?.price,
    paymentTokenPrice,
    amount,
    isValidAmount,
    amountBN,
  ]);

  // Check for insufficient balance for both buy and sell operations
  const hasAmount = amountBN.gt(0);
  const isInsufficientBalance = balance && hasAmount && amountBN.gt(balance);

  // Disable button if insufficient balance
  const shouldDisable = isInsufficientBalance;

  let buttonText = `${actionText} ${displayAmount} ${token?.symbol || ''}`;
  if (typeof totalValue === 'number') {
    buttonText += `($${totalValue.toFixed(2)})`;
  }

  if (shouldDisable) {
    buttonText = intl.formatMessage({
      id: ETranslations.swap_page_button_insufficient_balance,
    });
  }

  return (
    <Button
      variant="primary"
      size="medium"
      disabled={shouldDisable || disabled}
      onPress={shouldDisable ? undefined : onPress}
      {...otherProps}
    >
      {buttonText}
    </Button>
  );
}
