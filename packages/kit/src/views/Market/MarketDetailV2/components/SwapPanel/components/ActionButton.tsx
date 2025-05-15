import { Button } from '@onekeyhq/components';

import type { ITradeType } from '../useSwapPanel';

interface ITokenInfo {
  label: string;
  value: string;
  price?: number;
}

export function ActionButton({
  tradeType,
  amount,
  token,
  totalValue,
}: {
  tradeType: ITradeType;
  amount: string;
  token?: ITokenInfo;
  totalValue: number;
}) {
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
