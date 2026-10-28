import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import { Page } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useEarnActions } from '@onekeyhq/kit/src/states/jotai/contexts/earn/actions';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms/jotaiContextStoreMap';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import {
  EModalRoutes,
  EModalStakingRoutes,
  type IModalStakingParamList,
} from '@onekeyhq/shared/src/routes';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import { EEarnProviderEnum } from '@onekeyhq/shared/types/earn';
import type { IFeeUTXO } from '@onekeyhq/shared/types/fee';
import {
  EApproveType,
  EEarnLabels,
  type IApproveConfirmFnParams,
  type IEarnTokenInfo,
  type IEarnTokenItem,
} from '@onekeyhq/shared/types/staking';
import type { IToken } from '@onekeyhq/shared/types/token';

import { DiscoveryBrowserProviderMirror } from '../../../Discovery/components/DiscoveryBrowserProviderMirror';
import { EarnProviderMirror } from '../../../Earn/EarnProviderMirror';
import { UniversalStake } from '../../components/UniversalStake';
import { useUniversalStake } from '../../hooks/useUniversalHooks';
import {
  buildStakeTokenUniqueKey,
  resolveEarnStakeRequestSymbol,
  resolveEarnStakeType,
  resolveNativeEarnProtocolSymbol,
  resolveSelectedStakeAsset,
  resolveStakeTokenAddress,
} from '../../utils/utils';

