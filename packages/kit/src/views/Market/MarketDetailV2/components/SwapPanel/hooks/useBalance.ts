import { useState } from 'react';

import type { IToken } from '../types';
import type BigNumber from 'bignumber.js';

interface IUseBalanceProps {
  token?: IToken;
}

export function useBalance({ token }: IUseBalanceProps) {
  const [balance, setBalance] = useState<BigNumber | undefined>();

  return { balance, setBalance, balanceToken: token };
}
