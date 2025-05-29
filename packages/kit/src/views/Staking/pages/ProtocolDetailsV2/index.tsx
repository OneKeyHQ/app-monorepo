import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import type { IButtonProps, IPageFooterProps } from '@onekeyhq/components';
import {
  Badge,
  Button,
  Divider,
  Icon,
  IconButton,
  Image,
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
import { FormatHyperlinkText } from '@onekeyhq/kit/src/components/HyperlinkText';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { PeriodSection } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/PeriodSectionV2';
import { ProtectionSection } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/ProtectionSectionV2';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EModalStakingRoutes,
  type IModalStakingParamList,
} from '@onekeyhq/shared/src/routes';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type {
  IEarnTokenInfo,
  IProtocolInfo,
  IStakeEarnDetail,
} from '@onekeyhq/shared/types/staking';
import { EEarnLabels } from '@onekeyhq/shared/types/staking';

import {
  PageFrame,
  isErrorState,
  isLoadingState,
} from '../../components/PageFrame';
import { GridItem } from '../../components/ProtocolDetails/GridItemV2';
import { NoAddressWarning } from '../../components/ProtocolDetails/NoAddressWarning';
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
import { ShareEventsContext } from './ShareEventsProvider';

function ManagersSection({
  managers,
}: {
  managers: IStakeEarnDetail['managers'] | undefined;
}) {
  return managers?.items?.length ? (
    <XStack pt="$1" pb="$4" gap="$1" px="$5">
      {managers.items.map((item, index) => (
        <>
          <XStack key={item.title.text} gap="$1" alignItems="center">
            <Image size="$4" borderRadius="$1" src={item.logoURI} />
            <SizableText size="$bodySm" color={item.title.color}>
              {item.title.text}
            </SizableText>
            <SizableText
              size="$bodySm"
              color={item.description.color || '$textSubdued'}
            >
              {item.description.text}
            </SizableText>
          </XStack>
          {index !== managers.items.length - 1 ? (
            <XStack w="$4" h="$4" ai="center" jc="center">
              <XStack w="$1" h="$1" borderRadius="$full" bg="$iconSubdued" />
            </XStack>
          ) : null}
        </>
      ))}
    </XStack>
  ) : null;
}

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
        <Button {...cancelButtonProps}>{onCancelText}</Button>
        <Button {...confirmButtonProps}>{onConfirmText}</Button>
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
          formatterOptions={{
            tokenSymbol: subscriptionValue.token.info.symbol,
          }}
        >
          {subscriptionValue.formattedValue || 0}
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
  protocolInfo,
}: {
  rewards: IStakeEarnDetail['rewards'];
  tokenInfo?: IEarnTokenInfo;
  protocolInfo?: IProtocolInfo;
}) {
  const intl = useIntl();
  const handleClaim = useHandleClaim({
    accountId: protocolInfo?.earnAccount?.accountId || '',
    networkId: tokenInfo?.networkId || '',
  });
  const tooltipElement = useMemo(() => {
    if (rewards?.tooltip) {
      switch (rewards.tooltip.type) {
        case 'text':
        default:
          return (
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
                  <SizableText color="$text" size="$bodyLg">
                    {rewards.tooltip.data?.text}
                  </SizableText>
                </Stack>
              }
            />
          );
      }
    }
    return null;
  }, [rewards?.title?.text, rewards?.tooltip]);
  return rewards ? (
    <YStack
      gap="$2.5"
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
        {tooltipElement}
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
                    tokenImageUri={token.token.info.logoURI}
                  />
                  <XStack flex={1} flexWrap="wrap" alignItems="center">
                    <SizableText size="$bodyLgMedium" color={token.title.color}>
                      {token.title.text}
                    </SizableText>
                  </XStack>
                </XStack>
                {token?.button.type === 'claim' ? (
                  <Button
                    size="small"
                    variant="primary"
                    disabled={token?.button?.disabled}
                    onPress={async () => {
                      // TODO: need fiatValue
                      const claimAmount =
                        token?.title?.text?.split(' ')?.[0] || '0';
                      const isMorphoClaim = !!(
                        tokenInfo?.provider &&
                        earnUtils.isMorphoProvider({
                          providerName: tokenInfo?.provider,
                        })
                      );
                      const newRewardToken = token.token.info;
                      await handleClaim({
                        symbol: protocolInfo?.symbol || '',
                        protocolInfo,
                        tokenInfo: tokenInfo
                          ? {
                              ...tokenInfo,
                              token: newRewardToken,
                            }
                          : undefined,
                        claimAmount,
                        claimTokenAddress: newRewardToken.address,
                        isMorphoClaim,
                        stakingInfo: {
                          label: EEarnLabels.Claim,
                          protocol: earnUtils.getEarnProviderName({
                            providerName: tokenInfo?.provider || '',
                          }),
                          protocolLogoURI: protocolInfo?.providerDetail.logoURI,
                          receive: {
                            token: newRewardToken,
                            amount: claimAmount,
                          },
                          tags: protocolInfo?.stakeTag
                            ? [protocolInfo.stakeTag]
                            : [],
                        },
                      });
                    }}
                  >
                    {intl.formatMessage({
                      id: ETranslations.earn_claim,
                    })}
                  </Button>
                ) : null}
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
  protocolInfo,
}: {
  portfolios: IStakeEarnDetail['portfolios'];
  rewards: IStakeEarnDetail['rewards'];
  tokenInfo?: IEarnTokenInfo;
  protocolInfo?: IProtocolInfo;
}) {
  const intl = useIntl();
  const appNavigation = useAppNavigation();
  const onPortfolioDetails = useCallback(() => {
    appNavigation.push(EModalStakingRoutes.PortfolioDetails, {
      accountId: protocolInfo?.earnAccount?.accountId || '',
      networkId: tokenInfo?.networkId || '',
      symbol: protocolInfo?.symbol || '',
      provider: protocolInfo?.provider || '',
    });
  }, [
    appNavigation,
    protocolInfo?.earnAccount?.accountId,
    protocolInfo?.provider,
    protocolInfo?.symbol,
    tokenInfo?.networkId,
  ]);
  const handleClaim = useHandleClaim({
    accountId: protocolInfo?.earnAccount?.accountId || '',
    networkId: tokenInfo?.networkId || '',
  });
  const renderItem = useCallback(
    (item: IStakeEarnDetail['portfolios']['items'][0]) => {
      switch (item.type) {
        case 'default':
        default:
          return (
            <XStack
              key={item.title.text}
              minHeight={30}
              alignItems="center"
              justifyContent="space-between"
            >
              <XStack alignItems="center" gap="$1.5">
                <Token size="sm" tokenImageUri={item.token.info.logoURI} />
                <FormatHyperlinkText
                  size="$bodyLgMedium"
                  color={item.title.color}
                >
                  {item.title.text}
                </FormatHyperlinkText>
                <SizableText
                  size="$bodyLgMedium"
                  color={item.description?.color}
                >
                  {item.description?.text}
                </SizableText>
                {item?.badge ? (
                  <Badge
                    badgeType={item.badge.badgeType}
                    badgeSize={item.badge.badgeSize}
                  >
                    <Badge.Text>{item.badge.text.text}</Badge.Text>
                  </Badge>
                ) : null}
                {item?.tooltip && item?.tooltip.type === 'text' ? (
                  <Popover
                    placement="top"
                    title={item?.description?.text || ''}
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
                        <SizableText color={item.tooltip.data.color}>
                          {item.tooltip.data.text}
                        </SizableText>
                      </Stack>
                    }
                  />
                ) : null}
              </XStack>
              {item?.buttons?.[0]?.type === 'claim' ? (
                <Button
                  size="small"
                  disabled={item?.buttons?.[0]?.disabled}
                  variant="primary"
                  onPress={async () => {
                    const claimAmount = protocolInfo?.claimable || '0';
                    const newTokenInfo = {
                      ...tokenInfo,
                      token: item.token.info,
                    };
                    await handleClaim({
                      symbol: item.token.info.symbol,
                      protocolInfo,
                      tokenInfo: newTokenInfo as IEarnTokenInfo,
                      claimAmount,
                      claimTokenAddress: newTokenInfo?.token.address,
                      isMorphoClaim: !!(
                        newTokenInfo?.provider &&
                        earnUtils.isMorphoProvider({
                          providerName: newTokenInfo.provider,
                        })
                      ),
                      stakingInfo: {
                        label: EEarnLabels.Claim,
                        protocol: earnUtils.getEarnProviderName({
                          providerName: newTokenInfo?.provider || '',
                        }),
                        protocolLogoURI: protocolInfo?.providerDetail.logoURI,
                        receive: {
                          token: item.token.info,
                          amount: claimAmount,
                        },
                        tags: protocolInfo?.stakeTag
                          ? [protocolInfo.stakeTag]
                          : [],
                      },
                    });
                  }}
                >
                  {item?.buttons?.[0]?.text.text}
                </Button>
              ) : null}
            </XStack>
          );
      }
    },
    [handleClaim, protocolInfo, tokenInfo],
  );
  return portfolios?.items?.length || rewards?.tokens?.length ? (
    <>
      <YStack gap="$6">
        <XStack justifyContent="space-between">
          <SizableText size="$headingLg" color={portfolios.title.color}>
            {portfolios.title.text}
          </SizableText>
          {portfolios.button && portfolios.button.type === 'portfolio' ? (
            <Button
              disabled={portfolios.button.disabled}
              variant="tertiary"
              iconAfter="ChevronRightOutline"
              onPress={onPortfolioDetails}
            >
              {portfolios?.button.text.text}
            </Button>
          ) : null}
        </XStack>
        <YStack gap="$3">
          {portfolios?.items.length ? (
            <YStack gap="$3">{portfolios.items.map(renderItem)}</YStack>
          ) : null}
          {rewards?.tokens.length ? (
            <ProtocolRewards
              rewards={rewards}
              tokenInfo={tokenInfo}
              protocolInfo={protocolInfo}
            />
          ) : null}
        </YStack>
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
              actionIcon={cell.button}
              tooltip={cell.tooltip}
              type={cell.type}
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
              actionIcon={cell.button}
              tooltip={cell?.tooltip}
              type={cell.type}
            />
          ))}
        </XStack>
      </YStack>
      <Divider />
    </>
  ) : null;
}

