import { useCallback, useMemo, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { getEarnProtocol } from '@onekeyhq/kit/src/views/Earn/protocols';
import { EModalRoutes, EModalStakingRoutes } from '@onekeyhq/shared/src/routes';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import {
  EEarnLabels,
  EStakingActionType,
} from '@onekeyhq/shared/types/staking';
import type {
  IEarnActionIcon,
  IEarnClaimActionIcon,
  IEarnClaimType,
  IEarnClaimWithKycActionIcon,
  IEarnToken,
} from '@onekeyhq/shared/types/staking';

import { showClaimWithKycDialog } from '../../Staking/components/ProtocolDetails/showKYCDialog';
import { useEarnSignMessage } from '../../Staking/hooks/useEarnSignMessage';
import { useUniversalWithdraw } from '../../Staking/hooks/useUniversalHooks';
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
  onSuccess?: () => Promise<void>;
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
  onSuccess,
}: IUsePortfolioActionParams) => {
  const [loading, setLoading] = useState(false);
  const appNavigation = useAppNavigation();

  // Get earnAccount to use the correct accountId for claim. An indexed
  // account alone (all networks on an HD or hardware wallet, a network whose
  // address is not created yet) resolves too, as the detail page's
  // useEarnAccount does; the phone positions card claims from there.
  const accountScope = JSON.stringify([accountId, networkId, indexedAccountId]);
  const {
    result: resolvedAccount,
    run: resolveAccount,
    isLoading: isAccountLoading,
  } = usePromiseResult(
    async () => {
      if (!accountId && !indexedAccountId) {
        return { accountScope, status: 'unavailable' as const };
      }
      try {
        const account = await backgroundApiProxy.serviceStaking.getEarnAccount({
          accountId,
          networkId,
          indexedAccountId,
          btcOnlyTaproot: true,
        });
        return account
          ? { accountScope, status: 'ready' as const, account }
          : { accountScope, status: 'unavailable' as const };
      } catch (_error) {
        return { accountScope, status: 'error' as const };
      }
    },
    [accountId, networkId, indexedAccountId, accountScope],
    { watchLoading: true, undefinedResultIfReRun: true },
  );

  const earnAccount = useMemo(
    () =>
      resolvedAccount?.accountScope === accountScope &&
      resolvedAccount.status === 'ready'
        ? resolvedAccount.account
        : undefined,
    [resolvedAccount, accountScope],
  );
  const earnAccountId = earnAccount?.accountId ?? '';
  const isResolvingAccount = Boolean(
    (accountId || indexedAccountId) &&
    (isAccountLoading || resolvedAccount?.accountScope !== accountScope),
  );
  const accountResolutionFailed = Boolean(
    (accountId || indexedAccountId) &&
    resolvedAccount?.accountScope === accountScope &&
    resolvedAccount.status !== 'ready',
  );

  const handleClaim = useHandleClaim({ accountId: earnAccountId, networkId });
  const handleWithdraw = useUniversalWithdraw({
    accountId: earnAccountId,
    networkId,
  });
  const signMessage = useEarnSignMessage();

  const handleListaCheckAction = useCallback(
    async (
      _: {
        stakedSymbol?: string;
        rewardSymbol?: string;
      } = {},
    ) => {
      setLoading(true);
      try {
        await signMessage({
          accountId: earnAccountId,
          networkId,
          provider,
          symbol,
          request: { origin: 'https://lista.org/', scope: 'ethereum' },
        });

        void onSuccess?.();
      } finally {
        setLoading(false);
      }
    },
    [signMessage, earnAccountId, networkId, provider, symbol, onSuccess],
  );

  const handleClaimAction = useCallback(
    async ({
      actionIcon,
      token,
      rewardTokenAddress,
      claimRequestType,
      stakedSymbol,
      rewardSymbol,
    }: {
      actionIcon: IEarnClaimActionIcon;
      token?: {
        price: string;
        info: IEarnToken;
      };
      rewardTokenAddress?: string;
      claimRequestType?: IEarnClaimType;
      stakedSymbol?: string;
      rewardSymbol?: string;
    }) => {
      setLoading(true);
      try {
        const claimAmount = actionIcon.data?.balance || '0';
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
            // IProtocolInfo.vault is a required string, so a provider with no
            // vault (Stakefish) still travels as ''. ServiceStaking drops that
            // empty string before it reaches the backend — see getClaimableList.
            vault: vault || '',
            networkId,
            stakeTag: stakeTag || '',
            providerDetail: {
              name: provider,
              logoURI: providerLogoURI || '',
            },
            claimable: claimAmount,
            earnAccount,
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
          claimRequestType,
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
          onSuccess,
        });
      } finally {
        setLoading(false);
      }
    },
    [
      onSuccess,
      handleClaim,
      provider,
      symbol,
      vault,
      networkId,
      stakeTag,
      providerLogoURI,
      accountId,
      earnAccount,
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
      } catch (_error) {
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

  const handleCancelWithdrawalAction = useCallback(
    // Aggregated actions open a picker; legacy actions retain direct cancellation.
    async () => {
      if (
        getEarnProtocol(provider).getCancelWithdrawalRoute() ===
        'withdraw-options'
      ) {
        if (!earnAccountId) return;
        appNavigation.pushModal(EModalRoutes.StakingModal, {
          screen: EModalStakingRoutes.WithdrawOptions,
          params: {
            accountId: earnAccountId,
            networkId,
            symbol,
            provider,
            withdrawType: 'cancel',
            protocolInfo: {
              symbol,
              provider,
              vault: vault ?? '',
              networkId,
              stakeTag: stakeTag || '',
              providerDetail: {
                name: provider,
                logoURI: providerLogoURI || '',
              },
              earnAccount,
            },
            onSuccess,
          },
        });
        return;
      }
      setLoading(true);
      try {
        await handleWithdraw({
          amount: '0',
          symbol,
          provider,
          protocolVault: earnUtils.shouldSendEarnProtocolVault({
            providerName: provider,
          })
            ? vault
            : undefined,
          withdrawAll: false,
          withdrawType: 'cancel',
          taskAccountAddress: earnAccount?.accountAddress,
          stakingInfo: {
            label: EEarnLabels.Withdraw,
            protocol: earnUtils.getEarnProviderName({ providerName: provider }),
            protocolLogoURI: providerLogoURI || '',
            tags: stakeTag ? [stakeTag] : [],
          },
          onSuccess: async () => {
            await onSuccess?.();
          },
        });
      } finally {
        setLoading(false);
      }
    },
    [
      appNavigation,
      earnAccountId,
      earnAccount,
      networkId,
      handleWithdraw,
      onSuccess,
      provider,
      providerLogoURI,
      stakeTag,
      symbol,
      vault,
    ],
  );

  const handleAction = useCallback(
    ({
      actionIcon,
      token,
      rewardTokenAddress,
      claimRequestType,
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
      claimRequestType?: IEarnClaimType;
      indexedAccountId?: string;
      stakedSymbol?: string;
      rewardSymbol?: string;
    }) => {
      if (!earnAccountId) return;
      switch (actionIcon.type) {
        case 'claim':
        case 'claimOrder':
        case 'claimAirdrop':
          void handleClaimAction({
            actionIcon: actionIcon as IEarnClaimActionIcon,
            token,
            rewardTokenAddress,
            claimRequestType,
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
        case EStakingActionType.CancelWithdrawal:
          void handleCancelWithdrawalAction();
          break;
        default:
          break;
      }
    },
    [
      handleClaimAction,
      handleClaimWithKycAction,
      handleListaCheckAction,
      handleCancelWithdrawalAction,
      earnAccountId,
      symbol,
    ],
  );

  return {
    loading: loading || isResolvingAccount,
    accountResolutionFailed,
    accountUnavailable: !accountId && !indexedAccountId,
    retryAccount: resolveAccount,
    handleAction,
  };
};
