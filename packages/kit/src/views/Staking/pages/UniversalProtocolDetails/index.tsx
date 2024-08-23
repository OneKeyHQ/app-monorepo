import { useCallback } from 'react';

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

import { PageFrame } from '../../components/PageFrame';
import { OverviewSkeleton } from '../../components/StakingSkeleton';
import { UniversalProtocolDetails } from '../../components/UniversalProtocolDetails';

const UniversalProtocolDetailsPage = () => {
  const route = useAppRoute<
    IModalStakingParamList,
    EModalStakingRoutes.UniversalProtocolDetails
  >();
  const { accountId, networkId, symbol, provider } = route.params;
  const appNavigation = useAppNavigation();
  const { result, isLoading, run } = usePromiseResult(
    () =>
      backgroundApiProxy.serviceStaking.getProtocolDetails({
        accountId,
        networkId,
        symbol,
        provider,
      }),
    [accountId, networkId, symbol, provider],
    { watchLoading: true },
  );
  const onStake = useCallback(() => {
    if (!result) return;
    appNavigation.push(EModalStakingRoutes.UniversalStake, {
      accountId,
      networkId,
      details: result,
    });
  }, [result, accountId, networkId, appNavigation]);
  const onWithdraw = useCallback(() => {
    if (!result) return;
    appNavigation.push(EModalStakingRoutes.UniversalWithdraw, {
      accountId,
      networkId,
      details: result,
    });
  }, [result, accountId, networkId, appNavigation]);

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
          loading={Boolean(
            result === undefined &&
              (isLoading !== undefined || isLoading === true),
          )}
          error={Boolean(result === undefined && isLoading === false)}
          onRefresh={run}
        >
          <Stack>
            <UniversalProtocolDetails details={result} />
            <Page.Footer
              onConfirmText={intl.formatMessage({
                id: ETranslations.earn_stake,
              })}
              confirmButtonProps={{
                variant: 'primary',
                onPress: onStake,
              }}
              onCancelText={intl.formatMessage({
                id: ETranslations.earn_redeem,
              })}
              cancelButtonProps={{
                onPress: onWithdraw,
              }}
            />
          </Stack>
        </PageFrame>
      </Page.Body>
    </Page>
  );
};

export default UniversalProtocolDetailsPage;
