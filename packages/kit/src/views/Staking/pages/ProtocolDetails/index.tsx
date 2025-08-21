import type { ComponentProps } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import type { Button } from '@onekeyhq/components';
import { Page, YStack, useMedia } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { CountDownCalendarAlert } from '@onekeyhq/kit/src/components/CountDownCalendarAlert';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useRouteIsFocused as useIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import { useEarnEventActive } from '@onekeyhq/kit/src/views/Staking/hooks/useEarnEventActive';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EModalStakingRoutes,
  type IModalStakingParamList,
} from '@onekeyhq/shared/src/routes';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import { EEarnProviderEnum } from '@onekeyhq/shared/types/earn';
import { EEarnLabels } from '@onekeyhq/shared/types/staking';

import { BabylonTrackingAlert } from '../../components/BabylonTrackingAlert';
import {
  PageFrame,
  isErrorState,
  isLoadingState,
} from '../../components/PageFrame';
import { ProtocolDetails } from '../../components/ProtocolDetails';
import { NoAddressWarning } from '../../components/ProtocolDetails/NoAddressWarning';
import { PortfolioSection } from '../../components/ProtocolDetails/PortfolioSection';
import { ShareEventsContext } from '../../components/ProtocolDetails/ShareEventsProvider';
import { StakedValueSection } from '../../components/ProtocolDetails/StakedValueSection';
import { StakingTransactionIndicator } from '../../components/StakingActivityIndicator';
import { OverviewSkeleton } from '../../components/StakingSkeleton';
import { useFalconUSDfRegister } from '../../hooks/useEarnSignMessage';
import { buildLocalTxStatusSyncId } from '../../utils/utils';

import { useHandleStake, useHandleWithdraw } from './useHandleActions';
import { useHandleClaim } from './useHandleClaim';

