import type { ReactElement } from 'react';
import { useCallback, useMemo, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { UniversalBorrowRepay } from '@onekeyhq/kit/src/views/Borrow/components/UniversalBorrowRepay';
import { UniversalBorrowWithdraw } from '@onekeyhq/kit/src/views/Borrow/components/UniversalBorrowWithdraw';
import {
  useUniversalBorrowRepay,
  useUniversalBorrowWithdraw,
} from '@onekeyhq/kit/src/views/Borrow/hooks/useUniversalBorrowHooks';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import {
  type EBorrowActionsEnum,
  EEarnLabels,
  type IBorrowAsset,
  type IBorrowAssetsList,
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

  // State for selected asset from popover (override the default)
  const [selectedAsset, setSelectedAsset] = useState<IBorrowAsset | null>(null);

  // Fetch selectable assets for Withdraw/Repay popover
  const { result: assetsList, isLoading: assetsListLoading } =
    usePromiseResult<IBorrowAssetsList>(
      async () => {
        if (
          !accountId ||
          !networkId ||
          !providerName ||
          !borrowMarketAddress ||
          !useBorrowApi ||
          (borrowAction !== 'withdraw' && borrowAction !== 'repay')
        ) {
          return { assets: [] };
        }
        return backgroundApiProxy.serviceStaking.getBorrowAssetsList({
          accountId,
          networkId,
          provider: providerName,
          marketAddress: borrowMarketAddress,
          action: borrowAction as EBorrowActionsEnum,
        });
      },
      [
        accountId,
        networkId,
        providerName,
        borrowMarketAddress,
        useBorrowApi,
        borrowAction,
      ],
      {
        initResult: { assets: [] },
        watchLoading: true,
      },
    );

  // Determine the effective reserve address (selected or default)
  const effectiveReserveAddress = useMemo(
    () => selectedAsset?.reserveAddress ?? borrowReserveAddress,
    [selectedAsset, borrowReserveAddress],
  );

  // Handle token selection from popover
  const handleTokenSelect = useCallback((item: IBorrowAsset) => {
    setSelectedAsset(item);
  }, []);

  const borrowApiCtx = useBorrowApiParams({
    useBorrowApi,
    networkId,
    provider: providerName,
    marketAddress: borrowMarketAddress,
    reserveAddress: effectiveReserveAddress,
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

  // Determine the effective token info (from selected asset or default)
  const effectiveTokenSymbol = useMemo(
    () => selectedAsset?.token?.symbol ?? token?.symbol ?? '',
    [selectedAsset, token],
  );
  const effectiveTokenImageUri = useMemo(
    () =>
      selectedAsset?.token?.logoURI ?? token?.logoURI ?? fallbackTokenImageUri,
    [selectedAsset, token, fallbackTokenImageUri],
  );
  const effectiveDecimals = useMemo(
    () =>
      selectedAsset?.token?.decimals ??
      protocolInfo?.protocolInputDecimals ??
      token?.decimals,
    [selectedAsset, protocolInfo?.protocolInputDecimals, token?.decimals],
  );

  // Determine the effective balance (from selected asset or default)
  const effectiveBalance = useMemo(() => {
    if (selectedAsset) {
      if (borrowAction === 'repay') {
        // For repay, use borrowed balance
        return selectedAsset.borrowed?.title?.text ?? '0';
      }
      // For withdraw, use supplied balance
      return selectedAsset.supplied?.title?.text ?? '0';
    }
    return protocolInfo?.activeBalance ?? '0';
  }, [selectedAsset, borrowAction, protocolInfo?.activeBalance]);
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

  // Build token for staking info (use selected asset or default)
  const effectiveToken = useMemo<IToken | undefined>(() => {
    if (selectedAsset) {
      return {
        ...selectedAsset.token,
        isNative: false,
        networkId,
      } as IToken;
    }
    return token;
  }, [selectedAsset, token, networkId]);

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
      if (!borrowApiCtx.isBorrow) return;

      const { provider, marketAddress, action } = borrowApiCtx.borrowApiParams;
      // Use effective reserve address (from selected asset or default)
      const reserveAddress = effectiveReserveAddress ?? '';

      if (action === 'repay') {
        await handleBorrowRepay({
          amount,
          provider,
          marketAddress,
          reserveAddress,
          repayAll,
          stakingInfo: effectiveToken
            ? {
                label: EEarnLabels.Repay,
                protocol: earnUtils.getEarnProviderName({
                  providerName: provider,
                }),
                protocolLogoURI: protocolInfo?.providerDetail.logoURI,
                send: { token: effectiveToken, amount },
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
        stakingInfo: effectiveToken
          ? {
              label: EEarnLabels.Withdraw,
              protocol: earnUtils.getEarnProviderName({
                providerName: provider,
              }),
              protocolLogoURI: protocolInfo?.providerDetail.logoURI,
              receive: { token: effectiveToken, amount },
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
      effectiveReserveAddress,
      effectiveToken,
      handleBorrowRepay,
      handleBorrowWithdraw,
      onSuccess,
      protocolInfo?.providerDetail.logoURI,
      protocolInfo?.stakeTag,
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
          decimals={effectiveDecimals}
          balance={effectiveBalance}
          accountId={accountId}
          networkId={networkId}
          tokenSymbol={effectiveTokenSymbol}
          tokenImageUri={effectiveTokenImageUri}
          providerName={providerName}
          onConfirm={onBorrowConfirm}
          tokenInfo={tokenInfo}
          isDisabled={isDisabled}
          borrowMarketAddress={
            borrowApiCtx.borrowApiParams?.marketAddress ?? ''
          }
          borrowReserveAddress={effectiveReserveAddress ?? ''}
          beforeFooter={beforeFooter}
          showApyDetail={showApyDetail}
          actionLabel={borrowActionLabel}
          selectableAssets={assetsList.assets}
          selectableAssetsLoading={assetsListLoading}
          onTokenSelect={handleTokenSelect}
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
