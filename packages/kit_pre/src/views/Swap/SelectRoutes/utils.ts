import type { Token } from '@onekeyhq/engine/src/types/token';

import { formatAmount, getTokenAmountValue } from '../utils';

export function useTokenOutput({
  token,
  amount,
}: {
  token?: Token;
  amount?: string;
}) {
  let text = '';
  if (token && amount) {
    text = formatAmount(getTokenAmountValue(token, amount), 4);
  }
  return text;
}
