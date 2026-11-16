import type { ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import { Alert } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  BorrowRepayPosition,
  type IRepayWithCollateralConfirmParams,
} from '@onekeyhq/kit/src/views/Borrow/components/BorrowRepayPosition';
import {
  buildAaveNativeGatewayReceiveToken,
  buildBorrowTokenFromAsset,
  filterUnsupportedAaveNativeReserveAssets,
  getBorrowAssetByReserveAddress,
  getBorrowBalanceAmount,
  getBorrowRepayDebtBalance,
  getBorrowRepayMaxInputBalance,
  getBorrowRepayWalletBalance,
  getValidBorrowSelectedAsset,
  hasPositiveBorrowBalance,
  isUnsupportedAaveNativeReserve,
  resolveBorrowTokenApproveSpenderAddress,
  shouldUseAaveNativeGateway,
} from '@onekeyhq/kit/src/views/Borrow/components/borrowRepayPosition.utils';
import { ManagePosition } from '@onekeyhq/kit/src/views/Borrow/components/ManagePosition';
import { resolveBorrowRepayAllBalance } from '@onekeyhq/kit/src/views/Borrow/components/ManagePosition/utils';
import {
  useUniversalBorrowRepay,
  useUniversalBorrowRepayWithCollateral,
  useUniversalBorrowWithdraw,
} from '@onekeyhq/kit/src/views/Borrow/hooks/useUniversalBorrowHooks';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EModalRoutes, EModalStakingRoutes } from '@onekeyhq/shared/src/routes';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import { isAllowedEtherFiAsset } from '@onekeyhq/shared/src/utils/etherFiVaults';
import {
  EApproveType,
  type EBorrowActionsEnum,
  EEarnLabels,
  type IBorrowAsset,
  type IBorrowAssetsList,
  type IEarnTokenInfo,
  type IEarnTokenItem,
  type IEarnUtmParams,
  type IEarnWithdrawType,
  type IProtocolInfo,
} from '@onekeyhq/shared/types/staking';
import type { IToken } from '@onekeyhq/shared/types/token';

import { UniversalWithdraw } from '../../../components/UniversalWithdraw';
import { useBorrowApiParams } from '../../../hooks/useBorrowApiParams';
import { useEtherFiWithdrawApproval } from '../../../hooks/useEtherFiWithdrawApproval';
import { useIsPendleProvider } from '../../../hooks/useIsPendleProvider';
import { useUniversalWithdraw } from '../../../hooks/useUniversalHooks';
import {
  buildBorrowTag,
  normalizeStakeTokenAddress,
  resolveStakeTokenAddress,
} from '../../../utils/utils';
import { resolveWithdrawShareToken } from '../../Withdraw/withdrawShareTokenUtils';
import { buildManagePageApproveInfo } from '../hooks/useManagePage.utils';

import {
  type IScopedBorrowManagePageResult,
  buildSelectedBorrowManagePageRequestKey,
  resolveBorrowManageApproveType,
  resolveBorrowManageTokenInfo,
  resolveScopedBorrowManagePageResult,
  settleScopedBorrowManagePageRequest,
} from './WithdrawSection.utils';

import type { IManagePositionFooterAction } from './ManagePositionContent';
import type { IManagePageV2ReceiveInputConfig } from '../../../components/ManagePageV2ReceiveInput';

type IBorrowSelectedAssetState = {
  asset: IBorrowAsset;
  scopeKey: string;
};

