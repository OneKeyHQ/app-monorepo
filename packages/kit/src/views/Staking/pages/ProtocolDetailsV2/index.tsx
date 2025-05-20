import type { ComponentProps } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import type { IButtonProps, IPageFooterProps } from '@onekeyhq/components';
import {
  Badge,
  Button,
  Divider,
  Icon,
  IconButton,
  NumberSizeableText,
  Page,
  Popover,
  SizableText,
  Stack,
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
import { PeriodSection } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/PeriodSectionV2';
import { useEarnEventActive } from '@onekeyhq/kit/src/views/Staking/hooks/useEarnEventActive';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EModalStakingRoutes,
  type IModalStakingParamList,
} from '@onekeyhq/shared/src/routes';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import { EEarnProviderEnum } from '@onekeyhq/shared/types/earn';
import type {
  IEarnTokenInfo,
  IStakeEarnDetail,
} from '@onekeyhq/shared/types/staking';
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
  onConfirmText,
  confirmButtonProps,
  onCancelText,
  cancelButtonProps,
}: {
  subscriptionValue: IStakeEarnDetail['subscriptionValue'];
  onConfirmText: IPageFooterProps['onConfirmText'];
  confirmButtonProps: IPageFooterProps['confirmButtonProps'];
  onCancelText: IPageFooterProps['onCancelText'];
  cancelButtonProps: IPageFooterProps['cancelButtonProps'];
}) {
  const media = useMedia();
  const renderActionButtons = useCallback(() => {
    if (!media.gtMd) {
      return null;
    }
    // if (shouldRegisterBeforeStake) {
    //   return (
    //     <XStack gap="$2">
    //       <Button {...registerButtonProps}>
    //         {intl.formatMessage({ id: ETranslations.earn_register })}
    //       </Button>
    //     </XStack>
    //   );
    // }
    return (
      <XStack gap="$2">
        <Button {...confirmButtonProps}>{onCancelText}</Button>
        <Button {...cancelButtonProps}>{onConfirmText}</Button>
      </XStack>
    );
  }, [
    cancelButtonProps,
    confirmButtonProps,
    media.gtMd,
    onCancelText,
    onConfirmText,
  ]);
  return subscriptionValue ? (
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
          {renderActionButtons()}
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
  ) : null;
}

function AlertSection({ alerts }: { alerts: IStakeEarnDetail['alerts'] }) {
  if (alerts && alerts.length) {
    return (
      <YStack
        bg="$bgSubdued"
        borderColor="$borderSubdued"
        borderWidth={StyleSheet.hairlineWidth}
        borderRadius="$3"
        py="$3.5"
        px="$4"
      >
        {alerts.map((text, index) => (
          <SizableText key={index} size="$bodyMd" color="$textSubdued">
            {text}
          </SizableText>
        ))}
      </YStack>
    );
  }
  return null;
}

