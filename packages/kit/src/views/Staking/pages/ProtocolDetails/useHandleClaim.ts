import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { showMorphoClaimDialog } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/showMorphoClaimDialog';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalStakingRoutes } from '@onekeyhq/shared/src/routes';
import type { IStakingInfo } from '@onekeyhq/shared/types/staking';

import { useUniversalClaim } from '../../hooks/useUniversalHooks';

export const useHandleClaim = ({
  accountId,
  networkId,
  updateFrequency,
}: {
  accountId?: string;
  networkId: string;
  updateFrequency?: string;
}) => {
  const intl = useIntl();
  const appNavigation = useAppNavigation();
  const handleUniversalClaim = useUniversalClaim({
    networkId,
    accountId: accountId ?? '',
  });
  return useCallback(
    async ({
      symbol,
      claimAmount,
      claimTokenAddress,
      isReward,
      isMorphoClaim,
      provider,
      vault,
      tokenAddress,
      stakingInfo,
      onSuccess,
    }: {
      symbol: string;
      provider: string;
      claimAmount: string;
      claimTokenAddress?: string;
      vault: string;
      tokenAddress?: string;
      isReward?: boolean;
      isMorphoClaim?: boolean;
      stakingInfo?: IStakingInfo;
      onSuccess?: () => void;
    }) => {
      if (!accountId) return;
      const stakingConfig =
        await backgroundApiProxy.serviceStaking.getStakingConfigs({
          networkId: networkId || '',
          symbol,
          provider,
        });
      if (!stakingConfig) {
        throw new Error('Staking config not found');
      }
      if (isReward) {
        await handleUniversalClaim({
          amount: claimAmount,
          symbol,
          provider,
          stakingInfo,
          claimTokenAddress,
          vault: vault || '',
        });
        return;
      }
      if (isMorphoClaim) {
        showMorphoClaimDialog({
          title: intl.formatMessage({
            id: ETranslations.earn_claim_rewards,
          }),
          description: intl.formatMessage(
            {
              id: ETranslations.earn_claim_rewards_morpho_desc,
            },
            {
              time: updateFrequency || '',
            },
          ),
          onConfirm: async () => {
            await handleUniversalClaim({
              amount: claimAmount,
              symbol,
              provider,
              stakingInfo,
              claimTokenAddress,
              morphoVault: vault,
              vault: vault || '',
            });
          },
        });
        return;
      }
      const providerInfo = {
        name: provider,
        vault,
        logoURI: '',
      };

      const token = backgroundApiProxy.serviceToken.getToken({
        accountId,
        networkId: networkId || '',
        tokenIdOnNetwork: tokenAddress || '',
      });
      if (stakingConfig.claimWithTx) {
        appNavigation.push(EModalStakingRoutes.ClaimOptions, {
          accountId,
          networkId,
          provider: providerInfo,
          token,
        });
        return;
      }
      if (
        provider.toLowerCase() === 'everstake' &&
        symbol.toLowerCase() === 'apt'
      ) {
        appNavigation.push(EModalStakingRoutes.Claim, {
          accountId,
          networkId,
          onSuccess,
          amount: stakingConfig.claimWithAmount ? claimAmount : undefined,
          claimableAmount: '0',
          token,
          provider: providerInfo,
        });
        return;
      }
      await handleUniversalClaim({
        amount: claimAmount,
        symbol,
        provider,
        claimTokenAddress,
        stakingInfo,
        vault: vault || '',
      });
    },
    [
      accountId,
      networkId,
      handleUniversalClaim,
      intl,
      updateFrequency,
      appNavigation,
    ],
  );
};
