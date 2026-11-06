import type { ComponentProps } from 'react';
import { useCallback, useEffect, useRef } from 'react';

import { useIntl } from 'react-intl';

import { Page, SectionList } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { getEarnProtocol } from '@onekeyhq/kit/src/views/Earn/protocols';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IModalStakingParamList } from '@onekeyhq/shared/src/routes';
import { EModalStakingRoutes } from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { EEarnLabels } from '@onekeyhq/shared/types/staking';

import { type IOnSelectOption, OptionList } from '../../components/OptionList';
import {
  PageFrame,
  SimpleSpinnerSkeleton,
  isErrorState,
  isLoadingState,
} from '../../components/PageFrame';
import { useCommittedEarnScopeGuard } from '../../hooks/useCommittedEarnScopeGuard';
import { useUniversalWithdraw } from '../../hooks/useUniversalHooks';
import {
  getBabylonPortfolioStatus,
  useBabylonStatusMap,
} from '../../utils/babylon';

const WithdrawOptionsContent = ({
  params,
}: {
  params: IModalStakingParamList[EModalStakingRoutes.WithdrawOptions];
}) => {
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
  } = params;
  const isCancelWithdrawal = withdrawType === 'cancel';
  const isEtherFiCancellation =
    isCancelWithdrawal &&
    getEarnProtocol(
      protocolInfo?.provider || routeProvider || '',
    ).getCancelWithdrawalRoute() === 'withdraw-options';
  const symbol = isEtherFiCancellation
    ? routeSymbol || protocolInfo?.symbol || tokenInfo?.token.symbol || ''
    : tokenInfo?.token.symbol || '';
  const provider = isEtherFiCancellation
    ? routeProvider || protocolInfo?.provider || ''
    : protocolInfo?.provider || '';
  const requestLifecycleRef = useRef(0);
  useEffect(() => {
    requestLifecycleRef.current += 1;
    return () => {
      requestLifecycleRef.current += 1;
    };
  }, []);
  const runForCurrentLifecycle = async <T,>(request: () => Promise<T>) => {
    const lifecycle = requestLifecycleRef.current;
    try {
      return await request();
    } catch (error) {
      if (lifecycle !== requestLifecycleRef.current) return undefined;
      throw error;
    }
  };
  const { result, isLoading, run } = usePromiseResult(
    () =>
      runForCurrentLifecycle(() =>
        backgroundApiProxy.serviceStaking.getWithdrawList({
          networkId,
          accountId,
          symbol,
          provider,
          vault: protocolInfo?.vault,
        }),
      ),
    [accountId, networkId, symbol, provider, protocolInfo?.vault],
    {
      watchLoading: true,
      undefinedResultIfReRun: true,
      undefinedResultIfError: true,
      resumeOnEffectReconnect: true,
    },
  );

  const {
    result: stakingConfig,
    isLoading: isLoadingStakingConfig,
    run: reloadStakingConfig,
  } = usePromiseResult(
    async () => {
      if (isCancelWithdrawal) return undefined;
      return runForCurrentLifecycle(() =>
        backgroundApiProxy.serviceStaking.getStakingConfigs({
          networkId,
          symbol,
          provider,
        }),
      );
    },
    [networkId, symbol, provider, isCancelWithdrawal],
    {
      watchLoading: true,
      undefinedResultIfReRun: true,
      undefinedResultIfError: true,
      resumeOnEffectReconnect: true,
    },
  );
  const handleWithdraw = useUniversalWithdraw({ accountId, networkId });
  const cancellationScope = useCommittedEarnScopeGuard(
    JSON.stringify([
      accountId,
      networkId,
      protocolInfo?.earnAccount?.accountAddress,
      provider,
      symbol,
      protocolInfo?.vault,
      withdrawType,
    ]),
  );
  const cancellationAttemptRef = useRef(0);
  const cancellationPreparingRef = useRef(false);
  const cancellationPickerActiveRef = useRef(false);
  useEffect(() => {
    cancellationPickerActiveRef.current = true;
    return () => {
      cancellationPickerActiveRef.current = false;
      cancellationScope.invalidate();
    };
  }, [cancellationScope]);

  const onPress = useCallback<IOnSelectOption>(
    async ({ item }) => {
      if (isCancelWithdrawal) {
        if (!cancellationPickerActiveRef.current) return;
        if (cancellationPreparingRef.current) return;
        const isScopeCurrent = cancellationScope.capture();
        if (!isScopeCurrent()) return;
        cancellationPreparingRef.current = true;
        cancellationAttemptRef.current += 1;
        const attempt = cancellationAttemptRef.current;
        const isActionCurrent = () =>
          isScopeCurrent() && cancellationAttemptRef.current === attempt;
        try {
          // The displayed share amount never replaces the selected request identity.
          await handleWithdraw({
            amount: '0',
            identity: item.id,
            symbol,
            provider,
            protocolVault: protocolInfo?.vault,
            withdrawAll: false,
            withdrawType: 'cancel',
            taskAccountAddress:
              protocolInfo?.earnAccount?.accountId === accountId &&
              protocolInfo.earnAccount.networkId === networkId
                ? protocolInfo.earnAccount.accountAddress
                : undefined,
            isActionCurrent,
            isSendCurrent: isActionCurrent,
            stakingInfo: {
              label: EEarnLabels.Withdraw,
              protocol: earnUtils.getEarnProviderName({
                providerName: provider,
              }),
              protocolLogoURI: protocolInfo?.providerDetail.logoURI,
              tags: protocolInfo?.stakeTag ? [protocolInfo.stakeTag] : [],
            },
            onSuccess: () => {
              if (!isActionCurrent()) return;
              appNavigation.pop();
              externalOnSuccess?.();
            },
          });
        } catch (error) {
          if (isActionCurrent()) {
            errorToastUtils.toastIfError(error);
            errorToastUtils.showToastOfError(error);
          }
        } finally {
          cancellationPreparingRef.current = false;
        }
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
      cancellationScope,
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
    getEarnProtocol(provider).getWithdrawOrderPresentation() ===
      'early-withdrawal'
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

  const listError = isErrorState({ result, isLoading });
  const needsStakingConfig =
    !isCancelWithdrawal && Boolean(result?.items.length);
  const configError =
    needsStakingConfig &&
    isErrorState({ result: stakingConfig, isLoading: isLoadingStakingConfig });
  const pageError = listError || configError;
  const pageLoading =
    !pageError &&
    (isLoadingState({ result, isLoading }) ||
      (needsStakingConfig &&
        isLoadingState({
          result: stakingConfig,
          isLoading: isLoadingStakingConfig,
        })));
  const refresh = () => {
    void run();
    if (!isCancelWithdrawal) void reloadStakingConfig();
  };

  return (
    <Page scrollEnabled>
      <Page.Header title={title} />
      <Page.Body>
        <PageFrame
          LoadingSkeleton={SimpleSpinnerSkeleton}
          loading={pageLoading}
          error={pageError}
          onRefresh={refresh}
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

const WithdrawOptions = () => {
  const { params } = useAppRoute<
    IModalStakingParamList,
    EModalStakingRoutes.WithdrawOptions
  >();
  const scopeKey = JSON.stringify([
    params.accountId,
    params.networkId,
    params.protocolInfo?.earnAccount?.accountAddress,
    params.provider,
    params.protocolInfo?.provider,
    params.symbol,
    params.protocolInfo?.symbol,
    params.tokenInfo?.token.symbol,
    params.protocolInfo?.vault,
    params.withdrawType,
  ]);
  return <WithdrawOptionsContent key={scopeKey} params={params} />;
};

export default WithdrawOptions;
