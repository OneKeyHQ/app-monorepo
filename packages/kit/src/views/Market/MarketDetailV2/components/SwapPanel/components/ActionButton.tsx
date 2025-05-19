import { Button } from '@onekeyhq/components';

import type { ITradeType } from '../hooks/useSwapPanel';

interface ITokenInfo {
  label: string;
  value: string;
  price?: number;
}

export interface IActionButtonProps {
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
}: IActionButtonProps) {
  const actionText = tradeType === 'buy' ? 'Buy' : 'Sell';
  const numericAmount = parseFloat(amount);
  const displayAmount = Number.isNaN(numericAmount) ? '' : amount;

  return (
    <Button variant="primary" size="large">
      {actionText} {displayAmount} {token?.label || ''} ($
      {totalValue.toFixed(2)})
    </Button>
  );
}
