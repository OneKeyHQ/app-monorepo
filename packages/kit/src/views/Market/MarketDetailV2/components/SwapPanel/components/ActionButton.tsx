import { Button } from '@onekeyhq/components';
import type { IButtonProps } from '@onekeyhq/components';

import type { ITradeType } from '../useSwapPanel';

interface ITokenInfo {
  label: string;
  value: string;
  price?: number;
}

export interface IActionButtonProps extends IButtonProps {
  tradeType: ITradeType;
  amount: string;
  token?: ITokenInfo;
  totalValue: number;
}

export function ActionButton({
  tradeType,
  amount,
  token,
  totalValue,
  ...props
}: IActionButtonProps) {
  const actionText = tradeType === 'buy' ? 'Buy' : 'Sell';
  const numericAmount = parseFloat(amount);
  const displayAmount = Number.isNaN(numericAmount) ? '' : amount;

  return (
    <Button variant="primary" size="large" {...props}>
      {actionText} {displayAmount} {token?.label || ''} ($
      {totalValue.toFixed(2)})
    </Button>
  );
}
