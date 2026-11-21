import { useCallback } from 'react';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { useEarnRegistrationTask } from './useEarnRegistrationTask';

import type { IJsBridgeMessagePayload } from '@onekeyfe/cross-inpage-provider-types';

export function useEarnSignMessage(scope: {
  accountId?: string;
  networkId?: string;
  accountAddress?: string;
  provider?: string;
  symbol?: string;
  ownerKey?: string;
}) {
  const register = useEarnRegistrationTask(scope);
  return useCallback(
    async ({
      accountId,
      networkId,
      provider,
      symbol,
      request,
    }: {
      networkId: string;
      accountId: string;
      request: IJsBridgeMessagePayload;
      provider: string | undefined;
      symbol: string | undefined;
    }) => {
      if (
        scope.accountId !== accountId ||
        scope.networkId !== networkId ||
        scope.provider !== provider ||
        scope.symbol !== symbol
      )
        throw new OneKeyLocalError('Earn registration scope changed');
      return register({ mode: 'signed', request });
    },
    [register, scope.accountId, scope.networkId, scope.provider, scope.symbol],
  );
}
