import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactElement } from 'react';

import { useIntl } from 'react-intl';

import { Alert, Page, Spinner } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useEarnActions } from '@onekeyhq/kit/src/states/jotai/contexts/earn/actions';
import { getEarnProtocol } from '@onekeyhq/kit/src/views/Earn/protocols';
import type { IEarnStakeConfirmParams } from '@onekeyhq/kit/src/views/Staking/earnDepositTask/types';
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
import type { IFeeUTXO } from '@onekeyhq/shared/types/fee';
import {
  EApproveType,
  EEarnLabels,
  type IEarnTokenInfo,
  type IEarnTokenItem,
} from '@onekeyhq/shared/types/staking';
import type { IToken } from '@onekeyhq/shared/types/token';

import { DiscoveryBrowserProviderMirror } from '../../../Discovery/components/DiscoveryBrowserProviderMirror';
import { EarnProviderMirror } from '../../../Earn/EarnProviderMirror';
import { RetainedTaskFallback } from '../../components/EarnProtocolForms/RetainedTaskFallback';
import { EarnStakeForm } from '../../components/EarnProtocolForms/Stake';
import { findRetainedDepositAsset } from '../../earnDepositTask/retainedAsset';
import {
  getDepositTaskOwnerKey,
  useRetainedDepositTask,
} from '../../earnDepositTask/useRetainedDepositTask';
import { useEtherFiStakeApproval } from '../../hooks/useEtherFiStakeApproval';
import { useStakeAssets } from '../../hooks/useStakeAssets';
import { useUniversalStake } from '../../hooks/useUniversalHooks';
import {
  buildStakeTokenUniqueKey,
  resolveEarnStakeRequestSymbol,
  resolveEarnStakeType,
  resolveSelectedStakeAsset,
  resolveStakeTokenAddress,
  resolveWrappedStakeAsset,
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
  const retainedOwnerKey = getDepositTaskOwnerKey({
    accountId,
    accountAddress: protocolInfo?.earnAccount?.accountAddress,
    networkId,
    provider: providerName,
    vault: protocolInfo?.vault,
  });
  const retained = useRetainedDepositTask(retainedOwnerKey);
  const retainedTask = retained.status === 'ready' ? retained.value : null;
  const appNavigation = useAppNavigation();
  const earnProtocol = useMemo(
    () => getEarnProtocol(providerName),
    [providerName],
  );
  const stakeAssetPolicy = earnProtocol.getStakeAssetPolicy();
  const stakePresentation = earnProtocol.getStakePresentation();
  const stakeTracking = earnProtocol.getOrderTrackingPolicy();
  const [selectedStakeAsset, setSelectedStakeAsset] = useState<
    IEarnTokenItem | undefined
  >(undefined);
  const stakeAssetsSymbol = useMemo(
    () =>
      earnProtocol.resolveStakeRequestSymbol({
        protocolSymbol: protocolInfo?.symbol,
      }),
    [earnProtocol, protocolInfo?.symbol],
  );

  const nativeWrapSelectedRef = useRef(false);
  const {
    result: stakeAssetsList,
    isLoading: isStakeAssetsLoading,
    run: retryStakeAssets,
    scopeKey: stakeAssetsScopeKey,
    wrappedToken,
    isWrappedTokenLoading,
    retryWrappedToken,
  } = useStakeAssets({
    enabled: stakeAssetPolicy.selection === 'wrapped',
    accountId,
    networkId,
    providerName,
    symbol: stakeAssetsSymbol,
    vault: protocolInfo?.vault,
    nativeWrapSelectedRef,
  });

  const selectableStakeAssets = useMemo(() => {
    return stakeAssetsList?.scopeKey === stakeAssetsScopeKey &&
      stakeAssetsList.isCurrentScope()
      ? stakeAssetsList.assets
      : [];
  }, [stakeAssetsList, stakeAssetsScopeKey]);
  const stakeAssetsError =
    stakeAssetPolicy.assetError === 'always' &&
    isStakeAssetsLoading !== true &&
    stakeAssetsList?.scopeKey === stakeAssetsScopeKey &&
    stakeAssetsList.isCurrentScope() &&
    stakeAssetsList.status === 'error';

  const activeStakeAsset = retainedTask
    ? findRetainedDepositAsset({
        assets: selectableStakeAssets,
        networkId,
        inputTokenAddress: retainedTask.task.identity.inputTokenAddress,
      })
    : resolveSelectedStakeAsset({
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
    if (stakeAssetPolicy.selection !== 'wrapped') {
      return undefined;
    }
    return (
      resolveWrappedStakeAsset({
        assets: selectableStakeAssets,
        networkId,
        providerName,
      }) ?? (wrappedToken ? { info: wrappedToken } : undefined)
    );
  }, [
    stakeAssetPolicy.selection,
    selectableStakeAssets,
    networkId,
    providerName,
    wrappedToken,
  ]);

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
  useLayoutEffect(() => {
    nativeWrapSelectedRef.current =
      stakeAssetPolicy.assetError === 'selected-wrap' && stakeType === 'wrap';
  }, [stakeAssetPolicy.assetError, stakeType]);

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
  const selectedStakeApproval = useEtherFiStakeApproval({
    enabled: stakeAssetPolicy.approval === 'selected-asset',
    networkId,
    provider: providerName,
    symbol:
      stakeType === 'wrap'
        ? wrappedStakeAsset && activeStakeAsset?.info.symbol
        : activeStakeAsset?.info.symbol,
    vault: protocolInfo?.vault,
    wrappedNative: stakeType === 'wrap',
  });
  const stakeApprove =
    stakeAssetPolicy.approval === 'selected-asset'
      ? selectedStakeApproval.approve
      : protocolInfo?.approve;
  const missingWrappedStakeAsset = Boolean(
    stakeAssetPolicy.selection === 'wrapped' &&
    stakeType === 'wrap' &&
    isStakeAssetsLoading !== true &&
    !isWrappedTokenLoading &&
    stakeAssetsList?.scopeKey === stakeAssetsScopeKey &&
    stakeAssetsList.isCurrentScope() &&
    stakeAssetsList.status === 'success' &&
    !wrappedStakeAsset,
  );
  const wrappedStakeAssetsError = Boolean(
    stakeAssetPolicy.assetError === 'selected-wrap' &&
    stakeType === 'wrap' &&
    isStakeAssetsLoading !== true &&
    stakeAssetsList?.scopeKey === stakeAssetsScopeKey &&
    stakeAssetsList.isCurrentScope() &&
    stakeAssetsList.status === 'error',
  );
  const isStakeAssetReady =
    (stakeType !== 'wrap' ||
      Boolean(
        wrappedStakeAsset &&
        stakeAssetsList?.scopeKey === stakeAssetsScopeKey &&
        stakeAssetsList.isCurrentScope() &&
        stakeAssetsList.status === 'success' &&
        isStakeAssetsLoading !== true,
      )) &&
    (stakeAssetPolicy.approval !== 'selected-asset' ||
      Boolean(
        activeStakeAsset &&
        stakeApprove?.approveTarget &&
        stakeApprove.approveType,
      ));
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
    if (stakePresentation.feeInput === 'utxo') {
      return (value: string) => setBtcFeeRate(value);
    }
  }, [stakePresentation.feeInput]);

  const handleStake = useUniversalStake({
    accountId,
    networkId,
    scopeKey: [
      providerName,
      protocolInfo?.vault,
      selectedStakeTokenAddress,
      stakeType,
    ].join('|'),
  });

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
    if (
      stakeAssetPolicy.selection !== 'wrapped' ||
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
    handleOpenStakeTokenSelector,
    stakeAssetPolicy.selection,
    selectableStakeAssets.length,
  ]);

  const onConfirm = useCallback(
    async (
      {
        amount,
        approveType,
        permitSignature,
        unsignedMessage,
        message,
        effectiveApy,
        validatorPubkey,
        stakeType: confirmStakeType,
        taskMode,
        taskAccountAddress,
        isSendCurrent,
        stakefishSignTask,
        workflowHandoff,
        workflowSpenderAddress,
        resumeTaskState,
        directDepositTask,
        prepareWrappedDeposit,
        beforeDepositTaskSend,
        canSendDepositTask,
        onDepositTaskReady,
        onDepositTaskChange,
        onDepositTaskSettled,
        canRecoverDepositRecording,
        onStepChange,
        onWrapStateChange,
      }: IEarnStakeConfirmParams,
      isActionCurrent?: () => boolean,
    ) => {
      if (!token || !isStakeAssetReady) {
        // Nothing was started, so the form keeps what the user typed.
        return false;
      }
      const effectiveStakeType = confirmStakeType ?? stakeType;
      return handleStake({
        isActionCurrent,
        amount,
        approveType,
        permitSignature,
        unsignedMessage,
        message,
        effectiveApy,
        validatorPublicKey: validatorPubkey,
        stakeType: effectiveStakeType,
        taskMode,
        taskAccountAddress,
        isSendCurrent,
        stakefishSignTask,
        workflowHandoff,
        workflowSpenderAddress,
        resumeTaskState,
        directDepositTask,
        prepareWrappedDeposit,
        beforeDepositTaskSend,
        canSendDepositTask,
        onDepositTaskReady,
        onDepositTaskChange,
        onDepositTaskSettled,
        canRecoverDepositRecording,
        postWrapStakeToken:
          effectiveStakeType === 'wrap' ? wrappedStakeAsset?.info : undefined,
        inputToken: effectiveStakeType === 'wrap' ? token : undefined,
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
        onWrapStateChange,
        // TODO: remove term after babylon remove term
        term: undefined,
        feeRate: Number(btcFeeRate) > 0 ? Number(btcFeeRate) : undefined,
        protocolVault: earnUtils.shouldSendEarnProtocolVault({
          providerName,
        })
          ? protocolInfo?.vault
          : undefined,
        onSubmitted: async (txid) => {
          if (
            !workflowHandoff &&
            approveType === EApproveType.Permit &&
            permitSignature
          ) {
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
              expectedSignature: permitSignature,
              ...(taskAccountAddress
                ? { expectedAccountAddress: taskAccountAddress }
                : undefined),
            });
          }
          if (stakeTracking === 'babylon') {
            await backgroundApiProxy.serviceStaking.addBabylonTrackingItem({
              txId: txid,
              action: 'stake',
              createAt: Date.now(),
              accountId,
              networkId,
              amount,
              minStakeTerm: undefined,
            });
          }
        },
        onSuccess: () => {
          if (!(isSendCurrent?.() ?? true)) return;
          appNavigation.pop();
          defaultLogger.staking.page.staking({
            token,
            stakingProtocol: providerName,
          });
          onSuccess?.();
        },
      });
    },
    [
      handleStake,
      isStakeAssetReady,
      token,
      stakeRequestSymbol,
      stakeTracking,
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

  let retainedView: ReactElement | undefined;
  if (retained.status === 'checking') {
    retainedView = <Spinner />;
  } else if (retained.status === 'unavailable') {
    retainedView = (
      <Alert
        type="critical"
        title={intl.formatMessage({
          id: ETranslations.global_an_error_occurred,
        })}
        action={{
          primary: intl.formatMessage({ id: ETranslations.global_retry }),
          onPrimaryPress: () => {
            retained.retry();
            void retryStakeAssets();
          },
        }}
      />
    );
  } else if (retainedTask && !activeStakeAsset) {
    retainedView = (
      <RetainedTaskFallback
        ownerKey={retainedOwnerKey}
        retainedTask={retainedTask}
        assetsLoading={isStakeAssetsLoading !== false}
        onRetryAssets={() => void retryStakeAssets()}
      />
    );
  }

  return (
    <Page scrollEnabled scrollProps={{ keyboardShouldPersistTaps: 'handled' }}>
      <Page.Header
        title={intl.formatMessage(
          { id: ETranslations.earn_earn_token },
          { token: tokenSymbol },
        )}
      />
      <Page.Body>
        {retainedView || (
          <EarnStakeForm
            retainedTask={retainedTask}
            showStandaloneKeyboardFooter
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
            beforeFooter={
              stakeAssetsError ||
              wrappedStakeAssetsError ||
              missingWrappedStakeAsset ||
              selectedStakeApproval.error ? (
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
                      if (
                        stakeAssetsError ||
                        wrappedStakeAssetsError ||
                        missingWrappedStakeAsset
                      ) {
                        void retryStakeAssets();
                        void retryWrappedToken();
                      }
                      if (selectedStakeApproval.error) {
                        void selectedStakeApproval.retry();
                      }
                    },
                  }}
                />
              ) : undefined
            }
            approveType={effectiveApproveType}
            currentAllowance={
              stakeAssetPolicy.approval === 'selected-asset'
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
        )}
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
