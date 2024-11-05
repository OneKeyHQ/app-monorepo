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
  const actionTag = buildLocalTxStatusSyncId(details);
  const appNavigation = useAppNavigation();
  const handleWithdraw = useUniversalWithdraw({ accountId, networkId });
  const onConfirm = useCallback(
    async (amount: string) => {
      await handleWithdraw({
        amount,
        identity,
        symbol: tokenInfo.symbol,
        provider: provider.name,
        stakingInfo: {
          label: EEarnLabels.Withdraw,
          protocol: provider.name,
          protocolLogoURI: provider.logoURI,
          tags: [actionTag],
        },
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
    () => provider.name.toLowerCase() === 'lido',
    [provider],
  );

  const hideReceived = useMemo<boolean>(
    () =>
      provider.name.toLowerCase() === 'everstake' &&
      tokenInfo.symbol.toLowerCase() === 'apt',
    [provider, tokenInfo.symbol],
  );

  const { result: estimateFeeResp } = usePromiseResult(async () => {
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
    });
    return resp;
  }, [networkId, provider.name, tokenInfo.symbol, identity]);

  const unstakingPeriod = useMemo(() => {
    if (details.provider.unstakingTime) {
      return Math.ceil(details.provider.unstakingTime / (24 * 60 * 60));
    }
    return details.unstakingPeriod; // day
  }, [details]);

  return (
    <Page>
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
          balance={BigNumber(active ?? 0)
            .plus(overflow ?? 0)
            .toFixed()}
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
          unstakingPeriod={unstakingPeriod}
          providerLabel={providerLabel}
          showPayWith={showPayWith}
          payWithToken={details.rewardToken}
          payWithTokenRate={provider.lidoStTokenRate}
          estimateFeeResp={estimateFeeResp}
        />
      </Page.Body>
    </Page>
  );
};

export default WithdrawPage;