export const WithdrawSection = ({
  accountId,
  networkId,
  tokenInfo,
  protocolInfo,
  isDisabled,
  onSuccess,
  beforeFooter,
  footerActionOverride,
  showApyDetail,
  isInModalContext,
  fallbackTokenImageUri,
  utm,
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
  repayWithCollateralSetupReadyProgressKey,
  onRepayWithCollateralSetupReadyProgressKeyChange,
}: {
  accountId: string;
  networkId: string;
  tokenInfo?: IEarnTokenInfo;
  protocolInfo?: IProtocolInfo;
  isDisabled?: boolean;
  onSuccess?: () => void;
  beforeFooter?: ReactElement | null;
  footerActionOverride?: IManagePositionFooterAction;
  showApyDetail?: boolean;
  isInModalContext?: boolean;
  fallbackTokenImageUri?: string;
  utm?: IEarnUtmParams;
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
  repayWithCollateralSetupReadyProgressKey?: string;
  onRepayWithCollateralSetupReadyProgressKeyChange?: (
    progressKey: string,
  ) => void;
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
  const isEtherFiProvider = earnUtils.isEtherFiProvider({ providerName });
  const etherFiWithdrawal = useEtherFiWithdrawApproval({
    enabled: isEtherFiProvider && !useBorrowApi,
    accountId,
    networkId,
    provider: providerName,
    symbol: protocolInfo?.symbol,
    vault: protocolInfo?.vault,
  });
  const effectiveProtocolInfo = useMemo(
    () =>
      isEtherFiProvider && protocolInfo
        ? { ...protocolInfo, withdrawApprove: etherFiWithdrawal.approval }
        : protocolInfo,
    [etherFiWithdrawal.approval, isEtherFiProvider, protocolInfo],
  );
  const shareToken = useMemo(
    () =>
      resolveWithdrawShareToken({
        accountId,
        networkId,
        provider: providerName,
        protocolInfo: effectiveProtocolInfo,
        tokenInfo,
      }),
    [accountId, effectiveProtocolInfo, networkId, providerName, tokenInfo],
  );
  const effectiveEarnTokenInfo = isEtherFiProvider
    ? shareToken.tokenInfo
    : tokenInfo;
  const hasWithdrawApprove = Boolean(
    effectiveProtocolInfo?.withdrawApprove?.approveTarget &&
    effectiveProtocolInfo.withdrawApprove.tokenAddress,
  );
  const borrowProviderDisplayName = useMemo(() => {
    if (
      protocolInfo?.providerDetail.name &&
      protocolInfo.providerDetail.name !== providerName
    ) {
      return protocolInfo.providerDetail.name;
    }
    return earnUtils.getEarnProviderName({
      providerName,
    });
  }, [protocolInfo?.providerDetail.name, providerName]);

  const token = useMemo(
    () =>
      effectiveEarnTokenInfo?.token
        ? (effectiveEarnTokenInfo.token as IToken)
        : undefined,
    [effectiveEarnTokenInfo],
  );
  const borrowAssetSelectionScopeKey = useMemo(
    () =>
      [
        useBorrowApi ? 'borrow' : 'earn',
        accountId,
        networkId,
        providerName,
        borrowMarketAddress,
        borrowAction,
        borrowReserveAddress,
      ].join('|'),
    [
      accountId,
      borrowAction,
      borrowMarketAddress,
      borrowReserveAddress,
      networkId,
      providerName,
      useBorrowApi,
    ],
  );
  const [selectedAssetState, setSelectedAssetState] =
    useState<IBorrowSelectedAssetState | null>(null);
  const selectedAsset = useMemo(
    () =>
      selectedAssetState?.scopeKey === borrowAssetSelectionScopeKey
        ? selectedAssetState.asset
        : null,
    [borrowAssetSelectionScopeKey, selectedAssetState],
  );
  const selectedAssetReserveAddress = selectedAsset?.reserveAddress;
  const selectedBorrowManagePageType = useMemo(() => {
    if (
      selectedAssetReserveAddress === undefined ||
      !useBorrowApi ||
      (borrowAction !== 'withdraw' && borrowAction !== 'repay')
    ) {
      return undefined;
    }

    return borrowAction;
  }, [borrowAction, selectedAssetReserveAddress, useBorrowApi]);
  const selectedBorrowManagePageRequestKey = useMemo(
    () =>
      buildSelectedBorrowManagePageRequestKey({
        accountId,
        networkId,
        provider: providerName,
        marketAddress: borrowMarketAddress,
        reserveAddress: selectedAssetReserveAddress,
        action: selectedBorrowManagePageType,
      }),
    [
      accountId,
      borrowMarketAddress,
      networkId,
      providerName,
      selectedAssetReserveAddress,
      selectedBorrowManagePageType,
    ],
  );
  const {
    result: selectedBorrowManagePageResult,
    isLoading: selectedBorrowManagePageRequestLoading,
  } = usePromiseResult<IScopedBorrowManagePageResult | undefined>(
    async () => {
      if (
        !selectedBorrowManagePageRequestKey ||
        !selectedBorrowManagePageType ||
        selectedAssetReserveAddress === undefined ||
        !accountId ||
        !networkId ||
        !providerName ||
        !borrowMarketAddress ||
        !useBorrowApi
      ) {
        return undefined;
      }
      return settleScopedBorrowManagePageRequest({
        requestKey: selectedBorrowManagePageRequestKey,
        request: () =>
          backgroundApiProxy.serviceStaking.getBorrowManagePage({
            accountId,
            networkId,
            provider: providerName,
            marketAddress: borrowMarketAddress,
            reserveAddress: selectedAssetReserveAddress,
            type: selectedBorrowManagePageType,
          }),
      });
    },
    [
      accountId,
      borrowMarketAddress,
      networkId,
      providerName,
      selectedAssetReserveAddress,
      selectedBorrowManagePageType,
      selectedBorrowManagePageRequestKey,
      useBorrowApi,
    ],
    {
      watchLoading: true,
      undefinedResultIfReRun: true,
    },
  );
  const {
    data: selectedBorrowManagePageData,
    isPending: selectedBorrowManagePageLoading,
  } = resolveScopedBorrowManagePageResult({
    requestKey: selectedBorrowManagePageRequestKey,
    result: selectedBorrowManagePageResult,
    isLoading: selectedBorrowManagePageRequestLoading,
  });
  const selectedBorrowManagePageApproveInfo = useMemo(
    () =>
      selectedBorrowManagePageData
        ? buildManagePageApproveInfo(selectedBorrowManagePageData)
        : undefined,
    [selectedBorrowManagePageData],
  );
  const effectiveBorrowTokenInfo = useMemo(
    () =>
      resolveBorrowManageTokenInfo({
        action: borrowAction,
        hasSelectedAsset: !!selectedAsset,
        selectedManagePageData: selectedBorrowManagePageData,
        fallbackTokenInfo: tokenInfo,
      }),
    [borrowAction, selectedAsset, selectedBorrowManagePageData, tokenInfo],
  );
  const effectiveBorrowApproveInfo = useMemo(() => {
    if (selectedBorrowManagePageType) {
      return selectedBorrowManagePageApproveInfo;
    }
    return protocolInfo?.approve;
  }, [
    protocolInfo?.approve,
    selectedBorrowManagePageApproveInfo,
    selectedBorrowManagePageType,
  ]);
  const borrowTokenApproveNeeded =
    !!useBorrowApi &&
    (borrowAction === 'repay' ||
      (borrowAction === 'withdraw' &&
        !!effectiveBorrowApproveInfo?.approveTarget));
  const effectiveToken = useMemo<IToken | undefined>(
    () =>
      selectedAsset
        ? buildBorrowTokenFromAsset({ asset: selectedAsset, networkId })
        : token,
    [networkId, selectedAsset, token],
  );
  const approveAssetFallbackBaseToken = effectiveToken ?? token;
  const fallbackApproveAssetToken = useMemo<IToken | undefined>(() => {
    if (
      !effectiveBorrowApproveInfo?.approveAsset ||
      !approveAssetFallbackBaseToken
    ) {
      return undefined;
    }
    return {
      ...approveAssetFallbackBaseToken,
      address: effectiveBorrowApproveInfo.approveAsset,
      isNative: false,
      networkId,
    };
  }, [
    approveAssetFallbackBaseToken,
    effectiveBorrowApproveInfo?.approveAsset,
    networkId,
  ]);
  const { result: fetchedApproveAssetToken } = usePromiseResult<
    IToken | undefined
  >(
    async () => {
      if (
        !effectiveBorrowApproveInfo?.approveAsset ||
        !accountId ||
        !networkId
      ) {
        return undefined;
      }
      const approveAssetToken = await backgroundApiProxy.serviceToken.getToken({
        accountId,
        networkId,
        tokenIdOnNetwork: effectiveBorrowApproveInfo.approveAsset,
        tokenInfoOnly: true,
      });
      return approveAssetToken ?? undefined;
    },
    [accountId, networkId, effectiveBorrowApproveInfo?.approveAsset],
    {
      undefinedResultIfReRun: true,
    },
  );
  const approveAssetToken =
    fetchedApproveAssetToken ?? fallbackApproveAssetToken;
  const withdrawApproveToken = useMemo(() => {
    const withdrawApprove = effectiveProtocolInfo?.withdrawApprove;
    if (!withdrawApprove?.tokenAddress || !token) {
      return token;
    }
    if (isEtherFiProvider) return token;
    return {
      ...token,
      address: withdrawApprove.tokenAddress,
      isNative: false,
      ...(withdrawApprove.inputToken && {
        symbol: withdrawApprove.inputToken.symbol,
        displaySymbol: undefined,
        name: withdrawApprove.inputToken.symbol,
        logoURI: withdrawApprove.inputToken.logoURI ?? '',
        decimals: protocolInfo?.protocolInputDecimals ?? token.decimals,
      }),
    };
  }, [
    protocolInfo?.protocolInputDecimals,
    effectiveProtocolInfo?.withdrawApprove,
    isEtherFiProvider,
    token,
  ]);
  const approvalToken = useMemo(() => {
    if (borrowTokenApproveNeeded) {
      if (effectiveBorrowApproveInfo?.approveAsset) {
        return approveAssetToken;
      }
      return effectiveToken;
    }
    if (hasWithdrawApprove) {
      return withdrawApproveToken;
    }
    return token;
  }, [
    approveAssetToken,
    borrowTokenApproveNeeded,
    effectiveBorrowApproveInfo?.approveAsset,
    effectiveToken,
    hasWithdrawApprove,
    token,
    withdrawApproveToken,
  ]);
  const useApproveTarget =
    isPendleProvider || hasWithdrawApprove || borrowTokenApproveNeeded;

  const approveSpenderAddress = useMemo(() => {
    if (!useApproveTarget) {
      return '';
    }

    if (useBorrowApi) {
      return resolveBorrowTokenApproveSpenderAddress({
        providerName,
        marketAddress: borrowMarketAddress,
        backendApproveTarget: effectiveBorrowApproveInfo?.approveTarget,
        tokenIsNative: approvalToken?.isNative,
      });
    }

    if (hasWithdrawApprove) {
      return effectiveProtocolInfo?.withdrawApprove?.approveTarget ?? '';
    }

    return earnUtils.resolveEarnApproveSpenderAddress({
      providerName,
      protocolVault: protocolInfo?.vault,
      backendApproveTarget: effectiveBorrowApproveInfo?.approveTarget,
    });
  }, [
    approvalToken?.isNative,
    borrowMarketAddress,
    effectiveBorrowApproveInfo?.approveTarget,
    hasWithdrawApprove,
    effectiveProtocolInfo?.withdrawApprove?.approveTarget,
    useApproveTarget,
    useBorrowApi,
    providerName,
    protocolInfo?.vault,
  ]);
  const backendApproveType = hasWithdrawApprove
    ? EApproveType.Legacy
    : effectiveBorrowApproveInfo?.approveType;
  const effectiveApproveType = useMemo(() => {
    const resolvedApproveType = earnUtils.resolveEarnApproveType({
      providerName,
      networkId,
      tokenIsNative: approvalToken?.isNative,
      approveSpenderAddress,
      backendApproveType,
    });
    return resolveBorrowManageApproveType({
      isBorrowTokenApproval: !!useBorrowApi && borrowTokenApproveNeeded,
      approveType: resolvedApproveType,
    });
  }, [
    approvalToken?.isNative,
    approveSpenderAddress,
    backendApproveType,
    borrowTokenApproveNeeded,
    networkId,
    providerName,
    useBorrowApi,
  ]);

  const allowanceScopeKey = JSON.stringify([
    accountId,
    networkId,
    providerName,
    protocolInfo?.vault,
    effectiveApproveType,
    protocolInfo?.earnAccount?.accountAddress,
    approveSpenderAddress,
    approvalToken?.address,
  ]);
  const { result: initialAllowanceResult, run: retryAllowance } =
    usePromiseResult(
      async () => {
        if (
          !effectiveApproveType ||
          !approveSpenderAddress ||
          !accountId ||
          !networkId ||
          !approvalToken ||
          approvalToken?.isNative
        ) {
          return undefined;
        }
        // While a protocol switch is in flight (confirm button force-loading),
        // networkId is already the new chain but token/spender still come from
        // the previous protocol's stale data — skip to avoid a mismatched
        // allowance request. Re-runs automatically once fresh data lands.
        if (footerActionOverride?.loading) {
          return undefined;
        }
        try {
          const { allowanceParsed } =
            await backgroundApiProxy.serviceStaking.fetchTokenAllowance({
              accountId,
              networkId,
              expectedAccountAddress: isEtherFiProvider
                ? protocolInfo?.earnAccount?.accountAddress
                : undefined,
              spenderAddress: earnUtils.resolveEarnAllowanceSpenderAddress({
                networkId,
                approveType: effectiveApproveType,
                approveSpenderAddress,
              }),
              tokenAddress: approvalToken.address,
            });
          return { allowanceParsed, scopeKey: allowanceScopeKey, error: false };
        } catch (error) {
          if (!isEtherFiProvider) throw error;
          return {
            allowanceParsed: undefined,
            scopeKey: allowanceScopeKey,
            error: true,
          };
        }
      },
      [
        effectiveApproveType,
        approveSpenderAddress,
        accountId,
        networkId,
        approvalToken,
        footerActionOverride?.loading,
        allowanceScopeKey,
        protocolInfo?.earnAccount?.accountAddress,
        isEtherFiProvider,
      ],
      { watchLoading: true, undefinedResultIfReRun: true },
    );

  const approveTarget = useMemo(() => {
    if (!effectiveApproveType || !approveSpenderAddress || !approvalToken) {
      return undefined;
    }
    return {
      accountId,
      networkId,
      spenderAddress: approveSpenderAddress,
      token: approvalToken,
    };
  }, [
    accountId,
    approvalToken,
    approveSpenderAddress,
    effectiveApproveType,
    networkId,
  ]);
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
  const selectableBorrowAssets = useMemo(() => {
    const assets = filterUnsupportedAaveNativeReserveAssets({
      assets: assetsList.assets,
      networkId,
      providerName,
    });
    if (borrowAction === 'withdraw') {
      return assets.filter((asset) => hasPositiveBorrowBalance(asset.supplied));
    }
    if (borrowAction === 'repay') {
      return assets.filter((asset) => hasPositiveBorrowBalance(asset.borrowed));
    }
    return assets;
  }, [assetsList.assets, borrowAction, networkId, providerName]);
  useEffect(() => {
    setSelectedAssetState((prev) => {
      if (!prev) {
        return null;
      }
      if (prev.scopeKey !== borrowAssetSelectionScopeKey) {
        return null;
      }
      if (assetsListLoading) {
        return prev;
      }
      const matchedAsset = getValidBorrowSelectedAsset({
        assets: selectableBorrowAssets,
        selectedAsset: prev.asset,
      });
      if (!matchedAsset) {
        return null;
      }
      if (matchedAsset === prev.asset) {
        return prev;
      }
      return {
        ...prev,
        asset: matchedAsset,
      };
    });
  }, [assetsListLoading, borrowAssetSelectionScopeKey, selectableBorrowAssets]);

  const unstakeAssetsScopeKey = JSON.stringify([
    accountId,
    networkId,
    providerName,
    protocolInfo?.symbol,
    protocolInfo?.vault,
  ]);
  const { result: unstakeAssetsList, run: retryUnstakeAssets } =
    usePromiseResult(
      async () => {
        if (
          !hasRequiredData ||
          !(isPendleProvider || isEtherFiProvider) ||
          useBorrowApi ||
          !accountId ||
          !protocolInfo?.symbol
        ) {
          return undefined;
        }
        try {
          const response =
            await backgroundApiProxy.serviceStaking.getEarnAssetsList({
              accountId,
              networkId,
              provider: providerName,
              symbol: protocolInfo.symbol,
              vault: protocolInfo.vault || undefined,
              action: 'unstake',
            });
          const assets = isEtherFiProvider
            ? response.assets.filter((asset) =>
                isAllowedEtherFiAsset({
                  vault: protocolInfo?.vault,
                  networkId,
                  direction: 'unstake',
                  token: asset.info,
                }),
              )
            : response.assets;
          return {
            ...response,
            assets,
            scopeKey: unstakeAssetsScopeKey,
            error:
              isEtherFiProvider &&
              response.assets.length > 0 &&
              assets.length === 0,
          };
        } catch (error) {
          if (!isEtherFiProvider) throw error;
          return { assets: [], scopeKey: unstakeAssetsScopeKey, error: true };
        }
      },
      [
        hasRequiredData,
        isPendleProvider,
        isEtherFiProvider,
        useBorrowApi,
        accountId,
        networkId,
        providerName,
        protocolInfo?.symbol,
        protocolInfo?.vault,
        unstakeAssetsScopeKey,
      ],
      {
        watchLoading: true,
      },
    );

  const selectableReceiveAssets = useMemo(() => {
    if (
      isEtherFiProvider &&
      unstakeAssetsList?.scopeKey !== unstakeAssetsScopeKey
    ) {
      return [];
    }
    return unstakeAssetsList?.assets ?? [];
  }, [isEtherFiProvider, unstakeAssetsList, unstakeAssetsScopeKey]);
  const selectedReceiveAssetIsCurrent = Boolean(
    selectedReceiveAsset &&
    (!isEtherFiProvider ||
      isAllowedEtherFiAsset({
        vault: protocolInfo?.vault,
        networkId,
        direction: 'unstake',
        token: selectedReceiveAsset.info,
      })) &&
    selectableReceiveAssets.some(
      (asset) =>
        normalizeStakeTokenAddress(asset.info) ===
          normalizeStakeTokenAddress(selectedReceiveAsset.info) &&
        asset.info.symbol.toLowerCase() ===
          selectedReceiveAsset.info.symbol.toLowerCase(),
    ),
  );
  const etherFiWithdrawalReady = Boolean(
    etherFiWithdrawal.approval &&
    shareToken.ready &&
    protocolInfo?.earnAccount?.accountId === accountId &&
    protocolInfo?.earnAccount?.networkId === networkId &&
    Boolean(protocolInfo?.earnAccount?.accountAddress) &&
    selectedReceiveAssetIsCurrent &&
    initialAllowanceResult?.scopeKey === allowanceScopeKey &&
    initialAllowanceResult.allowanceParsed !== undefined,
  );

  useEffect(() => {
    if (!(isPendleProvider || isEtherFiProvider) || useBorrowApi) {
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
  }, [
    isEtherFiProvider,
    isPendleProvider,
    selectableReceiveAssets,
    useBorrowApi,
  ]);

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
          if (
            isEtherFiProvider &&
            !isAllowedEtherFiAsset({
              vault: protocolInfo?.vault,
              networkId,
              direction: 'unstake',
              token: item.info,
            })
          )
            return;
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
    isEtherFiProvider,
  ]);

  const receiveTokenSelectorTriggerProps = useMemo(() => {
    if (
      !(isPendleProvider || isEtherFiProvider) ||
      useBorrowApi ||
      !selectableReceiveAssets.length
    ) {
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
    isEtherFiProvider,
    useBorrowApi,
    selectableReceiveAssets.length,
    handleOpenReceiveTokenSelector,
  ]);

  const effectiveReceiveInputConfig = useMemo<
    IManagePageV2ReceiveInputConfig | undefined
  >(() => {
    if (!(isPendleProvider || isEtherFiProvider) || useBorrowApi) {
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
    isEtherFiProvider,
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
  const isSelectedBorrowAssetValid = useMemo(
    () =>
      !selectedAsset ||
      !!getValidBorrowSelectedAsset({
        assets: selectableBorrowAssets,
        selectedAsset,
      }),
    [selectableBorrowAssets, selectedAsset],
  );

  // Handle token selection from popover
  const handleTokenSelect = useCallback(
    (item: IBorrowAsset) => {
      setSelectedAssetState({
        asset: item,
        scopeKey: borrowAssetSelectionScopeKey,
      });
    },
    [borrowAssetSelectionScopeKey],
  );

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
  const unsupportedAaveNativeReserve = useMemo(
    () =>
      isUnsupportedAaveNativeReserve({
        networkId,
        providerName,
        reserveAddress: effectiveReserveAddress,
      }),
    [effectiveReserveAddress, networkId, providerName],
  );

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

  const selectedRepayManagePageData =
    borrowAction === 'repay' ? selectedBorrowManagePageData : undefined;
  const selectedRepayLoading =
    borrowAction === 'repay' ? selectedBorrowManagePageLoading : false;

  const currentRepayAsset = useMemo(() => {
    if (borrowAction !== 'repay' || selectedAsset) {
      return undefined;
    }

    return getBorrowAssetByReserveAddress({
      assets: selectableBorrowAssets,
      reserveAddress: borrowReserveAddress,
    });
  }, [
    borrowAction,
    borrowReserveAddress,
    selectableBorrowAssets,
    selectedAsset,
  ]);

  const repayDebtAsset = useMemo(
    () => selectedAsset ?? currentRepayAsset,
    [currentRepayAsset, selectedAsset],
  );

  const effectiveDebtBalance = useMemo(() => {
    if (borrowAction !== 'repay') {
      return undefined;
    }
    if (selectedAsset && selectedRepayManagePageData?.debt?.data?.balance) {
      return selectedRepayManagePageData.debt.data.balance;
    }
    return getBorrowRepayDebtBalance({
      selectedAsset: repayDebtAsset,
      fallbackDebtBalance: protocolInfo?.debtBalance,
    });
  }, [
    borrowAction,
    protocolInfo?.debtBalance,
    repayDebtAsset,
    selectedAsset,
    selectedRepayManagePageData?.debt?.data?.balance,
  ]);

  const selectedRepayWalletBalance = useMemo(() => {
    if (borrowAction !== 'repay') {
      return {
        balance: '0',
        missingWalletBalance: false,
      };
    }
    if (!selectedAsset) {
      return {
        balance: protocolInfo?.activeBalance ?? '0',
        missingWalletBalance: false,
      };
    }
    if (selectedRepayManagePageData?.repay?.data?.balance !== undefined) {
      return {
        balance: selectedRepayManagePageData.repay.data.balance,
        missingWalletBalance: false,
      };
    }
    return getBorrowRepayWalletBalance({
      selectedAsset,
    });
  }, [
    borrowAction,
    protocolInfo?.activeBalance,
    selectedAsset,
    selectedRepayManagePageData?.repay?.data?.balance,
  ]);

  const isMissingSelectedRepayWalletBalance = useMemo(
    () =>
      borrowAction === 'repay' &&
      !!selectedAsset &&
      !selectedRepayLoading &&
      selectedRepayWalletBalance.missingWalletBalance,
    [
      borrowAction,
      selectedAsset,
      selectedRepayLoading,
      selectedRepayWalletBalance.missingWalletBalance,
    ],
  );
  const isMissingSelectedBorrowTokenInfo =
    !!selectedAsset && !effectiveBorrowTokenInfo;
  const isBorrowRepayInputDisabled =
    isDisabled ||
    unsupportedAaveNativeReserve ||
    !isSelectedBorrowAssetValid ||
    isMissingSelectedBorrowTokenInfo ||
    (!!selectedAsset &&
      !!selectedBorrowManagePageType &&
      !!selectedBorrowManagePageLoading) ||
    isMissingSelectedRepayWalletBalance;

  // Determine the effective balance (from selected asset or default)
  const effectiveBalance = useMemo(() => {
    if (borrowAction === 'repay' && selectedAsset) {
      return selectedRepayWalletBalance.balance;
    }
    if (borrowAction === 'withdraw' && selectedAsset) {
      return (
        selectedBorrowManagePageData?.withdraw?.data?.balance ??
        getBorrowBalanceAmount(selectedAsset.supplied)
      );
    }
    if (selectedAsset) {
      return getBorrowBalanceAmount(selectedAsset.supplied);
    }
    return protocolInfo?.activeBalance ?? '0';
  }, [
    selectedAsset,
    borrowAction,
    selectedBorrowManagePageData?.withdraw?.data?.balance,
    selectedRepayWalletBalance.balance,
    protocolInfo?.activeBalance,
  ]);

  // Determine the effective max input balance for repay (min of wallet and debt)
  const effectiveMaxBalance = useMemo(() => {
    if (borrowAction !== 'repay') {
      return undefined;
    }
    if (selectedAsset) {
      const selectedMaxBalance =
        selectedRepayManagePageData?.repay?.data?.maxBalance;
      if (selectedMaxBalance !== undefined) {
        return selectedMaxBalance;
      }
      if (selectedRepayWalletBalance.missingWalletBalance) {
        return undefined;
      }
      return getBorrowRepayMaxInputBalance({
        walletBalance: selectedRepayWalletBalance.balance,
        debtBalance: effectiveDebtBalance,
      });
    }
    return protocolInfo?.maxRepayBalance;
  }, [
    borrowAction,
    selectedAsset,
    selectedRepayWalletBalance.balance,
    selectedRepayWalletBalance.missingWalletBalance,
    effectiveDebtBalance,
    protocolInfo?.maxRepayBalance,
    selectedRepayManagePageData?.repay?.data?.maxBalance,
  ]);

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
      actionSignal,
      verifyEtherFiLegacyApproval,
      onTransactionSubmitted,
      withdrawAll,
      effectiveApy,
      useEthenaCooldown,
      resumeEthenaCooldownUnstake,
      onStepChange,
      onEthenaCooldownUnstakeReady,
      withdrawType,
    }: {
      amount: string;
      actionSignal?: AbortSignal;
      verifyEtherFiLegacyApproval?: () => Promise<boolean>;
      onTransactionSubmitted?: () => void;
      withdrawAll: boolean;
      effectiveApy?: string | number;
      useEthenaCooldown?: boolean;
      resumeEthenaCooldownUnstake?: boolean;
      onStepChange?: (step: number) => void;
      onEthenaCooldownUnstakeReady?: () => void;
      withdrawType?: IEarnWithdrawType;
    }) => {
      // Nothing was started, so the form keeps what the user typed.
      if (!hasRequiredData) return false;

      if (borrowApiCtx.isBorrow) return false;
      if (isEtherFiProvider && !etherFiWithdrawalReady) return false;

      withdrawAbortRef.current?.abort();
      const abortController = new AbortController();
      withdrawAbortRef.current = abortController;

      return handleWithdraw({
        amount,
        // identity,
        expectedAccountAddress: isEtherFiProvider
          ? protocolInfo?.earnAccount?.accountAddress
          : undefined,
        protocolVault: earnUtils.shouldSendEarnProtocolVault({
          providerName,
        })
          ? vault
          : undefined,
        symbol: withdrawRequestSymbol,
        provider: providerName,
        inputTokenAddress: effectiveEarnTokenInfo?.token?.isNative
          ? ''
          : (effectiveEarnTokenInfo?.token?.address ?? ''),
        outputTokenAddress: selectedReceiveTokenAddress,
        slippage: pendleSlippage,
        effectiveApy,
        utm,
        useEthenaCooldown,
        resumeEthenaCooldownUnstake,
        withdrawType,
        onStepChange,
        onEthenaCooldownUnstakeReady,
        signal: actionSignal ?? abortController.signal,
        verifyEtherFiLegacyApproval,
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
          onTransactionSubmitted?.();
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
      utm,
      // identity,
      providerName,
      vault,
      protocolInfo?.providerDetail.logoURI,
      protocolInfo?.earnAccount?.accountAddress,
      onSuccess,
      token,
      protocolInfo?.stakeTag,
      withdrawRequestSymbol,
      effectiveEarnTokenInfo?.token?.address,
      effectiveEarnTokenInfo?.token?.isNative,
      etherFiWithdrawalReady,
      isEtherFiProvider,
      selectedReceiveTokenAddress,
      borrowApiCtx.isBorrow,
      pendleSlippage,
      isPendleProvider,
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
      if (
        !borrowApiCtx.isBorrow ||
        unsupportedAaveNativeReserve ||
        !isSelectedBorrowAssetValid
      ) {
        // Nothing was started, so the form keeps what the user typed.
        return false;
      }

      const { provider, marketAddress, action } = borrowApiCtx.borrowApiParams;
      // Use effective reserve address (from selected asset or default)
      const reserveAddress = effectiveReserveAddress ?? '';
      const shouldUnwrapNativeAaveReserve =
        action === 'withdraw' &&
        shouldUseAaveNativeGateway({
          networkId,
          providerName: provider,
          reserveAddress,
        });
      const receiveToken = shouldUnwrapNativeAaveReserve
        ? buildAaveNativeGatewayReceiveToken({
            token: effectiveToken,
            nativeToken: tokenInfo?.nativeToken?.info,
            networkId,
          })
        : effectiveToken;

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
        return handleBorrowRepay({
          amount,
          provider,
          marketAddress,
          reserveAddress,
          repayAll,
          stakingInfo: effectiveToken
            ? {
                label: EEarnLabels.Repay,
                protocol: borrowProviderDisplayName,
                protocolLogoURI: protocolInfo?.providerDetail.logoURI,
                send: { token: effectiveToken, amount },
                tags: buildTags('repay'),
              }
            : undefined,
          onSuccess: () => {
            onSuccess?.();
          },
        });
      }

      return handleBorrowWithdraw({
        amount,
        provider,
        marketAddress,
        reserveAddress,
        withdrawAll,
        ...(shouldUnwrapNativeAaveReserve ? { unwrap: true } : {}),
        stakingInfo: effectiveToken
          ? {
              label: EEarnLabels.Withdraw,
              protocol: borrowProviderDisplayName,
              protocolLogoURI: protocolInfo?.providerDetail.logoURI,
              receive: { token: receiveToken ?? effectiveToken, amount },
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
      borrowProviderDisplayName,
      effectiveReserveAddress,
      effectiveToken,
      handleBorrowRepay,
      handleBorrowWithdraw,
      isSelectedBorrowAssetValid,
      networkId,
      onSuccess,
      protocolInfo?.providerDetail.logoURI,
      protocolInfo?.stakeTag,
      tokenInfo?.nativeToken?.info,
      unsupportedAaveNativeReserve,
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

  const effectiveRepayAllBalance = useMemo(() => {
    if (borrowAction !== 'repay') {
      return undefined;
    }
    return resolveBorrowRepayAllBalance({
      selectedDebtBalance: selectedAsset ? effectiveDebtBalance : undefined,
      protocolDebtBalance: protocolInfo?.debtBalance,
      reserveAddress: effectiveReserveAddress,
      tokenAddress: token?.address,
      repayTokenSymbol: effectiveTokenSymbol,
      borrowedAssets: freshBorrowReserves?.borrowed?.assets,
    });
  }, [
    borrowAction,
    effectiveDebtBalance,
    effectiveReserveAddress,
    effectiveTokenSymbol,
    freshBorrowReserves?.borrowed?.assets,
    protocolInfo?.debtBalance,
    selectedAsset,
    token?.address,
  ]);

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
      needsSetupLut,
      onSetupReadyForRepay,
    }: IRepayWithCollateralConfirmParams) => {
      if (!borrowApiCtx.isBorrow) {
        return false;
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

      return handleBorrowRepayWithCollateral({
        amount,
        provider,
        marketAddress,
        reserveAddress,
        collateralReserveAddress,
        needsSetupLut,
        repayAll,
        slippageBps,
        routeKey,
        stakingInfo: {
          label: EEarnLabels.Repay,
          protocol: borrowProviderDisplayName,
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
        onSetupLutReadyForRepay: onSetupReadyForRepay,
        onSuccess: () => {
          onSuccess?.();
        },
      });
    },
    [
      borrowApiCtx,
      borrowProviderDisplayName,
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
      borrowReserveAddress !== undefined &&
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
        onConfirm={async () => false}
        protocolVault=""
        isDisabled
        isInModalContext={isInModalContext}
        beforeFooter={beforeFooter}
        footerActionOverride={footerActionOverride}
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
          price={
            effectiveBorrowTokenInfo?.price
              ? String(effectiveBorrowTokenInfo.price)
              : '0'
          }
          decimals={effectiveDecimals}
          balance={effectiveBalance}
          maxBalance={effectiveMaxBalance}
          repayAllBalance={effectiveRepayAllBalance}
          tokenSymbol={effectiveTokenSymbol}
          tokenImageUri={effectiveTokenImageUri}
          onWalletConfirm={onBorrowConfirm}
          onRepayWithCollateralConfirm={onBorrowRepayWithCollateralConfirm}
          tokenInfo={effectiveBorrowTokenInfo}
          isDisabled={isBorrowRepayInputDisabled}
          approveType={effectiveApproveType}
          currentAllowance={initialAllowanceResult?.allowanceParsed}
          approveTarget={approveTarget}
          borrowMarketAddress={
            borrowApiCtx.borrowApiParams?.marketAddress ?? ''
          }
          borrowReserveAddress={effectiveReserveAddress ?? ''}
          beforeFooter={beforeFooter}
          showApyDetail={showApyDetail}
          actionLabel={borrowActionLabel}
          selectableAssets={selectableBorrowAssets}
          selectableAssetsLoading={assetsListLoading}
          onTokenSelect={handleTokenSelect}
          isInModalContext={isInModalContext}
          collateralAssets={collateralAssets}
          collateralLoading={!!collateralLoading}
          defaultCollateralReserveAddress={defaultCollateralReserveAddress}
          needsSetupLut={protocolInfo?.needsSetupLut}
          repayWithCollateralSetupReadyProgressKey={
            repayWithCollateralSetupReadyProgressKey
          }
          onRepayWithCollateralSetupReadyProgressKeyChange={
            onRepayWithCollateralSetupReadyProgressKeyChange
          }
          debtBalance={effectiveDebtBalance}
        />
      );
    } else {
      borrowWithdrawContent = (
        <ManagePosition
          accountId={accountId}
          networkId={networkId}
          providerName={providerName}
          action={borrowApiCtx.borrowApiParams.action as 'withdraw' | 'repay'}
          price={
            effectiveBorrowTokenInfo?.price
              ? String(effectiveBorrowTokenInfo.price)
              : '0'
          }
          decimals={effectiveDecimals}
          balance={effectiveBalance}
          maxBalance={effectiveMaxBalance}
          tokenSymbol={effectiveTokenSymbol}
          tokenImageUri={effectiveTokenImageUri}
          onConfirm={onBorrowConfirm}
          tokenInfo={effectiveBorrowTokenInfo}
          isDisabled={isBorrowRepayInputDisabled}
          approveType={effectiveApproveType}
          currentAllowance={initialAllowanceResult?.allowanceParsed}
          approveTarget={approveTarget}
          borrowMarketAddress={
            borrowApiCtx.borrowApiParams?.marketAddress ?? ''
          }
          borrowReserveAddress={effectiveReserveAddress ?? ''}
          beforeFooter={beforeFooter}
          showApyDetail={showApyDetail}
          actionLabel={borrowActionLabel}
          selectableAssets={selectableBorrowAssets}
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
          price={
            effectiveEarnTokenInfo?.price
              ? String(effectiveEarnTokenInfo.price)
              : '0'
          }
          decimals={
            isEtherFiProvider
              ? token?.decimals
              : (protocolInfo?.protocolInputDecimals ?? token?.decimals)
          }
          balance={
            isEtherFiProvider
              ? (shareToken.balance ?? '0')
              : protocolInfo?.activeBalance || '0'
          }
          accountId={accountId}
          networkId={networkId}
          tokenSymbol={effectiveTokenSymbol}
          requestSymbol={withdrawRequestSymbol}
          tokenImageUri={token?.logoURI || fallbackTokenImageUri}
          providerLogo={protocolInfo?.providerDetail.logoURI}
          providerName={providerName}
          protocolInfo={effectiveProtocolInfo}
          tokenInfo={effectiveEarnTokenInfo}
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
          isActionDisabled={isEtherFiProvider && !etherFiWithdrawalReady}
          beforeFooter={
            <>
              {beforeFooter}
              {isEtherFiProvider &&
              (etherFiWithdrawal.error ||
                initialAllowanceResult?.error ||
                unstakeAssetsList?.error ||
                (unstakeAssetsList?.scopeKey === unstakeAssetsScopeKey &&
                  !unstakeAssetsList.error &&
                  !unstakeAssetsList.assets.length)) ? (
                <Alert
                  type="critical"
                  title={intl.formatMessage({
                    id: ETranslations.global_an_error_occurred,
                  })}
                  action={{
                    primary: intl.formatMessage({
                      id: ETranslations.global_retry,
                    }),
                    onPrimaryPress: () => {
                      if (etherFiWithdrawal.error)
                        void etherFiWithdrawal.retry();
                      if (initialAllowanceResult?.error) void retryAllowance();
                      if (
                        unstakeAssetsList?.error ||
                        !unstakeAssetsList?.assets.length
                      ) {
                        void retryUnstakeAssets();
                      }
                    },
                  }}
                />
              ) : null}
            </>
          }
          footerActionOverride={footerActionOverride}
          showApyDetail={showApyDetail}
          isInModalContext={isInModalContext}
          receiveInputConfig={effectiveReceiveInputConfig}
          transactionInputTokenAddress={
            effectiveEarnTokenInfo?.token?.isNative
              ? ''
              : (effectiveEarnTokenInfo?.token?.address ?? '')
          }
          transactionOutputTokenAddress={selectedReceiveTokenAddress}
          isQuoteExpired={isQuoteExpired}
          onQuoteReset={onQuoteReset}
          refreshKey={refreshKey}
          onQuoteRefreshingChange={onQuoteRefreshingChange}
          approveType={effectiveApproveType}
          approveTarget={approveTarget}
          currentAllowance={
            !isEtherFiProvider ||
            initialAllowanceResult?.scopeKey === allowanceScopeKey
              ? initialAllowanceResult?.allowanceParsed
              : undefined
          }
          receiptTokenRate={
            protocolInfo?.withdrawApprove?.receiptTokenRate ??
            protocolInfo?.receiptTokenRate ??
            protocolInfo?.morphoTokenRate
          }
          pendleSlippage={pendleSlippage}
        />
      )}
    </>
  );
};
