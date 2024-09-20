import { useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Page } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type {
  EModalStakingRoutes,
  IModalStakingParamList,
} from '@onekeyhq/shared/src/routes';
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

  const { token, provider, active } = details;
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
          decimals={details.token.info.decimals}
          balance={BigNumber(active ?? 0).toFixed()}
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
          unstakingPeriod={details.unstakingPeriod}
          providerLabel={providerLabel}
          showPayWith={showPayWith}
          payWithToken={details.rewardToken}
          payWithTokenRate={provider.lidoStTokenRate}
        />
      </Page.Body>
    </Page>
  );
};

export default WithdrawPage;
