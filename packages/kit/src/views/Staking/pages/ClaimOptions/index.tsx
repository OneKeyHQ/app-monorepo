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

const ClaimOptions = () => {
  const appRoute = useAppRoute<
    IModalStakingParamList,
    EModalStakingRoutes.ClaimOptions
  >();
  const appNavigation = useAppNavigation();
  const {
    accountId,
    networkId,
    protocolInfo,
    tokenInfo,
    symbol,
    provider,
    onSuccess: externalOnSuccess,
  } = appRoute.params;

  const finalProvider = provider || protocolInfo?.provider || '';
  const finalSymbol = symbol || tokenInfo?.token.symbol || '';
  const { result, isLoading, run } = usePromiseResult(
    () =>
      backgroundApiProxy.serviceStaking.getClaimableList({
        networkId,
        accountId,
        symbol: finalSymbol,
        provider: finalProvider,
      }),
    [accountId, networkId, finalSymbol, finalProvider],
    { watchLoading: true },
  );

  const handleClaim = useUniversalClaim({ accountId, networkId });

  const onPress = useCallback<IOnSelectOption>(
    async ({ item }) => {
      const receiveToken = earnUtils.convertEarnTokenToIToken(tokenInfo?.token);

      await handleClaim({
        identity: item.id,
        amount: item.amount,
        symbol: finalSymbol,
        provider: finalProvider,
        protocolVault: protocolInfo?.vault || '',
        vault: protocolInfo?.vault || '',
        stakingInfo: {
          label: EEarnLabels.Claim,
          protocol: earnUtils.getEarnProviderName({
            providerName: finalProvider,
          }),
          protocolLogoURI: protocolInfo?.providerDetail.logoURI,
          receive: receiveToken
            ? { token: receiveToken, amount: item.amount }
            : undefined,
          tags: protocolInfo?.stakeTag ? [protocolInfo.stakeTag] : [],
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
            token: tokenInfo?.token,
            stakingProtocol: finalProvider,
          });
          if (finalProvider === 'babylon') {
            void backgroundApiProxy.serviceStaking.babylonClaimRecord({
              accountId,
              networkId,
              provider: finalProvider,
              symbol: finalSymbol,
              identity: item.id,
            });
          }
          // Trigger external onSuccess callback (from ManagePositionContent)
          // This ensures the entire modal stack is closed when in modal context
          externalOnSuccess?.();
        },
      });
    },
    [
      handleClaim,
      finalSymbol,
      finalProvider,
      protocolInfo?.vault,
      protocolInfo?.providerDetail.logoURI,
      protocolInfo?.stakeTag,
      tokenInfo?.token,
      appNavigation,
      accountId,
      networkId,
      externalOnSuccess,
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
