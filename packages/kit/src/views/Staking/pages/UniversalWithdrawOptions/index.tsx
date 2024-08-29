import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Page } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IModalStakingParamList } from '@onekeyhq/shared/src/routes';
import { EModalStakingRoutes } from '@onekeyhq/shared/src/routes';

import {
  PageFrame,
  SimpleSpinnerSkeleton,
  isErrorState,
  isLoadingState,
} from '../../components/PageFrame';
import {
  type IOnSelectOption,
  UniversalOptionList,
} from '../../components/UniversalOptionList';

const UniversalWithdrawOptions = () => {
  const appRoute = useAppRoute<
    IModalStakingParamList,
    EModalStakingRoutes.UniversalWithdrawOptions
  >();
  const intl = useIntl();
  const appNavigation = useAppNavigation();
  const { accountId, networkId, symbol, provider, details } = appRoute.params;
  const { result, isLoading, run } = usePromiseResult(
    () =>
      backgroundApiProxy.serviceStaking.getWithdrawList({
        networkId,
        accountId,
        symbol,
        provider,
      }),
    [accountId, networkId, symbol, provider],
    { watchLoading: true },
  );

  const onPress = useCallback<IOnSelectOption>(
    ({ item }) => {
      appNavigation.push(EModalStakingRoutes.UniversalWithdraw, {
        accountId,
        networkId,
        symbol,
        provider,
        details,
        identity: item.id,
        amount: item.amount,
      });
    },
    [appNavigation, accountId, networkId, symbol, provider, details],
  );

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.earn_redeem })}
      />
      <Page.Body>
        <PageFrame
          LoadingSkeleton={SimpleSpinnerSkeleton}
          loading={isLoadingState({ result, isLoading })}
          error={isErrorState({ result, isLoading })}
          onRefresh={run}
        >
          {result ? (
            <UniversalOptionList
              items={result.items}
              token={result.token}
              onPress={onPress}
            />
          ) : null}
        </PageFrame>
      </Page.Body>
    </Page>
  );
};

export default UniversalWithdrawOptions;