function BasicStakePage() {
  const route = useAppRoute<
    IModalStakingParamList,
    EModalStakingRoutes.Stake
  >();
  const {
    accountId,
    networkId,
    tokenInfo,
    protocolInfo,
    currentAllowance,
    onSuccess,
  } = route.params;
  const providerName = protocolInfo?.provider || '';
  const appNavigation = useAppNavigation();
  const isNativeProvider = useMemo(
    () => earnUtils.isNativeProvider({ providerName }),
    [providerName],
  );
  const isEtherFiProvider = earnUtils.isEtherFiProvider({ providerName });
  const supportsWrappedStake = isNativeProvider || isEtherFiProvider;
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

  const stakeAssetsScopeKey = [
    accountId,
    networkId,
    providerName,
    protocolInfo?.vault,
    stakeAssetsSymbol,
  ].join(':');

  const { result: stakeAssetsList } = usePromiseResult(
    async () => {
      if (!supportsWrappedStake || !accountId || !stakeAssetsSymbol) {
        return undefined;
      }
      const response =
        await backgroundApiProxy.serviceStaking.getEarnAssetsList({
          accountId,
          networkId,
          provider: providerName,
          symbol: stakeAssetsSymbol,
          vault: protocolInfo?.vault || undefined,
          action: 'stake',
        });
      return { ...response, scopeKey: stakeAssetsScopeKey };
    },
    [
      supportsWrappedStake,
      accountId,
      networkId,
      providerName,
      stakeAssetsSymbol,
      stakeAssetsScopeKey,
      protocolInfo?.vault,
    ],
    {
      watchLoading: true,
    },
  );

  const selectableStakeAssets = useMemo(() => {
    return stakeAssetsList?.scopeKey === stakeAssetsScopeKey
      ? stakeAssetsList.assets
      : [];
  }, [stakeAssetsList, stakeAssetsScopeKey]);

  const activeStakeAsset = resolveSelectedStakeAsset({
    assets: selectableStakeAssets,
    selectedToken: selectedStakeAsset?.info,
    initialToken: tokenInfo?.token,
  });

  const effectiveStakeTokenInfo = useMemo(() => {
    if (!tokenInfo || !activeStakeAsset) {
      return tokenInfo;
    }
    return {
      ...tokenInfo,
      balanceParsed: activeStakeAsset.balanceParsed || '0',
      price: activeStakeAsset.price || '0',
      token: {
        ...tokenInfo.token,
        ...activeStakeAsset.info,
      } as IEarnTokenInfo['token'],
    };
  }, [activeStakeAsset, tokenInfo]);

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

  const wrappedStakeAsset = useMemo(() => {
    if (!supportsWrappedStake) {
      return undefined;
    }
    return selectableStakeAssets.find(
      (asset) =>
        !asset.info.isNative && asset.info.symbol.toUpperCase() === 'WETH',
    );
  }, [supportsWrappedStake, selectableStakeAssets]);

  const stakeType = useMemo(
    () =>
      resolveEarnStakeType({
        providerName,
        tokenSymbol: effectiveStakeTokenInfo?.token.symbol,
        vaultSymbol: stakeAssetsSymbol,
        tokenIsNative: effectiveStakeTokenInfo?.token?.isNative,
      }),
    [
      effectiveStakeTokenInfo?.token?.isNative,
      effectiveStakeTokenInfo?.token.symbol,
      providerName,
      stakeAssetsSymbol,
    ],
  );

  const stakeRequestSymbol = useMemo(
    () =>
      resolveEarnStakeRequestSymbol({
        providerName,
        protocolSymbol: stakeAssetsSymbol || protocolInfo?.symbol,
        tokenSymbol:
          effectiveStakeTokenInfo?.token.symbol || tokenInfo?.token.symbol,
        tokenIsNative: effectiveStakeTokenInfo?.token?.isNative,
        wrappedTokenSymbol: wrappedStakeAsset?.info.symbol,
      }),
    [
      effectiveStakeTokenInfo?.token?.isNative,
      effectiveStakeTokenInfo?.token.symbol,
      providerName,
      wrappedStakeAsset?.info.symbol,
      protocolInfo?.symbol,
      stakeAssetsSymbol,
      tokenInfo?.token.symbol,
    ],
  );

  const selectedStakeTokenUniqueKey = useMemo(() => {
    if (activeStakeAsset?.info) {
      return buildStakeTokenUniqueKey({
        uniqueKey: activeStakeAsset.info.uniqueKey,
        address: activeStakeAsset.info.address,
        symbol: activeStakeAsset.info.symbol,
        isNative: activeStakeAsset.info.isNative,
      });
    }
    return buildStakeTokenUniqueKey({
      uniqueKey: effectiveStakeTokenInfo?.token.uniqueKey,
      address: effectiveStakeTokenInfo?.token.address,
      symbol: effectiveStakeTokenInfo?.token.symbol,
      isNative: effectiveStakeTokenInfo?.token.isNative,
    });
  }, [effectiveStakeTokenInfo?.token, activeStakeAsset?.info]);

  const token = effectiveStakeTokenInfo?.token as IToken;
  const selectedStakeApprove =
    stakeType === 'wrap'
      ? wrappedStakeAsset?.approve
      : activeStakeAsset?.approve;
  const stakeApprove = isEtherFiProvider
    ? selectedStakeApprove
    : protocolInfo?.approve;
  const isStakeAssetReady =
    !isEtherFiProvider ||
    Boolean(
      activeStakeAsset &&
      stakeApprove?.approveTarget &&
      stakeApprove.approveType &&
      (stakeType !== 'wrap' || wrappedStakeAsset),
    );
  const approveSpenderAddress = useMemo(
    () =>
      earnUtils.resolveEarnApproveSpenderAddress({
        providerName: protocolInfo?.provider || '',
        protocolVault: protocolInfo?.vault,
        backendApproveTarget: stakeApprove?.approveTarget,
      }),
    [protocolInfo?.provider, protocolInfo?.vault, stakeApprove?.approveTarget],
  );
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

  const allowanceScopeKey = [
    accountId,
    networkId,
    effectiveApproveType,
    approveSpenderAddress,
    effectiveStakeTokenInfo?.token.address,
  ].join(':');

  const { result: allowanceResult } = usePromiseResult(
    async () => {
      if (
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
            providerName,
            networkId,
            approveType: effectiveApproveType,
            approveSpenderAddress,
          }),
          tokenAddress: effectiveStakeTokenInfo?.token.address || '',
        });

      return { allowanceParsed, scopeKey: allowanceScopeKey };
    },
    [
      allowanceScopeKey,
      accountId,
      networkId,
      providerName,
      approveSpenderAddress,
      effectiveApproveType,
      effectiveStakeTokenInfo?.token?.isNative,
      effectiveStakeTokenInfo?.token.address,
    ],
    {
      watchLoading: true,
    },
  );

  const selectedTokenAllowance =
    allowanceResult?.scopeKey === allowanceScopeKey
      ? allowanceResult?.allowanceParsed
      : undefined;

  const { removePermitCache } = useEarnActions().current;

  const actionTag = protocolInfo?.stakeTag || '';
  const [btcFeeRate, setBtcFeeRate] = useState<string | undefined>();
  const btcFeeRateInit = useRef<boolean>(false);

  const onFeeRateChange = useMemo(() => {
    if (
      providerName.toLowerCase() === EEarnProviderEnum.Babylon.toLowerCase()
    ) {
      return (value: string) => setBtcFeeRate(value);
    }
  }, [providerName]);

  const handleStake = useUniversalStake({ accountId, networkId });

  const handleOpenStakeTokenSelector = useCallback(() => {
    if (!accountId || !stakeAssetsSymbol) {
      return;
    }
    let currentAddress = effectiveStakeTokenInfo?.token.address;
    if (effectiveStakeTokenInfo?.token.isNative) {
      currentAddress = 'native';
    }
    if (activeStakeAsset?.info) {
      currentAddress = activeStakeAsset.info.isNative
        ? 'native'
        : activeStakeAsset.info.address;
    }

    appNavigation.pushModal(EModalRoutes.StakingModal, {
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
    appNavigation,
    effectiveStakeTokenInfo?.token.address,
    effectiveStakeTokenInfo?.token.isNative,
    networkId,
    providerName,
    protocolInfo?.vault,
    activeStakeAsset?.info,
    stakeAssetsSymbol,
  ]);

  const stakeTokenSelectorTriggerProps = useMemo(() => {
    if (!supportsWrappedStake || !selectableStakeAssets.length) {
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
    handleOpenStakeTokenSelector,
    supportsWrappedStake,
    selectableStakeAssets.length,
  ]);

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
      if (!token || !isStakeAssetReady) {
        // Nothing was started, so the form keeps what the user typed.
        return false;
      }
      const effectiveStakeType = confirmStakeType ?? stakeType;
      return handleStake({
        amount,
        approveType,
        permitSignature,
        unsignedMessage,
        message,
        effectiveApy,
        validatorPublicKey: validatorPubkey,
        stakeType: effectiveStakeType,
        postWrapStakeToken:
          effectiveStakeType === 'wrap' ? wrappedStakeAsset?.info : undefined,
        postWrapApproveSpenderAddress:
          effectiveStakeType === 'wrap' ? approveSpenderAddress : undefined,
        symbol: stakeRequestSymbol,
        provider: providerName,
        inputTokenAddress: selectedStakeTokenAddress,
        stakingInfo: {
          label: EEarnLabels.Stake,
          protocol: earnUtils.getEarnProviderName({
            providerName,
          }),
          protocolLogoURI: protocolInfo?.providerDetail.logoURI,
          send: { token, amount },
          tags: [actionTag],
        },
        onStepChange,
        // TODO: remove term after babylon remove term
        term: undefined,
        feeRate: Number(btcFeeRate) > 0 ? Number(btcFeeRate) : undefined,
        protocolVault: earnUtils.shouldSendEarnProtocolVault({
          providerName,
        })
          ? protocolInfo?.vault
          : undefined,
        onSuccess: async (txs) => {
          appNavigation.pop();
          defaultLogger.staking.page.staking({
            token,
            stakingProtocol: providerName,
          });
          const tx = txs[0];
          if (approveType === EApproveType.Permit && permitSignature) {
            removePermitCache({
              accountId,
              networkId,
              providerName,
              approveSpenderAddress:
                earnUtils.resolveEarnAllowanceSpenderAddress({
                  providerName,
                  networkId,
                  approveType,
                  approveSpenderAddress,
                }),
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
          onSuccess?.();
        },
      });
    },
    [
      handleStake,
      isStakeAssetReady,
      token,
      stakeRequestSymbol,
      providerName,
      protocolInfo?.providerDetail.logoURI,
      protocolInfo?.vault,
      actionTag,
      btcFeeRate,
      appNavigation,
      onSuccess,
      removePermitCache,
      accountId,
      networkId,
      effectiveStakeTokenInfo?.token.address,
      selectedStakeTokenAddress,
      stakeType,
      wrappedStakeAsset,
      approveSpenderAddress,
    ],
  );

  const intl = useIntl();

  const { result: estimateFeeUTXO } = usePromiseResult(async () => {
    if (!networkUtils.isBTCNetwork(networkId)) {
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
  }, [accountId, networkId]);

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
  const tokenSymbol = effectiveStakeTokenInfo?.token.symbol || '';
  const balanceParsed = effectiveStakeTokenInfo?.balanceParsed || '';
  const decimals =
    protocolInfo?.protocolInputDecimals ??
    effectiveStakeTokenInfo?.token.decimals ??
    0;

  return (
    <Page scrollEnabled scrollProps={{ keyboardShouldPersistTaps: 'handled' }}>
      <Page.Header
        title={intl.formatMessage(
          { id: ETranslations.earn_earn_token },
          { token: tokenSymbol },
        )}
      />
      <Page.Body>
        <UniversalStake
          key={`stake-input-${selectedStakeTokenUniqueKey || tokenInfo?.token?.uniqueKey || 'default'}`}
          accountId={accountId}
          networkId={networkId}
          decimals={decimals}
          balance={balanceParsed}
          tokenImageUri={token?.logoURI}
          tokenSymbol={token?.symbol}
          providerLogo={protocolInfo?.providerDetail.logoURI}
          providerName={protocolInfo?.provider}
          onConfirm={onConfirm}
          isDisabled={!isStakeAssetReady}
          approveType={effectiveApproveType}
          currentAllowance={
            isEtherFiProvider
              ? selectedTokenAllowance
              : (allowanceResult?.allowanceParsed ?? currentAllowance)
          }
          minTransactionFee={protocolInfo?.minTransactionFee}
          estimateFeeUTXO={estimateFeeUTXO}
          onFeeRateChange={onFeeRateChange}
          tokenInfo={effectiveStakeTokenInfo}
          protocolInfo={protocolInfo}
          stakeType={stakeType}
          approveTarget={{
            accountId,
            networkId,
            spenderAddress: approveSpenderAddress,
            token: effectiveStakeTokenInfo?.token,
          }}
          postWrapApproveTarget={
            stakeType === 'wrap'
              ? {
                  spenderAddress: approveSpenderAddress,
                  token: wrappedStakeAsset?.info,
                }
              : undefined
          }
          tokenSelectorTriggerProps={stakeTokenSelectorTriggerProps}
          requestSymbol={stakeRequestSymbol}
          transactionInputTokenAddress={selectedStakeTokenAddress}
        />
      </Page.Body>
    </Page>
  );
}

export default function StakePage() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <EarnProviderMirror storeName={EJotaiContextStoreNames.earn}>
        <DiscoveryBrowserProviderMirror>
          <BasicStakePage />
        </DiscoveryBrowserProviderMirror>
      </EarnProviderMirror>
    </AccountSelectorProviderMirror>
  );
}
