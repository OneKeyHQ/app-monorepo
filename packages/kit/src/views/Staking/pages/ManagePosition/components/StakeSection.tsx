import type { ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useEarnActions } from '@onekeyhq/kit/src/states/jotai/contexts/earn/actions';
import {
  type IManagePositionConfirmParams,
  ManagePosition,
} from '@onekeyhq/kit/src/views/Borrow/components/ManagePosition';
import {
  useUniversalBorrowBorrow,
  useUniversalBorrowSupply,
} from '@onekeyhq/kit/src/views/Borrow/hooks/useUniversalBorrowHooks';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EModalRoutes, EModalStakingRoutes } from '@onekeyhq/shared/src/routes';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { EEarnProviderEnum } from '@onekeyhq/shared/types/earn';
import type { IFeeUTXO } from '@onekeyhq/shared/types/fee';
import { EApproveType, EEarnLabels } from '@onekeyhq/shared/types/staking';
import type {
  IApproveConfirmFnParams,
  IEarnSelectField,
  IEarnTokenInfo,
  IEarnTokenItem,
  IProtocolInfo,
} from '@onekeyhq/shared/types/staking';
import type { IToken } from '@onekeyhq/shared/types/token';

import { UniversalStake } from '../../../components/UniversalStake';
import { useBorrowApiParams } from '../../../hooks/useBorrowApiParams';
import { useIsPendleProvider } from '../../../hooks/useIsPendleProvider';
import { useUniversalStake } from '../../../hooks/useUniversalHooks';
import {
  buildBorrowTag,
  buildStakeTokenUniqueKey,
  normalizeStakeTokenAddress,
  resolveNativeEarnProtocolSymbol,
  resolveNativeEarnStakeRequestSymbol,
  resolveNativeEarnStakeType,
  resolveStakeTokenAddress,
} from '../../../utils/utils';

import type { IManagePositionProtocolSwitchConfig } from './ManagePositionContent';
import type { IManagePageV2ReceiveInputConfig } from '../../../components/ManagePageV2ReceiveInput';

