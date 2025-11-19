import { useCallback, useMemo, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
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
    async ({
      stakedSymbol: actionStakedSymbol,
      rewardSymbol: actionRewardSymbol,
    }: {
      stakedSymbol?: string;
      rewardSymbol?: string;
    } = {}) => {
      setLoading(true);
      try {
        await signMessage({
          accountId: earnAccountId,
          networkId,
          provider,
          symbol,
          request: { origin: 'https://lista.org/', scope: 'ethereum' },
        });

        const symbolForRefresh = actionStakedSymbol || symbol;
        if (symbolForRefresh) {
          appEventBus.emit(EAppEventBusNames.RefreshEarnPortfolioItem, {
            provider,
            symbol: symbolForRefresh,
            networkId,
            rewardSymbol: actionRewardSymbol,
          });
        }
      } finally {
        setLoading(false);
      }
    },
    [signMessage, earnAccountId, networkId, provider, symbol],
  );

  const handleClaimAction = useCallback(
    async ({
      actionIcon,
      token,
      rewardTokenAddress,
      stakedSymbol,
      rewardSymbol,
    }: {
      actionIcon: IEarnClaimActionIcon;
      token?: {
        price: string;
        info: IEarnToken;
      };
      rewardTokenAddress?: string;
      stakedSymbol?: string;
      rewardSymbol?: string;
    }) => {
      setLoading(true);
      try {
        const claimAmount = actionIcon.data?.balance || '0';
        const isMorphoClaim = earnUtils.isMorphoProvider({
          providerName: provider,
        });

        const receiveToken = earnUtils.convertEarnTokenToIToken(token?.info);

        // Use rewardTokenAddress if provided (from airdrop asset), otherwise use token.address
        // Only pass claimTokenAddress if it's a non-empty string
        const claimTokenAddress =
          rewardTokenAddress || token?.info.address || undefined;

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
                token: token.info,
                price: token.price,
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
          // For airdrops, use stakedSymbol to refresh the correct portfolio item
          // For normal claims, use token?.symbol
          portfolioSymbol: stakedSymbol || token?.info.symbol,
          // For airdrops, also pass rewardSymbol to filter the correct airdrop asset
          portfolioRewardSymbol: rewardSymbol,
        });
      } finally {
        setLoading(false);
      }
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
          showClaimWithKycDialog({
            actionData: actionIcon,
          });
        }
      } catch (error) {
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
      stakedSymbol,
      rewardSymbol,
    }: {
      actionIcon: IEarnActionIcon | IEarnClaimWithKycActionIcon;
      token?: {
        price: string;
        info: IEarnToken;
      };
      rewardTokenAddress?: string;
      indexedAccountId?: string;
      stakedSymbol?: string;
      rewardSymbol?: string;
    }) => {
      switch (actionIcon.type) {
        case 'claim':
        case 'claimOrder':
        case 'claimAirdrop':
          void handleClaimAction({
            actionIcon: actionIcon as IEarnClaimActionIcon,
            token,
            rewardTokenAddress,
            stakedSymbol,
            rewardSymbol,
          });
          break;
        case 'claimWithKyc':
          void handleClaimWithKycAction({
            actionIcon: actionIcon as IEarnClaimWithKycActionIcon,
            indexedAccountId: actionIndexedAccountId,
          });
          break;
        case 'listaCheck':
          void handleListaCheckAction({
            stakedSymbol: stakedSymbol || symbol,
            rewardSymbol,
          });
          break;
        default:
          break;
      }
    },
    [
      handleClaimAction,
      handleClaimWithKycAction,
      handleListaCheckAction,
      symbol,
    ],
  );

  return {
    loading,
    handleAction,
  };
};
