import { useCallback, useMemo } from 'react';

import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import {
  EEarnLabels,
  type IEarnTokenInfo,
  type IProtocolInfo,
} from '@onekeyhq/shared/types/staking';
import type { IToken } from '@onekeyhq/shared/types/token';

import { UniversalWithdraw } from '../../../components/UniversalWithdraw';
import { useUniversalWithdraw } from '../../../hooks/useUniversalHooks';

export const WithdrawSection = ({
  accountId,
  networkId,
  tokenInfo,
  protocolInfo,
  isDisabled,
}: {
  accountId: string;
  networkId: string;
  tokenInfo?: IEarnTokenInfo;
  protocolInfo?: IProtocolInfo;
  isDisabled?: boolean;
}) => {
  // Early return if no tokenInfo or protocolInfo
  // This happens when there's no account or no address
  const hasRequiredData = tokenInfo && protocolInfo;

  const providerName = useMemo(
    () => protocolInfo?.provider ?? '',
    [protocolInfo?.provider],
  );
  const token = useMemo(() => tokenInfo?.token as IToken, [tokenInfo]);
  const symbol = useMemo(() => token?.symbol || '', [token]);
  const vault = useMemo(() => protocolInfo?.vault || '', [protocolInfo?.vault]);
  const handleWithdraw = useUniversalWithdraw({ accountId, networkId });
  const appNavigation = useAppNavigation();

  const onConfirm = useCallback(
    async ({
      amount,
      withdrawAll,
    }: {
      amount: string;
      withdrawAll: boolean;
    }) => {
      if (!hasRequiredData) return;

      await handleWithdraw({
        amount,
        // identity,
        protocolVault: earnUtils.isVaultBasedProvider({
          providerName,
        })
          ? vault
          : undefined,
        symbol,
        provider: providerName,
        stakingInfo: {
          label: EEarnLabels.Withdraw,
          protocol: earnUtils.getEarnProviderName({
            providerName,
          }),
          protocolLogoURI: protocolInfo?.providerDetail.logoURI,
          tags: [protocolInfo?.stakeTag || ''],
        },
        withdrawAll,
        onSuccess: () => {
          appNavigation.pop();
          defaultLogger.staking.page.unstaking({
            token,
            stakingProtocol: providerName,
          });
          // onSuccess?.();
        },
      });
    },
    [
      hasRequiredData,
      handleWithdraw,
      // identity,
      providerName,
      vault,
      protocolInfo?.providerDetail.logoURI,
      appNavigation,
      token,
      protocolInfo?.stakeTag,
      symbol,
    ],
  );

  // If no required data, render placeholder to maintain layout
  if (!hasRequiredData) {
    return (
      <UniversalWithdraw
        accountAddress=""
        price="0"
        balance="0"
        accountId={accountId}
        networkId={networkId}
        tokenSymbol=""
        providerName=""
        onConfirm={async () => {}}
        protocolVault=""
        isDisabled
      />
    );
  }

  return (
    <UniversalWithdraw
      accountAddress={protocolInfo?.earnAccount?.accountAddress || ''}
      price={tokenInfo?.price ? String(tokenInfo.price) : '0'}
      decimals={token?.decimals}
      balance={protocolInfo?.activeBalance || '0'}
      accountId={accountId}
      networkId={networkId}
      tokenSymbol={symbol || ''}
      tokenImageUri={token?.logoURI}
      providerLogo={protocolInfo?.providerDetail.logoURI}
      providerName={providerName}
      onConfirm={onConfirm}
      minAmount={
        Number(protocolInfo?.minUnstakeAmount) > 0
          ? String(protocolInfo?.minUnstakeAmount)
          : undefined
      }
      protocolVault={protocolInfo?.vault ?? ''}
      isDisabled={isDisabled}
    />
  );
};