const ProtocolDetailsPage = () => {
  const route = useAppRoute<
    IModalStakingParamList,
    EModalStakingRoutes.ProtocolDetailsV2
  >();
  const { accountId, networkId, indexedAccountId, symbol, provider, vault } =
    route.params;
  const appNavigation = useAppNavigation();
  const [stakeLoading, setStakeLoading] = useState(false);
  const { result: earnAccount, run: refreshAccount } = usePromiseResult(
    async () =>
      backgroundApiProxy.serviceStaking.getEarnAccount({
        accountId,
        networkId,
        indexedAccountId,
        btcOnlyTaproot: true,
      }),
    [accountId, indexedAccountId, networkId],
  );
  const { result, isLoading, run } = usePromiseResult(
    () =>
      backgroundApiProxy.serviceStaking.getProtocolDetails({
        accountId,
        networkId,
        indexedAccountId,
        symbol,
        provider,
        vault,
      }),
    [accountId, networkId, indexedAccountId, symbol, provider, vault],
    { watchLoading: true, revalidateOnFocus: true },
  );

  const { result: unbondingDelegationList } = usePromiseResult(
    () =>
      earnAccount?.accountAddress
        ? backgroundApiProxy.serviceStaking.getUnbondingDelegationList({
            accountAddress: earnAccount?.accountAddress,
            symbol,
            networkId,
            provider,
          })
        : Promise.resolve([]),
    [earnAccount?.accountAddress, symbol, networkId, provider],
    { watchLoading: true, initResult: [], revalidateOnFocus: true },
  );

  const onCreateAddress = useCallback(async () => {
    await refreshAccount();
    void run();
  }, [refreshAccount, run]);

  const { isEventActive, effectiveTime } = useEarnEventActive(
    result?.provider.eventEndTime,
  );
  const handleWithdraw = useHandleWithdraw();
  const handleStake = useHandleStake();

  const { result: trackingResp, run: refreshTracking } = usePromiseResult(
    async () => {
      if (
        provider.toLowerCase() !== EEarnProviderEnum.Babylon.toLowerCase() ||
        !earnAccount
      ) {
        return [];
      }
      const items =
        await backgroundApiProxy.serviceStaking.getBabylonTrackingItems({
          accountId: earnAccount.accountId,
          networkId: earnAccount.networkId,
        });
      return items;
    },
    [provider, earnAccount],
    { initResult: [] },
  );

  const isFocused = useIsFocused();
  useEffect(() => {
    if (isFocused) {
      void refreshTracking();
    }
  }, [isFocused, refreshTracking]);

  const onRefreshTracking = useCallback(async () => {
    void run();
    void refreshTracking();
  }, [run, refreshTracking]);

  const onStake = useCallback(async () => {
    // await handleStake({
    //   details: result,
    //   accountId: earnAccount?.accountId,
    //   networkId,
    //   indexedAccountId,
    //   symbol,
    //   provider,
    //   setStakeLoading,
    //   onSuccess: async () => {
    //     if (networkUtils.isBTCNetwork(networkId)) {
    //       await run();
    //       await refreshTracking();
    //     }
    //   },
    // });
  }, []);

  const onWithdraw = useCallback(async () => {
    // await handleWithdraw({
    //   details: result,
    //   accountId: earnAccount?.accountId,
    //   networkId,
    //   symbol,
    //   provider,
    //   onSuccess: async () => {
    //     if (networkUtils.isBTCNetwork(networkId)) {
    //       await run();
    //     }
    //   },
    // });
  }, []);

  const handleClaim = useHandleClaim({
    accountId: earnAccount?.accountId,
    networkId,
  });
  const onClaim = useCallback(
    async (params?: {
      amount: string;
      claimTokenAddress?: string;
      isReward?: boolean;
      isMorphoClaim?: boolean;
    }) => {
      // if (!result) return;
      // const { amount, claimTokenAddress, isReward, isMorphoClaim } =
      //   params ?? {};
      // let claimTokenInfo = { token: result.token.info, amount: amount ?? '0' };
      // if (claimTokenAddress) {
      //   const rewardToken = result.rewardAssets?.[claimTokenAddress];
      //   if (!rewardToken) {
      //     throw new OneKeyLocalError('Reward token not found');
      //   }
      //   claimTokenInfo = { token: rewardToken.info, amount: amount ?? '0' };
      // }
      // await handleClaim({
      //   symbol,
      //   provider,
      //   claimAmount: claimTokenInfo.amount,
      //   claimTokenAddress,
      //   isReward,
      //   isMorphoClaim,
      //   details: result,
      //   stakingInfo: {
      //     label: EEarnLabels.Claim,
      //     protocol: earnUtils.getEarnProviderName({
      //       providerName: result.provider.name,
      //     }),
      //     protocolLogoURI: result.provider.logoURI,
      //     receive: claimTokenInfo,
      //     tags: [buildLocalTxStatusSyncId(result)],
      //   },
      // });
    },
    [],
  );

  const onPortfolioDetails = useMemo(
    () =>
      networkUtils.isBTCNetwork(networkId) && earnAccount?.accountId
        ? () => {
            appNavigation.push(EModalStakingRoutes.PortfolioDetails, {
              accountId: earnAccount?.accountId,
              networkId,
              symbol,
              provider,
            });
          }
        : undefined,
    [appNavigation, earnAccount?.accountId, networkId, symbol, provider],
  );

  const onHistory = useMemo(() => {
    if (!result?.earnHistoryEnable || !earnAccount?.accountId) {
      return undefined;
    }
    return (params?: { filterType?: string }) => {
      const { filterType } = params || {};
      appNavigation.navigate(EModalStakingRoutes.HistoryList, {
        accountId: earnAccount?.accountId,
        networkId,
        symbol,
        provider,
        stakeTag: buildLocalTxStatusSyncId({
          providerName: result.provider.name,
          tokenSymbol: result.token.info.symbol,
        }),
        protocolVault: vault,
        filterType,
      });
    };
  }, [
    appNavigation,
    earnAccount?.accountId,
    networkId,
    symbol,
    provider,
    vault,
    result,
  ]);

  const intl = useIntl();
  const media = useMedia();

  const disableStakeButton = useMemo(
    () => !(result?.provider.buttonStake ?? true),
    [result?.provider.buttonStake],
  );

  const disableUnstakeButton = useMemo(
    () => !(result?.provider.buttonUnstake ?? true),
    [result?.provider.buttonUnstake],
  );

  const stakeButtonProps = useMemo<ComponentProps<typeof Button>>(
    () => ({
      variant: 'primary',
      loading: stakeLoading,
      onPress: onStake,
      disabled: !earnAccount?.accountAddress || disableStakeButton,
    }),
    [stakeLoading, onStake, earnAccount?.accountAddress, disableStakeButton],
  );

  const withdrawButtonProps = useMemo<ComponentProps<typeof Button>>(
    () => ({
      onPress: onWithdraw,
      disabled:
        !earnAccount?.accountAddress ||
        !(Number(result?.active) > 0 || Number(result?.overflow) > 0) ||
        disableUnstakeButton,
    }),
    [
      onWithdraw,
      earnAccount?.accountAddress,
      result?.active,
      result?.overflow,
      disableUnstakeButton,
    ],
  );

  const falconUSDfRegister = useFalconUSDfRegister();
  const shouldRegisterBeforeStake = useMemo(() => {
    if (
      earnUtils.isFalconProvider({ providerName: result?.provider.name ?? '' })
    ) {
      return !result?.hasRegister;
    }
    return false;
  }, [result?.hasRegister, result?.provider.name]);

  const registerButtonProps = useMemo<ComponentProps<typeof Button>>(
    () => ({
      variant: 'primary',
      loading: stakeLoading,
      onPress: () => {
        void falconUSDfRegister({
          accountId: earnAccount?.accountId ?? '',
          networkId: earnAccount?.networkId ?? '',
          details: result,
        });
      },
    }),
    [
      stakeLoading,
      earnAccount?.accountId,
      earnAccount?.networkId,
      falconUSDfRegister,
      result,
    ],
  );
  // const { bindInviteCode } = useReferFriends();
  // const { result: isShowAlert, run: refetchInviteCode } = usePromiseResult(
  //   async () => {
  //     const code = await backgroundApiProxy.serviceReferralCode.getInviteCode();
  //     if (code) {
  //       return false;
  //     }
  //     if (earnAccount?.accountAddress) {
  //       const inviteCodeOnServer =
  //         await backgroundApiProxy.serviceStaking.queryInviteCodeByAddress({
  //           networkId,
  //           accountAddress: earnAccount?.accountAddress,
  //         });
  //       if (inviteCodeOnServer) {
  //         return false;
  //       }
  //     }
  //     return true;
  //   },
  //   [earnAccount?.accountAddress, networkId],
  //   {
  //     revalidateOnFocus: true,
  //     initResult: false,
  //   },
  // );

  const renderPageFooter = useCallback(() => {
    if (media.gtMd) {
      return null;
    }
    if (shouldRegisterBeforeStake) {
      return (
        <Page.Footer
          onConfirmText={intl.formatMessage({
            id: ETranslations.earn_register,
          })}
          confirmButtonProps={registerButtonProps}
        />
      );
    }
    return (
      <Page.Footer
        onConfirmText={intl.formatMessage({
          id: ETranslations.earn_deposit,
        })}
        confirmButtonProps={stakeButtonProps}
        onCancelText={intl.formatMessage({
          id: ETranslations.global_withdraw,
        })}
        cancelButtonProps={withdrawButtonProps}
      />
    );
  }, [
    media,
    shouldRegisterBeforeStake,
    intl,
    registerButtonProps,
    stakeButtonProps,
    withdrawButtonProps,
  ]);

  const contextValue = useMemo(
    () => ({
      onHistory,
    }),
    [onHistory],
  );
  return (
    <Page scrollEnabled>
      <Page.Header
        title={intl.formatMessage(
          { id: ETranslations.earn_earn_symbol },
          {
            'symbol': networkUtils.isBTCNetwork(networkId)
              ? `${symbol} (Taproot)`
              : symbol,
          },
        )}
      />
      <Page.Body pb="$5">
        {/* {result?.buttons?.addInviteCode && isShowAlert ? (
          <Alert
            type="success"
            icon="GiftOutline"
            mb="$3"
            title={intl.formatMessage(
              {
                id: ETranslations.earn_referral_enter_invite_code_subtitle,
              },
              {
                number: '1.5%',
              },
            )}
            action={{
              primary: intl.formatMessage({
                id: ETranslations.earn_referral_add_invite_code,
              }),
              onPrimaryPress: () => {
                bindInviteCode(refetchInviteCode);
              },
            }}
            fullBleed
          />
        ) : null} */}
        {isEventActive ? (
          <YStack pb="$1">
            <CountDownCalendarAlert effectiveTimeAt={effectiveTime} />
          </YStack>
        ) : null}
        <ShareEventsContext.Provider value={contextValue}>
          <YStack px="$5" gap="$8">
            <PageFrame
              LoadingSkeleton={OverviewSkeleton}
              loading={isLoadingState({ result, isLoading })}
              error={isErrorState({ result, isLoading })}
              onRefresh={run}
            >
              <ProtocolDetails details={result}>
                {earnAccount?.accountAddress ? (
                  <>
                    <StakedValueSection
                      details={result}
                      shouldRegisterBeforeStake={shouldRegisterBeforeStake}
                      stakeButtonProps={stakeButtonProps}
                      withdrawButtonProps={withdrawButtonProps}
                      registerButtonProps={registerButtonProps}
                      alerts={result?.provider.alerts}
                    />
                    <PortfolioSection
                      details={result}
                      onClaim={onClaim}
                      onWithdraw={onWithdraw}
                      onPortfolioDetails={onPortfolioDetails}
                      unbondingDelegationList={unbondingDelegationList}
                      onHistory={onHistory}
                    />
                    {trackingResp.length > 0 ? (
                      <BabylonTrackingAlert
                        accountId={earnAccount.accountId}
                        networkId={networkId}
                        provider={provider}
                        symbol={symbol}
                        onRefresh={onRefreshTracking}
                      />
                    ) : null}
                  </>
                ) : (
                  <NoAddressWarning
                    accountId={accountId}
                    networkId={networkId}
                    indexedAccountId={indexedAccountId}
                    onCreateAddress={onCreateAddress}
                  />
                )}
              </ProtocolDetails>
              {renderPageFooter()}
              {result ? (
                <StakingTransactionIndicator
                  accountId={earnAccount?.accountId ?? ''}
                  networkId={networkId}
                  stakeTag={buildLocalTxStatusSyncId({
                    providerName: result.provider.name,
                    tokenSymbol: result.token.info.symbol,
                  })}
                  onRefresh={run}
                  onPress={onHistory}
                />
              ) : null}
            </PageFrame>
          </YStack>
        </ShareEventsContext.Provider>
      </Page.Body>
    </Page>
  );
};

function ProtocolDetailsPageWithProvider() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <ProtocolDetailsPage />
    </AccountSelectorProviderMirror>
  );
}

export default ProtocolDetailsPageWithProvider;
