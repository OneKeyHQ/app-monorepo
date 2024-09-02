import { useCallback } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
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
      accountId?: string;
      networkId: string;
      symbol: string;
      provider: string;
    }) => {
      if (!details || !accountId) return;
      const stakingConfig =
        await backgroundApiProxy.serviceStaking.getStakingConfigs({
          networkId,
          symbol,
          provider,
        });
      if (!stakingConfig) {
        throw new Error('Staking config not found');
      }
      if (stakingConfig.claimWithTx) {
        appNavigation.push(EModalStakingRoutes.ClaimOptions, {
          accountId,
          networkId,
          details,
          symbol,
          provider,
        });
        return;
      }
      appNavigation.push(EModalStakingRoutes.Claim, {
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
    async ({
      details,
      accountId,
      networkId,
      symbol,
      provider,
    }: {
      details?: IStakeProtocolDetails;
      accountId?: string;
      networkId: string;
      symbol: string;
      provider: string;
    }) => {
      if (!details || !accountId) return;
      const stakingConfig =
        await backgroundApiProxy.serviceStaking.getStakingConfigs({
          networkId,
          symbol,
          provider,
        });
      if (!stakingConfig) {
        throw new Error('Staking config not found');
      }
      if (stakingConfig.withdrawWithTx) {
        appNavigation.push(EModalStakingRoutes.WithdrawOptions, {
          accountId,
          networkId,
          details,
          symbol,
          provider,
        });
        return;
      }
      appNavigation.push(EModalStakingRoutes.Withdraw, {
        accountId,
        networkId,
        details,
      });
    },
    [appNavigation],
  );
};

export const useHandleStake = () => {
  const appNavigation = useAppNavigation();
  return useCallback(
    async ({
      details,
      accountId,
      networkId,
      setStakeLoading,
    }: {
      details?: IStakeProtocolDetails;
      accountId?: string;
      networkId: string;
      symbol: string;
      provider: string;
      setStakeLoading?: (value: boolean) => void;
    }) => {
      if (!details || !accountId) return;
      if (details.approveTarget) {
        setStakeLoading?.(true);
        try {
          const { allowanceParsed } =
            await backgroundApiProxy.serviceStaking.fetchTokenAllowance({
              accountId,
              networkId,
              spenderAddress: details.approveTarget,
              tokenAddress: details.token.info.address,
            });
          appNavigation.push(EModalStakingRoutes.ApproveBaseStake, {
            accountId,
            networkId,
            details,
            currentAllowance: allowanceParsed,
          });
        } finally {
          setStakeLoading?.(false);
        }
        return;
      }
      appNavigation.push(EModalStakingRoutes.Stake, {
        accountId,
        networkId,
        details,
      });
    },
    [appNavigation],
  );
};
