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
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';

import { type IOnSelectOption, OptionList } from '../../components/OptionList';
import {
  PageFrame,
  SimpleSpinnerSkeleton,
  isErrorState,
  isLoadingState,
} from '../../components/PageFrame';
import {
  getBabylonPortfolioStatus,
  useBabylonStatusMap,
} from '../../utils/babylon';

const WithdrawOptions = () => {
  const appRoute = useAppRoute<
    IModalStakingParamList,
    EModalStakingRoutes.WithdrawOptions
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
      appNavigation.push(EModalStakingRoutes.Withdraw, {
        accountId,
        networkId,
        symbol,
        provider,
        details,
        identity: item.id,
        amount: item.amount,
        onSuccess: () => {
          // pop to portfolio details page
          setTimeout(() => appNavigation.pop(), 4);
        },
      });
    },
    [appNavigation, accountId, networkId, symbol, provider, details],
  );

  const babylonStatusMap = useBabylonStatusMap();

  return (
    <Page scrollEnabled>
      <Page.Header
        title={intl.formatMessage(
          { id: ETranslations.earn_withdraw_token },
          { 'token': symbol },
        )}
      />
      <Page.Body>
        <PageFrame
          LoadingSkeleton={SimpleSpinnerSkeleton}
          loading={isLoadingState({ result, isLoading })}
          error={isErrorState({ result, isLoading })}
          onRefresh={run}
        >
          {result ? (
            <OptionList
              items={result.items}
              token={result.token}
              network={result.network}
              onPress={onPress}
              onConfirmText={intl.formatMessage({
                id: ETranslations.global_continue,
              })}
              extraFields={
                networkUtils.isBTCNetwork(networkId)
                  ? [
                      {
                        name: intl.formatMessage({
                          id: ETranslations.global_status,
                        }),
                        renderItem({ item }) {
                          if (item.babylonExtra) {
                            return (
                              babylonStatusMap[
                                getBabylonPortfolioStatus(item.babylonExtra)
                              ] ?? item.babylonExtra.status
                            );
                          }
                          return '';
                        },
                      },
                      {
                        name: intl.formatMessage({
                          id: ETranslations.earn_unlock_time,
                        }),
                        renderItem({ item }) {
                          return item.babylonExtra?.endTime
                            ? formatDate(new Date(item.babylonExtra?.endTime), {
                                hideTimeForever: true,
                              })
                            : '';
                        },
                      },
                    ]
                  : undefined
              }
            />
          ) : null}
        </PageFrame>
      </Page.Body>
    </Page>
  );
};

export default WithdrawOptions;
