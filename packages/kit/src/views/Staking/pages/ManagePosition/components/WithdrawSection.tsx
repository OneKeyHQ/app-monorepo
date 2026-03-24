import type { ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  BorrowRepayPosition,
  type IRepayWithCollateralConfirmParams,
} from '@onekeyhq/kit/src/views/Borrow/components/BorrowRepayPosition';
import { ManagePosition } from '@onekeyhq/kit/src/views/Borrow/components/ManagePosition';
import {
  useUniversalBorrowRepay,
  useUniversalBorrowRepayWithCollateral,
  useUniversalBorrowWithdraw,
} from '@onekeyhq/kit/src/views/Borrow/hooks/useUniversalBorrowHooks';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EModalRoutes, EModalStakingRoutes } from '@onekeyhq/shared/src/routes';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import {
  EApproveType,
  type EBorrowActionsEnum,
  EEarnLabels,
  type IBorrowAsset,
  type IBorrowAssetsList,
  type IEarnAssetsList,
  type IEarnTokenInfo,
  type IEarnTokenItem,
  type IProtocolInfo,
} from '@onekeyhq/shared/types/staking';
import type { IToken } from '@onekeyhq/shared/types/token';

import { UniversalWithdraw } from '../../../components/UniversalWithdraw';
import { useBorrowApiParams } from '../../../hooks/useBorrowApiParams';
import { useIsPendleProvider } from '../../../hooks/useIsPendleProvider';
import { useUniversalWithdraw } from '../../../hooks/useUniversalHooks';
import {
  buildBorrowTag,
  normalizeStakeTokenAddress,
  resolveStakeTokenAddress,
} from '../../../utils/utils';

