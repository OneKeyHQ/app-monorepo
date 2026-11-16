import type { ComponentProps, ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import { Alert } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useEarnActions } from '@onekeyhq/kit/src/states/jotai/contexts/earn/actions';
import {
  buildAaveNativeGatewayReceiveToken,
  isUnsupportedAaveNativeReserve,
  resolveBorrowTokenApproveSpenderAddress,
  shouldUseAaveNativeGateway,
} from '@onekeyhq/kit/src/views/Borrow/components/borrowRepayPosition.utils';
import {
  type IManagePositionConfirmParams,
  ManagePosition,
} from '@onekeyhq/kit/src/views/Borrow/components/ManagePosition';
import { buildBorrowTokenApproveTarget } from '@onekeyhq/kit/src/views/Borrow/components/ManagePosition/borrowApproval.utils';
import {
  useUniversalBorrowBorrow,
  useUniversalBorrowSupply,
} from '@onekeyhq/kit/src/views/Borrow/hooks/useUniversalBorrowHooks';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EModalRoutes, EModalStakingRoutes } from '@onekeyhq/shared/src/routes';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import { isAllowedEtherFiAsset } from '@onekeyhq/shared/src/utils/etherFiVaults';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { EEarnProviderEnum } from '@onekeyhq/shared/types/earn';
import type { IFeeUTXO } from '@onekeyhq/shared/types/fee';
import { EApproveType, EEarnLabels } from '@onekeyhq/shared/types/staking';
import type {
  IApproveConfirmFnParams,
  IEarnSelectField,
  IEarnTokenInfo,
  IEarnTokenItem,
  IEarnUtmParams,
  IProtocolInfo,
} from '@onekeyhq/shared/types/staking';
import type { IToken } from '@onekeyhq/shared/types/token';

import { EtherFiNativeDepositRecoveryNotice } from '../../../components/EtherFiNativeDepositRecoveryNotice';
import { UniversalStake } from '../../../components/UniversalStake';
import { useBorrowApiParams } from '../../../hooks/useBorrowApiParams';
import { useEtherFiNativeRecoveryController } from '../../../hooks/useEtherFiNativeDepositRecovery';
import { useEtherFiStakeApproval } from '../../../hooks/useEtherFiStakeApproval';
import { useEtherFiWrappedToken } from '../../../hooks/useEtherFiWrappedToken';
import { useIsPendleProvider } from '../../../hooks/useIsPendleProvider';
import { useUniversalStake } from '../../../hooks/useUniversalHooks';
import {
  buildBorrowTag,
  buildStakeTokenUniqueKey,
  normalizeStakeTokenAddress,
  resolveEtherFiStakeType,
  resolveNativeEarnProtocolSymbol,
  resolveNativeEarnStakeRequestSymbol,
  resolveNativeEarnStakeType,
  resolveStakeTokenAddress,
} from '../../../utils/utils';

import { resolveStakeInitialAllowanceTarget } from './StakeSection.utils';

import type {
  IManagePositionFooterAction,
  IManagePositionProtocolSwitchConfig,
} from './ManagePositionContent';
import type { IManagePageV2ReceiveInputConfig } from '../../../components/ManagePageV2ReceiveInput';

function isSameStakeAsset(a: IEarnTokenItem, b: IEarnTokenItem) {
  return (
    normalizeStakeTokenAddress(a.info) === normalizeStakeTokenAddress(b.info) &&
    a.info.symbol.toLowerCase() === b.info.symbol.toLowerCase()
  );
}

