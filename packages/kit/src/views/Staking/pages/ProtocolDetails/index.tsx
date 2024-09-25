import type { ComponentProps } from 'react';
import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import type { Button } from '@onekeyhq/components';
import { Page, useMedia } from '@onekeyhq/components';
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
import { EEarnLabels } from '@onekeyhq/shared/types/staking';

import {
  PageFrame,
  isErrorState,
  isLoadingState,
} from '../../components/PageFrame';
import { ProtocolDetails } from '../../components/ProtocolDetails';
import { StakingTransactionIndicator } from '../../components/StakingActivityIndicator';
import { OverviewSkeleton } from '../../components/StakingSkeleton';
import { useUniversalClaim } from '../../hooks/useUniversalHooks';
import { buildLocalTxStatusSyncId } from '../../utils/utils';

import {
  useHandleClaim,
  useHandleStake,
  useHandleWithdraw,
} from './useHandleActions';

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
      onSuccess: async () => {
        if (networkUtils.isBTCNetwork(networkId)) {
          await run();
        }
      },
    });
  }, [
    result,
    earnAccount,
    networkId,
    handleStake,
    setStakeLoading,
    symbol,
    provider,
    run,
  ]);

  const onWithdraw = useCallback(async () => {
    await handleWithdraw({
      details: result,
      accountId: earnAccount?.accountId,
      networkId,
      symbol,
      provider,
      onSuccess: async () => {
        if (networkUtils.isBTCNetwork(networkId)) {
          await run();
        }
      },
    });
  }, [handleWithdraw, result, earnAccount, networkId, symbol, provider, run]);

  const onClaim = useCallback(async () => {
    await handleClaim({
      details: result,
      accountId: earnAccount?.accountId,
      networkId,
      symbol,
      provider,
    });
  }, [handleClaim, result, earnAccount, networkId, symbol, provider]);

  const handleClaimOperation = useUniversalClaim({ accountId, networkId });

  const onClaimReward = useCallback(async () => {
    if (!result) return;
    await handleClaimOperation({
      symbol: result.token.info.symbol,
      provider: result.provider.name,
      stakingInfo: {
        label: EEarnLabels.Claim,
        protocol: result.provider.name,
        send: { token: result.token.info, amount: result.rewards ?? '0' },
        tags: [buildLocalTxStatusSyncId(result)],
      },
    });
  }, [result, handleClaimOperation]);

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
        stakeTag: buildLocalTxStatusSyncId(result),
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
  const media = useMedia();

  const stakeButtonProps = useMemo<ComponentProps<typeof Button>>(
    () => ({
      variant: 'primary',
      loading: stakeLoading,
      onPress: onStake,
      disabled: !earnAccount?.accountAddress,
    }),
    [stakeLoading, earnAccount?.accountAddress, onStake],
  );

  const withdrawButtonProps = useMemo<ComponentProps<typeof Button>>(
    () => ({
      onPress: onWithdraw,
      disabled:
        !earnAccount?.accountAddress ||
        !(Number(result?.active) > 0 || Number(result?.overflow) > 0),
    }),
    [onWithdraw, earnAccount?.accountAddress, result?.active, result?.overflow],
  );

  return (
    <Page scrollEnabled>
      <Page.Header
        title={intl.formatMessage(
          { id: ETranslations.earn_earn_symbol },
          {
            'symbol': networkUtils.isBTCNetwork(networkId)
              ? `${symbol} (Taproot)`
              : symbol,
          },
        )}
      />
      <Page.Body px="$5" pb="$5" gap="$8">
        <PageFrame
          LoadingSkeleton={OverviewSkeleton}
          loading={isLoadingState({ result, isLoading })}
          error={isErrorState({ result, isLoading })}
          onRefresh={run}
        >
          <ProtocolDetails
            accountId={accountId}
            networkId={networkId}
            indexedAccountId={indexedAccountId}
            earnAccount={earnAccount}
            details={result}
            onClaim={onClaim}
            onClaimReward={onClaimReward}
            onWithdraw={onWithdraw}
            onPortfolioDetails={onPortfolioDetails}
            onCreateAddress={onCreateAddress}
            withdrawButtonProps={withdrawButtonProps}
            stakeButtonProps={stakeButtonProps}
          />
          {!media.gtMd ? (
            <Page.Footer
              onConfirmText={intl.formatMessage({
                id: ETranslations.earn_stake,
              })}
              confirmButtonProps={stakeButtonProps}
              onCancelText={intl.formatMessage({
                id: ETranslations.global_withdraw,
              })}
              cancelButtonProps={withdrawButtonProps}
            />
          ) : null}
          {result ? (
            <StakingTransactionIndicator
              accountId={earnAccount?.accountId ?? ''}
              networkId={networkId}
              stakeTag={buildLocalTxStatusSyncId(result)}
              onRefresh={run}
              onPress={onHistory}
            />
          ) : null}
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