function ProtocolRewards({
  rewards,
  tokenInfo,
}: {
  rewards: IStakeEarnDetail['rewards'];
  tokenInfo?: IEarnTokenInfo;
}) {
  const intl = useIntl();
  const handleClaim = useHandleClaim({
    accountId: tokenInfo?.accountId || '',
    networkId: tokenInfo?.networkId || '',
  });
  return rewards ? (
    <YStack
      gap="$2.5"
      mt="$3"
      py="$3.5"
      px="$4"
      borderRadius="$3"
      borderWidth={StyleSheet.hairlineWidth}
      borderColor="$borderSubdued"
      bg="$bgSubdued"
    >
      <XStack alignItems="center" gap="$1">
        <SizableText
          color={rewards.title.color || '$textSubdued'}
          size="$bodyMd"
        >
          {rewards.title.text}
        </SizableText>
        <Popover
          title={rewards.title.text}
          placement="top"
          renderTrigger={
            <IconButton
              iconColor="$iconSubdued"
              size="small"
              icon="InfoCircleOutline"
              variant="tertiary"
            />
          }
          renderContent={
            <Stack p="$5">
              <SizableText
                color={rewards.tooltip.color || '$text'}
                size="$bodyLg"
              >
                {rewards.tooltip.text}
              </SizableText>
            </Stack>
          }
        />
      </XStack>
      {rewards?.tokens?.map((token, index) => {
        return (
          <>
            <YStack gap="$2.5">
              <XStack
                alignItems="center"
                justifyContent="space-between"
                flexWrap="wrap"
                gap="$2"
              >
                <XStack alignItems="center" flex={1} flexWrap="wrap">
                  <Token
                    mr="$1.5"
                    size="sm"
                    tokenImageUri={token.token.logoURI}
                  />
                  <XStack flex={1} flexWrap="wrap" alignItems="center">
                    <SizableText size="$bodyLgMedium" color={token.title.color}>
                      {token.title.text}
                    </SizableText>
                  </XStack>
                </XStack>
                <Button
                  size="small"
                  variant="primary"
                  onPress={async () => {
                    await handleClaim({
                      symbol: token.token.symbol,
                      provider: tokenInfo?.provider || '',
                      // claimAmount: claimTokenInfo.amount,
                      vault: '',
                      claimAmount: '0',
                      claimTokenAddress: tokenInfo?.token.address,
                      isReward: true,
                      isMorphoClaim: !!(
                        tokenInfo?.provider &&
                        earnUtils.isMorphoProvider({
                          providerName: tokenInfo?.provider,
                        })
                      ),
                      stakingInfo: {
                        label: EEarnLabels.Claim,
                        protocol: earnUtils.getEarnProviderName({
                          providerName: tokenInfo?.provider || '',
                        }),
                        protocolLogoURI: '',
                        receive: {
                          token: token.token,
                          amount: '0',
                        },
                        tags: [
                          buildLocalTxStatusSyncId({
                            providerName: tokenInfo?.provider || '',
                            tokenSymbol: token.token.symbol,
                          }),
                        ],
                      },
                    });
                  }}
                >
                  {intl.formatMessage({
                    id: ETranslations.earn_claim,
                  })}
                </Button>
              </XStack>
              <XStack>
                <SizableText
                  size="$bodyMd"
                  color={token.description.color || '$textSubdued'}
                >
                  {token.description.text}
                </SizableText>
              </XStack>
            </YStack>
            {rewards?.tokens.length !== index + 1 ? (
              <Divider my="$1.5" />
            ) : null}
          </>
        );
      })}
    </YStack>
  ) : null;
}