function RiskSection({ risk }: { risk?: IStakeEarnDetail['risk'] }) {
  return risk ? (
    <>
      <YStack gap="$6">
        <SizableText size="$headingLg" color={risk.title.color}>
          {risk.title.text}
        </SizableText>
        <YStack gap="$3">
          {risk.items?.map((item) => (
            <>
              <XStack ai="center" gap="$3" key={item.title.text}>
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
                        name={item.icon.icon}
                        size="$4"
                        color={item.icon.color || '$iconCaution'}
                      />
                    </XStack>
                    <SizableText size="$bodyMdMedium" color={item.title.color}>
                      {item.title.text}
                    </SizableText>
                  </XStack>
                  <SizableText
                    size="$bodyMd"
                    color={item.description.color || '$textSubdued'}
                  >
                    {item.description.text}
                  </SizableText>
                </YStack>
                {item?.actionButton?.type === 'link' ? (
                  <IconButton
                    icon="OpenOutline"
                    color="$iconSubdued"
                    size="small"
                    bg="transparent"
                    onPress={() => {
                      openUrlExternal(item?.actionButton?.data?.link);
                    }}
                  />
                ) : null}
              </XStack>

              {item.list?.length ? (
                <YStack gap="$1">
                  {item.list.map((i, indexOfList) => (
                    <XStack key={indexOfList} gap="$1">
                      <Icon
                        name={i.icon.icon}
                        size="$4"
                        color={i.icon.color || '$iconCaution'}
                      />
                      <FormatHyperlinkText
                        size="$bodySm"
                        color={i.title.color || '$textCaution'}
                      >
                        {i.title.text}
                      </FormatHyperlinkText>
                    </XStack>
                  ))}
                </YStack>
              ) : null}
            </>
          ))}
        </YStack>
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
    async () => {
      const response =
        await backgroundApiProxy.serviceStaking.getProtocolDetailsV2({
          accountId,
          networkId,
          indexedAccountId,
          symbol,
          provider,
          vault,
        });

      const tokens = response?.subscriptionValue?.token.info.address
        ? await backgroundApiProxy.serviceToken.fetchTokenInfoOnly({
            networkId,
            contractList: [response.subscriptionValue.token.info.address],
          })
        : undefined;
      return {
        detailInfo: response,
        nativeToken: tokens?.[0],
      };
    },
    [accountId, networkId, indexedAccountId, symbol, provider, vault],
    { watchLoading: true, revalidateOnFocus: true },
  );

  const { detailInfo, nativeToken } = result || {};

  const tokenInfo: IEarnTokenInfo | undefined = useMemo(() => {
    return detailInfo?.subscriptionValue?.token &&
      detailInfo?.subscriptionValue?.balance
      ? {
          nativeToken,
          balanceParsed: detailInfo.subscriptionValue.balance,
          token: detailInfo.subscriptionValue.token.info,
          price: detailInfo.subscriptionValue.token.price,
          networkId,
          provider,
          vault,
          accountId,
        }
      : undefined;
  }, [
    detailInfo?.subscriptionValue?.token,
    detailInfo?.subscriptionValue.balance,
    nativeToken,
    networkId,
    provider,
    vault,
    accountId,
  ]);

  const onCreateAddress = useCallback(async () => {
    await refreshAccount();
    void run();
  }, [refreshAccount, run]);

  const handleWithdraw = useHandleWithdraw();
  const handleStake = useHandleStake();

  // const { result: trackingResp, run: refreshTracking } = usePromiseResult(
  //   async () => {
  //     if (
  //       provider.toLowerCase() !== EEarnProviderEnum.Babylon.toLowerCase() ||
  //       !earnAccount
  //     ) {
  //       return [];
  //     }
  //     const items =
  //       await backgroundApiProxy.serviceStaking.getBabylonTrackingItems({
  //         accountId: earnAccount.accountId,
  //         networkId: earnAccount.networkId,
  //       });
  //     return items;
  //   },
  //   [provider, earnAccount],
  //   { initResult: [] },
  // );

  // const isFocused = useIsFocused();
  // useEffect(() => {
  //   if (isFocused) {
  //     void refreshTracking();
  //   }
  // }, [isFocused, refreshTracking]);

  // const onRefreshTracking = useCallback(async () => {
  //   void run();
  //   void refreshTracking();
  // }, [run, refreshTracking]);

  const protocolInfo: IProtocolInfo | undefined = useMemo(() => {
    const withdrawAction = detailInfo?.actions.find(
      (i) => i.type === 'withdraw',
    );
    return detailInfo?.protocol
      ? {
          ...detailInfo.protocol,
          apyDetail: detailInfo.apyDetail,
          earnAccount,
          activeBalance: withdrawAction?.data?.balance,
          eventEndTime: detailInfo?.countDownAlert?.endTime,
          stakeTag: buildLocalTxStatusSyncId({
            providerName: provider,
            tokenSymbol: symbol,
          }),

          // withdraw
          overflowBalance: detailInfo.nums?.overflow,
          maxUnstakeAmount: detailInfo.nums?.maxUnstakeAmount,
          minUnstakeAmount: detailInfo.nums?.minUnstakeAmount,

          // staking
          minTransactionFee: detailInfo.nums?.minTransactionFee,

          // claim
          claimable: detailInfo.nums?.claimable,
        }
      : undefined;
  }, [
    detailInfo?.actions,
    detailInfo?.apyDetail,
    detailInfo?.countDownAlert?.endTime,
    detailInfo?.nums?.claimable,
    detailInfo?.nums?.maxUnstakeAmount,
    detailInfo?.nums?.minTransactionFee,
    detailInfo?.nums?.minUnstakeAmount,
    detailInfo?.nums?.overflow,
    detailInfo?.protocol,
    earnAccount,
    provider,
    symbol,
  ]);

  const onStake = useCallback(async () => {
    await handleStake({
      protocolInfo,
      tokenInfo,
      accountId: earnAccount?.accountId,
      networkId,
      indexedAccountId,
      setStakeLoading,
      onSuccess: async () => {
        // if (networkUtils.isBTCNetwork(networkId)) {
        //   await run();
        // }
      },
    });
  }, [
    handleStake,
    protocolInfo,
    tokenInfo,
    earnAccount?.accountId,
    networkId,
    indexedAccountId,
  ]);

  const onWithdraw = useCallback(async () => {
    await handleWithdraw({
      protocolInfo,
      tokenInfo,
      accountId: earnAccount?.accountId,
      networkId,
      symbol,
      provider,
      onSuccess: async () => {
        // if (networkUtils.isBTCNetwork(networkId)) {
        //   await run();
        // }
      },
    });
  }, [
    earnAccount?.accountId,
    handleWithdraw,
    networkId,
    protocolInfo,
    provider,
    symbol,
    tokenInfo,
  ]);

  const historyAction = useMemo(() => {
    return detailInfo?.actions.find((i) => i.type === 'history');
  }, [detailInfo?.actions]);

  const onHistory = useMemo(() => {
    if (historyAction?.disabled || !earnAccount?.accountId) {
      return undefined;
    }
    return (params?: { filterType?: string }) => {
      const { filterType } = params || {};
      appNavigation.navigate(EModalStakingRoutes.HistoryList, {
        accountId: earnAccount?.accountId,
        networkId,
        symbol,
        provider,
        stakeTag: protocolInfo?.stakeTag || '',
        morphoVault: vault,
        filterType,
      });
    };
  }, [
    appNavigation,
    earnAccount?.accountId,
    historyAction?.disabled,
    networkId,
    protocolInfo?.stakeTag,
    provider,
    symbol,
    vault,
  ]);

  const intl = useIntl();
  const media = useMedia();

  // const falconUSDfRegister = useFalconUSDfRegister();
  // const shouldRegisterBeforeStake = useMemo(() => {
  //   // if (
  //   //   earnUtils.isFalconProvider({ providerName: detailInfo?.provider.name ?? '' })
  //   // ) {
  //   //   return !detailInfo?.hasRegister;
  //   // }
  //   return false;
  // }, []);

  const depositButtonProps = useMemo(() => {
    const item = detailInfo?.actions?.find((i) => i.type === 'deposit');
    return {
      props: {
        disabled: !earnAccount?.accountAddress || item?.disabled,
        variant: 'primary',
        loading: stakeLoading,
        display: item ? undefined : 'none',
        onPress: onStake,
      } as IButtonProps,
      text: item?.text.text,
    };
  }, [detailInfo?.actions, earnAccount?.accountAddress, stakeLoading, onStake]);

  const withdrawButtonProps = useMemo(() => {
    const item = detailInfo?.actions?.find(
      (i) => i.type === 'withdraw' || i.type === 'withdrawOrder',
    );
    return {
      text: item?.text.text,
      props: {
        disabled: !earnAccount?.accountAddress || item?.disabled,
        display: item ? undefined : 'none',
        onPress: onWithdraw,
      } as IButtonProps,
    };
  }, [earnAccount?.accountAddress, onWithdraw, detailInfo?.actions]);

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

  const now = useMemo(() => Date.now(), []);
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
        <ManagersSection managers={detailInfo?.managers} />
        {detailInfo?.countDownAlert?.startTime &&
        detailInfo?.countDownAlert?.endTime &&
        now > detailInfo.countDownAlert.startTime &&
        detailInfo.countDownAlert.endTime < now ? (
          <YStack pb="$1">
            <CountDownCalendarAlert
              description={detailInfo.countDownAlert.description.text}
              descriptionTextProps={{
                color: detailInfo.countDownAlert.description.color,
              }}
              effectiveTimeAt={detailInfo.countDownAlert.endTime}
            />
          </YStack>
        ) : null}
        <YStack px="$5" gap="$8">
          <ShareEventsContext.Provider value={contextValue}>
            <PageFrame
              LoadingSkeleton={OverviewSkeleton}
              loading={isLoadingState({ result: detailInfo, isLoading })}
              error={isErrorState({ result: detailInfo, isLoading })}
              onRefresh={run}
            >
              {detailInfo ? (
                <YStack gap="$8">
                  {earnAccount?.accountAddress ? (
                    <>
                      <SubscriptionSection
                        subscriptionValue={detailInfo.subscriptionValue}
                        onConfirmText={depositButtonProps.text}
                        confirmButtonProps={depositButtonProps.props}
                        onCancelText={withdrawButtonProps.text}
                        cancelButtonProps={withdrawButtonProps.props}
                      />
                      <AlertSection alerts={detailInfo.alerts} />
                      <Divider />
                      <PortfolioSection
                        portfolios={detailInfo.portfolios}
                        rewards={detailInfo.rewards}
                        tokenInfo={tokenInfo}
                        protocolInfo={protocolInfo}
                      />
                    </>
                  ) : (
                    <NoAddressWarning
                      accountId={accountId}
                      networkId={networkId}
                      indexedAccountId={indexedAccountId}
                      onCreateAddress={onCreateAddress}
                    />
                  )}
                  <ProfitSection profit={detailInfo.profit} />
                  <PeriodSection timeline={detailInfo.timeline} />
                  <ProtectionSection protection={detailInfo.protection} />
                  <ProviderSection provider={detailInfo.provider} />
                  <RiskSection risk={detailInfo.risk} />
                  <FAQSection faqs={detailInfo.faqs} tokenInfo={tokenInfo} />
                </YStack>
              ) : null}
              {renderPageFooter()}
              {detailInfo ? (
                <StakingTransactionIndicator
                  accountId={earnAccount?.accountId ?? ''}
                  networkId={networkId}
                  stakeTag={protocolInfo?.stakeTag || ''}
                  historyAction={historyAction}
                  onRefresh={run}
                  onPress={onHistory}
                />
              ) : null}
            </PageFrame>
          </ShareEventsContext.Provider>
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
