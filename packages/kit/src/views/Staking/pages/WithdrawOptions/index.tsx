import type { ComponentProps } from 'react';
import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Page, SectionList } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IModalStakingParamList } from '@onekeyhq/shared/src/routes';
import { EModalStakingRoutes } from '@onekeyhq/shared/src/routes';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
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
    withdrawType,
    symbol: routeSymbol,
    provider: routeProvider,
  } = appRoute.params;
  const symbol =
    withdrawType === 'cancel'
      ? routeSymbol || protocolInfo?.symbol || tokenInfo?.token.symbol || ''
      : tokenInfo?.token.symbol || '';
  const provider =
    withdrawType === 'cancel'
      ? protocolInfo?.provider || routeProvider || ''
      : protocolInfo?.provider || '';
  const isEtherFi = earnUtils.isEtherFiProvider({ providerName: provider });
  const listScope = useMemo(
    () => ({
      accountId,
      networkId,
      symbol,
      provider,
      vault: protocolInfo?.vault,
      accountAddress: protocolInfo?.earnAccount?.accountAddress,
    }),
    [
      accountId,
      networkId,
      symbol,
      provider,
      protocolInfo?.vault,
      protocolInfo?.earnAccount?.accountAddress,
    ],
  );
  const {
    result: listResult,
    isLoading,
    run,
  } = usePromiseResult(
    async () => {
      const earnAccount = protocolInfo?.earnAccount;
      if (
        isEtherFi &&
        (!earnAccount?.accountAddress ||
          earnAccount.accountId !== accountId ||
          earnAccount.networkId !== networkId)
      ) {
        throw new OneKeyLocalError('EtherFi withdrawal account is unavailable');
      }
      const data = await backgroundApiProxy.serviceStaking.getWithdrawList({
        networkId,
        accountId,
        symbol,
        provider,
        vault: protocolInfo?.vault,
        expectedAccountAddress: isEtherFi
          ? earnAccount?.accountAddress
          : undefined,
      });
      return { scope: listScope, data };
    },
    [
      accountId,
      networkId,
      symbol,
      provider,
      protocolInfo?.vault,
      protocolInfo?.earnAccount,
      isEtherFi,
      listScope,
    ],
    { watchLoading: true, undefinedResultIfReRun: isEtherFi },
  );
  const result =
    isEtherFi && listResult?.scope !== listScope ? undefined : listResult?.data;

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
        withdrawType,
        symbol,
        provider,
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
      withdrawType,
      symbol,
      provider,
    ],
  );

  const babylonStatusMap = useBabylonStatusMap();

  let title = intl.formatMessage({
    id:
      withdrawType === 'cancel'
        ? ETranslations.earn_withdrawal_requested
        : ETranslations.earn_select_an_order_to_withdraw,
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
                id:
                  withdrawType === 'cancel'
                    ? ETranslations.global_cancel
                    : ETranslations.global_withdraw,
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
