import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Alert, Page } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { IModalStakingParamList } from '@onekeyhq/shared/src/routes';
import { EModalRoutes, EModalStakingRoutes } from '@onekeyhq/shared/src/routes';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import { isAllowedEtherFiAsset } from '@onekeyhq/shared/src/utils/etherFiVaults';
import {
  EEarnLabels,
  type IEarnTokenItem,
  type IEarnWithdrawType,
} from '@onekeyhq/shared/types/staking';

import { DiscoveryBrowserProviderMirror } from '../../../Discovery/components/DiscoveryBrowserProviderMirror';
import { UniversalWithdraw } from '../../components/UniversalWithdraw';
import { useEtherFiWithdrawApproval } from '../../hooks/useEtherFiWithdrawApproval';
import { useUniversalWithdraw } from '../../hooks/useUniversalHooks';
import { normalizeStakeTokenAddress } from '../../utils/utils';

import { resolveWithdrawShareToken } from './withdrawShareTokenUtils';

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
  const isEtherFi = earnUtils.isEtherFiProvider({ providerName });
  const isEtherFiCancellation = isEtherFi && withdrawType === 'cancel';
  const requestSymbol = isEtherFi
    ? protocolInfo?.symbol || symbol || ''
    : tokenInfo?.token.symbol || protocolInfo?.symbol || symbol || '';
  const withdrawalApproval = useEtherFiWithdrawApproval({
    enabled: isEtherFi && !isEtherFiCancellation,
    accountId,
    networkId,
    provider: providerName,
    symbol: requestSymbol,
    vault: protocolInfo?.vault,
  });
  const effectiveProtocolInfo = useMemo(
    () =>
      isEtherFi && !isEtherFiCancellation && protocolInfo
        ? { ...protocolInfo, withdrawApprove: withdrawalApproval.approval }
        : protocolInfo,
    [
      isEtherFi,
      isEtherFiCancellation,
      protocolInfo,
      withdrawalApproval.approval,
    ],
  );
  const shareToken = useMemo(
    () =>
      resolveWithdrawShareToken({
        accountId,
        networkId,
        provider: providerName,
        protocolInfo: effectiveProtocolInfo,
        tokenInfo,
        initialAmount,
        withdrawType,
      }),
    [
      accountId,
      effectiveProtocolInfo,
      initialAmount,
      networkId,
      providerName,
      tokenInfo,
      withdrawType,
    ],
  );
  const effectiveTokenInfo =
    isEtherFi && !isEtherFiCancellation ? shareToken.tokenInfo : tokenInfo;
  const token = effectiveTokenInfo?.token;
  const tokenSymbol = token?.symbol || protocolInfo?.symbol || symbol || '';
  const active = protocolInfo?.activeBalance;
  const overflow = protocolInfo?.overflowBalance;
  const price = effectiveTokenInfo?.price
    ? String(effectiveTokenInfo.price)
    : '0';
  const vault = protocolInfo?.vault || '';
  const actionTag = protocolInfo?.stakeTag || '';
  const appNavigation = useAppNavigation();
  const [selectedOutput, setSelectedOutput] = useState<
    IEarnTokenItem | undefined
  >();
  const outputScopeKey = JSON.stringify([
    accountId,
    networkId,
    providerName,
    requestSymbol,
    vault,
    protocolInfo?.earnAccount?.accountAddress,
  ]);
  const { result: outputAssets, run: retryOutputAssets } = usePromiseResult(
    async () => {
      if (
        !isEtherFi ||
        isEtherFiCancellation ||
        !accountId ||
        !requestSymbol ||
        !vault
      )
        return undefined;
      try {
        const response =
          await backgroundApiProxy.serviceStaking.getEarnAssetsList({
            accountId,
            networkId,
            provider: providerName,
            symbol: requestSymbol,
            vault,
            action: 'unstake',
          });
        const assets = response.assets.filter((asset) =>
          isAllowedEtherFiAsset({
            vault,
            networkId,
            direction: 'unstake',
            token: asset.info,
          }),
        );
        return {
          assets,
          scopeKey: outputScopeKey,
          error: response.assets.length > 0 && assets.length === 0,
        };
      } catch {
        return { assets: [], scopeKey: outputScopeKey, error: true };
      }
    },
    [
      accountId,
      isEtherFi,
      isEtherFiCancellation,
      networkId,
      providerName,
      requestSymbol,
      vault,
      outputScopeKey,
    ],
    { watchLoading: true, undefinedResultIfReRun: true },
  );
  useEffect(() => {
    setSelectedOutput((current) => {
      if (outputAssets?.scopeKey !== outputScopeKey) return undefined;
      const matched = outputAssets?.assets.find(
        (asset) =>
          current &&
          normalizeStakeTokenAddress(asset.info) ===
            normalizeStakeTokenAddress(current.info) &&
          asset.info.symbol.toLowerCase() === current.info.symbol.toLowerCase(),
      );
      return matched ?? outputAssets?.assets[0];
    });
  }, [outputAssets, outputScopeKey]);
  const selectedOutputIsCurrent = Boolean(
    selectedOutput &&
    outputAssets?.scopeKey === outputScopeKey &&
    isAllowedEtherFiAsset({
      vault,
      networkId,
      direction: 'unstake',
      token: selectedOutput.info,
    }) &&
    outputAssets?.assets.some(
      (asset) =>
        normalizeStakeTokenAddress(asset.info) ===
          normalizeStakeTokenAddress(selectedOutput.info) &&
        asset.info.symbol.toLowerCase() ===
          selectedOutput.info.symbol.toLowerCase(),
    ),
  );
  const outputTokenAddress = selectedOutput?.info.isNative
    ? ''
    : selectedOutput?.info.address || '';
  const handleWithdraw = useUniversalWithdraw({ accountId, networkId });
  const withdrawAbortRef = useRef<AbortController | null>(null);
  const withdrawApproveToken = useMemo(() => {
    const withdrawApprove = effectiveProtocolInfo?.withdrawApprove;
    if (!withdrawApprove?.tokenAddress || !token) {
      return undefined;
    }
    if (isEtherFi) return token;
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
    isEtherFi,
    token,
  ]);
  const withdrawApproveSpender =
    effectiveProtocolInfo?.withdrawApprove?.approveTarget;
  const allowanceScopeKey = JSON.stringify([
    accountId,
    networkId,
    providerName,
    vault,
    protocolInfo?.earnAccount?.accountAddress,
    withdrawApproveSpender,
    withdrawApproveToken?.address,
  ]);
  const { result: withdrawAllowance, run: retryAllowance } = usePromiseResult(
    async () => {
      if (!withdrawApproveToken?.address || !withdrawApproveSpender) {
        return undefined;
      }
      try {
        const response =
          await backgroundApiProxy.serviceStaking.fetchTokenAllowance({
            accountId,
            networkId,
            expectedAccountAddress: isEtherFi
              ? protocolInfo?.earnAccount?.accountAddress
              : undefined,
            spenderAddress: withdrawApproveSpender,
            tokenAddress: withdrawApproveToken.address,
          });
        return { ...response, scopeKey: allowanceScopeKey, error: false };
      } catch (error) {
        if (!isEtherFi) throw error;
        return {
          allowanceParsed: undefined,
          scopeKey: allowanceScopeKey,
          error: true,
        };
      }
    },
    [
      accountId,
      networkId,
      withdrawApproveSpender,
      withdrawApproveToken?.address,
      allowanceScopeKey,
      protocolInfo?.earnAccount?.accountAddress,
      isEtherFi,
    ],
    { watchLoading: true },
  );
  const withdrawalReady = Boolean(
    protocolInfo?.earnAccount?.accountId === accountId &&
    protocolInfo?.earnAccount?.networkId === networkId &&
    protocolInfo?.earnAccount?.accountAddress &&
    (isEtherFiCancellation
      ? identity && vault
      : withdrawalApproval.approval &&
        shareToken.ready &&
        selectedOutputIsCurrent &&
        withdrawAllowance?.scopeKey === allowanceScopeKey &&
        withdrawAllowance.allowanceParsed !== undefined),
  );
  const handleSelectOutput = useCallback(() => {
    appNavigation.pushModal(EModalRoutes.StakingModal, {
      screen: EModalStakingRoutes.EarnTokenSelect,
      params: {
        accountId,
        networkId,
        provider: providerName,
        symbol: requestSymbol,
        vault,
        action: 'unstake',
        currentTokenAddress: selectedOutput?.info.isNative
          ? 'native'
          : selectedOutput?.info.address,
        onSelect: (item: IEarnTokenItem) => {
          if (
            isAllowedEtherFiAsset({
              vault,
              networkId,
              direction: 'unstake',
              token: item.info,
            })
          )
            setSelectedOutput(item);
        },
      },
    });
  }, [
    accountId,
    appNavigation,
    networkId,
    providerName,
    requestSymbol,
    selectedOutput?.info,
    vault,
  ]);

  useEffect(
    () => () => {
      withdrawAbortRef.current?.abort();
    },
    [],
  );

  const onConfirm = useCallback(
    async ({
      amount,
      actionSignal,
      verifyEtherFiLegacyApproval,
      onTransactionSubmitted,
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
      actionSignal?: AbortSignal;
      verifyEtherFiLegacyApproval?: () => Promise<boolean>;
      onTransactionSubmitted?: () => void;
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
      if (isEtherFi && !withdrawalReady) return false;
      withdrawAbortRef.current?.abort();
      const abortController = new AbortController();
      withdrawAbortRef.current = abortController;

      return handleWithdraw({
        amount,
        identity,
        expectedAccountAddress: isEtherFi
          ? protocolInfo?.earnAccount?.accountAddress
          : undefined,
        protocolVault: earnUtils.shouldSendEarnProtocolVault({
          providerName,
        })
          ? vault
          : undefined,
        symbol: isEtherFi ? requestSymbol : tokenSymbol,
        provider: providerName,
        inputTokenAddress:
          isEtherFi && !isEtherFiCancellation ? token?.address : undefined,
        outputTokenAddress:
          isEtherFi && !isEtherFiCancellation ? outputTokenAddress : undefined,
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
        signal: actionSignal ?? abortController.signal,
        verifyEtherFiLegacyApproval,
        onSuccess: () => {
          onTransactionSubmitted?.();
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
      tokenSymbol,
      protocolInfo?.providerDetail.logoURI,
      protocolInfo?.earnAccount?.accountAddress,
      actionTag,
      appNavigation,
      token,
      onSuccess,
      isEtherFi,
      isEtherFiCancellation,
      requestSymbol,
      outputTokenAddress,
      withdrawalReady,
    ],
  );

  const balance = useMemo(() => {
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
  ]);

  const initialWithdrawAmount = useMemo(() => {
    if (withdrawType === 'cancel') {
      return '0';
    }
    if (allowPartialWithdraw) {
      return undefined;
    }
    return isEtherFi ? shareToken.initialAmount : initialAmount;
  }, [
    allowPartialWithdraw,
    initialAmount,
    isEtherFi,
    shareToken.initialAmount,
    withdrawType,
  ]);

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
            isEtherFi && !isEtherFiCancellation
              ? token?.decimals
              : (protocolInfo?.protocolInputDecimals ?? token?.decimals)
          }
          balance={
            isEtherFi && !isEtherFiCancellation
              ? (shareToken.balance ?? '0')
              : balance
          }
          accountId={accountId}
          networkId={networkId}
          initialAmount={initialWithdrawAmount}
          initialWithdrawType={withdrawType}
          tokenSymbol={tokenSymbol}
          tokenImageUri={token?.logoURI}
          providerLogo={protocolInfo?.providerDetail.logoURI}
          providerName={providerName}
          protocolInfo={effectiveProtocolInfo}
          tokenInfo={effectiveTokenInfo}
          identity={identity}
          onConfirm={onConfirm}
          requestSymbol={isEtherFi ? requestSymbol : undefined}
          isActionDisabled={isEtherFi && !withdrawalReady}
          transactionInputTokenAddress={
            isEtherFi && !isEtherFiCancellation ? token?.address : undefined
          }
          transactionOutputTokenAddress={
            isEtherFi && !isEtherFiCancellation ? outputTokenAddress : undefined
          }
          receiveInputConfig={
            isEtherFi && !isEtherFiCancellation
              ? {
                  enabled: Boolean(selectedOutput),
                  tokenImageUri: selectedOutput?.info.logoURI,
                  tokenSymbol: selectedOutput?.info.symbol,
                  tokenAddress: outputTokenAddress,
                  balance: selectedOutput?.balanceParsed,
                  price: selectedOutput?.price,
                  tokenSelectorTriggerProps: outputAssets?.assets.length
                    ? {
                        disabled: outputAssets.assets.length <= 1,
                        onPress:
                          outputAssets.assets.length > 1
                            ? handleSelectOutput
                            : undefined,
                      }
                    : undefined,
                }
              : undefined
          }
          beforeFooter={
            isEtherFi &&
            !isEtherFiCancellation &&
            (withdrawalApproval.error ||
              outputAssets?.error ||
              withdrawAllowance?.error ||
              (outputAssets?.scopeKey === outputScopeKey &&
                !outputAssets.assets.length)) ? (
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
                    if (withdrawalApproval.error)
                      void withdrawalApproval.retry();
                    if (outputAssets?.error || !outputAssets?.assets.length)
                      void retryOutputAssets();
                    if (withdrawAllowance?.error) void retryAllowance();
                  },
                }}
              />
            ) : undefined
          }
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
          currentAllowance={
            !isEtherFi || withdrawAllowance?.scopeKey === allowanceScopeKey
              ? withdrawAllowance?.allowanceParsed
              : undefined
          }
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
