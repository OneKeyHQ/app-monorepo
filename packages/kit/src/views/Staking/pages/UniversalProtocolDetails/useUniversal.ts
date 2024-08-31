import { useCallback } from 'react';

import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EModalStakingRoutes } from '@onekeyhq/shared/src/routes';
import type { IStakeProtocolDetails } from '@onekeyhq/shared/types/staking';

export const useHandleClaim = () => {
  const appNavigation = useAppNavigation();
  return useCallback(
    async ({
      details,
      accountId,
      networkId,
      symbol,
      provider,
    }: {
      details?: IStakeProtocolDetails;
      accountId: string;
      networkId: string;
      symbol: string;
      provider: string;
    }) => {
      if (!details) return;
      if (
        (symbol.toLowerCase() === 'matic' &&
          provider.toLowerCase() === 'lido') ||
        (symbol.toLowerCase() === 'sol' &&
          provider.toLowerCase() === 'everstake')
      ) {
        appNavigation.push(EModalStakingRoutes.ClaimOptions, {
          accountId,
          networkId,
          details,
          symbol,
          provider,
        });
        return;
      }
      appNavigation.push(EModalStakingRoutes.UniversalClaim, {
        accountId,
        networkId,
        details,
        amount:
          symbol.toLowerCase() === 'eth' &&
          provider.toLowerCase() === 'everstake'
            ? details.claimable
            : undefined,
      });
    },
    [appNavigation],
  );
};

export const useHandleWithdraw = () => {
  const appNavigation = useAppNavigation();
  return useCallback(
    ({
      details,
      accountId,
      networkId,
      symbol,
      provider,
    }: {
      details?: IStakeProtocolDetails;
      accountId: string;
      networkId: string;
      symbol: string;
      provider: string;
    }) => {
      if (!details) return;
      if (
        symbol.toLowerCase() === 'sol' &&
        provider.toLowerCase() === 'everstake'
      ) {
        appNavigation.push(EModalStakingRoutes.WithdrawOptions, {
          accountId,
          networkId,
          details,
          symbol,
          provider,
        });
        return;
      }
      appNavigation.push(EModalStakingRoutes.UniversalWithdraw, {
        accountId,
        networkId,
        details,
      });
    },
    [appNavigation],
  );
};
