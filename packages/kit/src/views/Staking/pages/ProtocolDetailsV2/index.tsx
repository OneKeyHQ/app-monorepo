import type { ComponentProps } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Badge,
  Button,
  Divider,
  NumberSizeableText,
  Page,
  Popover,
  SizableText,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { CountDownCalendarAlert } from '@onekeyhq/kit/src/components/CountDownCalendarAlert';
import { Token } from '@onekeyhq/kit/src/components/Token';
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
import type { IStakeEarnDetail } from '@onekeyhq/shared/types/staking';
import { EEarnLabels } from '@onekeyhq/shared/types/staking';

import { BabylonTrackingAlert } from '../../components/BabylonTrackingAlert';
import {
  PageFrame,
  isErrorState,
  isLoadingState,
} from '../../components/PageFrame';
import { ProtocolDetails } from '../../components/ProtocolDetails';
import { GridItem } from '../../components/ProtocolDetails/GridItemV2';
import { NoAddressWarning } from '../../components/ProtocolDetails/NoAddressWarning';
import { StakedValueSection } from '../../components/ProtocolDetails/StakedValueSection';
import { StakingTransactionIndicator } from '../../components/StakingActivityIndicator';
import { OverviewSkeleton } from '../../components/StakingSkeleton';
import { useFalconUSDfRegister } from '../../hooks/useEarnSignMessage';
import { buildLocalTxStatusSyncId } from '../../utils/utils';
import {
  useHandleStake,
  useHandleWithdraw,
} from '../ProtocolDetails/useHandleActions';
import { useHandleClaim } from '../ProtocolDetails/useHandleClaim';

import { FAQSection } from './FAQSection';

function SubscriptionSection({
  subscriptionValue,
}: {
  subscriptionValue: IStakeEarnDetail['subscriptionValue'];
}) {
  return (
    <YStack gap="$8">
      <YStack>
        <SizableText size="$headingLg" pt="$2">
          {subscriptionValue.title.text}
        </SizableText>
        <XStack gap="$2" pt="$2" pb="$1">
          <NumberSizeableText
            flex={1}
            size="$heading4xl"
            color={
              subscriptionValue.fiatValue === '0' ? '$textDisabled' : '$text'
            }
            formatter="value"
          >
            {subscriptionValue.fiatValue || 0}
          </NumberSizeableText>
          {/* {renderActionButtons()} */}
        </XStack>
        <NumberSizeableText
          size="$bodyLgMedium"
          formatter="balance"
          color="$textSubdued"
          formatterOptions={{ tokenSymbol: 'ETH' }}
        >
          {0}
        </NumberSizeableText>
      </YStack>
    </YStack>
  );
}

function AlertSection({ alerts }: { alerts: IStakeEarnDetail['alerts'] }) {
  return null;
}

function PortfolioSection({
  portfolios,
}: {
  portfolios: IStakeEarnDetail['portfolios'];
}) {
  const intl = useIntl();
  return (
    <YStack gap="$6">
      <XStack justifyContent="space-between">
        <SizableText size="$headingLg">
          {intl.formatMessage({ id: ETranslations.earn_portfolio })}
        </SizableText>
        {/* {onPortfolioDetails !== undefined ? (
          <Button
            variant="tertiary"
            iconAfter="ChevronRightOutline"
            onPress={onPortfolioDetails}
          >
            {intl.formatMessage({ id: ETranslations.global_details })}
          </Button>
        ) : null} */}
      </XStack>
      <YStack gap="$3">
        {portfolios.map((item) => (
          <XStack
            key={item.title.text}
            minHeight={30}
            alignItems="center"
            justifyContent="space-between"
          >
            <XStack alignItems="center" gap="$1.5">
              <Token size="sm" tokenImageUri={item.token.logoURI} />
              <NumberSizeableText
                size="$bodyLgMedium"
                formatter="balance"
                formatterOptions={{ tokenSymbol: item.token.symbol }}
              >
                {item.formattedValue}
              </NumberSizeableText>
              <XStack gap="$1" ai="center">
                <SizableText size="$bodyLg">{item.title.text}</SizableText>
              </XStack>
              {/* {tooltip || renderTooltipContent ? (
                <Popover
                  placement="top"
                  title={statusText}
                  renderTrigger={
                    <IconButton
                      iconColor="$iconSubdued"
                      size="small"
                      icon="InfoCircleOutline"
                      variant="tertiary"
                    />
                  }
                  renderContent={
                    tooltip ? (
                      <Stack p="$5">
                        <SizableText>{tooltip}</SizableText>
                      </Stack>
                    ) : (
                      renderTooltipContent || null
                    )
                  }
                />
              ) : null} */}
              {/* {badgeText ? (
                <Badge badgeType={badgeType}>
                  <Badge.Text>{badgeText}</Badge.Text>
                </Badge>
              ) : null} */}
            </XStack>
            {/* {buttonText && onPress ? (
              <Button
                size="small"
                disabled={disabled}
                variant="primary"
                onPress={handlePress}
                loading={loading}
              >
                {buttonText}
              </Button>
            ) : null} */}
          </XStack>
        ))}
      </YStack>
    </YStack>
  );
}

