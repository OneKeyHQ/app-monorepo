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
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import {
  PageFrame,
  isErrorState,
  isLoadingState,
} from '../../components/PageFrame';
import { ProtocolDetails } from '../../components/ProtocolDetails';
import { StakingTransactionIndicator } from '../../components/StakingActivityIndicator';
import { OverviewSkeleton } from '../../components/StakingSkeleton';
import { buildLocalTxStatusSyncId } from '../../utils/utils';

import {
  useHandleClaim,
  useHandleStake,
  useHandleWithdraw,
} from './useUniversal';

const ProtocolDetailsPage = () => {
  const route = useAppRoute<
    IModalStakingParamList,
    EModalStakingRoutes.ProtocolDetails
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
  const handleStake = useHandleStake();

  const onStake = useCallback(async () => {
    await handleStake({
      details: result,
      accountId: earnAccount?.accountId,
      networkId,
      symbol,
      provider,
      setStakeLoading,
    });
  }, [
    result,
    earnAccount,
    networkId,
    handleStake,
    setStakeLoading,
    symbol,
    provider,
  ]);

  const onWithdraw = useCallback(async () => {
    await handleWithdraw({
      details: result,
      accountId: earnAccount?.accountId,
      networkId,
      symbol,
      provider,
    });
  }, [handleWithdraw, result, earnAccount, networkId, symbol, provider]);

  const onClaim = useCallback(async () => {
    await handleClaim({
      details: result,
      accountId: earnAccount?.accountId,
      networkId,
      symbol,
      provider,
    });
  }, [handleClaim, result, earnAccount, networkId, symbol, provider]);

  const onPortfolioDetails = useMemo(
    () =>
      networkUtils.isBTCNetwork(networkId) && earnAccount?.accountId
        ? () => {
            appNavigation.push(EModalStakingRoutes.PortfolioDetails, {
              accountId: earnAccount?.accountId,
              networkId,
              symbol,
              provider,
            });
          }
        : undefined,
    [appNavigation, earnAccount?.accountId, networkId, symbol, provider],
  );

  const onHistory = useMemo(() => {
    if (!result?.earnHistoryEnable || !earnAccount?.accountId) {
      return undefined;
    }
    return () => {
      appNavigation.navigate(EModalStakingRoutes.HistoryList, {
        accountId: earnAccount?.accountId,
        networkId,
        symbol,
        provider,
      });
    };
  }, [
    appNavigation,
    earnAccount?.accountId,
    networkId,
    symbol,
    provider,
    result,
  ]);

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
            <ProtocolDetails
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
                accountId={earnAccount?.accountId ?? ''}
                networkId={networkId}
                stakeTag={buildLocalTxStatusSyncId(result)}
                onRefresh={run}
                onPress={onHistory}
              />
            ) : null}
          </Stack>
        </PageFrame>
      </Page.Body>
    </Page>
  );
};

function ProtocolDetailsPageWithProvider() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <ProtocolDetailsPage />
    </AccountSelectorProviderMirror>
  );
}

export default ProtocolDetailsPageWithProvider;
