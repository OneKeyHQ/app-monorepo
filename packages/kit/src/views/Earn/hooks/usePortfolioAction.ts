import { useCallback, useMemo, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import { EEarnLabels } from '@onekeyhq/shared/types/staking';
import type {
  IEarnActionIcon,
  IEarnClaimActionIcon,
  IEarnClaimWithKycActionIcon,
  IEarnToken,
} from '@onekeyhq/shared/types/staking';

import { showClaimWithKycDialog } from '../../Staking/components/ProtocolDetails/showKYCDialog';
import { useEarnSignMessage } from '../../Staking/hooks/useEarnSignMessage';
import { useHandleClaim } from '../../Staking/pages/ProtocolDetails/useHandleClaim';

interface IUsePortfolioActionParams {
  accountId: string;
  networkId: string;
  indexedAccountId?: string;
  symbol: string;
  provider: string;
  vault?: string;
  providerLogoURI?: string;
  stakeTag?: string;
}

export const usePortfolioAction = ({
  accountId,
  networkId,
  indexedAccountId,
  symbol,
  provider,
  vault,
  providerLogoURI,
  stakeTag,
}: IUsePortfolioActionParams) => {
  const [loading, setLoading] = useState(false);

  // Get earnAccount to use the correct accountId for claim
  const { result: earnAccount } = usePromiseResult(async () => {
    if (!accountId) {
      return null;
    }
    return backgroundApiProxy.serviceStaking.getEarnAccount({
      accountId,
      networkId,
      indexedAccountId,
    });
  }, [accountId, networkId, indexedAccountId]);

  const earnAccountId = useMemo(
    () => earnAccount?.accountId || accountId,
    [earnAccount, accountId],
  );

  const handleClaim = useHandleClaim({ accountId: earnAccountId, networkId });
  const signMessage = useEarnSignMessage();

  const handleListaCheckAction = useCallback(
    async (token?: IEarnToken) => {
      setLoading(true);
      await signMessage({
        accountId: earnAccountId,
        networkId,
        provider,
        symbol: token?.symbol,
        request: { origin: 'https://lista.org/', scope: 'ethereum' },
      }).finally(() => setLoading(false));
    },
    [signMessage, earnAccountId, networkId, provider],
  );

  const handleClaimAction = useCallback(
    async ({
      actionIcon,
      token,
      rewardTokenAddress,
    }: {
      actionIcon: IEarnClaimActionIcon;
      token?: IEarnToken;
      rewardTokenAddress?: string;
    }) => {
      setLoading(true);
      setTimeout(() => {
        setLoading(false);
      }, 10 * 1000);

      const claimAmount = actionIcon.data?.balance || '0';
      const isMorphoClaim = earnUtils.isMorphoProvider({
        providerName: provider,
      });

      const receiveToken = earnUtils.convertEarnTokenToIToken(token);

      // Use rewardTokenAddress if provided (from airdrop asset), otherwise use token.address
      // Only pass claimTokenAddress if it's a non-empty string
      const claimTokenAddress =
        rewardTokenAddress || token?.address || undefined;

      await handleClaim({
        claimType: actionIcon.type,
        symbol,
        protocolInfo: {
          symbol,
          provider,
          vault: vault || '',
          networkId,
          stakeTag: stakeTag || '',
          providerDetail: {
            name: provider,
            logoURI: providerLogoURI || '',
          },
          claimable: claimAmount,
        },
        tokenInfo: token
          ? {
              balanceParsed: '0',
              token,
              price: '0',
              networkId,
              provider,
              vault,
              accountId,
            }
          : undefined,
        claimAmount,
        claimTokenAddress,
        isMorphoClaim,
        stakingInfo: {
          label: EEarnLabels.Claim,
          protocol: earnUtils.getEarnProviderName({ providerName: provider }),
          protocolLogoURI: providerLogoURI || '',
          receive: receiveToken
            ? { token: receiveToken, amount: claimAmount }
            : undefined,
          tags: stakeTag ? [stakeTag] : [],
        },
        portfolioSymbol: token?.symbol,
      });
      setLoading(false);
    },
    [
      handleClaim,
      provider,
      symbol,
      vault,
      networkId,
      stakeTag,
      providerLogoURI,
      accountId,
    ],
  );

  const handleClaimWithKycAction = useCallback(
    async ({
      actionIcon,
      indexedAccountId: actionIndexedAccountId,
    }: {
      actionIcon: IEarnClaimWithKycActionIcon;
      indexedAccountId?: string;
    }) => {
      setLoading(true);
      try {
        // Get fresh data from API
        const response =
          await backgroundApiProxy.serviceStaking.getProtocolDetailsV2({
            accountId,
            networkId,
            indexedAccountId: actionIndexedAccountId ?? indexedAccountId,
            symbol,
            provider,
            vault,
          });

        // Find the updated action in portfolios
        const buttons =
          response?.portfolios?.items
            ?.flatMap((item) => item.buttons || [])
            .filter((button) => 'type' in button) || [];

        const latestClaimWithKycAction = buttons.find(
          (button) => button.type === 'claimWithKyc',
        ) as IEarnClaimWithKycActionIcon | undefined;

        const latestClaimAction = !latestClaimWithKycAction
          ? (buttons.find((button) => button.type === 'claim') as
              | IEarnClaimActionIcon
              | undefined)
          : undefined;

        // Priority: claimWithKyc > claim > no response
        if (latestClaimWithKycAction) {
          showClaimWithKycDialog({
            actionData: latestClaimWithKycAction,
          });
        } else if (latestClaimAction) {
          await handleClaimAction({
            actionIcon: latestClaimAction,
            token: actionIcon.data?.token,
          });
        } else {
          console.warn('No claimWithKyc or claim action found in updated data');
          showClaimWithKycDialog({
            actionData: actionIcon,
          });
        }
      } catch (error) {
        console.error('Failed to fetch latest claimWithKyc data:', error);
        showClaimWithKycDialog({
          actionData: actionIcon,
        });
      } finally {
        setLoading(false);
      }
    },
    [
      accountId,
      networkId,
      indexedAccountId,
      symbol,
      provider,
      vault,
      handleClaimAction,
    ],
  );

  const handleAction = useCallback(
    ({
      actionIcon,
      token,
      rewardTokenAddress,
      indexedAccountId: actionIndexedAccountId,
    }: {
      actionIcon: IEarnActionIcon;
      token?: IEarnToken;
      rewardTokenAddress?: string;
      indexedAccountId?: string;
    }) => {
      switch (actionIcon.type) {
        case 'claim':
        case 'claimOrder':
        case 'claimAirdrop':
          void handleClaimAction({
            actionIcon,
            token,
            rewardTokenAddress,
          });
          break;
        case 'claimWithKyc':
          void handleClaimWithKycAction({
            actionIcon: actionIcon as IEarnClaimWithKycActionIcon,
            indexedAccountId: actionIndexedAccountId,
          });
          break;
        case 'listaCheck':
          void handleListaCheckAction(token);
          break;
        default:
          console.warn(`Unsupported action type: ${actionIcon.type}`);
      }
    },
    [handleClaimAction, handleClaimWithKycAction, handleListaCheckAction],
  );

  return {
    loading,
    handleAction,
  };
};