function ProfitSection({ profit }: { profit: IStakeEarnDetail['profit'] }) {
  return (
    <YStack gap="$6">
      <SizableText size="$headingLg">{profit.title.text}</SizableText>
      {/* {earnPoints ? (
        <Alert
          title={intl.formatMessage({ id: ETranslations.earn_earn_points })}
          description={intl.formatMessage({
            id: ETranslations.earn_earn_points_desc,
          })}
        />
      ) : (
        <XStack flexWrap="wrap" m="$-5" p="$2">
          {!apys && apr && Number(apr) > 0 ? (
            <GridItem
              title={intl.formatMessage({
                id: ETranslations.earn_rewards_percentage,
              })}
            >
              <XStack gap="$1" alignItems="center">
                <SizableText size="$bodyLgMedium" color="$textSuccess">
                  {`${formatApy(apr)}% ${rewardUnit}`}
                </SizableText>
              </XStack>
            </GridItem>
          ) : null}
          {(apys?.dailyNetApy && Number(apys.dailyNetApy) > 0) ||
          (apys?.weeklyNetApy && Number(apys.weeklyNetApy) > 0) ? (
            <GridItem
              title={intl.formatMessage({
                id: ETranslations.earn_rewards_percentage,
              })}
            >
              <XStack gap="$1" alignItems="center">
                <SizableText size="$bodyLgMedium" color="$textSuccess">
                  {`${formatApy(
                    isFalconProvider ? aprWithoutFee : apys?.dailyNetApy,
                  )}% ${rewardUnit}`}
                </SizableText>
                {apys ? (
                  <Popover
                    floatingPanelProps={{
                      w: 320,
                    }}
                    title={intl.formatMessage({
                      id: ETranslations.earn_rewards,
                    })}
                    renderTrigger={
                      <IconButton
                        icon="CoinsAddOutline"
                        size="small"
                        variant="tertiary"
                      />
                    }
                    renderContent={<ProtocolApyRewards details={details} />}
                    placement="top"
                  />
                ) : null}
              </XStack>
            </GridItem>
          ) : null}
          {earningsIn24h && Number(earningsIn24h) > 0 ? (
            <GridItem
              title={intl.formatMessage({
                id: ETranslations.earn_24h_earnings,
              })}
              tooltip={intl.formatMessage({
                id: ETranslations.earn_24h_earnings_tooltip,
              })}
            >
              <NumberSizeableText
                formatter="value"
                color="$textSuccess"
                size="$bodyLgMedium"
                formatterOptions={{
                  currency: symbol,
                  showPlusMinusSigns: Number(earningsIn24h) >= 0.01,
                }}
              >
                {earningsIn24h}
              </NumberSizeableText>
            </GridItem>
          ) : null}
          {totalRewardAmount && Number(totalRewardAmount) > 0 ? (
            <GridItem
              title={intl.formatMessage({
                id: ETranslations.earn_referral_total_earned,
              })}
            >
              <NumberSizeableText
                formatter="balance"
                color="$textSuccess"
                size="$bodyLgMedium"
                formatterOptions={{
                  tokenSymbol: token.info.symbol,
                  showPlusMinusSigns: Number(totalRewardAmount) > 0,
                }}
              >
                {totalRewardAmount}
              </NumberSizeableText>
            </GridItem>
          ) : null}
          {receiptToken || rewardTokens ? (
            <GridItem
              title={intl.formatMessage({
                id: ETranslations.earn_reward_tokens,
              })}
            >
              <XStack gap="$1" alignItems="center">
                <SizableText size="$bodyLgMedium">
                  {receiptToken || rewardTokens}
                </SizableText>
                {isFalconProvider && isEventActive ? (
                  <Popover
                    placement="top"
                    title={intl.formatMessage({
                      id: ETranslations.earn_reward_tokens,
                    })}
                    renderTrigger={
                      <IconButton
                        iconColor="$iconSubdued"
                        size="small"
                        icon="InfoCircleOutline"
                        variant="tertiary"
                      />
                    }
                    renderContent={
                      <XStack p="$5">
                        <SizableText>
                          {intl.formatMessage({
                            id: ETranslations.earn_fixed_yield_info,
                          })}
                        </SizableText>
                      </XStack>
                    }
                  />
                ) : null}
              </XStack>
            </GridItem>
          ) : null}
          {updateFrequency ? (
            <GridItem
              title={intl.formatMessage({
                id: ETranslations.earn_update_frequency,
              })}
            >
              {updateFrequency}
            </GridItem>
          ) : null}
          {stakingTime &&
          !earnUtils.isEverstakeProvider({
            providerName: providerName || '',
          }) ? (
            <GridItem
              title={intl.formatMessage({
                id: ETranslations.earn_earnings_start,
              })}
            >
              {intl.formatMessage(
                { id: ETranslations.earn_in_number },
                {
                  number: formatStakingDistanceToNowStrict(stakingTime),
                },
              )}
            </GridItem>
          ) : null}
          {unstakingPeriod ? (
            <GridItem
              title={intl.formatMessage({
                id: ETranslations.earn_unstaking_period,
              })}
              tooltip={intl.formatMessage({
                id:
                  rewardToken === 'APT'
                    ? ETranslations.earn_earn_during_unstaking_tooltip
                    : ETranslations.earn_unstaking_period_tooltip,
              })}
            >
              {intl.formatMessage(
                { id: ETranslations.earn_up_to_number_days },
                { number: unstakingPeriod },
              )}
            </GridItem>
          ) : null}
          {joinRequirement && Number(joinRequirement) > 0 ? (
            <GridItem
              title={intl.formatMessage({
                id: ETranslations.earn_join_requirement,
              })}
            >
              <NumberSizeableText
                formatter="balance"
                color="$text"
                size="$bodyLgMedium"
                formatterOptions={{
                  tokenSymbol: rewardToken,
                }}
              >
                {joinRequirement}
              </NumberSizeableText>
            </GridItem>
          ) : null}
        </XStack>
      )} */}
      <XStack flexWrap="wrap" m="$-5" p="$2">
        {profit.cells.map((cell, index) => (
          <GridItem
            key={cell.title.text}
            title={cell.title}
            description={cell.description}
          />
        ))}
      </XStack>
    </YStack>
  );
}

