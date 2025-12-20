import { useMemo, useState } from 'react';

export enum ESwapDirection {
  BUY = 'buy',
  SELL = 'sell',
}

export type ITradeType = ESwapDirection.BUY | ESwapDirection.SELL | undefined;

export function useTradeType() {
  const [tradeType, setTradeType] = useState<ITradeType>(ESwapDirection.BUY);

  const isBuy = useMemo(() => tradeType === ESwapDirection.BUY, [tradeType]);
  const isSell = useMemo(() => tradeType === ESwapDirection.SELL, [tradeType]);

  return {
    isBuy,
    isSell,
    tradeType,
    setTradeType,
  };
}
