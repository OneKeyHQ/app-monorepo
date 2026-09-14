import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';

import type { IToken } from '../types';

export function resolveMarketPaymentTokenDisplay({
  candidates,
  paymentToken,
  preference,
  preferenceReady,
}: {
  candidates: IToken[];
  paymentToken?: IToken;
  preference?: Pick<IToken, 'contractAddress' | 'networkId' | 'symbol'>;
  preferenceReady: boolean;
}): IToken | undefined {
  const currentCandidate = paymentToken
    ? candidates.find((candidate) =>
        equalTokenNoCaseSensitive({
          token1: candidate,
          token2: paymentToken,
        }),
      )
    : undefined;

  // Keep a valid token stable while a same-network preference is revalidating.
  // With no scoped selection yet, keep the trigger in its loading presentation.
  if (!preferenceReady) {
    return currentCandidate;
  }

  const preferredCandidate = preference
    ? candidates.find((candidate) =>
        equalTokenNoCaseSensitive({
          token1: candidate,
          token2: preference,
        }),
      )
    : undefined;

  return currentCandidate ?? preferredCandidate ?? candidates[0];
}
