import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { showMorphoClaimDialog } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/showMorphoClaimDialog';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalStakingRoutes } from '@onekeyhq/shared/src/routes';
import type {
  IStakeProtocolDetails,
  IStakingInfo,
} from '@onekeyhq/shared/types/staking';

import { useUniversalClaim } from '../../hooks/useUniversalHooks';

export const useHandleClaim = ({
  accountId,
  networkId,
}: {
  accountId?: string;
  networkId: string;
}) => {
  const intl = useIntl();
  const appNavigation = useAppNavigation();
  const handleUniversalClaim = useUniversalClaim({
    networkId,
    accountId: accountId ?? '',
  });
  return useCallback(
    async ({
      details,
      symbol,
      claimAmount,
      claimTokenAddress,
      isReward,
      isMorphoClaim,
      provider,
      stakingInfo,
      onSuccess,
    }: {
      symbol: string;
      provider: string;
      claimAmount: string;
      claimTokenAddress?: string;
      isReward?: boolean;
      isMorphoClaim?: boolean;
      details?: IStakeProtocolDetails;
      stakingInfo?: IStakingInfo;
      onSuccess?: () => void;
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
      if (isReward) {
        await handleUniversalClaim({
          amount: claimAmount,
          symbol,
          provider,
          stakingInfo,
          claimTokenAddress,
        });
        return;
      }
      if (isMorphoClaim) {
        showMorphoClaimDialog({
          title: intl.formatMessage({
            id: ETranslations.earn_claim_rewards,
          }),
          description: intl.formatMessage({
            id: ETranslations.earn_claim_rewards_morpho_desc,
          }),
          onConfirm: async () => {
            await handleUniversalClaim({
              amount: claimAmount,
              symbol,
              provider,
              stakingInfo,
              claimTokenAddress,
              morphoVault: details.provider.vault,
            });
          },
        });
        return;
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
      if (
        provider.toLowerCase() === 'everstake' &&
        symbol.toLowerCase() === 'apt'
      ) {
        appNavigation.push(EModalStakingRoutes.Claim, {
          accountId,
          networkId,
          details,
          onSuccess,
          amount: stakingConfig.claimWithAmount ? claimAmount : undefined,
        });
        return;
      }
      await handleUniversalClaim({
        amount: claimAmount,
        symbol,
        provider,
        claimTokenAddress,
        stakingInfo,
      });
    },
    [appNavigation, accountId, networkId, handleUniversalClaim, intl],
  );
};
