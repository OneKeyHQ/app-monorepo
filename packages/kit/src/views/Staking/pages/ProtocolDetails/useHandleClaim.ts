import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { showMorphoClaimDialog } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/showMorphoClaimDialog';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalStakingRoutes } from '@onekeyhq/shared/src/routes';
import type {
  IEarnTokenInfo,
  IProtocolInfo,
  IStakingInfo,
} from '@onekeyhq/shared/types/staking';

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
      protocolInfo,
      tokenInfo,
      symbol,
      claimAmount,
      claimTokenAddress,
      isReward,
      isMorphoClaim,
      stakingInfo,
      onSuccess,
    }: {
      protocolInfo?: IProtocolInfo;
      tokenInfo?: IEarnTokenInfo;
      symbol: string;
      claimAmount: string;
      claimTokenAddress?: string;
      isReward?: boolean;
      isMorphoClaim?: boolean;
      stakingInfo?: IStakingInfo;
      onSuccess?: () => void;
    }) => {
      if (!accountId) return;
      const provider = protocolInfo?.provider || '';
      const vault = protocolInfo?.approve?.approveTarget || '';
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
          vault: protocolInfo?.approve?.approveTarget || '',
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
              vault,
            });
          },
        });
        return;
      }
      if (stakingConfig.claimWithTx) {
        appNavigation.push(EModalStakingRoutes.ClaimOptions, {
          accountId,
          networkId,
          protocolInfo,
          tokenInfo,
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
          protocolInfo,
          tokenInfo,
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
        vault,
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