function PortfolioSection({
  portfolios,
  rewards,
  tokenInfo,
}: {
  portfolios: IStakeEarnDetail['portfolios'];
  rewards: IStakeEarnDetail['rewards'];
  tokenInfo?: IEarnTokenInfo;
}) {
  return portfolios ? (
    <>
      <YStack gap="$6">
        <XStack justifyContent="space-between">
          <SizableText size="$headingLg" color={portfolios.title.color}>
            {portfolios.title.text}
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
          {portfolios.items.map((item) => (
            <XStack
              key={item.title.text}
              minHeight={30}
              alignItems="center"
              justifyContent="space-between"
            >
              <XStack alignItems="center" gap="$1.5">
                <Token size="sm" tokenImageUri={item.token.logoURI} />
                <SizableText size="$bodyLgMedium" color={item.title.color}>
                  {item.title.text}
                </SizableText>
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
                {item?.badge ? (
                  <Badge
                    badgeType={item.badge.badgeType}
                    badgeSize={item.badge.badgeSize}
                  >
                    <Badge.Text>{item.badge.text.text}</Badge.Text>
                  </Badge>
                ) : null}
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
        <ProtocolRewards rewards={rewards} tokenInfo={tokenInfo} />
      </YStack>
      <Divider />
    </>
  ) : null;
}

function ProfitSection({ profit }: { profit: IStakeEarnDetail['profit'] }) {
  return profit ? (
    <>
      <YStack gap="$6">
        <SizableText size="$headingLg">{profit.title.text}</SizableText>
        <XStack flexWrap="wrap" m="$-5" p="$2">
          {profit.items.map((cell) => (
            <GridItem
              key={cell.title.text}
              title={cell.title}
              description={cell.description}
              actionIcon={cell.actionIcon}
              tooltip={cell.tooltip}
            />
          ))}
        </XStack>
      </YStack>
      <Divider />
    </>
  ) : null;
}

function ProviderSection({
  provider,
}: {
  provider: IStakeEarnDetail['provider'];
}) {
  return provider ? (
    <>
      <YStack gap="$6">
        <SizableText size="$headingLg" color={provider.title.color}>
          {provider.title.text}
        </SizableText>
        <XStack flexWrap="wrap" m="$-5" p="$2">
          {provider.items.map((cell) => (
            <GridItem
              key={cell.title.text}
              title={cell.title}
              description={cell.description}
              actionIcon={cell.actionIcon}
              tooltip={cell?.tooltip}
            />
          ))}
        </XStack>
      </YStack>
      <Divider />
    </>
  ) : null;
}

function RiskSection({ risk }: { risk?: IStakeEarnDetail['risk'] }) {
  const intl = useIntl();
  return risk ? (
    <>
      <YStack gap="$6">
        <SizableText size="$headingLg">
          {intl.formatMessage({ id: ETranslations.global_risk })}
        </SizableText>
        <XStack ai="center" gap="$3">
          <YStack flex={1} gap="$2">
            <XStack ai="center" gap="$2">
              <XStack
                ai="center"
                jc="center"
                w="$6"
                h="$6"
                bg="$bgCaution"
                borderRadius="$1"
              >
                <Icon
                  name={risk.icon.icon}
                  size="$4"
                  color={risk.icon.color || '$iconCaution'}
                />
              </XStack>
              <SizableText size="$bodyMdMedium" color={risk.title.color}>
                {risk.title.text}
              </SizableText>
            </XStack>
            <SizableText
              size="$bodyMd"
              color={risk.description.color || '$textSubdued'}
            >
              {risk.description.text}
            </SizableText>
          </YStack>
          {risk?.actionButton?.actionType === 'link' ? (
            <IconButton
              icon="OpenOutline"
              color="$iconSubdued"
              size="small"
              bg="transparent"
              onPress={() => {
                openUrlExternal(risk?.actionButton?.text.text);
              }}
            />
          ) : null}
        </XStack>
      </YStack>
      <Divider />
    </>
  ) : null;
}

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

  const tokenInfo = useMemo(() => {
    return result?.subscriptionValue?.token
      ? {
          token: result?.subscriptionValue?.token,
          networkId,
          provider,
          vault,
          accountId,
        }
      : undefined;
  }, [accountId, networkId, provider, result?.subscriptionValue?.token, vault]);

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

  const depositButtonProps = useMemo(() => {
    const item = result?.actions?.find((i) => i.actionType === 'deposit');
    return {
      props: {
        disabled: !earnAccount?.accountAddress || item?.disabled,
        variant: 'primary',
        loading: stakeLoading,
        display: item ? undefined : 'none',
      } as IButtonProps,
      text: item?.text.text,
    };
  }, [stakeLoading, earnAccount?.accountAddress, result?.actions]);

  const withdrawButtonProps = useMemo(() => {
    const item = result?.actions?.find((i) => i.actionType === 'withdraw');
    return {
      text: item?.text.text,
      props: {
        disabled: !earnAccount?.accountAddress || item?.disabled,
        display: item ? undefined : 'none',
      } as IButtonProps,
    };
  }, [earnAccount?.accountAddress, result?.actions]);

  const renderPageFooter = useCallback(() => {
    if (media.gtMd) {
      return null;
    }
    // if (shouldRegisterBeforeStake) {
    //   return (
    //     <Page.Footer
    //       onConfirmText={intl.formatMessage({
    //         id: ETranslations.earn_register,
    //       })}
    //       confirmButtonProps={registerButtonProps}
    //     />
    //   );
    // }
    return (
      <Page.Footer
        onConfirmText={depositButtonProps.text}
        confirmButtonProps={depositButtonProps.props}
        onCancelText={withdrawButtonProps.text}
        cancelButtonProps={withdrawButtonProps.props}
      />
    );
  }, [
    media.gtMd,
    depositButtonProps.text,
    depositButtonProps.props,
    withdrawButtonProps,
  ]);

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
                  onConfirmText={depositButtonProps.text}
                  confirmButtonProps={depositButtonProps.props}
                  onCancelText={withdrawButtonProps.text}
                  cancelButtonProps={withdrawButtonProps.props}
                />
                <AlertSection alerts={result.alerts} />
                <Divider />
                <PortfolioSection
                  portfolios={result.portfolios}
                  rewards={result.rewards}
                  tokenInfo={tokenInfo}
                />
                <ProfitSection profit={result.profit} />
                <PeriodSection timeline={result.timeline} />
                <ProviderSection provider={result.provider} />
                <RiskSection risk={result.risk} />
                <FAQSection faqs={result.faqs} tokenInfo={tokenInfo} />
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
            {result ? (
              <StakingTransactionIndicator
                accountId={earnAccount?.accountId ?? ''}
                networkId={networkId}
                stakeTag={buildLocalTxStatusSyncId(result)}
                onRefresh={run}
                onPress={onHistory}
              />
            ) : null} */}
            {renderPageFooter()}
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
