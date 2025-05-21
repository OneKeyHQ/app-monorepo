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
import type {
  EModalStakingRoutes,
  IModalStakingParamList,
} from '@onekeyhq/shared/src/routes';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import { EEarnProviderEnum } from '@onekeyhq/shared/types/earn';
import { EEarnLabels } from '@onekeyhq/shared/types/staking';

import { UniversalWithdraw } from '../../components/UniversalWithdraw';
import { useProviderLabel } from '../../hooks/useProviderLabel';
import { useUniversalWithdraw } from '../../hooks/useUniversalHooks';
import { buildLocalTxStatusSyncId } from '../../utils/utils';

const WithdrawPage = () => {
  const intl = useIntl();
  const route = useAppRoute<
    IModalStakingParamList,
    EModalStakingRoutes.Withdraw
  >();
  const {
    accountId,
    networkId,
    details,
    identity,
    amount: initialAmount,
    onSuccess,
  } = route.params;

  const { token, provider, active, overflow } = details;
  const { price, info: tokenInfo } = token;
  const actionTag = buildLocalTxStatusSyncId({
    providerName: provider.name,
    tokenSymbol: tokenInfo.symbol,
  });
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
        morphoVault: earnUtils.isMorphoProvider({
          providerName: provider.name,
        })
          ? provider.vault
          : undefined,
        symbol: tokenInfo.symbol,
        provider: provider.name,
        stakingInfo: {
          label: EEarnLabels.Withdraw,
          protocol: earnUtils.getEarnProviderName({
            providerName: provider.name,
          }),
          protocolLogoURI: provider.logoURI,
          tags: [actionTag],
        },
        withdrawAll,
        onSuccess: () => {
          appNavigation.pop();
          defaultLogger.staking.page.unstaking({
            token: tokenInfo,
            stakingProtocol: provider.name,
          });
          onSuccess?.();
        },
      });
    },
    [
      handleWithdraw,
      tokenInfo,
      appNavigation,
      provider,
      actionTag,
      identity,
      onSuccess,
    ],
  );

  const providerLabel = useProviderLabel(provider.name);

  const showPayWith = useMemo<boolean>(
    () =>
      earnUtils.isLidoProvider({
        providerName: provider.name,
      }),
    [provider],
  );

  const payWithTokenRate = useMemo(() => {
    if (
      earnUtils.isLidoProvider({
        providerName: provider.name,
      })
    ) {
      return provider.lidoStTokenRate;
    }
    if (
      earnUtils.isMorphoProvider({
        providerName: provider.name,
      })
    ) {
      return provider.morphoTokenRate;
    }
    return '1';
  }, [provider]);

  const hideReceived = useMemo<boolean>(
    () =>
      provider.name.toLowerCase() === 'everstake' &&
      tokenInfo.symbol.toLowerCase() === 'apt',
    [provider, tokenInfo.symbol],
  );

  const { result: estimateFeeResp } = usePromiseResult(async () => {
    const account = await backgroundApiProxy.serviceAccount.getAccount({
      accountId,
      networkId,
    });
    const resp = await backgroundApiProxy.serviceStaking.estimateFee({
      networkId,
      provider: provider.name,
      symbol: tokenInfo.symbol,
      action: 'unstake',
      amount: '1',
      txId:
        provider.name.toLowerCase() === EEarnProviderEnum.Babylon.toLowerCase()
          ? identity
          : undefined,
      morphoVault: provider.vault,
      identity,
      accountAddress: account.address,
    });
    return resp;
  }, [
    accountId,
    networkId,
    provider.name,
    provider.vault,
    tokenInfo.symbol,
    identity,
  ]);

  const { unstakingPeriod, showDetailWithdrawalRequested } = useMemo(() => {
    const showDetail = !!details?.provider?.unstakingTime;
    return {
      showDetailWithdrawalRequested: showDetail,
      unstakingPeriod: showDetail
        ? Math.ceil(Number(details.provider.unstakingTime) / (24 * 60 * 60))
        : details.unstakingPeriod, // day
    };
  }, [details]);

  return (
    <Page scrollEnabled>
      <Page.Header
        title={intl.formatMessage(
          { id: ETranslations.earn_withdraw_token },
          { token: tokenInfo.symbol },
        )}
      />
      <Page.Body>
        <UniversalWithdraw
          price={price}
          hideReceived={hideReceived}
          decimals={details.token.info.decimals}
          balance={
            earnUtils.isMorphoProvider({ providerName: provider.name })
              ? BigNumber(provider.maxUnstakeAmount ?? active ?? 0).toFixed()
              : BigNumber(active ?? 0)
                  .plus(overflow ?? 0)
                  .toFixed()
          }
          accountId={accountId}
          networkId={networkId}
          initialAmount={initialAmount}
          tokenSymbol={tokenInfo.symbol}
          tokenImageUri={tokenInfo.logoURI}
          providerLogo={provider.logoURI}
          providerName={provider.name}
          onConfirm={onConfirm}
          minAmount={
            Number(provider.minUnstakeAmount) > 0
              ? String(provider.minUnstakeAmount)
              : undefined
          }
          showDetailWithdrawalRequested={showDetailWithdrawalRequested}
          unstakingPeriod={unstakingPeriod}
          providerLabel={providerLabel}
          showPayWith={showPayWith}
          payWithToken={details.rewardToken}
          payWithTokenRate={payWithTokenRate}
          estimateFeeResp={estimateFeeResp}
          morphoVault={provider.vault}
        />
      </Page.Body>
    </Page>
  );
};

export default WithdrawPage;
