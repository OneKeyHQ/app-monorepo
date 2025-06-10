import { Fragment, useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import type { IButtonProps, IPageFooterProps } from '@onekeyhq/components';
import {
  Badge,
  Button,
  Divider,
  Image,
  Page,
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
import { PeriodSection } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/PeriodSectionV2';
import { ProtectionSection } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/ProtectionSectionV2';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EModalStakingRoutes,
  type IModalStakingParamList,
} from '@onekeyhq/shared/src/routes';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import { EWithdrawType } from '@onekeyhq/shared/types/staking';
import type {
  IEarnTokenInfo,
  IEarnWithdrawActionIcon,
  IEarnWithdrawOrderActionIcon,
  IProtocolInfo,
  IStakeEarnDetail,
} from '@onekeyhq/shared/types/staking';

import {
  PageFrame,
  isErrorState,
  isLoadingState,
} from '../../components/PageFrame';
import { EarnActionIcon } from '../../components/ProtocolDetails/EarnActionIcon';
import { EarnIcon } from '../../components/ProtocolDetails/EarnIcon';
import { EarnText } from '../../components/ProtocolDetails/EarnText';
import { EarnTooltip } from '../../components/ProtocolDetails/EarnTooltip';
import { GridItem } from '../../components/ProtocolDetails/GridItemV2';
import { NoAddressWarning } from '../../components/ProtocolDetails/NoAddressWarning';
import { ShareEventsContext } from '../../components/ProtocolDetails/ShareEventsProvider';
import { StakingTransactionIndicator } from '../../components/StakingActivityIndicator';
import { OverviewSkeleton } from '../../components/StakingSkeleton';
import { useFalconUSDfRegister } from '../../hooks/useEarnSignMessage';
import { buildLocalTxStatusSyncId } from '../../utils/utils';
import {
  useHandleStake,
  useHandleWithdraw,
} from '../ProtocolDetails/useHandleActions';

import { FAQSection } from './FAQSection';

function ManagersSection({
  managers,
}: {
  managers: IStakeEarnDetail['managers'] | undefined;
}) {
  return managers?.items?.length ? (
    <XStack pt="$1" pb="$4" gap="$1" px="$5">
      {managers.items.map((item, index) => (
        <Fragment key={index}>
          <XStack gap="$1" alignItems="center">
            <Image size="$4" borderRadius="$1" src={item.logoURI} />
            <EarnText text={item.title} size="$bodySm" />
            <EarnText text={item.description} size="$bodySm" />
          </XStack>
          {index !== managers.items.length - 1 ? (
            <XStack w="$4" h="$4" ai="center" jc="center">
              <XStack w="$1" h="$1" borderRadius="$full" bg="$iconSubdued" />
            </XStack>
          ) : null}
        </Fragment>
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
  const [{ currencyInfo }] = useSettingsPersistAtom();
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
  const isZero = useMemo(() => {
    return !subscriptionValue.fiatValue || subscriptionValue.fiatValue === '0';
  }, [subscriptionValue.fiatValue]);
  return subscriptionValue ? (
    <YStack gap="$8">
      <YStack>
        <EarnText text={subscriptionValue.title} size="$headingLg" pt="$2" />
        <XStack gap="$2" pt="$2" pb="$1" jc="space-between">
          <EarnText
            text={{
              text: isZero
                ? `${currencyInfo.symbol} 0.00`
                : subscriptionValue.fiatValue,
            }}
            size="$heading4xl"
            color={isZero ? '$textDisabled' : '$text'}
          />
          {renderActionButtons()}
        </XStack>
        <EarnText
          text={{
            text: `${subscriptionValue.formattedValue || 0} ${
              subscriptionValue?.token?.info?.symbol
            }`,
          }}
          size="$bodyLgMedium"
          color="$textSubdued"
        />
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
          <EarnText
            key={index}
            text={{ text, size: '$bodyMd', color: '$textSubdued' }}
          />
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
        <EarnText text={rewards.title} size="$bodyMd" color="$textSubdued" />
        <EarnTooltip title={rewards?.title?.text} tooltip={rewards?.tooltip} />
      </XStack>
      {rewards?.tokens?.map((token, index) => {
        return (
          <Fragment key={index}>
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
                    <EarnText text={token.title} size="$bodyLgMedium" />
                  </XStack>
                </XStack>
                <EarnActionIcon
                  title={token.title.text}
                  actionIcon={token.button}
                  protocolInfo={protocolInfo}
                  tokenInfo={tokenInfo}
                  token={token.token.info}
                />
              </XStack>
              <XStack>
                <EarnText
                  text={token.description}
                  size="$bodyMd"
                  color="$textSubdued"
                />
              </XStack>
            </YStack>
            {rewards?.tokens.length !== index + 1 ? (
              <Divider my="$1.5" />
            ) : null}
          </Fragment>
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
                <EarnText text={item.title} size="$bodyLgMedium" />
                <EarnText text={item.description} size="$bodyLgMedium" />
                {item?.badge ? (
                  <Badge
                    badgeType={item.badge.badgeType}
                    badgeSize={item.badge.badgeSize}
                  >
                    <Badge.Text>{item.badge.text.text}</Badge.Text>
                  </Badge>
                ) : null}
                <EarnTooltip
                  title={item?.description?.text}
                  tooltip={item?.tooltip}
                />
              </XStack>
              <XStack gap="$1">
                {item.buttons?.map((button, index) => (
                  <EarnActionIcon
                    key={index}
                    title={item.title.text}
                    actionIcon={button}
                    protocolInfo={protocolInfo}
                    tokenInfo={tokenInfo}
                    token={item.token.info}
                  />
                ))}
              </XStack>
            </XStack>
          );
      }
    },
    [protocolInfo, tokenInfo],
  );
  return portfolios?.items?.length || rewards?.tokens?.length ? (
    <>
      <YStack gap="$6">
        <XStack justifyContent="space-between">
          <EarnText text={portfolios.title} size="$headingLg" />
          <EarnActionIcon
            title={portfolios.title.text}
            actionIcon={portfolios.button}
            protocolInfo={protocolInfo}
            tokenInfo={tokenInfo}
          />
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
        <EarnText text={profit.title} size="$headingLg" />
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
        <EarnText text={provider.title} size="$headingLg" />
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
        <EarnText text={risk.title} size="$headingLg" />
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
                      <EarnIcon
                        icon={item.icon}
                        size="$4"
                        color="$iconCaution"
                      />
                    </XStack>
                    <EarnText text={item.title} size="$bodyMdMedium" />
                  </XStack>
                  <EarnText
                    text={item.description}
                    size="$bodyMd"
                    color={item.description.color || '$textSubdued'}
                  />
                </YStack>
                <EarnActionIcon
                  title={item.title.text}
                  actionIcon={item.actionButton}
                />
              </XStack>

              {item.list?.length ? (
                <YStack gap="$1">
                  {item.list.map((i, indexOfList) => (
                    <XStack key={indexOfList} gap="$1">
                      <EarnIcon icon={i.icon} size="$4" color="$iconCaution" />
                      <EarnText
                        text={i.title}
                        size="$bodySm"
                        color="$textCaution"
                      />
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
  const {
    result: detailInfo,
    isLoading,
    run,
  } = usePromiseResult(
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
      return response;
    },
    [accountId, networkId, indexedAccountId, symbol, provider, vault],
    { watchLoading: true, revalidateOnFocus: true },
  );

  const tokenInfo: IEarnTokenInfo | undefined = useMemo(() => {
    return detailInfo?.subscriptionValue?.token &&
      detailInfo?.subscriptionValue?.balance
      ? {
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
    ) as IEarnWithdrawActionIcon;
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

  const onWithdraw = useCallback(
    async (withdrawType: EWithdrawType) => {
      await handleWithdraw({
        withdrawType,
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
    },
    [
      earnAccount?.accountId,
      handleWithdraw,
      networkId,
      protocolInfo,
      provider,
      symbol,
      tokenInfo,
    ],
  );

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
    const item: IEarnWithdrawActionIcon | IEarnWithdrawOrderActionIcon =
      detailInfo?.actions?.find(
        (i) =>
          i.type === EWithdrawType.Withdraw ||
          i.type === EWithdrawType.WithdrawOrder,
      ) as IEarnWithdrawActionIcon | IEarnWithdrawOrderActionIcon;
    return {
      text: item?.text.text,
      props: {
        disabled: !earnAccount?.accountAddress || item?.disabled,
        display: item ? undefined : 'none',
        onPress: () => onWithdraw(item?.type || EWithdrawType.Withdraw),
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
                size: detailInfo.countDownAlert.description.size,
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
