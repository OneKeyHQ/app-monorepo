import type { ComponentProps } from 'react';
import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Page, SectionList } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IModalStakingParamList } from '@onekeyhq/shared/src/routes';
import { EModalStakingRoutes } from '@onekeyhq/shared/src/routes';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { EEarnProviderEnum } from '@onekeyhq/shared/types/earn';

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
  const {
    accountId,
    networkId,
    protocolInfo,
    tokenInfo,
    onSuccess: externalOnSuccess,
    isInModalContext,
  } = appRoute.params;
  const symbol = tokenInfo?.token.symbol || '';
  const provider = protocolInfo?.provider || '';
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

  const { result: stakingConfig } = usePromiseResult(
    () =>
      backgroundApiProxy.serviceStaking.getStakingConfigs({
        networkId,
        symbol,
        provider,
      }),
    [networkId, symbol, provider],
  );

  const onPress = useCallback<IOnSelectOption>(
    ({ item }) => {
      appNavigation.push(EModalStakingRoutes.Withdraw, {
        accountId,
        networkId,
        protocolInfo,
        tokenInfo,
        identity: item.id,
        amount: item.amount,
        fromPage: EModalStakingRoutes.WithdrawOptions,
        allowPartialWithdraw: stakingConfig?.allowPartialWithdraw,
        onSuccess: () => {
          if (!isInModalContext) {
            appNavigation.popStack();
          }
          externalOnSuccess?.();
        },
      });
    },
    [
      appNavigation,
      accountId,
      networkId,
      protocolInfo,
      tokenInfo,
      stakingConfig?.allowPartialWithdraw,
      externalOnSuccess,
      isInModalContext,
    ],
  );

  const babylonStatusMap = useBabylonStatusMap();

  let title = intl.formatMessage({
    id: ETranslations.earn_select_an_order_to_withdraw,
  });

  let ListHeaderComponent:
    | ComponentProps<typeof OptionList>['ListHeaderComponent']
    | undefined;

  if (provider.toLowerCase() === EEarnProviderEnum.Babylon.toLowerCase()) {
    title = intl.formatMessage({
      id: ETranslations.earn_select_for_early_withdrawal,
    });
    ListHeaderComponent = (
      <SectionList.SectionHeader
        title={intl.formatMessage({
          id: ETranslations.earn_select_for_early_withdrawal_desc,
        })}
      />
    );
  }

  return (
    <Page scrollEnabled>
      <Page.Header title={title} />
      <Page.Body>
        <PageFrame
          LoadingSkeleton={SimpleSpinnerSkeleton}
          loading={isLoadingState({ result, isLoading })}
          error={isErrorState({ result, isLoading })}
          onRefresh={run}
        >
          {result ? (
            <OptionList
              ListHeaderComponent={
                result.items.length > 0 ? ListHeaderComponent : undefined
              }
              items={result.items}
              token={result.token}
              network={result.network}
              onPress={onPress}
              onConfirmText={intl.formatMessage({
                id: ETranslations.global_withdraw,
              })}
              description={result.description}
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