const ProtocolDetailsPage = () => {
  const route = useAppRoute<
    IModalStakingParamList,
    EModalStakingRoutes.ProtocolDetails
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
      backgroundApiProxy.serviceStaking.getProtocolDetailsV2({
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

  // const { isEventActive, effectiveTime } = useEarnEventActive(
  //   result?.provider.eventEndTime,
  // );
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
    // updateFrequency: result?.updateFrequency,
  });
  const onClaim = useCallback(
    async (params?: {
      amount: string;
      claimTokenAddress?: string;
      isReward?: boolean;
      isMorphoClaim?: boolean;
    }) => {
      // if (!result) {
      //   return;
      // }
      // const { amount, claimTokenAddress, isReward, isMorphoClaim } =
      //   params ?? {};
      // let claimTokenInfo = {
      //   token: result.portfolios.token,
      //   amount: amount ?? '0',
      // };
      // if (claimTokenAddress) {
      //   const rewardToken = result.rewardAssets?.[claimTokenAddress];
      //   if (!rewardToken) {
      //     throw new Error('Reward token not found');
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
    // if (!result?.earnHistoryEnable || !earnAccount?.accountId) {
    //   return undefined;
    // }
    // return (params?: { filterType?: string }) => {
    //   const { filterType } = params || {};
    //   appNavigation.navigate(EModalStakingRoutes.HistoryList, {
    //     accountId: earnAccount?.accountId,
    //     networkId,
    //     symbol,
    //     provider,
    //     stakeTag: buildLocalTxStatusSyncId(result),
    //     morphoVault: vault,
    //     filterType,
    //   });
    // };
  }, []);

  const intl = useIntl();
  const media = useMedia();

  // const disableStakeButton = useMemo(
  //   () => !(result?.provider.buttonStake ?? true),
  //   [result?.provider.buttonStake],
  // );

  // const disableUnstakeButton = useMemo(
  //   () => !(result?.provider.buttonUnstake ?? true),
  //   [result?.provider.buttonUnstake],
  // );

  // const stakeButtonProps = useMemo<ComponentProps<typeof Button>>(
  //   () => ({
  //     variant: 'primary',
  //     loading: stakeLoading,
  //     onPress: onStake,
  //     disabled: !earnAccount?.accountAddress || disableStakeButton,
  //   }),
  //   [stakeLoading, onStake, earnAccount?.accountAddress, disableStakeButton],
  // );

  // const withdrawButtonProps = useMemo<ComponentProps<typeof Button>>(
  //   () => ({
  //     onPress: onWithdraw,
  //     disabled:
  //       !earnAccount?.accountAddress ||
  //       !(Number(result?.active) > 0 || Number(result?.overflow) > 0) ||
  //       disableUnstakeButton,
  //   }),
  //   [
  //     onWithdraw,
  //     earnAccount?.accountAddress,
  //     result?.active,
  //     result?.overflow,
  //     disableUnstakeButton,
  //   ],
  // );

  const falconUSDfRegister = useFalconUSDfRegister();
  const shouldRegisterBeforeStake = useMemo(() => {
    // if (
    //   earnUtils.isFalconProvider({ providerName: result?.provider.name ?? '' })
    // ) {
    //   return !result?.hasRegister;
    // }
    return false;
  }, []);

  // const registerButtonProps = useMemo<ComponentProps<typeof Button>>(
  //   () => ({
  //     variant: 'primary',
  //     loading: stakeLoading,
  //     onPress: () => {
  //       void falconUSDfRegister({
  //         accountId: earnAccount?.accountId ?? '',
  //         networkId: earnAccount?.networkId ?? '',
  //         details: result,
  //       });
  //     },
  //   }),
  //   [
  //     stakeLoading,
  //     earnAccount?.accountId,
  //     earnAccount?.networkId,
  //     falconUSDfRegister,
  //     result,
  //   ],
  // );
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

  // const renderPageFooter = useCallback(() => {
  //   if (media.gtMd) {
  //     return null;
  //   }
  //   if (shouldRegisterBeforeStake) {
  //     return (
  //       <Page.Footer
  //         onConfirmText={intl.formatMessage({
  //           id: ETranslations.earn_register,
  //         })}
  //         confirmButtonProps={registerButtonProps}
  //       />
  //     );
  //   }
  //   return (
  //     <Page.Footer
  //       onConfirmText={intl.formatMessage({
  //         id: ETranslations.earn_deposit,
  //       })}
  //       confirmButtonProps={stakeButtonProps}
  //       onCancelText={intl.formatMessage({
  //         id: ETranslations.global_withdraw,
  //       })}
  //       cancelButtonProps={withdrawButtonProps}
  //     />
  //   );
  // }, [
  //   media,
  //   shouldRegisterBeforeStake,
  //   intl,
  //   registerButtonProps,
  //   stakeButtonProps,
  //   withdrawButtonProps,
  // ]);

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
        {/* {isEventActive ? (
          <YStack pb="$1">
            <CountDownCalendarAlert effectiveTimeAt={effectiveTime} />
          </YStack>
        ) : null} */}
        <YStack px="$5" gap="$8">
          <PageFrame
            LoadingSkeleton={OverviewSkeleton}
            loading={isLoadingState({ result, isLoading })}
            error={isErrorState({ result, isLoading })}
            onRefresh={run}
          >
            {result ? (
              <YStack gap="$8">
                <SubscriptionSection
                  subscriptionValue={result.subscriptionValue}
                />
                <AlertSection alerts={result.alerts} />
                <Divider />
                <PortfolioSection portfolios={result.portfolios} />
                <Divider />
                <ProfitSection profit={result.profit} />
                <Divider />
                <FAQSection faqs={result.faqs} />
              </YStack>
            ) : null}

            {/* <ProtocolDetails details={result}>
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
                stakeTag={buildLocalTxStatusSyncId(result)}
                onRefresh={run}
                onPress={onHistory}
              />
            ) : null} */}
          </PageFrame>
        </YStack>
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