export const StakeSection = ({
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
  showApyDetail?: boolean;
  isInModalContext?: boolean;
  fallbackTokenImageUri?: string;
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

  const { result: stakeAssetsList } = usePromiseResult(
    async () => {
      if (
        !hasRequiredData ||
        !(isPendleProvider || isNativeProvider) ||
        !accountId ||
        !stakeAssetsSymbol
      ) {
        return undefined;
      }
      return backgroundApiProxy.serviceStaking.getEarnAssetsList({
        accountId,
        networkId,
        provider: providerName,
        symbol: stakeAssetsSymbol,
        vault: protocolInfo?.vault || undefined,
        action: 'stake',
      });
    },
    [
      hasRequiredData,
      isPendleProvider,
      isNativeProvider,
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
    return stakeAssetsList?.assets ?? [];
  }, [stakeAssetsList?.assets]);

  useEffect(() => {
    if (!selectableStakeAssets.length) {
      setSelectedStakeAsset(undefined);
      return;
    }

    setSelectedStakeAsset((prev) => {
      if (prev) {
        const prevAddress = normalizeStakeTokenAddress({
          address: prev.info.address,
          isNative: prev.info.isNative,
        });
        const matchedPrev = selectableStakeAssets.find((asset) => {
          const assetAddress = normalizeStakeTokenAddress({
            address: asset.info.address,
            isNative: asset.info.isNative,
          });
          return (
            assetAddress === prevAddress &&
            asset.info.symbol.toLowerCase() === prev.info.symbol.toLowerCase()
          );
        });
        if (matchedPrev) {
          return matchedPrev;
        }
      }

      return selectableStakeAssets[0];
    });
  }, [selectableStakeAssets]);

  const effectiveStakeTokenInfo = useMemo(() => {
    if (!tokenInfo || !selectedStakeAsset) {
      return tokenInfo;
    }
    return {
      ...tokenInfo,
      balanceParsed: selectedStakeAsset.balanceParsed || '0',
      price: selectedStakeAsset.price || '0',
      token: {
        ...tokenInfo.token,
        ...selectedStakeAsset.info,
      } as IEarnTokenInfo['token'],
    };
  }, [selectedStakeAsset, tokenInfo]);

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
    if (!isNativeProvider) {
      return undefined;
    }
    return selectableStakeAssets.find(
      (asset) =>
        !asset.info.isNative && asset.info.symbol.toUpperCase() === 'WETH',
    );
  }, [isNativeProvider, selectableStakeAssets]);
  const nativeStakeType = useMemo(
    () =>
      resolveNativeEarnStakeType({
        isNativeProvider,
        vaultSymbol: stakeAssetsSymbol,
        tokenIsNative: effectiveStakeTokenInfo?.token?.isNative,
      }),
    [
      effectiveStakeTokenInfo?.token?.isNative,
      isNativeProvider,
      stakeAssetsSymbol,
    ],
  );
  const stakeRequestSymbol = useMemo(
    () =>
      resolveNativeEarnStakeRequestSymbol({
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
      nativeWrappedStakeAsset?.info.symbol,
      protocolInfo?.symbol,
      stakeAssetsSymbol,
      tokenInfo?.token.symbol,
    ],
  );
  const approveSpenderAddress = useMemo(
    () =>
      earnUtils.resolveEarnApproveSpenderAddress({
        providerName: protocolInfo?.provider || '',
        protocolVault: protocolInfo?.vault,
        backendApproveTarget: protocolInfo?.approve?.approveTarget,
      }),
    [
      protocolInfo?.provider,
      protocolInfo?.vault,
      protocolInfo?.approve?.approveTarget,
    ],
  );
  const effectiveApproveType = useMemo(() => {
    return earnUtils.resolveEarnApproveType({
      providerName: protocolInfo?.provider || '',
      networkId,
      tokenIsNative: effectiveStakeTokenInfo?.token?.isNative,
      approveSpenderAddress,
      backendApproveType: protocolInfo?.approve?.approveType,
    });
  }, [
    protocolInfo?.provider,
    protocolInfo?.approve?.approveType,
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
    stakeAssetsSymbol,
  ]);

  const stakeTokenSelectorTriggerProps = useMemo(() => {
    if (
      !(isPendleProvider || isNativeProvider) ||
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
    isNativeProvider,
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

  const { result, isLoading: _isLoading = true } = usePromiseResult(
    async () => {
      if (
        !hasRequiredData ||
        !effectiveApproveType ||
        !approveSpenderAddress ||
        effectiveStakeTokenInfo?.token?.isNative
      ) {
        return undefined;
      }
      const { allowanceParsed } =
        await backgroundApiProxy.serviceStaking.fetchTokenAllowance({
          accountId,
          networkId,
          spenderAddress: earnUtils.resolveEarnAllowanceSpenderAddress({
            approveType: effectiveApproveType,
            approveSpenderAddress,
          }),
          tokenAddress: effectiveStakeTokenInfo?.token.address || '',
        });

      return { allowanceParsed };
    },
    [
      hasRequiredData,
      accountId,
      networkId,
      approveSpenderAddress,
      effectiveApproveType,
      effectiveStakeTokenInfo?.token?.isNative,
      effectiveStakeTokenInfo?.token.address,
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
      approveType,
      permitSignature,
      unsignedMessage,
      message,
      effectiveApy,
      validatorPubkey,
      stakeType: confirmStakeType,
      onStepChange,
    }: IApproveConfirmFnParams) => {
      if (!hasRequiredData) return;

      const token = effectiveStakeTokenInfo?.token as IToken;
      const effectiveStakeType = confirmStakeType ?? nativeStakeType;

      if (borrowApiCtx.isBorrow) return;

      await handleStake({
        amount,
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
        stakeType: effectiveStakeType,
        postWrapStakeToken:
          effectiveStakeType === 'wrap'
            ? nativeWrappedStakeAsset?.info
            : undefined,
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
      protocolInfo?.providerDetail.logoURI,
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
      nativeWrappedStakeAsset?.info,
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

  const onBorrowConfirm = useCallback(
    async (params: IManagePositionConfirmParams) => {
      const { amount } = params;
      if (!hasRequiredData || !borrowApiCtx.isBorrow) return;

      const token = tokenInfo?.token as IToken;
      const { provider, marketAddress, reserveAddress, action } =
        borrowApiCtx.borrowApiParams;

      // Build tags array with both new borrow tag and legacy stakeTag for backward compatibility
      const tags: string[] = [EEarnLabels.Borrow];
      if (action === 'supply' || action === 'borrow') {
        tags.push(buildBorrowTag({ provider, action }));
      }
      // Keep legacy stakeTag for backward compatibility
      if (protocolInfo?.stakeTag) {
        tags.push(protocolInfo.stakeTag);
      }

      await (action === 'borrow' ? handleBorrowBorrow : handleBorrowSupply)({
        amount,
        provider,
        marketAddress,
        reserveAddress,
        stakingInfo: token
          ? {
              label:
                action === 'borrow' ? EEarnLabels.Borrow : EEarnLabels.Supply,
              protocol: earnUtils.getEarnProviderName({
                providerName: provider,
              }),
              protocolLogoURI: protocolInfo?.providerDetail.logoURI,
              ...(action === 'borrow'
                ? { receive: { token, amount } }
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
      handleBorrowBorrow,
      handleBorrowSupply,
      hasRequiredData,
      onSuccess,
      protocolInfo?.providerDetail.logoURI,
      protocolInfo?.stakeTag,
      tokenInfo?.token,
    ],
  );

  // If no required data, render placeholder to maintain layout
  if (!hasRequiredData) {
    if (
      useBorrowApi &&
      borrowMarketAddress &&
      borrowReserveAddress &&
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
        tokenSymbol={tokenInfo?.token.symbol}
        isDisabled
        approveTarget={{
          accountId,
          networkId,
          spenderAddress: '',
        }}
        isInModalContext={isInModalContext}
        beforeFooter={beforeFooter}
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
          isInModalContext={isInModalContext}
        />
      ) : (
        <UniversalStake
          key={`stake-input-${selectedStakeTokenUniqueKey || tokenInfo?.token?.uniqueKey || 'default'}`}
          accountId={accountId}
          networkId={networkId}
          decimals={
            protocolInfo?.protocolInputDecimals ??
            effectiveStakeTokenInfo?.token?.decimals
          }
          balance={effectiveStakeTokenInfo?.balanceParsed ?? ''}
          tokenImageUri={
            effectiveStakeTokenInfo?.token.logoURI || fallbackTokenImageUri
          }
          tokenSymbol={effectiveStakeTokenInfo?.token.symbol}
          providerLogo={protocolInfo?.providerDetail.logoURI}
          providerName={protocolInfo?.provider}
          onConfirm={onConfirm}
          approveType={effectiveApproveType}
          currentAllowance={result?.allowanceParsed}
          minTransactionFee={protocolInfo?.minTransactionFee}
          estimateFeeUTXO={estimateFeeUTXO}
          onFeeRateChange={onFeeRateChange}
          tokenInfo={effectiveStakeTokenInfo}
          protocolInfo={protocolInfo}
          isDisabled={isDisabled}
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
                  token: nativeWrappedStakeAsset?.info,
                }
              : undefined
          }
          beforeFooter={beforeFooter}
          showApyDetail={showApyDetail}
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
