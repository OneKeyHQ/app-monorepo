import BigNumber from 'bignumber.js';

import {
  ETokenRiskLevel,
  type ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

export function isSwapTokenRisky(token: ISwapToken) {
  return Boolean(
    !token.isPopular &&
    (!token.price ||
      new BigNumber(token.price).isZero() ||
      token.riskLevel === ETokenRiskLevel.SPAM ||
      token.riskLevel === ETokenRiskLevel.MALICIOUS),
  );
}