import type { IManagePageV2ReceiveInputConfig } from '../../../components/ManagePageV2ReceiveInput';

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
  defaultCollateralReserveAddress,
  borrowActionLabel,
  receiveInputConfig,
  pendleSlippage,
  isQuoteExpired,
  onQuoteReset,
  refreshKey,
  onQuoteRefreshingChange,
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
  defaultCollateralReserveAddress?: string;
  borrowActionLabel?: string;
  receiveInputConfig?: IManagePageV2ReceiveInputConfig;
  pendleSlippage?: number;
  isQuoteExpired?: boolean;
  onQuoteReset?: () => void;
  refreshKey?: number;
  onQuoteRefreshingChange?: (loading: boolean) => void;
}) => {
  const intl = useIntl();
  // Early return if no tokenInfo or protocolInfo
  // This happens when there's no account or no address
  const navigation = useAppNavigation();
  const hasRequiredData = tokenInfo && protocolInfo;
  const providerName = useMemo(
    () => protocolInfo?.provider ?? '',
    [protocolInfo?.provider],
  );
  const isPendleProvider = useIsPendleProvider(providerName);

  const approveSpenderAddress = useMemo(
    () =>
      isPendleProvider
        ? earnUtils.resolveEarnApproveSpenderAddress({
            providerName,
            protocolVault: protocolInfo?.vault,
            backendApproveTarget: protocolInfo?.approve?.approveTarget,
          })
        : '',
    [
      isPendleProvider,
      providerName,
      protocolInfo?.vault,
      protocolInfo?.approve?.approveTarget,
    ],
  );

  const token = useMemo(
    () => (tokenInfo?.token ? (tokenInfo.token as IToken) : undefined),
    [tokenInfo],
  );

  const { result: initialAllowanceResult } = usePromiseResult(
    async () => {
      if (
        !isPendleProvider ||
        !approveSpenderAddress ||
        !accountId ||
        !networkId ||
        token?.isNative
      ) {
        return undefined;
      }
      const { allowanceParsed } =
        await backgroundApiProxy.serviceStaking.fetchTokenAllowance({
          accountId,
          networkId,
          spenderAddress: earnUtils.resolveEarnAllowanceSpenderAddress({
            approveType: EApproveType.Legacy,
            approveSpenderAddress,
          }),
          tokenAddress: token?.address || '',
        });
      return { allowanceParsed };
    },
    [
      isPendleProvider,
      approveSpenderAddress,
      accountId,
      networkId,
      token?.isNative,
      token?.address,
    ],
    { watchLoading: true },
  );

  const approveTarget = useMemo(() => {
    if (!isPendleProvider || !approveSpenderAddress || !token) {
      return undefined;
    }
    return {
      accountId,
      networkId,
      spenderAddress: approveSpenderAddress,
      token,
    };
  }, [isPendleProvider, approveSpenderAddress, accountId, networkId, token]);
  const [selectedAsset, setSelectedAsset] = useState<IBorrowAsset | null>(null);
  const [selectedReceiveAsset, setSelectedReceiveAsset] = useState<
    IEarnTokenItem | undefined
  >(undefined);

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

  const { result: unstakeAssetsList } = usePromiseResult<
    IEarnAssetsList | undefined
  >(
    async () => {
      if (
        !hasRequiredData ||
        !isPendleProvider ||
        useBorrowApi ||
        !accountId ||
        !protocolInfo?.symbol
      ) {
        return undefined;
      }
      return backgroundApiProxy.serviceStaking.getEarnAssetsList({
        accountId,
        networkId,
        provider: providerName,
        symbol: protocolInfo.symbol,
        vault: protocolInfo.vault || undefined,
        action: 'unstake',
      });
    },
    [
      hasRequiredData,
      isPendleProvider,
      useBorrowApi,
      accountId,
      networkId,
      providerName,
      protocolInfo?.symbol,
      protocolInfo?.vault,
    ],
    {
      watchLoading: true,
    },
  );

  const selectableReceiveAssets = useMemo(() => {
    return unstakeAssetsList?.assets ?? [];
  }, [unstakeAssetsList?.assets]);

  useEffect(() => {
    if (!isPendleProvider || useBorrowApi) {
      setSelectedReceiveAsset(undefined);
      return;
    }

    if (!selectableReceiveAssets.length) {
      setSelectedReceiveAsset(undefined);
      return;
    }

    setSelectedReceiveAsset((prev) => {
      if (prev?.info) {
        const prevAddress = normalizeStakeTokenAddress({
          address: prev.info.address,
          isNative: prev.info.isNative,
        });
        const prevSymbol = prev.info.symbol?.toLowerCase() ?? '';
        const matchedPrev = selectableReceiveAssets.find((asset) => {
          const assetAddress = normalizeStakeTokenAddress({
            address: asset.info.address,
            isNative: asset.info.isNative,
          });
          return (
            assetAddress === prevAddress &&
            asset.info.symbol.toLowerCase() === prevSymbol
          );
        });
        if (matchedPrev) {
          return matchedPrev;
        }
      }

      return selectableReceiveAssets[0];
    });
  }, [isPendleProvider, selectableReceiveAssets, useBorrowApi]);

  const handleOpenReceiveTokenSelector = useCallback(() => {
    if (!accountId || !protocolInfo?.symbol) return;
    const currentAddress = selectedReceiveAsset?.info?.isNative
      ? 'native'
      : selectedReceiveAsset?.info?.address;
    navigation.pushModal(EModalRoutes.StakingModal, {
      screen: EModalStakingRoutes.EarnTokenSelect,
      params: {
        networkId,
        accountId,
        provider: providerName,
        symbol: protocolInfo.symbol,
        vault: protocolInfo.vault || undefined,
        action: 'unstake' as const,
        currentTokenAddress: currentAddress,
        onSelect: (item: IEarnTokenItem) => {
          setSelectedReceiveAsset(item);
        },
      },
    });
  }, [
    accountId,
    networkId,
    providerName,
    protocolInfo?.symbol,
    protocolInfo?.vault,
    selectedReceiveAsset?.info,
    navigation,
  ]);

  const receiveTokenSelectorTriggerProps = useMemo(() => {
    if (!isPendleProvider || useBorrowApi || !selectableReceiveAssets.length) {
      return undefined;
    }

    return {
      disabled: selectableReceiveAssets.length <= 1,
      onPress:
        selectableReceiveAssets.length > 1
          ? handleOpenReceiveTokenSelector
          : undefined,
    };
  }, [
    isPendleProvider,
    useBorrowApi,
    selectableReceiveAssets.length,
    handleOpenReceiveTokenSelector,
  ]);

  const effectiveReceiveInputConfig = useMemo<
    IManagePageV2ReceiveInputConfig | undefined
  >(() => {
    if (!isPendleProvider || useBorrowApi) {
      return receiveInputConfig;
    }

    const selectedToken = selectedReceiveAsset?.info;
    const selectedTokenAddress = resolveStakeTokenAddress({
      address: selectedToken?.address,
      isNative: selectedToken?.isNative,
    });
    const hasSelectedToken = !!selectedToken;

    return {
      ...receiveInputConfig,
      enabled: (receiveInputConfig?.enabled ?? false) || hasSelectedToken,
      tokenImageUri:
        selectedToken?.logoURI ?? receiveInputConfig?.tokenImageUri,
      tokenSymbol: selectedToken?.symbol ?? receiveInputConfig?.tokenSymbol,
      tokenAddress: hasSelectedToken
        ? selectedTokenAddress
        : (receiveInputConfig?.tokenAddress ?? ''),
      balance:
        selectedReceiveAsset?.balanceParsed ?? receiveInputConfig?.balance,
      price: selectedReceiveAsset?.price ?? receiveInputConfig?.price,
      tokenSelectorTriggerProps: receiveTokenSelectorTriggerProps,
    };
  }, [
    isPendleProvider,
    useBorrowApi,
    receiveInputConfig,
    selectedReceiveAsset?.balanceParsed,
    selectedReceiveAsset?.price,
    selectedReceiveAsset?.info,
    receiveTokenSelectorTriggerProps,
  ]);

  const selectedReceiveTokenAddress = useMemo(() => {
    return effectiveReceiveInputConfig?.tokenAddress ?? '';
  }, [effectiveReceiveInputConfig?.tokenAddress]);

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

  // Determine the effective max balance for repay (wallet balance for max button)
  const effectiveMaxBalance = useMemo(() => {
    if (borrowAction !== 'repay') {
      return undefined;
    }
    // For selected asset, maxBalance is not available, use undefined
    if (selectedAsset) {
      return undefined;
    }
    return protocolInfo?.maxRepayBalance;
  }, [borrowAction, selectedAsset, protocolInfo?.maxRepayBalance]);

  const withdrawRequestSymbol = useMemo(
    () => protocolInfo?.symbol || token?.symbol || '',
    [protocolInfo?.symbol, token?.symbol],
  );
  const vault = useMemo(() => protocolInfo?.vault || '', [protocolInfo?.vault]);
  const handleWithdraw = useUniversalWithdraw({ accountId, networkId });
  const withdrawAbortRef = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      withdrawAbortRef.current?.abort();
    },
    [],
  );
  const handleBorrowWithdraw = useUniversalBorrowWithdraw({
    accountId,
    networkId,
  });
  const handleBorrowRepay = useUniversalBorrowRepay({ accountId, networkId });
  const handleBorrowRepayWithCollateral = useUniversalBorrowRepayWithCollateral(
    {
      accountId,
      networkId,
    },
  );

  const onConfirm = useCallback(
    async ({
      amount,
      withdrawAll,
      effectiveApy,
      useEthenaCooldown,
      resumeEthenaCooldownUnstake,
      onStepChange,
      onEthenaCooldownUnstakeReady,
    }: {
      amount: string;
      withdrawAll: boolean;
      effectiveApy?: string | number;
      useEthenaCooldown?: boolean;
      resumeEthenaCooldownUnstake?: boolean;
      onStepChange?: (step: number) => void;
      onEthenaCooldownUnstakeReady?: () => void;
    }) => {
      if (!hasRequiredData) return;

      if (borrowApiCtx.isBorrow) return;

      withdrawAbortRef.current?.abort();
      const abortController = new AbortController();
      withdrawAbortRef.current = abortController;

      await handleWithdraw({
        amount,
        // identity,
        protocolVault: earnUtils.isVaultBasedProvider({
          providerName,
        })
          ? vault
          : undefined,
        symbol: withdrawRequestSymbol,
        provider: providerName,
        inputTokenAddress: tokenInfo?.token?.isNative
          ? ''
          : (tokenInfo?.token?.address ?? ''),
        outputTokenAddress: selectedReceiveTokenAddress,
        slippage: pendleSlippage,
        effectiveApy,
        useEthenaCooldown,
        resumeEthenaCooldownUnstake,
        onStepChange,
        onEthenaCooldownUnstakeReady,
        signal: abortController.signal,
        stakingInfo: {
          label: isPendleProvider ? EEarnLabels.Sell : EEarnLabels.Withdraw,
          protocol: earnUtils.getEarnProviderName({
            providerName,
          }),
          protocolLogoURI: protocolInfo?.providerDetail.logoURI,
          tags: [protocolInfo?.stakeTag || ''],
          send: isPendleProvider && token ? { token, amount } : undefined,
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
      withdrawRequestSymbol,
      tokenInfo?.token?.address,
      tokenInfo?.token?.isNative,
      selectedReceiveTokenAddress,
      borrowApiCtx.isBorrow,
      pendleSlippage,
      isPendleProvider,
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

      // Build tags array with both new borrow tag and legacy stakeTag for backward compatibility
      const buildTags = (actionType: 'withdraw' | 'repay'): string[] => {
        const tags: string[] = [
          EEarnLabels.Borrow,
          buildBorrowTag({ provider, action: actionType }),
        ];
        // Keep legacy stakeTag for backward compatibility
        if (protocolInfo?.stakeTag) {
          tags.push(protocolInfo.stakeTag);
        }
        return tags;
      };

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
                tags: buildTags('repay'),
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
              tags: buildTags('withdraw'),
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

  // Fetch fresh collateral positions from API instead of using stale props
  const { result: freshBorrowReserves, isLoading: collateralLoading } =
    usePromiseResult(
      async () => {
        if (
          !useBorrowApi ||
          !borrowMarketAddress ||
          !accountId ||
          !providerName ||
          borrowApiCtx.borrowApiParams?.action !== 'repay'
        ) {
          return undefined;
        }
        return backgroundApiProxy.serviceStaking.getBorrowReserves({
          provider: providerName,
          networkId,
          marketAddress: borrowMarketAddress,
          accountId,
        });
      },
      [
        useBorrowApi,
        borrowMarketAddress,
        accountId,
        networkId,
        providerName,
        borrowApiCtx.borrowApiParams?.action,
      ],
      { watchLoading: true },
    );

  const collateralAssets = useMemo(() => {
    const suppliedAssets = freshBorrowReserves?.supplied?.assets ?? [];
    return suppliedAssets
      .filter((item) => item.canBeCollateral)
      .map((item) => ({
        reserveAddress: item.reserveAddress,
        token: item.token,
        supplied: {
          title: item.suppliedAmount.title,
          description: item.suppliedAmount.description,
        },
      }));
  }, [freshBorrowReserves?.supplied?.assets]);

  const onBorrowRepayWithCollateralConfirm = useCallback(
    async ({
      amount,
      collateralReserveAddress,
      repayAll,
      slippageBps,
      routeKey,
      collateralAmount,
      collateralAsset,
    }: IRepayWithCollateralConfirmParams) => {
      if (!borrowApiCtx.isBorrow) {
        return;
      }

      const { provider, marketAddress } = borrowApiCtx.borrowApiParams;
      const reserveAddress = effectiveReserveAddress ?? '';

      const tags: string[] = [
        EEarnLabels.Borrow,
        buildBorrowTag({ provider, action: 'repay' }),
      ];
      if (protocolInfo?.stakeTag) {
        tags.push(protocolInfo.stakeTag);
      }

      await handleBorrowRepayWithCollateral({
        amount,
        provider,
        marketAddress,
        reserveAddress,
        collateralReserveAddress,
        repayAll,
        slippageBps,
        routeKey,
        stakingInfo: {
          label: EEarnLabels.Repay,
          protocol: earnUtils.getEarnProviderName({
            providerName: provider,
          }),
          protocolLogoURI: protocolInfo?.providerDetail.logoURI,
          send: {
            token: {
              ...collateralAsset.token,
              isNative: false,
              networkId,
            } as IToken,
            amount: collateralAmount || '0',
          },
          tags,
        },
        onSuccess: () => {
          onSuccess?.();
        },
      });
    },
    [
      borrowApiCtx,
      effectiveReserveAddress,
      handleBorrowRepayWithCollateral,
      networkId,
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
        <ManagePosition
          accountId={accountId}
          networkId={networkId}
          providerName=""
          action={borrowAction}
          balance="0"
          price="0"
          isDisabled
          borrowMarketAddress={borrowMarketAddress}
          borrowReserveAddress={borrowReserveAddress}
          beforeFooter={beforeFooter}
          tokenImageUri={fallbackTokenImageUri}
          tokenSymbol={tokenInfo?.token.symbol}
          actionLabel={borrowActionLabel}
          isInModalContext={isInModalContext}
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

  let borrowWithdrawContent: ReactElement | null = null;

  if (isBorrowWithdraw) {
    if (borrowApiCtx.borrowApiParams.action === 'repay') {
      borrowWithdrawContent = (
        <BorrowRepayPosition
          accountId={accountId}
          networkId={networkId}
          providerName={providerName}
          price={tokenInfo?.price ? String(tokenInfo.price) : '0'}
          decimals={effectiveDecimals}
          balance={effectiveBalance}
          maxBalance={effectiveMaxBalance}
          tokenSymbol={effectiveTokenSymbol}
          tokenImageUri={effectiveTokenImageUri}
          onWalletConfirm={onBorrowConfirm}
          onRepayWithCollateralConfirm={onBorrowRepayWithCollateralConfirm}
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
          isInModalContext={isInModalContext}
          collateralAssets={collateralAssets}
          collateralLoading={!!collateralLoading}
          defaultCollateralReserveAddress={defaultCollateralReserveAddress}
          debtBalance={
            protocolInfo?.debtBalance !== undefined
              ? (selectedAsset?.borrowed?.title?.text ??
                protocolInfo.debtBalance)
              : undefined
          }
        />
      );
    } else {
      borrowWithdrawContent = (
        <ManagePosition
          accountId={accountId}
          networkId={networkId}
          providerName={providerName}
          action={borrowApiCtx.borrowApiParams.action as 'withdraw' | 'repay'}
          price={tokenInfo?.price ? String(tokenInfo.price) : '0'}
          decimals={effectiveDecimals}
          balance={effectiveBalance}
          maxBalance={effectiveMaxBalance}
          tokenSymbol={effectiveTokenSymbol}
          tokenImageUri={effectiveTokenImageUri}
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
          isInModalContext={isInModalContext}
        />
      );
    }
  }

  return (
    <>
      {isBorrowWithdraw ? (
        borrowWithdrawContent
      ) : (
        <UniversalWithdraw
          accountAddress={protocolInfo?.earnAccount?.accountAddress || ''}
          price={tokenInfo?.price ? String(tokenInfo.price) : '0'}
          decimals={protocolInfo?.protocolInputDecimals ?? token?.decimals}
          balance={protocolInfo?.activeBalance || '0'}
          accountId={accountId}
          networkId={networkId}
          tokenSymbol={effectiveTokenSymbol}
          requestSymbol={withdrawRequestSymbol}
          tokenImageUri={token?.logoURI || fallbackTokenImageUri}
          providerLogo={protocolInfo?.providerDetail.logoURI}
          providerName={providerName}
          onConfirm={onConfirm}
          inputTitle={
            isPendleProvider
              ? intl.formatMessage({ id: ETranslations.content__amount })
              : undefined
          }
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
          receiveInputConfig={effectiveReceiveInputConfig}
          transactionInputTokenAddress={
            tokenInfo?.token?.isNative ? '' : (tokenInfo?.token?.address ?? '')
          }
          transactionOutputTokenAddress={selectedReceiveTokenAddress}
          isQuoteExpired={isQuoteExpired}
          onQuoteReset={onQuoteReset}
          refreshKey={refreshKey}
          onQuoteRefreshingChange={onQuoteRefreshingChange}
          approveTarget={approveTarget}
          currentAllowance={initialAllowanceResult?.allowanceParsed}
          pendleSlippage={pendleSlippage}
        />
      )}
    </>
  );
};
