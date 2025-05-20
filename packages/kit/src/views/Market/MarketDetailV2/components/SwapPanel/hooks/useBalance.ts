import { useState } from 'react';

import type BigNumber from 'bignumber.js';

interface IUseBalanceProps {
  token?: {
    symbol: string;
  };
}

export function useBalance({ token }: IUseBalanceProps) {
  const [balance, setBalance] = useState<BigNumber | undefined>();

  return { balance, setBalance, balanceToken: token };
}
