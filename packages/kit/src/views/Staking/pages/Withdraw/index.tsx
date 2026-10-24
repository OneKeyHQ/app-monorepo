import { useCallback, useEffect, useMemo, useRef } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Page } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { IModalStakingParamList } from '@onekeyhq/shared/src/routes';
import { EModalRoutes, EModalStakingRoutes } from '@onekeyhq/shared/src/routes';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import {
  EEarnLabels,
  type IEarnWithdrawType,
} from '@onekeyhq/shared/types/staking';

import { DiscoveryBrowserProviderMirror } from '../../../Discovery/components/DiscoveryBrowserProviderMirror';
import { UniversalWithdraw } from '../../components/UniversalWithdraw';
import { useEarnWithdrawAssets } from '../../hooks/useEarnWithdrawAssets';
import { useUniversalWithdraw } from '../../hooks/useUniversalHooks';
import { resolveStakeTokenAddress } from '../../utils/utils';

import { resolveWithdrawShareToken } from './withdrawShareTokenUtils';

import type { IManagePageV2ReceiveInputConfig } from '../../components/ManagePageV2ReceiveInput';

/** 按服务端单位展示赎回资产，缺少元数据时禁用新赎回；取消已有请求不依赖资产选择或授权。 */
const WithdrawPage = () => {
  const intl = useIntl();
  const route = useAppRoute<
    IModalStakingParamList,
    EModalStakingRoutes.Withdraw
  >();
  const {
    accountId,
    networkId,
    protocolInfo,
    tokenInfo,
    identity,
    amount: initialAmount,
    onSuccess,
    fromPage,
    allowPartialWithdraw,
    withdrawType,
    symbol,
    provider,
  } = route.params;

  const providerName = protocolInfo?.provider || provider || '';
  const isCancelWithdrawal = withdrawType === 'cancel';
  const amountUnit = protocolInfo?.withdrawApprove?.amountUnit;
  const shareInput = useMemo(
    () =>
      resolveWithdrawShareToken({
        accountId,
        networkId,
        provider: providerName,
        protocolInfo,
        tokenInfo,
        initialAmount,
        withdrawType,
      }),
    [
      accountId,
      networkId,
      providerName,
      protocolInfo,
      tokenInfo,
      initialAmount,
      withdrawType,
    ],
  );
  const effectiveTokenInfo = shareInput.tokenInfo;
  const token = effectiveTokenInfo?.token;
  const tokenSymbol = token?.symbol || protocolInfo?.symbol || symbol || '';
  const requestSymbol =
    amountUnit === 'shares'
      ? protocolInfo?.symbol || symbol || ''
      : tokenSymbol;
  const active = protocolInfo?.activeBalance;
  const overflow = protocolInfo?.overflowBalance;
  const price = effectiveTokenInfo?.price
    ? String(effectiveTokenInfo.price)
    : '0';
  const vault = protocolInfo?.vault || '';
  const actionTag = protocolInfo?.stakeTag || '';
  const appNavigation = useAppNavigation();
  const { assets, selectedAsset, selectAsset } = useEarnWithdrawAssets({
    enabled: !isCancelWithdrawal && amountUnit === 'shares' && shareInput.ready,
    accountId,
    networkId,
    provider: providerName,
    symbol: requestSymbol,
    vault: vault || undefined,
  });
  const outputTokenAddress = resolveStakeTokenAddress(selectedAsset?.info);
  const withdrawAssetsReady =
    isCancelWithdrawal ||
    amountUnit !== 'shares' ||
    Boolean(shareInput.ready && requestSymbol && selectedAsset?.info);

  const handleOpenReceiveTokenSelector = useCallback(
    /** 仅为已确认的份额仓位选择服务端允许的取回资产，空账户或未就绪时不打开选择器。 */
    () => {
      if (!accountId || !requestSymbol || !withdrawAssetsReady) return;
      appNavigation.pushModal(EModalRoutes.StakingModal, {
        screen: EModalStakingRoutes.EarnTokenSelect,
        params: {
          accountId,
          networkId,
          provider: providerName,
          symbol: requestSymbol,
          vault: vault || undefined,
          action: 'unstake',
          currentTokenAddress: selectedAsset?.info.isNative
            ? 'native'
            : selectedAsset?.info.address,
          onSelect: selectAsset,
        },
      });
    },
    [
      accountId,
      appNavigation,
      networkId,
      providerName,
      requestSymbol,
      selectAsset,
      selectedAsset?.info,
      vault,
      withdrawAssetsReady,
    ],
  );
  const receiveInputConfig = useMemo<
    IManagePageV2ReceiveInputConfig | undefined
  >(() => {
    if (amountUnit !== 'shares' || !selectedAsset) return undefined;
    return {
      enabled: true,
      tokenSymbol: selectedAsset.info.symbol,
      tokenImageUri: selectedAsset.info.logoURI,
      tokenAddress: outputTokenAddress,
      balance: selectedAsset.balanceParsed,
      price: selectedAsset.price,
      tokenSelectorTriggerProps: {
        disabled: assets.length <= 1,
        onPress: assets.length > 1 ? handleOpenReceiveTokenSelector : undefined,
      },
    };
  }, [
    amountUnit,
    assets.length,
    handleOpenReceiveTokenSelector,
    outputTokenAddress,
    selectedAsset,
  ]);
  const handleWithdraw = useUniversalWithdraw({ accountId, networkId });
  const withdrawAbortRef = useRef<AbortController | null>(null);
  const withdrawApproveToken = useMemo(() => {
    if (
      isCancelWithdrawal ||
      !protocolInfo?.withdrawApprove?.tokenAddress ||
      !token ||
      (amountUnit === 'shares' && !shareInput.ready)
    ) {
      return undefined;
    }
    return {
      ...token,
      address: protocolInfo.withdrawApprove.tokenAddress,
      isNative: false,
    };
  }, [
    amountUnit,
    isCancelWithdrawal,
    protocolInfo?.withdrawApprove?.tokenAddress,
    shareInput.ready,
    token,
  ]);
  const withdrawApproveSpender = protocolInfo?.withdrawApprove?.approveTarget;
  const { result: withdrawAllowance } = usePromiseResult(
    async () => {
      if (!withdrawApproveToken?.address || !withdrawApproveSpender) {
        return undefined;
      }
      return backgroundApiProxy.serviceStaking.fetchTokenAllowance({
        accountId,
        networkId,
        spenderAddress: withdrawApproveSpender,
        tokenAddress: withdrawApproveToken.address,
      });
    },
    [
      accountId,
      networkId,
      withdrawApproveSpender,
      withdrawApproveToken?.address,
    ],
    { watchLoading: true, undefinedResultIfReRun: true },
  );

  useEffect(
    () => () => {
      withdrawAbortRef.current?.abort();
    },
    [],
  );

  const onConfirm = useCallback(
    /** 新赎回提交前确认份额身份与输出选择；取消请求只保留原有定位参数，不要求重新选择资产。 */
    async ({
      amount,
      withdrawAll,
      signature,
      message,
      effectiveApy,
      useEthenaCooldown,
      resumeEthenaCooldownUnstake,
      onStepChange,
      onEthenaCooldownUnstakeReady,
      withdrawType: confirmWithdrawType,
    }: {
      amount: string;
      withdrawAll: boolean;
      // Stakefish: signature and message for withdraw all
      signature?: string;
      message?: string;
      effectiveApy?: string | number;
      useEthenaCooldown?: boolean;
      resumeEthenaCooldownUnstake?: boolean;
      onStepChange?: (step: number) => void;
      onEthenaCooldownUnstakeReady?: () => void;
      withdrawType?: IEarnWithdrawType;
    }) => {
      if (amountUnit === 'shares' && !withdrawAssetsReady) return false;
      withdrawAbortRef.current?.abort();
      const abortController = new AbortController();
      withdrawAbortRef.current = abortController;

      return handleWithdraw({
        amount,
        identity,
        protocolVault: earnUtils.shouldSendEarnProtocolVault({
          providerName,
        })
          ? vault
          : undefined,
        symbol: requestSymbol,
        provider: providerName,
        inputTokenAddress:
          !isCancelWithdrawal && amountUnit === 'shares'
            ? token?.address
            : undefined,
        outputTokenAddress:
          !isCancelWithdrawal && amountUnit === 'shares'
            ? outputTokenAddress
            : undefined,
        stakingInfo: {
          label: EEarnLabels.Withdraw,
          protocol: earnUtils.getEarnProviderName({
            providerName,
          }),
          protocolLogoURI: protocolInfo?.providerDetail.logoURI,
          tags: [actionTag],
        },
        withdrawAll,
        effectiveApy,
        // Signature and message for withdraw all
        withdrawSignature: signature,
        withdrawMessage: message,
        useEthenaCooldown,
        resumeEthenaCooldownUnstake,
        withdrawType: confirmWithdrawType,
        onStepChange,
        onEthenaCooldownUnstakeReady,
        signal: abortController.signal,
        onSuccess: () => {
          appNavigation.pop();
          defaultLogger.staking.page.unstaking({
            token,
            stakingProtocol: providerName,
          });
          onSuccess?.();
        },
      });
    },
    [
      handleWithdraw,
      identity,
      providerName,
      vault,
      requestSymbol,
      amountUnit,
      isCancelWithdrawal,
      outputTokenAddress,
      withdrawAssetsReady,
      protocolInfo?.providerDetail.logoURI,
      actionTag,
      appNavigation,
      token,
      onSuccess,
    ],
  );

  const balance = useMemo(() => {
    if (amountUnit === 'shares') {
      return shareInput.ready ? (shareInput.balance ?? '0') : '0';
    }
    if (fromPage === EModalStakingRoutes.WithdrawOptions) {
      return BigNumber(initialAmount ?? 0).toFixed();
    }
    return earnUtils.isVaultBasedProvider({ providerName })
      ? BigNumber(protocolInfo?.maxUnstakeAmount ?? active ?? 0).toFixed()
      : BigNumber(active ?? 0)
          .plus(overflow ?? 0)
          .toFixed();
  }, [
    fromPage,
    providerName,
    protocolInfo?.maxUnstakeAmount,
    active,
    overflow,
    initialAmount,
    amountUnit,
    shareInput.ready,
    shareInput.balance,
  ]);

  const initialWithdrawAmount = useMemo(() => {
    if (withdrawType === 'cancel') {
      return '0';
    }
    if (allowPartialWithdraw) {
      return undefined;
    }
    return shareInput.initialAmount;
  }, [allowPartialWithdraw, shareInput.initialAmount, withdrawType]);

  return (
    <Page scrollEnabled>
      <Page.Header
        title={intl.formatMessage(
          { id: ETranslations.earn_withdraw_token },
          { token: tokenSymbol },
        )}
      />
      <Page.Body>
        <UniversalWithdraw
          isInModalContext
          accountAddress={protocolInfo?.earnAccount?.accountAddress || ''}
          price={price}
          decimals={
            amountUnit === 'shares'
              ? token?.decimals
              : (protocolInfo?.protocolInputDecimals ?? token?.decimals)
          }
          balance={balance}
          accountId={accountId}
          networkId={networkId}
          initialAmount={initialWithdrawAmount}
          initialWithdrawType={withdrawType}
          tokenSymbol={tokenSymbol}
          requestSymbol={requestSymbol}
          amountUnit={amountUnit}
          isDisabled={!withdrawAssetsReady}
          withdrawAssetsReady={withdrawAssetsReady}
          transactionInputTokenAddress={
            !isCancelWithdrawal && amountUnit === 'shares'
              ? token?.address
              : undefined
          }
          transactionOutputTokenAddress={
            !isCancelWithdrawal && amountUnit === 'shares'
              ? outputTokenAddress
              : undefined
          }
          receiveInputConfig={receiveInputConfig}
          tokenImageUri={token?.logoURI}
          providerLogo={protocolInfo?.providerDetail.logoURI}
          providerName={providerName}
          protocolInfo={protocolInfo}
          tokenInfo={effectiveTokenInfo}
          identity={identity}
          onConfirm={onConfirm}
          minAmount={
            Number(protocolInfo?.minUnstakeAmount) > 0
              ? String(protocolInfo?.minUnstakeAmount)
              : undefined
          }
          protocolVault={vault}
          approveTarget={
            withdrawApproveSpender && withdrawApproveToken
              ? {
                  accountId,
                  networkId,
                  spenderAddress: withdrawApproveSpender,
                  token: withdrawApproveToken,
                }
              : undefined
          }
          currentAllowance={withdrawAllowance?.allowanceParsed}
          receiptTokenRate={
            protocolInfo?.withdrawApprove?.receiptTokenRate ??
            protocolInfo?.receiptTokenRate ??
            protocolInfo?.morphoTokenRate
          }
        />
      </Page.Body>
    </Page>
  );
};

export default function WithdrawPageWithProvider() {
  return (
    <DiscoveryBrowserProviderMirror>
      <WithdrawPage />
    </DiscoveryBrowserProviderMirror>
  );
}
