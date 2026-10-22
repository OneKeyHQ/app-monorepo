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
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { EEarnProviderEnum } from '@onekeyhq/shared/types/earn';
import { EEarnLabels } from '@onekeyhq/shared/types/staking';

import { type IOnSelectOption, OptionList } from '../../components/OptionList';
import {
  PageFrame,
  SimpleSpinnerSkeleton,
  isErrorState,
  isLoadingState,
} from '../../components/PageFrame';
import { useUniversalWithdraw } from '../../hooks/useUniversalHooks';
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
    routeSymbol || protocolInfo?.symbol || tokenInfo?.token.symbol || '';
  const provider = routeProvider || protocolInfo?.provider || '';
  const isCancelWithdrawal = withdrawType === 'cancel';
  const { result, isLoading, run } = usePromiseResult(
    () =>
      backgroundApiProxy.serviceStaking.getWithdrawList({
        networkId,
        accountId,
        symbol,
        provider,
        vault: protocolInfo?.vault,
      }),
    [accountId, networkId, symbol, provider, protocolInfo?.vault],
    { watchLoading: true },
  );

  const { result: stakingConfig } = usePromiseResult(
    async () =>
      isCancelWithdrawal
        ? undefined
        : backgroundApiProxy.serviceStaking.getStakingConfigs({
            networkId,
            symbol,
            provider,
          }),
    [networkId, symbol, provider, isCancelWithdrawal],
  );
  const handleWithdraw = useUniversalWithdraw({ accountId, networkId });

  const onPress = useCallback<IOnSelectOption>(
    async ({ item }) => {
      if (isCancelWithdrawal) {
        // The displayed share amount never replaces the selected request identity.
        await handleWithdraw({
          amount: '0',
          identity: item.id,
          symbol,
          provider,
          protocolVault: protocolInfo?.vault,
          withdrawAll: false,
          withdrawType: 'cancel',
          stakingInfo: {
            label: EEarnLabels.Withdraw,
            protocol: earnUtils.getEarnProviderName({ providerName: provider }),
            protocolLogoURI: protocolInfo?.providerDetail.logoURI,
            tags: protocolInfo?.stakeTag ? [protocolInfo.stakeTag] : [],
          },
          onSuccess: () => {
            appNavigation.pop();
            externalOnSuccess?.();
          },
        });
        return;
      }
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
      isCancelWithdrawal,
      handleWithdraw,
      symbol,
      provider,
    ],
  );

  const babylonStatusMap = useBabylonStatusMap();

  let title = intl.formatMessage({
    id: isCancelWithdrawal
      ? ETranslations.earn_withdrawal_requested
      : ETranslations.earn_select_an_order_to_withdraw,
  });

  let ListHeaderComponent:
    | ComponentProps<typeof OptionList>['ListHeaderComponent']
    | undefined;

  if (
    !isCancelWithdrawal &&
    provider.toLowerCase() === EEarnProviderEnum.Babylon.toLowerCase()
  ) {
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

  let extraFields: ComponentProps<typeof OptionList>['extraFields'];
  if (isCancelWithdrawal) {
    extraFields = [
      {
        name: intl.formatMessage({
          id: ETranslations.Limit_order_history_order_id,
        }),
        renderItem: ({ item }) =>
          accountUtils.shortenAddress({ address: item.id }),
      },
      {
        name: intl.formatMessage({ id: ETranslations.global_time }),
        renderItem: ({ item }) =>
          item.timestamp ? formatDate(new Date(item.timestamp * 1000)) : '-',
      },
    ];
  } else if (networkUtils.isBTCNetwork(networkId)) {
    extraFields = [
      {
        name: intl.formatMessage({ id: ETranslations.global_status }),
        renderItem({ item }) {
          if (item.babylonExtra) {
            return (
              babylonStatusMap[getBabylonPortfolioStatus(item.babylonExtra)] ??
              item.babylonExtra.status
            );
          }
          return '';
        },
      },
      {
        name: intl.formatMessage({ id: ETranslations.earn_unlock_time }),
        renderItem({ item }) {
          return item.babylonExtra?.endTime
            ? formatDate(new Date(item.babylonExtra.endTime), {
                hideTimeForever: true,
              })
            : '';
        },
      },
    ];
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
                id: isCancelWithdrawal
                  ? ETranslations.global_cancel
                  : ETranslations.global_withdraw,
              })}
              onCancelText={
                isCancelWithdrawal
                  ? intl.formatMessage({ id: ETranslations.global_close })
                  : undefined
              }
              description={result.description}
              extraFields={extraFields}
            />
          ) : null}
        </PageFrame>
      </Page.Body>
    </Page>
  );
};

export default WithdrawOptions;
