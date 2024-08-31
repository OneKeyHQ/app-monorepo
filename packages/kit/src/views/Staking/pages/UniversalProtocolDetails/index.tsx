import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import { Page, Stack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EModalStakingRoutes,
  type IModalStakingParamList,
} from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import {
  PageFrame,
  isErrorState,
  isLoadingState,
} from '../../components/PageFrame';
import { StakingTransactionIndicator } from '../../components/StakingActivityIndicator';
import { OverviewSkeleton } from '../../components/StakingSkeleton';
import { UniversalProtocolDetails } from '../../components/UniversalProtocolDetails';
import { buildLocalTxStatusSyncId } from '../../utils/const';

import { useHandleClaim, useHandleWithdraw } from './useUniversal';

const UniversalProtocolDetailsPage = () => {
  const route = useAppRoute<
    IModalStakingParamList,
    EModalStakingRoutes.UniversalProtocolDetails
  >();
  const { accountId, networkId, indexedAccountId, symbol, provider } =
    route.params;
  const appNavigation = useAppNavigation();
  const [stakeLoading, setStakeLoading] = useState(false);
  const { result: earnAccount, run: refreshAccount } = usePromiseResult(
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

  const onCreateAddress = useCallback(async () => {
    await refreshAccount();
    void run();
  }, [refreshAccount, run]);

  const handleClaim = useHandleClaim();
  const handleWithdraw = useHandleWithdraw();

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
        appNavigation.push(EModalStakingRoutes.ApproveBaseStake, {
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
    handleWithdraw({
      details: result,
      accountId,
      networkId,
      symbol,
      provider,
    });
  }, [handleWithdraw, result, accountId, networkId, symbol, provider]);

  const onClaim = useCallback(async () => {
    await handleClaim({
      details: result,
      accountId,
      networkId,
      symbol,
      provider,
    });
  }, [handleClaim, result, accountId, networkId, symbol, provider]);

  const onPortfolioDetails = useMemo(
    () =>
      ['btc', 'sbtc'].includes(symbol.toLowerCase())
        ? () => {
            appNavigation.push(EModalStakingRoutes.PortfolioDetails, {
              accountId,
              networkId,
              symbol,
              provider,
            });
          }
        : undefined,
    [appNavigation, accountId, networkId, symbol, provider],
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
              accountId={accountId}
              networkId={networkId}
              indexedAccountId={indexedAccountId}
              earnAccount={earnAccount}
              details={result}
              onClaim={onClaim}
              onPortfolioDetails={onPortfolioDetails}
              onCreateAddress={onCreateAddress}
            />
            <Page.Footer
              onConfirmText={intl.formatMessage({
                id: ETranslations.earn_stake,
              })}
              confirmButtonProps={{
                variant: 'primary',
                loading: stakeLoading,
                onPress: onStake,
                disabled: !earnAccount?.accountAddress,
              }}
              onCancelText={intl.formatMessage({
                id: ETranslations.earn_redeem,
              })}
              cancelButtonProps={{
                onPress: onWithdraw,
                disabled:
                  !earnAccount?.accountAddress || Number(result?.staked) <= 0,
              }}
            />
            {result ? (
              <StakingTransactionIndicator
                accountId={accountId ?? ''}
                networkId={networkId}
                indexedAccountId={indexedAccountId}
                stakeTag={buildLocalTxStatusSyncId(result)}
                onRefresh={run}
                onPress={() => {
                  appNavigation.navigate(EModalStakingRoutes.HistoryList, {
                    accountId,
                    networkId,
                    symbol,
                    provider,
                  });
                }}
              />
            ) : null}
          </Stack>
        </PageFrame>
      </Page.Body>
    </Page>
  );
};

function EarnTokenDetailsPageWithProvider() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <UniversalProtocolDetailsPage />
    </AccountSelectorProviderMirror>
  );
}

export default EarnTokenDetailsPageWithProvider;
