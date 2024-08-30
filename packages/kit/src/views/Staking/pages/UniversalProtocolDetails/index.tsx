import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import { Page, Stack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EModalStakingRoutes,
  type IModalStakingParamList,
} from '@onekeyhq/shared/src/routes';

import {
  PageFrame,
  isErrorState,
  isLoadingState,
} from '../../components/PageFrame';
import { StakingTransactionIndicator } from '../../components/StakingActivityIndicator';
import { OverviewSkeleton } from '../../components/StakingSkeleton';
import { UniversalProtocolDetails } from '../../components/UniversalProtocolDetails';
import { buildLocalTraceTxTag } from '../../utils/const';

const UniversalProtocolDetailsPage = () => {
  const route = useAppRoute<
    IModalStakingParamList,
    EModalStakingRoutes.UniversalProtocolDetails
  >();
  const { accountId, networkId, indexedAccountId, symbol, provider } =
    route.params;
  const appNavigation = useAppNavigation();
  const [stakeLoading, setStakeLoading] = useState(false);
  const { result: earnAccount } = usePromiseResult(
    async () =>
      backgroundApiProxy.serviceStaking.getEarnAccount({
        accountId,
        networkId,
        indexedAccountId,
      }),
    [accountId, indexedAccountId, networkId],
  );
  const { result, isLoading, run } = usePromiseResult(
    () =>
      backgroundApiProxy.serviceStaking.getProtocolDetails({
        accountId,
        networkId,
        indexedAccountId,
        symbol,
        provider,
      }),
    [accountId, networkId, indexedAccountId, symbol, provider],
    { watchLoading: true },
  );
  const onStake = useCallback(async () => {
    if (!result) return;
    if (result.approveTarget) {
      setStakeLoading(true);
      try {
        const { allowanceParsed } =
          await backgroundApiProxy.serviceStaking.fetchTokenAllowance({
            accountId: accountId ?? '',
            networkId,
            spenderAddress: result.approveTarget,
            tokenAddress: result.token.info.address,
          });
        appNavigation.push(EModalStakingRoutes.UniversalApproveBaseStake, {
          accountId,
          networkId,
          details: result,
          currentAllowance: allowanceParsed,
        });
      } finally {
        setStakeLoading(false);
      }
      return;
    }
    appNavigation.push(EModalStakingRoutes.UniversalStake, {
      accountId,
      networkId,
      details: result,
    });
  }, [result, accountId, networkId, appNavigation]);
  const onWithdraw = useCallback(() => {
    if (!result) return;
    if (
      symbol.toLowerCase() === 'sol' &&
      provider.toLowerCase() === 'everstake'
    ) {
      appNavigation.push(EModalStakingRoutes.UniversalWithdrawOptions, {
        accountId,
        networkId,
        details: result,
        symbol,
        provider,
      });
      return;
    }
    appNavigation.push(EModalStakingRoutes.UniversalWithdraw, {
      accountId,
      networkId,
      details: result,
    });
  }, [result, accountId, networkId, appNavigation, symbol, provider]);

  const onClaim = useCallback(async () => {
    if (!result) return;
    if (
      (symbol.toLowerCase() === 'matic' && provider.toLowerCase() === 'lido') ||
      (symbol.toLowerCase() === 'sol' && provider.toLowerCase() === 'everstake')
    ) {
      appNavigation.push(EModalStakingRoutes.UniversalClaimOptions, {
        accountId,
        networkId,
        details: result,
        symbol,
        provider,
      });
      return;
    }
    appNavigation.push(EModalStakingRoutes.UniversalClaim, {
      accountId,
      networkId,
      details: result,
    });
  }, [result, accountId, networkId, appNavigation, symbol, provider]);

  const onPortfolioDetails = useMemo(
    () =>
      symbol.toLowerCase() === 'btc'
        ? () => {
            appNavigation.push(EModalStakingRoutes.PortfolioDetails);
          }
        : undefined,
    [appNavigation, symbol],
  );

  const intl = useIntl();
  return (
    <Page scrollEnabled>
      <Page.Header
        title={intl.formatMessage(
          { id: ETranslations.earn_stake_token },
          { 'token': symbol },
        )}
      />
      <Page.Body>
        <PageFrame
          LoadingSkeleton={OverviewSkeleton}
          loading={isLoadingState({ result, isLoading })}
          error={isErrorState({ result, isLoading })}
          onRefresh={run}
        >
          <Stack>
            <UniversalProtocolDetails
              earnAccount={earnAccount}
              details={result}
              onClaim={onClaim}
              onPortfolioDetails={onPortfolioDetails}
            />
            <Page.Footer
              onConfirmText={intl.formatMessage({
                id: ETranslations.earn_stake,
              })}
              confirmButtonProps={{
                variant: 'primary',
                loading: stakeLoading,
                onPress: onStake,
                disabled: !accountId,
              }}
              onCancelText={intl.formatMessage({
                id: ETranslations.earn_redeem,
              })}
              cancelButtonProps={{
                onPress: onWithdraw,
                disabled: !accountId,
              }}
            />
            {result ? (
              <StakingTransactionIndicator
                accountId={accountId ?? ''}
                networkId={networkId}
                indexedAccountId={indexedAccountId}
                stakeTag={buildLocalTraceTxTag(result)}
                onRefresh={run}
              />
            ) : null}
          </Stack>
        </PageFrame>
      </Page.Body>
    </Page>
  );
};

export default UniversalProtocolDetailsPage;
