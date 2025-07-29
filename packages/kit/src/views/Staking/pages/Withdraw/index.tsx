import { useCallback, useMemo } from 'react';

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
import { EEarnProviderEnum } from '@onekeyhq/shared/types/earn';
import { EEarnLabels } from '@onekeyhq/shared/types/staking';

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
  } = route.params;

  const token = tokenInfo?.token;
  const tokenSymbol = token?.symbol || '';
  const providerName = protocolInfo?.provider || '';
  const active = protocolInfo?.activeBalance;
  const overflow = protocolInfo?.overflowBalance;
  const price = tokenInfo?.price ? String(tokenInfo.price) : '0';
  const vault =
    protocolInfo?.approve?.approveTarget || protocolInfo?.vault || '';
  const actionTag = protocolInfo?.stakeTag || '';
  const appNavigation = useAppNavigation();
  const handleWithdraw = useUniversalWithdraw({ accountId, networkId });
  const onConfirm = useCallback(
    async ({
      amount,
      withdrawAll,
    }: {
      amount: string;
      withdrawAll: boolean;
    }) => {
      await handleWithdraw({
        amount,
        identity,
        protocolVault: earnUtils.useVaultProvider({
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
    return earnUtils.isMorphoProvider({ providerName })
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

  const { result: estimateFeeResp } = usePromiseResult(async () => {
    const account = await backgroundApiProxy.serviceAccount.getAccount({
      accountId,
      networkId,
    });
    const resp = await backgroundApiProxy.serviceStaking.estimateFee({
      networkId,
      provider: providerName,
      symbol: tokenSymbol,
      action: 'unstake',
      amount: earnUtils.isMomentumProvider({ providerName }) ? balance : '1',
      txId:
        providerName.toLowerCase() === EEarnProviderEnum.Babylon.toLowerCase()
          ? identity
          : undefined,
      protocolVault: earnUtils.useVaultProvider({
        providerName,
      })
        ? vault
        : undefined,
      identity,
      accountAddress: account.address,
    });
    return resp;
  }, [
    accountId,
    networkId,
    providerName,
    tokenSymbol,
    identity,
    vault,
    balance,
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
          accountAddress={protocolInfo?.earnAccount?.accountAddress || ''}
          price={price}
          decimals={token?.decimals}
          balance={balance}
          accountId={accountId}
          networkId={networkId}
          initialAmount={initialAmount}
          tokenSymbol={tokenSymbol}
          tokenImageUri={token?.logoURI}
          providerLogo={protocolInfo?.providerDetail.logoURI}
          providerName={providerName}
          onConfirm={onConfirm}
          minAmount={
            Number(protocolInfo?.minUnstakeAmount) > 0
              ? String(protocolInfo?.minUnstakeAmount)
              : undefined
          }
          estimateFeeResp={estimateFeeResp}
          protocolVault={vault}
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
