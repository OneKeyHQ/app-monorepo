import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Page } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type {
  EModalStakingRoutes,
  IModalStakingParamList,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { EEarnLabels } from '@onekeyhq/shared/types/staking';

import { type IOnSelectOption, OptionList } from '../../components/OptionList';
import {
  PageFrame,
  SimpleSpinnerSkeleton,
  isErrorState,
  isLoadingState,
} from '../../components/PageFrame';
import { useUniversalClaim } from '../../hooks/useUniversalHooks';
import { buildLocalTxStatusSyncId } from '../../utils/utils';

const ClaimOptions = () => {
  const appRoute = useAppRoute<
    IModalStakingParamList,
    EModalStakingRoutes.ClaimOptions
  >();
  const appNavigation = useAppNavigation();
  const { accountId, networkId, symbol, provider, details } = appRoute.params;

  const { result, isLoading, run } = usePromiseResult(
    () =>
      backgroundApiProxy.serviceStaking.getClaimableList({
        networkId,
        accountId,
        symbol,
        provider,
      }),
    [accountId, networkId, symbol, provider],
    { watchLoading: true },
  );

  const handleClaim = useUniversalClaim({ accountId, networkId });

  const onPress = useCallback<IOnSelectOption>(
    async ({ item }) => {
      await handleClaim({
        identity: item.id,
        amount: item.amount,
        symbol: details.token.info.symbol,
        provider,
        stakingInfo: {
          label: EEarnLabels.Claim,
          protocol: provider,
          protocolLogoURI: details.provider.logoURI,
          receive: { token: details.token.info, amount: item.amount },
          tags: [buildLocalTxStatusSyncId(details)],
        },
        onSuccess: async (txs) => {
          const tx = txs[0];
          if (tx) {
            await backgroundApiProxy.serviceStaking.addBabylonTrackingItem({
              txId: item.id,
              action: 'claim',
              createAt: Date.now(),
              accountId,
              networkId,
              amount: item.amount,
            });
          }
          appNavigation.pop();
          defaultLogger.staking.page.unstaking({
            token: details.token.info,
            stakingProtocol: provider,
          });
          if (provider === 'babylon') {
            void backgroundApiProxy.serviceStaking.babylonClaimRecord({
              accountId,
              networkId,
              provider,
              symbol,
              identity: item.id,
            });
          }
        },
      });
    },
    [
      appNavigation,
      details,
      handleClaim,
      provider,
      accountId,
      networkId,
      symbol,
    ],
  );

  const intl = useIntl();

  return (
    <Page scrollEnabled>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.earn_select_a_claimable_order,
        })}
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
                id: ETranslations.earn_claim,
              })}
              extraFields={
                networkUtils.isBTCNetwork(networkId)
                  ? [
                      {
                        name: intl.formatMessage({
                          id: ETranslations.global_status,
                        }),
                        renderItem() {
                          return intl.formatMessage({
                            id: ETranslations.earn_claimable,
                          });
                        },
                      },
                      {
                        name: intl.formatMessage({
                          id: ETranslations.global_transaction_id,
                        }),
                        renderItem({ item }) {
                          return accountUtils.shortenAddress({
                            address: item.id,
                          });
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

export default ClaimOptions;
