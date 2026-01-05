import type { ReactElement } from 'react';
import { useCallback, useMemo } from 'react';

import { UniversalBorrowRepay } from '@onekeyhq/kit/src/views/Borrow/components/UniversalBorrowRepay';
import { UniversalBorrowWithdraw } from '@onekeyhq/kit/src/views/Borrow/components/UniversalBorrowWithdraw';
import {
  useUniversalBorrowRepay,
  useUniversalBorrowWithdraw,
} from '@onekeyhq/kit/src/views/Borrow/hooks/useUniversalBorrowHooks';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import {
  EEarnLabels,
  type IEarnTokenInfo,
  type IProtocolInfo,
} from '@onekeyhq/shared/types/staking';
import type { IToken } from '@onekeyhq/shared/types/token';

import { UniversalWithdraw } from '../../../components/UniversalWithdraw';
import { useBorrowApiParams } from '../../../hooks/useBorrowApiParams';
import { useUniversalWithdraw } from '../../../hooks/useUniversalHooks';

export const WithdrawSection = ({
  accountId,
  networkId,
  tokenInfo,
  protocolInfo,
  isDisabled,
  onSuccess,
  beforeFooter,
  showApyDetail,
  isInModalContext,
  fallbackTokenImageUri,
  useBorrowApi,
  borrowMarketAddress,
  borrowReserveAddress,
  borrowAction,
  borrowActionLabel,
}: {
  accountId: string;
  networkId: string;
  tokenInfo?: IEarnTokenInfo;
  protocolInfo?: IProtocolInfo;
  isDisabled?: boolean;
  onSuccess?: () => void;
  beforeFooter?: ReactElement | null;
  showApyDetail?: boolean;
  isInModalContext?: boolean;
  fallbackTokenImageUri?: string;
  useBorrowApi?: boolean;
  borrowMarketAddress?: string;
  borrowReserveAddress?: string;
  borrowAction?: 'supply' | 'withdraw' | 'borrow' | 'repay';
  borrowActionLabel?: string;
}) => {
  // Early return if no tokenInfo or protocolInfo
  // This happens when there's no account or no address
  const hasRequiredData = tokenInfo && protocolInfo;
  const providerName = useMemo(
    () => protocolInfo?.provider ?? '',
    [protocolInfo?.provider],
  );
  const borrowApiCtx = useBorrowApiParams({
    useBorrowApi,
    networkId,
    provider: providerName,
    marketAddress: borrowMarketAddress,
    reserveAddress: borrowReserveAddress,
    accountId,
    action: borrowAction,
  });
  const isBorrowWithdraw =
    borrowApiCtx.isBorrow &&
    (borrowApiCtx.borrowApiParams.action === 'withdraw' ||
      borrowApiCtx.borrowApiParams.action === 'repay');
  const BorrowWithdrawComponent =
    borrowAction === 'repay' ? UniversalBorrowRepay : UniversalBorrowWithdraw;
  const token = useMemo(() => tokenInfo?.token as IToken, [tokenInfo]);
  const symbol = useMemo(() => token?.symbol || '', [token]);
  const vault = useMemo(() => protocolInfo?.vault || '', [protocolInfo?.vault]);
  const handleWithdraw = useUniversalWithdraw({ accountId, networkId });
  const handleBorrowWithdraw = useUniversalBorrowWithdraw({
    accountId,
    networkId,
  });
  const handleBorrowRepay = useUniversalBorrowRepay({ accountId, networkId });

  const onConfirm = useCallback(
    async ({
      amount,
      withdrawAll,
    }: {
      amount: string;
      withdrawAll: boolean;
    }) => {
      if (!hasRequiredData) return;

      if (borrowApiCtx.isBorrow) return;

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
          onSuccess?.();
          defaultLogger.staking.page.unstaking({
            token,
            stakingProtocol: providerName,
          });
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
      onSuccess,
      token,
      protocolInfo?.stakeTag,
      symbol,
      borrowApiCtx.isBorrow,
    ],
  );

  const onBorrowConfirm = useCallback(
    async ({
      amount,
      withdrawAll,
      repayAll,
    }: {
      amount: string;
      withdrawAll?: boolean;
      repayAll?: boolean;
    }) => {
      if (!hasRequiredData || !borrowApiCtx.isBorrow) return;

      const { provider, marketAddress, reserveAddress, action } =
        borrowApiCtx.borrowApiParams;

      if (action === 'repay') {
        await handleBorrowRepay({
          amount,
          provider,
          marketAddress,
          reserveAddress,
          repayAll,
          stakingInfo: token
            ? {
                label: EEarnLabels.Repay,
                protocol: earnUtils.getEarnProviderName({
                  providerName: provider,
                }),
                protocolLogoURI: protocolInfo?.providerDetail.logoURI,
                send: { token, amount },
                tags: [protocolInfo?.stakeTag || ''],
              }
            : undefined,
          onSuccess: () => {
            onSuccess?.();
          },
        });
        return;
      }

      await handleBorrowWithdraw({
        amount,
        provider,
        marketAddress,
        reserveAddress,
        withdrawAll,
        stakingInfo: token
          ? {
              label: EEarnLabels.Withdraw,
              protocol: earnUtils.getEarnProviderName({
                providerName: provider,
              }),
              protocolLogoURI: protocolInfo?.providerDetail.logoURI,
              receive: { token, amount },
              tags: [protocolInfo?.stakeTag || ''],
            }
          : undefined,
        onSuccess: () => {
          onSuccess?.();
        },
      });
    },
    [
      borrowApiCtx,
      handleBorrowRepay,
      handleBorrowWithdraw,
      hasRequiredData,
      onSuccess,
      protocolInfo?.providerDetail.logoURI,
      protocolInfo?.stakeTag,
      token,
    ],
  );

  // If no required data, render placeholder to maintain layout
  if (!hasRequiredData) {
    if (
      useBorrowApi &&
      borrowMarketAddress &&
      borrowReserveAddress &&
      (borrowAction === 'withdraw' || borrowAction === 'repay')
    ) {
      return (
        <BorrowWithdrawComponent
          accountId={accountId}
          networkId={networkId}
          providerName=""
          balance="0"
          price="0"
          isDisabled
          borrowMarketAddress={borrowMarketAddress}
          borrowReserveAddress={borrowReserveAddress}
          beforeFooter={beforeFooter}
          tokenImageUri={fallbackTokenImageUri}
          tokenSymbol={tokenInfo?.token.symbol}
          actionLabel={borrowActionLabel}
        />
      );
    }
    return (
      <UniversalWithdraw
        accountAddress=""
        price="0"
        balance="0"
        accountId={accountId}
        networkId={networkId}
        providerName=""
        onConfirm={async () => {}}
        protocolVault=""
        isDisabled
        isInModalContext={isInModalContext}
        beforeFooter={beforeFooter}
        tokenImageUri={fallbackTokenImageUri}
        tokenSymbol={tokenInfo?.token.symbol}
      />
    );
  }

  return (
    <>
      {isBorrowWithdraw ? (
        <BorrowWithdrawComponent
          price={tokenInfo?.price ? String(tokenInfo.price) : '0'}
          decimals={protocolInfo?.protocolInputDecimals ?? token?.decimals}
          balance={protocolInfo?.activeBalance || '0'}
          accountId={accountId}
          networkId={networkId}
          tokenSymbol={symbol || ''}
          tokenImageUri={token?.logoURI || fallbackTokenImageUri}
          providerName={providerName}
          onConfirm={onBorrowConfirm}
          tokenInfo={tokenInfo}
          isDisabled={isDisabled}
          borrowMarketAddress={
            borrowApiCtx.borrowApiParams?.marketAddress ?? ''
          }
          borrowReserveAddress={
            borrowApiCtx.borrowApiParams?.reserveAddress ?? ''
          }
          beforeFooter={beforeFooter}
          showApyDetail={showApyDetail}
          actionLabel={borrowActionLabel}
        />
      ) : (
        <UniversalWithdraw
          accountAddress={protocolInfo?.earnAccount?.accountAddress || ''}
          price={tokenInfo?.price ? String(tokenInfo.price) : '0'}
          decimals={protocolInfo?.protocolInputDecimals ?? token?.decimals}
          balance={protocolInfo?.activeBalance || '0'}
          accountId={accountId}
          networkId={networkId}
          tokenSymbol={symbol || ''}
          tokenImageUri={token?.logoURI || fallbackTokenImageUri}
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
          beforeFooter={beforeFooter}
          showApyDetail={showApyDetail}
          isInModalContext={isInModalContext}
        />
      )}
    </>
  );
};
