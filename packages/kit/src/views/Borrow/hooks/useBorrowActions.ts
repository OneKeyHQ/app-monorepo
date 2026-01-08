import { useCallback, useState } from 'react';

import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import { EClaimType, EEarnLabels } from '@onekeyhq/shared/types/staking';
import type { IEarnClaimActionIcon } from '@onekeyhq/shared/types/staking';

import { useHandleClaim } from '../../Staking/pages/ProtocolDetails/useHandleClaim';
import { buildLocalTxStatusSyncId } from '../../Staking/utils/utils';

type IUseBorrowActionsParams = {
  accountId: string;
  networkId?: string;
  provider?: string;
  providerLogoURI?: string;
  symbol: string;
  vault?: string;
  onSuccess?: () => Promise<void>;
};

export const useBorrowActions = ({
  accountId,
  networkId,
  provider,
  providerLogoURI,
  symbol,
  vault,
  onSuccess,
}: IUseBorrowActionsParams) => {
  const [loading, setLoading] = useState(false);
  const handleClaim = useHandleClaim({
    accountId,
    networkId: networkId ?? '',
  });

  const handleClaimAction = useCallback(
    async ({ actionIcon }: { actionIcon: IEarnClaimActionIcon }) => {
      const tokenInfo = actionIcon.data?.token?.info;
      setLoading(true);
      try {
        const claimAmount = actionIcon.data?.balance ?? '0';
        const price = actionIcon.data?.token?.price ?? '';
        const receiveToken = tokenInfo
          ? earnUtils.convertEarnTokenToIToken(tokenInfo)
          : undefined;

        await handleClaim({
          claimType: actionIcon.type,
          symbol,
          protocolInfo: {
            provider: provider || '',
            networkId: networkId || '',
            symbol,
            vault: vault || '',
            providerDetail: {
              name: provider || '',
              logoURI: providerLogoURI || '',
            },
            claimable: claimAmount,
            stakeTag: buildLocalTxStatusSyncId({
              providerName: provider,
              tokenSymbol: symbol,
            }),
          },
          tokenInfo: tokenInfo
            ? {
                balanceParsed: '0',
                token: tokenInfo,
                price,
                networkId: networkId || '',
                provider: provider || '',
                vault,
                accountId,
              }
            : undefined,
          claimAmount,
          claimTokenAddress: tokenInfo?.address,
          stakingInfo: receiveToken
            ? {
                label: EEarnLabels.Claim,
                protocol: earnUtils.getEarnProviderName({
                  providerName: provider || '',
                }),
                protocolLogoURI: providerLogoURI,
                receive: {
                  token: receiveToken,
                  amount: claimAmount,
                },
                tags: [
                  buildLocalTxStatusSyncId({
                    providerName: provider,
                    tokenSymbol: symbol,
                  }),
                ],
              }
            : undefined,
          portfolioSymbol: symbol,
        });
        if (onSuccess) {
          await onSuccess();
        }
      } finally {
        setLoading(false);
      }
    },
    [
      accountId,
      handleClaim,
      networkId,
      onSuccess,
      provider,
      providerLogoURI,
      symbol,
      vault,
    ],
  );

  const handleAction = useCallback(
    ({ actionIcon }: { actionIcon: IEarnClaimActionIcon }) => {
      if (actionIcon.type !== EClaimType.Claim) return;
      void handleClaimAction({ actionIcon });
    },
    [handleClaimAction],
  );

  return {
    loading,
    handleAction,
  };
};
