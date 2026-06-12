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
import { EModalStakingRoutes } from '@onekeyhq/shared/src/routes';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import {
  EEarnLabels,
  type IEarnWithdrawType,
} from '@onekeyhq/shared/types/staking';

import { DiscoveryBrowserProviderMirror } from '../../../Discovery/components/DiscoveryBrowserProviderMirror';
import { UniversalWithdraw } from '../../components/UniversalWithdraw';
import { useUniversalWithdraw } from '../../hooks/useUniversalHooks';

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

  const token = tokenInfo?.token;
  const tokenSymbol = token?.symbol || protocolInfo?.symbol || symbol || '';
  const providerName = protocolInfo?.provider || provider || '';
  const active = protocolInfo?.activeBalance;
  const overflow = protocolInfo?.overflowBalance;
  const price = tokenInfo?.price ? String(tokenInfo.price) : '0';
  const vault = protocolInfo?.vault || '';
  const actionTag = protocolInfo?.stakeTag || '';
  const appNavigation = useAppNavigation();
  const handleWithdraw = useUniversalWithdraw({ accountId, networkId });
  const withdrawAbortRef = useRef<AbortController | null>(null);
  const isNativeProvider = useMemo(
    () => earnUtils.isNativeProvider({ providerName }),
    [providerName],
  );
  const nativeWithdrawApproveToken = useMemo(() => {
    if (
      !isNativeProvider ||
      !protocolInfo?.withdrawApprove?.tokenAddress ||
      !token
    ) {
      return undefined;
    }
    return {
      ...token,
      address: protocolInfo.withdrawApprove.tokenAddress,
      isNative: false,
    };
  }, [isNativeProvider, protocolInfo?.withdrawApprove?.tokenAddress, token]);
  const nativeWithdrawApproveSpender =
    protocolInfo?.withdrawApprove?.approveTarget;
  const { result: nativeWithdrawAllowance } = usePromiseResult(
    async () => {
      if (
        !isNativeProvider ||
        !nativeWithdrawApproveToken?.address ||
        !nativeWithdrawApproveSpender
      ) {
        return undefined;
      }
      return backgroundApiProxy.serviceStaking.fetchTokenAllowance({
        accountId,
        networkId,
        spenderAddress: nativeWithdrawApproveSpender,
        tokenAddress: nativeWithdrawApproveToken.address,
      });
    },
    [
      accountId,
      networkId,
      isNativeProvider,
      nativeWithdrawApproveSpender,
      nativeWithdrawApproveToken?.address,
    ],
    { watchLoading: true },
  );

  useEffect(
    () => () => {
      withdrawAbortRef.current?.abort();
    },
    [],
  );

  const onConfirm = useCallback(
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
      withdrawAbortRef.current?.abort();
      const abortController = new AbortController();
      withdrawAbortRef.current = abortController;

      await handleWithdraw({
        amount,
        identity,
        protocolVault: earnUtils.shouldSendEarnProtocolVault({
          providerName,
        })
          ? vault
          : undefined,
        symbol: tokenSymbol,
        provider: providerName,
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
      tokenSymbol,
      protocolInfo?.providerDetail.logoURI,
      actionTag,
      appNavigation,
      token,
      onSuccess,
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
    return initialAmount;
  }, [allowPartialWithdraw, initialAmount, withdrawType]);

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
          decimals={protocolInfo?.protocolInputDecimals ?? token?.decimals}
          balance={balance}
          accountId={accountId}
          networkId={networkId}
          initialAmount={initialWithdrawAmount}
          initialWithdrawType={withdrawType}
          tokenSymbol={tokenSymbol}
          tokenImageUri={token?.logoURI}
          providerLogo={protocolInfo?.providerDetail.logoURI}
          providerName={providerName}
          protocolInfo={protocolInfo}
          tokenInfo={tokenInfo}
          identity={identity}
          onConfirm={onConfirm}
          minAmount={
            Number(protocolInfo?.minUnstakeAmount) > 0
              ? String(protocolInfo?.minUnstakeAmount)
              : undefined
          }
          protocolVault={vault}
          approveTarget={
            nativeWithdrawApproveSpender && nativeWithdrawApproveToken
              ? {
                  accountId,
                  networkId,
                  spenderAddress: nativeWithdrawApproveSpender,
                  token: nativeWithdrawApproveToken,
                }
              : undefined
          }
          currentAllowance={nativeWithdrawAllowance?.allowanceParsed}
          receiptTokenRate={
            protocolInfo?.receiptTokenRate ?? protocolInfo?.morphoTokenRate
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
