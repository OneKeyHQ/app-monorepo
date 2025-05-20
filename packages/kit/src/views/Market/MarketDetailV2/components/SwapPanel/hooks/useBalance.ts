import { useState } from 'react';

import BigNumber from 'bignumber.js';

import type { IToken } from '../types';

interface IUseBalanceProps {
  token?: IToken;
}

export function useBalance({ token }: IUseBalanceProps) {
  // TODO: get balance from db
  const [balance, setBalance] = useState<BigNumber | undefined>(
    new BigNumber(100.77),
  );

  return { balance, setBalance, balanceToken: token };
}