const StakeSectionContent = ({
  accountId,
  networkId,
  tokenInfo,
  protocolInfo,
  isDisabled,
  onSuccess,
  beforeFooter,
  footerActionOverride,
  showApyDetail,
  suppressPlatformBonus,
  isInModalContext,
  fallbackTokenImageUri,
  utm,
  protocolSwitchConfig,
  ongoingValidator,
  useBorrowApi,
  borrowMarketAddress,
  borrowReserveAddress,
  borrowAction,
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
  footerActionOverride?: IManagePositionFooterAction;
  showApyDetail?: boolean;
  suppressPlatformBonus?: boolean;
  isInModalContext?: boolean;
  fallbackTokenImageUri?: string;
  utm?: IEarnUtmParams;
  protocolSwitchConfig?: IManagePositionProtocolSwitchConfig;
  ongoingValidator?: IEarnSelectField;
  useBorrowApi?: boolean;
  borrowMarketAddress?: string;
  borrowReserveAddress?: string;
  borrowAction?: 'supply' | 'withdraw' | 'borrow' | 'repay';
  borrowActionLabel?: string;
  receiveInputConfig?: IManagePageV2ReceiveInputConfig;
  pendleSlippage?: number;
  isQuoteExpired?: boolean;
  onQuoteReset?: () => void;
  refreshKey?: number;
  onQuoteRefreshingChange?: (loading: boolean) => void;
}) => {
  // Early return if no tokenInfo or protocolInfo
  // This happens when there's no account or no address
  const intl = useIntl();
  const navigation = useAppNavigation();
  const hasRequiredData = tokenInfo && protocolInfo;
  const providerName = useMemo(
    () => protocolInfo?.provider ?? '',
    [protocolInfo?.provider],
  );
  const isPendleProvider = useIsPendleProvider(providerName);
  const isNativeProvider = useMemo(
    () => earnUtils.isNativeProvider({ providerName }),
    [providerName],
  );
  const isEtherFiProvider = earnUtils.isEtherFiProvider({ providerName });
  const supportsStakeAssets = isNativeProvider || isEtherFiProvider;
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
  const [selectedStakeAsset, setSelectedStakeAsset] = useState<
    IEarnTokenItem | undefined
  >(undefined);
  const stakeAssetsSymbol = useMemo(
    () =>
      resolveNativeEarnProtocolSymbol({
        isNativeProvider,
        protocolSymbol: protocolInfo?.symbol,
      }),
    [isNativeProvider, protocolInfo?.symbol],
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
  const isBorrowStake =
    borrowApiCtx.isBorrow &&
    (borrowApiCtx.borrowApiParams.action === 'supply' ||
      borrowApiCtx.borrowApiParams.action === 'borrow');
  const borrowDelegationApproveTarget = useMemo(() => {
    if (
      !borrowApiCtx.isBorrow ||
      borrowApiCtx.borrowApiParams.action !== 'borrow' ||
      protocolInfo?.borrowAllowance === undefined
    ) {
      return undefined;
    }

    const { provider, marketAddress, reserveAddress } =
      borrowApiCtx.borrowApiParams;
    return {
      accountId,
      networkId,
      provider,
      marketAddress,
      reserveAddress,
      allowance: protocolInfo.borrowAllowance,
    };
  }, [accountId, borrowApiCtx, networkId, protocolInfo?.borrowAllowance]);

  const stakeAssetsScopeKey = JSON.stringify([
    accountId,
    networkId,
    providerName,
    stakeAssetsSymbol,
    protocolInfo?.vault,
  ]);
  const {
    result: stakeAssetsList,
    isLoading: isStakeAssetsLoading,
    run: retryStakeAssets,
  } = usePromiseResult(
    async () => {
      if (
        !hasRequiredData ||
        !(isPendleProvider || supportsStakeAssets) ||
        !accountId ||
        !stakeAssetsSymbol
      ) {
        return undefined;
      }
      try {
        const response =
          await backgroundApiProxy.serviceStaking.getEarnAssetsList({
            accountId,
            networkId,
            provider: providerName,
            symbol: stakeAssetsSymbol,
            vault: protocolInfo?.vault || undefined,
            action: 'stake',
          });
        const assets = isEtherFiProvider
          ? response.assets.filter((asset) =>
              isAllowedEtherFiAsset({
                vault: protocolInfo?.vault,
                networkId,
                direction: 'stake',
                token: asset.info,
              }),
            )
          : response.assets;
        return {
          ...response,
          assets,
          scopeKey: stakeAssetsScopeKey,
          error:
            isEtherFiProvider &&
            response.assets.length > 0 &&
            assets.length === 0,
        };
      } catch (error) {
        if (!isEtherFiProvider) throw error;
        return { assets: [], scopeKey: stakeAssetsScopeKey, error: true };
      }
    },
    [
      hasRequiredData,
      isPendleProvider,
      supportsStakeAssets,
      isEtherFiProvider,
      stakeAssetsScopeKey,
      accountId,
      networkId,
      providerName,
      protocolInfo?.vault,
      stakeAssetsSymbol,
    ],
    {
      watchLoading: true,
    },
  );

  const selectableStakeAssets = useMemo(() => {
    if (
      isEtherFiProvider &&
      stakeAssetsList?.scopeKey !== stakeAssetsScopeKey
    ) {
      return [];
    }
    return stakeAssetsList?.assets ?? [];
  }, [isEtherFiProvider, stakeAssetsList, stakeAssetsScopeKey]);
  const nativeRecovery = useEtherFiNativeRecoveryController({
    scope:
      isEtherFiProvider &&
      protocolInfo?.earnAccount?.accountAddress &&
      protocolInfo.vault
        ? {
            accountId,
            accountAddress: protocolInfo.earnAccount.accountAddress,
            networkId,
            vault: protocolInfo.vault,
          }
        : undefined,
    assets: selectableStakeAssets,
    selectedAsset: selectedStakeAsset,
    setSelectedAsset: setSelectedStakeAsset,
  });
  const stakeAssetsError =
    isEtherFiProvider &&
    stakeAssetsList?.scopeKey === stakeAssetsScopeKey &&
    stakeAssetsList.error;
  const reconciledStakeAssetsRef = useRef(selectableStakeAssets);

  const isWaitingForStakeAsset =
    Boolean(hasRequiredData && accountId && stakeAssetsSymbol) &&
    !isBorrowStake &&
    (isPendleProvider || supportsStakeAssets) &&
    ((!selectedStakeAsset && isStakeAssetsLoading !== false) ||
      (selectableStakeAssets.length > 0 &&
        (!selectedStakeAsset ||
          (reconciledStakeAssetsRef.current !== selectableStakeAssets &&
            !selectableStakeAssets.some((asset) =>
              isSameStakeAsset(asset, selectedStakeAsset),
            )))));

  useEffect(() => {
    reconciledStakeAssetsRef.current = selectableStakeAssets;
    if (!selectableStakeAssets.length) {
      setSelectedStakeAsset(undefined);
      return;
    }

    setSelectedStakeAsset((prev) => {
      if (prev) {
        const matchedPrev = selectableStakeAssets.find((asset) =>
          isSameStakeAsset(asset, prev),
        );
        if (matchedPrev) {
          return matchedPrev;
        }
      }

      return (
        (isEtherFiProvider
          ? selectableStakeAssets.find(
              (asset) =>
                normalizeStakeTokenAddress(asset.info) ===
                  normalizeStakeTokenAddress(tokenInfo?.token) &&
                asset.info.symbol.toLowerCase() ===
                  tokenInfo?.token?.symbol?.toLowerCase(),
            )
          : undefined) ?? selectableStakeAssets[0]
      );
    });
  }, [isEtherFiProvider, selectableStakeAssets, tokenInfo?.token]);

  const effectiveStakeTokenInfo = useMemo(() => {
    if (!tokenInfo || !selectedStakeAsset) {
      return tokenInfo;
    }
    return {
      ...tokenInfo,
      balanceParsed:
        nativeRecovery.active?.balanceParsed ??
        (selectedStakeAsset.balanceParsed || '0'),
      price: selectedStakeAsset.price || '0',
      token: {
        ...tokenInfo.token,
        ...selectedStakeAsset.info,
      } as IEarnTokenInfo['token'],
    };
  }, [selectedStakeAsset, tokenInfo, nativeRecovery.active?.balanceParsed]);

  const selectedStakeTokenAddress = useMemo(
    () =>
      resolveStakeTokenAddress({
        address: effectiveStakeTokenInfo?.token.address,
        isNative: effectiveStakeTokenInfo?.token.isNative,
      }),
    [
      effectiveStakeTokenInfo?.token.address,
      effectiveStakeTokenInfo?.token.isNative,
    ],
  );
  const nativeWrappedStakeAsset = useMemo(() => {
    if (!supportsStakeAssets) {
      return undefined;
    }
    return selectableStakeAssets.find(
      (asset) =>
        !asset.info.isNative && asset.info.symbol.toUpperCase() === 'WETH',
    );
  }, [supportsStakeAssets, selectableStakeAssets]);
  const nativeStakeType = useMemo(
    () =>
      isEtherFiProvider
        ? resolveEtherFiStakeType({
            tokenSymbol: effectiveStakeTokenInfo?.token?.symbol,
            tokenIsNative: effectiveStakeTokenInfo?.token?.isNative,
          })
        : resolveNativeEarnStakeType({
            isNativeProvider,
            vaultSymbol: stakeAssetsSymbol,
            tokenIsNative: effectiveStakeTokenInfo?.token?.isNative,
          }),
    [
      effectiveStakeTokenInfo?.token?.isNative,
      isNativeProvider,
      isEtherFiProvider,
      effectiveStakeTokenInfo?.token?.symbol,
      stakeAssetsSymbol,
    ],
  );
  const wrappedToken = useEtherFiWrappedToken({
    enabled: isEtherFiProvider && nativeStakeType === 'wrap',
    accountId,
    networkId,
  });
  const postWrapToken = isEtherFiProvider
    ? wrappedToken.token
    : nativeWrappedStakeAsset?.info;
  const etherFiApproval = useEtherFiStakeApproval({
    enabled: isEtherFiProvider && Boolean(selectedStakeAsset),
    networkId,
    provider: providerName,
    symbol: selectedStakeAsset?.info.symbol,
    vault: protocolInfo?.vault,
    wrappedNative: nativeStakeType === 'wrap',
  });
  const stakeApprove = isEtherFiProvider
    ? etherFiApproval.approve
    : protocolInfo?.approve;
  const stakeRequestSymbol = useMemo(
    () =>
      isEtherFiProvider
        ? effectiveStakeTokenInfo?.token.symbol || ''
        : resolveNativeEarnStakeRequestSymbol({
            isNativeProvider,
            protocolSymbol: stakeAssetsSymbol || protocolInfo?.symbol,
            tokenSymbol:
              effectiveStakeTokenInfo?.token.symbol || tokenInfo?.token.symbol,
            tokenIsNative: effectiveStakeTokenInfo?.token?.isNative,
            wrappedTokenSymbol: nativeWrappedStakeAsset?.info.symbol,
          }),
    [
      effectiveStakeTokenInfo?.token?.isNative,
      effectiveStakeTokenInfo?.token.symbol,
      isNativeProvider,
      isEtherFiProvider,
      nativeWrappedStakeAsset?.info.symbol,
      protocolInfo?.symbol,
      stakeAssetsSymbol,
      tokenInfo?.token.symbol,
    ],
  );
  const approveSpenderAddress = useMemo(() => {
    if (borrowApiCtx.isBorrow) {
      return resolveBorrowTokenApproveSpenderAddress({
        providerName: protocolInfo?.provider,
        marketAddress: borrowApiCtx.borrowApiParams.marketAddress,
        backendApproveTarget: stakeApprove?.approveTarget,
        tokenIsNative: effectiveStakeTokenInfo?.token?.isNative,
      });
    }

    return earnUtils.resolveEarnApproveSpenderAddress({
      providerName: protocolInfo?.provider || '',
      protocolVault: protocolInfo?.vault,
      backendApproveTarget: stakeApprove?.approveTarget,
    });
  }, [
    borrowApiCtx,
    effectiveStakeTokenInfo?.token?.isNative,
    protocolInfo?.provider,
    protocolInfo?.vault,
    stakeApprove?.approveTarget,
  ]);
  const effectiveApproveType = useMemo(() => {
    return earnUtils.resolveEarnApproveType({
      providerName: protocolInfo?.provider || '',
      networkId,
      tokenIsNative: effectiveStakeTokenInfo?.token?.isNative,
      approveSpenderAddress,
      backendApproveType: stakeApprove?.approveType,
    });
  }, [
    protocolInfo?.provider,
    stakeApprove?.approveType,
    effectiveStakeTokenInfo?.token?.isNative,
    approveSpenderAddress,
    networkId,
  ]);

  const selectedStakeTokenUniqueKey = useMemo(() => {
    if (selectedStakeAsset?.info) {
      return buildStakeTokenUniqueKey({
        uniqueKey: selectedStakeAsset.info.uniqueKey,
        address: selectedStakeAsset.info.address,
        symbol: selectedStakeAsset.info.symbol,
        isNative: selectedStakeAsset.info.isNative,
      });
    }
    return buildStakeTokenUniqueKey({
      uniqueKey: effectiveStakeTokenInfo?.token.uniqueKey,
      address: effectiveStakeTokenInfo?.token.address,
      symbol: effectiveStakeTokenInfo?.token.symbol,
      isNative: effectiveStakeTokenInfo?.token.isNative,
    });
  }, [selectedStakeAsset?.info, effectiveStakeTokenInfo?.token]);

  const handleOpenStakeTokenSelector = useCallback(() => {
    if (!accountId || !stakeAssetsSymbol) return;
    const currentAddress = selectedStakeAsset?.info?.isNative
      ? 'native'
      : selectedStakeAsset?.info?.address;
    navigation.pushModal(EModalRoutes.StakingModal, {
      screen: EModalStakingRoutes.EarnTokenSelect,
      params: {
        networkId,
        accountId,
        provider: providerName,
        symbol: stakeAssetsSymbol,
        vault: protocolInfo?.vault || undefined,
        action: 'stake' as const,
        currentTokenAddress: currentAddress,
        onSelect: (item: IEarnTokenItem) => {
          if (
            isEtherFiProvider &&
            !isAllowedEtherFiAsset({
              vault: protocolInfo?.vault,
              networkId,
              direction: 'stake',
              token: item.info,
            })
          )
            return;
          setSelectedStakeAsset(item);
        },
      },
    });
  }, [
    accountId,
    networkId,
    providerName,
    protocolInfo?.vault,
    selectedStakeAsset?.info,
    navigation,
    isEtherFiProvider,
    stakeAssetsSymbol,
  ]);

  const stakeTokenSelectorTriggerProps = useMemo(() => {
    if (
      !(isPendleProvider || supportsStakeAssets) ||
      !selectableStakeAssets.length
    ) {
      return undefined;
    }

    return {
      disabled: selectableStakeAssets.length <= 1,
      onPress:
        selectableStakeAssets.length > 1
          ? handleOpenStakeTokenSelector
          : undefined,
    };
  }, [
    isPendleProvider,
    supportsStakeAssets,
    selectableStakeAssets.length,
    handleOpenStakeTokenSelector,
  ]);

  const { result: estimateFeeUTXO } = usePromiseResult(async () => {
    if (!hasRequiredData || !networkUtils.isBTCNetwork(networkId)) {
      return;
    }
    const account = await backgroundApiProxy.serviceAccount.getAccount({
      accountId,
      networkId,
    });
    const accountAddress = account.address;
    const result = await backgroundApiProxy.serviceGas.estimateFee({
      accountId,
      networkId,
      accountAddress,
    });
    return result.feeUTXO?.filter(
      (o): o is Required<Pick<IFeeUTXO, 'feeRate'>> => o.feeRate !== undefined,
    );
  }, [accountId, networkId, hasRequiredData]);

  const [btcFeeRate, setBtcFeeRate] = useState<string | undefined>();
  const btcFeeRateInit = useRef<boolean>(false);
  const { removePermitCache } = useEarnActions().current;

  const onFeeRateChange = useMemo(() => {
    if (
      protocolInfo?.provider.toLowerCase() ===
      EEarnProviderEnum.Babylon.toLowerCase()
    ) {
      return (value: string) => setBtcFeeRate(value);
    }
  }, [protocolInfo?.provider]);

  useEffect(() => {
    if (
      estimateFeeUTXO &&
      estimateFeeUTXO.length === 3 &&
      !btcFeeRateInit.current
    ) {
      const [, normalFee] = estimateFeeUTXO;
      setBtcFeeRate(normalFee.feeRate);
      btcFeeRateInit.current = true;
    }
  }, [estimateFeeUTXO]);

  const borrowSupplyApproveToken = useMemo<IToken | undefined>(() => {
    const token = tokenInfo?.token as IToken | undefined;
    if (!token) {
      return undefined;
    }
    if (protocolInfo?.approveAsset) {
      return {
        ...token,
        address: protocolInfo.approveAsset,
        isNative: false,
        networkId,
      };
    }
    return token;
  }, [networkId, protocolInfo?.approveAsset, tokenInfo?.token]);

  const borrowSupplyApproveTarget = useMemo(() => {
    if (!useBorrowApi || borrowAction !== 'supply') {
      return undefined;
    }
    return buildBorrowTokenApproveTarget({
      accountId,
      networkId,
      spenderAddress: approveSpenderAddress,
      token: borrowSupplyApproveToken,
    });
  }, [
    accountId,
    approveSpenderAddress,
    borrowAction,
    borrowSupplyApproveToken,
    networkId,
    useBorrowApi,
  ]);

  const initialAllowanceTarget = resolveStakeInitialAllowanceTarget({
    borrowSupplyApproveTarget,
    approveType: effectiveApproveType,
    spenderAddress: approveSpenderAddress,
    token: effectiveStakeTokenInfo?.token,
  });

  const allowanceScopeKey = JSON.stringify([
    accountId,
    networkId,
    providerName,
    protocolInfo?.vault,
    initialAllowanceTarget.approveType,
    protocolInfo?.earnAccount?.accountAddress,
    initialAllowanceTarget.spenderAddress,
    initialAllowanceTarget.token?.address,
  ]);

  const {
    result: initialAllowanceResult,
    isLoading: _isLoading = true,
    run: retryAllowance,
  } = usePromiseResult(
    async () => {
      if (
        !hasRequiredData ||
        !initialAllowanceTarget.approveType ||
        !initialAllowanceTarget.spenderAddress ||
        initialAllowanceTarget.token?.isNative
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
              approveType: initialAllowanceTarget.approveType,
              approveSpenderAddress: initialAllowanceTarget.spenderAddress,
            }),
            tokenAddress: initialAllowanceTarget.token?.address || '',
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
      hasRequiredData,
      accountId,
      networkId,
      initialAllowanceTarget.approveType,
      initialAllowanceTarget.spenderAddress,
      initialAllowanceTarget.token?.isNative,
      initialAllowanceTarget.token?.address,
      footerActionOverride?.loading,
      allowanceScopeKey,
      protocolInfo?.earnAccount?.accountAddress,
      isEtherFiProvider,
    ],
    {
      watchLoading: true,
    },
  );

  const handleStake = useUniversalStake({ accountId, networkId });
  const handleBorrowSupply = useUniversalBorrowSupply({ accountId, networkId });
  const handleBorrowBorrow = useUniversalBorrowBorrow({ accountId, networkId });

  const onConfirm = useCallback(
    async ({
      amount,
      actionSignal,
      verifyEtherFiLegacyApproval,
      etherFiNativeRecovery,
      beforeEtherFiPostWrapDeposit,
      onTransactionSubmitted,
      onTransactionRecorded,
      approveType,
      permitSignature,
      unsignedMessage,
      message,
      effectiveApy,
      validatorPubkey,
      stakeType: confirmStakeType,
      onStepChange,
    }: IApproveConfirmFnParams) => {
      // Nothing was started, so the form keeps what the user typed.
      if (!hasRequiredData) return false;

      const token = effectiveStakeTokenInfo?.token as IToken;
      const effectiveStakeType = etherFiNativeRecovery
        ? 'wrap'
        : (confirmStakeType ?? nativeStakeType);
      let effectivePostWrapToken;
      if (etherFiNativeRecovery) effectivePostWrapToken = token;
      else if (effectiveStakeType === 'wrap')
        effectivePostWrapToken = postWrapToken;

      if (borrowApiCtx.isBorrow) return false;

      return handleStake({
        amount,
        actionSignal,
        verifyEtherFiLegacyApproval,
        etherFiNativeRecovery,
        beforeEtherFiPostWrapDeposit,
        onTransactionSubmitted,
        expectedAccountAddress: isEtherFiProvider
          ? protocolInfo?.earnAccount?.accountAddress
          : undefined,
        approveType,
        permitSignature,
        unsignedMessage,
        message,
        symbol: stakeRequestSymbol,
        provider: providerName,
        inputTokenAddress: selectedStakeTokenAddress,
        outputTokenAddress: receiveInputConfig?.tokenAddress ?? '',
        slippage: pendleSlippage,
        effectiveApy,
        utm,
        stakeType: effectiveStakeType,
        postWrapStakeToken: effectivePostWrapToken,
        postWrapApproveSpenderAddress:
          effectiveStakeType === 'wrap' ? approveSpenderAddress : undefined,
        onStepChange,
        stakingInfo: {
          label: isPendleProvider ? EEarnLabels.Buy : EEarnLabels.Stake,
          protocol: earnUtils.getEarnProviderName({
            providerName,
          }),
          protocolLogoURI: protocolInfo?.providerDetail.logoURI,
          send: { token, amount },
          tags: [protocolInfo?.stakeTag || ''],
        },
        // TODO: remove term after babylon remove term
        term: undefined,
        feeRate: Number(btcFeeRate) > 0 ? Number(btcFeeRate) : undefined,
        protocolVault: earnUtils.shouldSendEarnProtocolVault({
          providerName,
        })
          ? protocolInfo?.vault
          : undefined,
        // Stakefish specific param
        validatorPublicKey: validatorPubkey,
        onSuccess: async (txs) => {
          onTransactionRecorded?.();
          onSuccess?.();
          defaultLogger.staking.page.staking({
            token,
            stakingProtocol: providerName,
          });
          const tx = txs[0];
          if (approveType === EApproveType.Permit && permitSignature) {
            removePermitCache({
              accountId,
              networkId,
              tokenAddress: effectiveStakeTokenInfo?.token.address || '',
              amount,
            });
          }
          if (
            tx &&
            providerName.toLowerCase() ===
              EEarnProviderEnum.Babylon.toLowerCase()
          ) {
            await backgroundApiProxy.serviceStaking.addBabylonTrackingItem({
              txId: tx.decodedTx.txid,
              action: 'stake',
              createAt: Date.now(),
              accountId,
              networkId,
              amount,
              // TODO: remove term after babylon remove term
              minStakeTerm: undefined,
            });
          }
        },
      });
    },
    [
      hasRequiredData,
      effectiveStakeTokenInfo?.token,
      handleStake,
      utm,
      protocolInfo?.providerDetail.logoURI,
      protocolInfo?.earnAccount?.accountAddress,
      isEtherFiProvider,
      protocolInfo?.vault,
      btcFeeRate,
      onSuccess,
      removePermitCache,
      accountId,
      networkId,
      providerName,
      protocolInfo?.stakeTag,
      selectedStakeTokenAddress,
      stakeRequestSymbol,
      receiveInputConfig?.tokenAddress,
      borrowApiCtx.isBorrow,
      pendleSlippage,
      isPendleProvider,
      nativeStakeType,
      postWrapToken,
      approveSpenderAddress,
    ],
  );

  // Determine the effective max balance for supply
  const effectiveMaxBalance = useMemo(() => {
    if (borrowAction !== 'supply') {
      return undefined;
    }
    return protocolInfo?.maxSupplyBalance;
  }, [borrowAction, protocolInfo?.maxSupplyBalance]);
  const unsupportedAaveNativeReserve = useMemo(
    () =>
      isUnsupportedAaveNativeReserve({
        networkId,
        providerName: providerName || borrowApiCtx.borrowApiParams?.provider,
        reserveAddress: borrowApiCtx.borrowApiParams?.reserveAddress,
      }),
    [
      borrowApiCtx.borrowApiParams?.provider,
      borrowApiCtx.borrowApiParams?.reserveAddress,
      networkId,
      providerName,
    ],
  );

  const onBorrowConfirm = useCallback(
    async (params: IManagePositionConfirmParams) => {
      const { amount } = params;
      if (
        !hasRequiredData ||
        !borrowApiCtx.isBorrow ||
        unsupportedAaveNativeReserve
      ) {
        // Nothing was started, so the form keeps what the user typed.
        return false;
      }

      const token = tokenInfo?.token as IToken;
      const { provider, marketAddress, reserveAddress, action } =
        borrowApiCtx.borrowApiParams;
      const shouldUnwrapNativeAaveReserve =
        action === 'borrow' &&
        shouldUseAaveNativeGateway({
          networkId,
          providerName: provider,
          reserveAddress,
        });
      const receiveToken = shouldUnwrapNativeAaveReserve
        ? buildAaveNativeGatewayReceiveToken({
            token,
            nativeToken: tokenInfo?.nativeToken?.info,
            networkId,
          })
        : token;

      // Build tags array with both new borrow tag and legacy stakeTag for backward compatibility
      const tags: string[] = [EEarnLabels.Borrow];
      if (action === 'supply' || action === 'borrow') {
        tags.push(buildBorrowTag({ provider, action }));
      }
      // Keep legacy stakeTag for backward compatibility
      if (protocolInfo?.stakeTag) {
        tags.push(protocolInfo.stakeTag);
      }

      return (action === 'borrow' ? handleBorrowBorrow : handleBorrowSupply)({
        amount,
        provider,
        marketAddress,
        reserveAddress,
        ...(shouldUnwrapNativeAaveReserve ? { unwrap: true } : {}),
        stakingInfo: token
          ? {
              label:
                action === 'borrow' ? EEarnLabels.Borrow : EEarnLabels.Supply,
              protocol: borrowProviderDisplayName,
              protocolLogoURI: protocolInfo?.providerDetail.logoURI,
              ...(action === 'borrow'
                ? { receive: { token: receiveToken ?? token, amount } }
                : { send: { token, amount } }),
              tags,
            }
          : undefined,
        onSuccess: async () => {
          onSuccess?.();
        },
      });
    },
    [
      borrowApiCtx,
      borrowProviderDisplayName,
      handleBorrowBorrow,
      handleBorrowSupply,
      hasRequiredData,
      networkId,
      onSuccess,
      protocolInfo?.providerDetail.logoURI,
      protocolInfo?.stakeTag,
      tokenInfo?.nativeToken?.info,
      tokenInfo?.token,
      unsupportedAaveNativeReserve,
    ],
  );

  // If no required data, render placeholder to maintain layout
  if (!hasRequiredData) {
    if (
      useBorrowApi &&
      borrowMarketAddress &&
      borrowReserveAddress !== undefined &&
      (borrowAction === 'supply' || borrowAction === 'borrow')
    ) {
      return (
        <ManagePosition
          accountId={accountId}
          networkId={networkId}
          providerName=""
          action={borrowAction}
          balance="0"
          price="0"
          tokenImageUri={fallbackTokenImageUri}
          tokenSymbol={tokenInfo?.token.symbol}
          isDisabled
          borrowMarketAddress={borrowMarketAddress}
          borrowReserveAddress={borrowReserveAddress}
          beforeFooter={beforeFooter}
          actionLabel={borrowActionLabel}
          isInModalContext={isInModalContext}
        />
      );
    }
    return (
      <UniversalStake
        accountId={accountId}
        networkId={networkId}
        balance="0"
        tokenImageUri={fallbackTokenImageUri}
        tokenImageLoading={!tokenInfo?.token && !fallbackTokenImageUri}
        tokenSymbol={tokenInfo?.token.symbol}
        isDisabled
        approveTarget={{
          accountId,
          networkId,
          spenderAddress: '',
        }}
        isInModalContext={isInModalContext}
        beforeFooter={beforeFooter}
        footerActionOverride={footerActionOverride}
        protocolSwitchConfig={protocolSwitchConfig}
      />
    );
  }

  return (
    <>
      {isBorrowStake ? (
        <ManagePosition
          accountId={accountId}
          networkId={networkId}
          providerName={providerName}
          action={borrowApiCtx.borrowApiParams.action as 'supply' | 'borrow'}
          decimals={
            protocolInfo?.protocolInputDecimals ?? tokenInfo?.token?.decimals
          }
          balance={tokenInfo?.balanceParsed ?? ''}
          maxBalance={effectiveMaxBalance}
          tokenImageUri={tokenInfo?.token.logoURI || fallbackTokenImageUri}
          tokenSymbol={tokenInfo?.token.symbol}
          price={tokenInfo?.price ? String(tokenInfo.price) : '0'}
          onConfirm={onBorrowConfirm}
          approveType={
            borrowApiCtx.borrowApiParams.action === 'supply'
              ? EApproveType.Legacy
              : undefined
          }
          approveTarget={borrowSupplyApproveTarget}
          currentAllowance={
            borrowApiCtx.borrowApiParams.action === 'supply'
              ? (initialAllowanceResult?.allowanceParsed ??
                protocolInfo?.approve?.allowance)
              : undefined
          }
          tokenInfo={tokenInfo}
          isDisabled={isDisabled || unsupportedAaveNativeReserve}
          borrowDelegationApproveTarget={borrowDelegationApproveTarget}
          borrowMarketAddress={
            borrowApiCtx.borrowApiParams?.marketAddress ?? ''
          }
          borrowReserveAddress={
            borrowApiCtx.borrowApiParams?.reserveAddress ?? ''
          }
          beforeFooter={beforeFooter}
          showApyDetail={showApyDetail}
          actionLabel={borrowActionLabel}
          isInModalContext={isInModalContext}
        />
      ) : (
        <UniversalStake
          // Include protocol identity (provider/vault) so switching between
          // protocols that share the same deposit token still remounts the
          // form and drops the previous protocol's transactionConfirmation.
          // Sourced from protocolInfo (same origin as the manage data), so the
          // key flips exactly when fresh protocol data lands.
          key={`stake-input-${protocolInfo?.provider ?? ''}-${protocolInfo?.vault ?? ''}-${selectedStakeTokenUniqueKey || tokenInfo?.token?.uniqueKey || 'default'}`}
          accountId={accountId}
          networkId={networkId}
          decimals={
            isEtherFiProvider
              ? effectiveStakeTokenInfo?.token?.decimals
              : (protocolInfo?.protocolInputDecimals ??
                effectiveStakeTokenInfo?.token?.decimals)
          }
          balance={effectiveStakeTokenInfo?.balanceParsed ?? ''}
          tokenImageUri={
            effectiveStakeTokenInfo?.token.logoURI || fallbackTokenImageUri
          }
          // Token metadata not in yet and no image came from route params:
          // skeleton the icon rather than flashing the placeholder coin.
          // Guarded on the metadata being absent (not merely on a missing
          // image) so a token that genuinely has no logo still renders its
          // fallback instead of a skeleton that never resolves (OK-59961).
          tokenImageLoading={
            !effectiveStakeTokenInfo?.token && !fallbackTokenImageUri
          }
          tokenSymbol={effectiveStakeTokenInfo?.token.symbol}
          isStakeAssetLoading={isWaitingForStakeAsset}
          providerLogo={protocolInfo?.providerDetail.logoURI}
          providerName={protocolInfo?.provider}
          onConfirm={onConfirm}
          etherFiNativeRecovery={nativeRecovery.active}
          etherFiNativeRecoveryRecords={nativeRecovery.allRecords}
          onAbandonEtherFiNativeRecovery={nativeRecovery.abandon}
          approveType={effectiveApproveType}
          currentAllowance={
            !isEtherFiProvider ||
            initialAllowanceResult?.scopeKey === allowanceScopeKey
              ? initialAllowanceResult?.allowanceParsed
              : undefined
          }
          minTransactionFee={protocolInfo?.minTransactionFee}
          estimateFeeUTXO={estimateFeeUTXO}
          onFeeRateChange={onFeeRateChange}
          tokenInfo={effectiveStakeTokenInfo}
          protocolInfo={protocolInfo}
          isDisabled={isDisabled}
          isActionDisabled={
            isEtherFiProvider &&
            (!selectedStakeAsset ||
              !isAllowedEtherFiAsset({
                vault: protocolInfo?.vault,
                networkId,
                direction: 'stake',
                token: selectedStakeAsset.info,
              }) ||
              protocolInfo?.earnAccount?.accountId !== accountId ||
              protocolInfo?.earnAccount?.networkId !== networkId ||
              !protocolInfo?.earnAccount?.accountAddress ||
              !stakeApprove?.approveTarget ||
              (!effectiveStakeTokenInfo?.token?.isNative &&
                (initialAllowanceResult?.scopeKey !== allowanceScopeKey ||
                  initialAllowanceResult?.allowanceParsed === undefined)) ||
              (nativeStakeType === 'wrap' && !postWrapToken))
          }
          approveTarget={{
            accountId,
            networkId,
            spenderAddress: approveSpenderAddress,
            token: effectiveStakeTokenInfo?.token,
          }}
          postWrapApproveTarget={
            nativeStakeType === 'wrap'
              ? {
                  spenderAddress: approveSpenderAddress,
                  token: postWrapToken,
                }
              : undefined
          }
          beforeFooter={
            <>
              {beforeFooter}
              <EtherFiNativeDepositRecoveryNotice
                records={nativeRecovery.records}
                loading={nativeRecovery.loading}
                onResume={nativeRecovery.resume}
              />
              {isEtherFiProvider &&
              (stakeAssetsError ||
                etherFiApproval.error ||
                wrappedToken.error ||
                initialAllowanceResult?.error ||
                (stakeAssetsList?.scopeKey === stakeAssetsScopeKey &&
                  !stakeAssetsList.error &&
                  !stakeAssetsList.assets.length)) ? (
                <Alert
                  type="critical"
                  title={intl.formatMessage({
                    id:
                      stakeAssetsList?.scopeKey === stakeAssetsScopeKey &&
                      !stakeAssetsList.error &&
                      !stakeAssetsList.assets.length
                        ? ETranslations.global_no_data
                        : ETranslations.global_an_error_occurred,
                  })}
                  action={{
                    primary: intl.formatMessage({
                      id: ETranslations.global_retry,
                    }),
                    onPrimaryPress: () => {
                      if (stakeAssetsError || !stakeAssetsList?.assets.length)
                        void retryStakeAssets();
                      if (etherFiApproval.error) void etherFiApproval.retry();
                      if (wrappedToken.error) void wrappedToken.retry();
                      if (initialAllowanceResult?.error) void retryAllowance();
                    },
                  }}
                />
              ) : null}
            </>
          }
          footerActionOverride={footerActionOverride}
          showApyDetail={showApyDetail}
          suppressPlatformBonus={suppressPlatformBonus}
          isInModalContext={isInModalContext}
          protocolSwitchConfig={protocolSwitchConfig}
          ongoingValidator={ongoingValidator}
          receiveInputConfig={receiveInputConfig}
          inputTitle={
            isPendleProvider
              ? intl.formatMessage({ id: ETranslations.content__amount })
              : undefined
          }
          tokenSelectorTriggerProps={stakeTokenSelectorTriggerProps}
          requestSymbol={stakeRequestSymbol}
          transactionInputTokenAddress={selectedStakeTokenAddress}
          transactionOutputTokenAddress={receiveInputConfig?.tokenAddress ?? ''}
          stakeType={nativeStakeType}
          isQuoteExpired={isQuoteExpired}
          onQuoteReset={onQuoteReset}
          refreshKey={refreshKey}
          onQuoteRefreshingChange={onQuoteRefreshingChange}
          pendleSlippage={pendleSlippage}
        />
      )}
    </>
  );
};

export function StakeSection(
  props: ComponentProps<typeof StakeSectionContent>,
) {
  const provider = props.protocolInfo?.provider ?? '';
  const needsAssetList =
    !props.useBorrowApi &&
    (earnUtils.isNativeProvider({ providerName: provider }) ||
      earnUtils.isEtherFiProvider({ providerName: provider }) ||
      earnUtils.isPendleProvider({ providerName: provider }));
  const key = needsAssetList
    ? JSON.stringify([
        props.accountId,
        props.networkId,
        provider,
        props.protocolInfo?.vault,
        props.protocolInfo?.symbol,
        Boolean(props.tokenInfo),
      ])
    : 'default';

  return <StakeSectionContent key={key} {...props} />;
}
