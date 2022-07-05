import BigNumber from 'bignumber.js';

import { Token } from '../../types/token';

export function convertTokenOnChainValueToAmount({
  tokenInfo,
  value,
}: {
  tokenInfo: Token;
  value: string;
}) {
  return new BigNumber(value).shiftedBy(-tokenInfo.decimals).toFixed();
}
