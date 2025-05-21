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
import { useUniversalClaim } from '../../hooks/useUniversalHooks';
import { buildLocalTxStatusSyncId } from '../../utils/utils';

const ClaimOptions = () => {
  const appRoute = useAppRoute<
    IModalStakingParamList,
    EModalStakingRoutes.ClaimOptions
  >();
  const appNavigation = useAppNavigation();
  const { accountId, networkId, provider, token } = appRoute.params;

  const { result, isLoading, run } = usePromiseResult(
    () =>
      backgroundApiProxy.serviceStaking.getClaimableList({
        networkId,
        accountId,
        symbol: token.symbol,
        provider: provider.name,
      }),
    [networkId, accountId, token.symbol, provider.name],
    { watchLoading: true },
  );

  const handleClaim = useUniversalClaim({ accountId, networkId });

  const onPress = useCallback<IOnSelectOption>(
    async ({ item }) => {
      await handleClaim({
        identity: item.id,
        amount: item.amount,
        symbol: token.symbol,
        provider: provider.name,
        morphoVault: provider.vault,
        vault: provider.vault || '',
        stakingInfo: {
          label: EEarnLabels.Claim,
          protocol: earnUtils.getEarnProviderName({
            providerName: provider.name,
          }),
          protocolLogoURI: provider.logoURI,
          receive: { token, amount: item.amount },
          tags: [
            buildLocalTxStatusSyncId({
              providerName: provider.name,
              tokenSymbol: token.symbol,
            }),
          ],
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
          defaultLogger.staking.page.staking({
            token,
            stakingProtocol: provider.name,
          });
          if (provider.name === 'babylon') {
            void backgroundApiProxy.serviceStaking.babylonClaimRecord({
              accountId,
              networkId,
              provider: provider.name,
              symbol: token.symbol,
              identity: item.id,
            });
          }
        },
      });
    },
    [
      handleClaim,
      token,
      provider.name,
      provider.vault,
      provider.logoURI,
      appNavigation,
      accountId,
      networkId,
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
