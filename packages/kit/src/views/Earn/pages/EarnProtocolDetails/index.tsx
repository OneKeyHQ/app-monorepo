import { Fragment, useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';
import { useSharedValue } from 'react-native-reanimated';

import {
  Button,
  Divider,
  Image,
  Page,
  SizableText,
  Skeleton,
  Stack,
  Tabs,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import type backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { CountDownCalendarAlert } from '@onekeyhq/kit/src/components/CountDownCalendarAlert';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  ETabEarnRoutes,
  ITabEarnParamList,
} from '@onekeyhq/shared/src/routes';
import {
  EModalReceiveRoutes,
  EModalRoutes,
  EModalStakingRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { ISupportedSymbol } from '@onekeyhq/shared/types/earn';
import {
  normalizeToEarnProvider,
  normalizeToEarnSymbol,
} from '@onekeyhq/shared/types/earn/earnProvider.constants';
import { EStakingActionType } from '@onekeyhq/shared/types/staking';
import type {
  IEarnAlert,
  IEarnTokenInfo,
  IStakeEarnDetail,
} from '@onekeyhq/shared/types/staking';

import { DiscoveryBrowserProviderMirror } from '../../../Discovery/components/DiscoveryBrowserProviderMirror';
import {
  PageFrame,
  isErrorState,
  isLoadingState,
} from '../../../Staking/components/PageFrame';
import { EarnActionIcon } from '../../../Staking/components/ProtocolDetails/EarnActionIcon';
import { EarnAlert } from '../../../Staking/components/ProtocolDetails/EarnAlert';
import { EarnIcon } from '../../../Staking/components/ProtocolDetails/EarnIcon';
import { EarnText } from '../../../Staking/components/ProtocolDetails/EarnText';
import { GridItem } from '../../../Staking/components/ProtocolDetails/GridItemV2';
import { NoAddressWarning } from '../../../Staking/components/ProtocolDetails/NoAddressWarning';
import { PeriodSection } from '../../../Staking/components/ProtocolDetails/PeriodSectionV2';
import { ProtectionSection } from '../../../Staking/components/ProtocolDetails/ProtectionSectionV2';
import { OverviewSkeleton } from '../../../Staking/components/StakingSkeleton';
import { useCheckEthenaKycStatus } from '../../../Staking/hooks/useCheckEthenaKycStatus';
import { useHandleSwap } from '../../../Staking/hooks/useHandleSwap';
import { useUnsupportedProtocol } from '../../../Staking/hooks/useUnsupportedProtocol';
import { HeaderRight } from '../../../Staking/pages/ManagePosition/components/HeaderRight';
import { StakeSection } from '../../../Staking/pages/ManagePosition/components/StakeSection';
import { WithdrawSection } from '../../../Staking/pages/ManagePosition/components/WithdrawSection';
import { useManagePage } from '../../../Staking/pages/ManagePosition/hooks/useManagePage';
import { FAQSection } from '../../../Staking/pages/ProtocolDetailsV2/FAQSection';
import { EarnPageContainer } from '../../components/EarnPageContainer';
import { EarnProviderMirror } from '../../EarnProviderMirror';
import { EarnNetworkUtils } from '../../earnUtils';

import { ApyChart } from './components/ApyChart';
import { useProtocolDetailBreadcrumb } from './hooks/useProtocolDetailBreadcrumb';
import { useProtocolDetailData } from './hooks/useProtocolDetailData';

function ManagersSection({
  managers,
  noPadding,
}: {
  managers: IStakeEarnDetail['managers'] | undefined;
  noPadding?: boolean;
}) {
  return managers?.items?.length ? (
    <XStack gap="$1" alignItems="center" px={noPadding ? '$0' : '$5'}>
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

function ChartSection({
  networkId,
  symbol,
  provider,
  vault,
  apyDetail,
  tokenInfo,
}: {
  networkId: string;
  symbol: string;
  provider: string;
  vault?: string;
  apyDetail: IStakeEarnDetail['apyDetail'];
  tokenInfo?: IEarnTokenInfo;
}) {
  return (
    <ApyChart
      networkId={networkId}
      symbol={symbol}
      provider={provider}
      vault={vault}
      apyDetail={apyDetail}
      tokenInfo={tokenInfo}
    />
  );
}

function IntroSection({ intro }: { intro?: IStakeEarnDetail['intro'] }) {
  if (!intro) {
    return null;
  }

  return (
    <>
      {intro.items?.length ? (
        <YStack gap="$6">
          <EarnText text={intro.title} size="$headingLg" />
          <XStack flexWrap="wrap" m="$-5" p="$2">
            {intro.items.map((cell) => (
              <GridItem
                key={cell.title.text}
                title={cell.title}
                description={cell.description}
                descriptionComponent={
                  cell?.items ? (
                    <YStack gap="$2">
                      {(cell?.items ?? []).map((item) => (
                        <XStack key={item.title.text} ai="center" gap="$1.5">
                          <Token
                            size="xs"
                            borderRadius="$2"
                            mr="$0.5"
                            tokenImageUri={item.logoURI}
                          />
                          <EarnText text={item.title} size="$bodyLgMedium" />
                        </XStack>
                      ))}
                    </YStack>
                  ) : null
                }
                actionIcon={cell.button}
                tooltip={cell.tooltip}
                type={cell.type}
              />
            ))}
          </XStack>
        </YStack>
      ) : null}
      <Divider />
    </>
  );
}

function AlertSection({ alerts }: { alerts?: IEarnAlert[] }) {
  return <EarnAlert alerts={alerts} />;
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

function PerformanceSection({
  performance,
}: {
  performance?: IStakeEarnDetail['intro'];
}) {
  if (!performance) {
    return null;
  }

  return (
    <>
      {performance.items?.length ? (
        <YStack gap="$6">
          <EarnText text={performance.title} size="$headingLg" />
          <XStack flexWrap="wrap" m="$-5" p="$2">
            {performance.items.map((cell) => (
              <GridItem
                key={cell.title.text}
                title={cell.title}
                description={cell.description}
                descriptionComponent={
                  cell?.items ? (
                    <YStack gap="$2">
                      {(cell?.items ?? []).map((item) => (
                        <XStack key={item.title.text}>
                          <Token
                            size="sm"
                            borderRadius="$2"
                            mr="$0.5"
                            tokenImageUri={item.logoURI}
                          />
                          <EarnText text={item.title} size="$bodyLgMedium" />
                        </XStack>
                      ))}
                    </YStack>
                  ) : null
                }
                actionIcon={cell.button}
                tooltip={cell.tooltip}
                type={cell.type}
              />
            ))}
          </XStack>
        </YStack>
      ) : null}
      <Divider />
    </>
  );
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
                      borderRadius="$1"
                    >
                      <EarnIcon
                        icon={item.icon}
                        size="$6"
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

const DetailsPart = ({
  detailInfo,
  tokenInfo,
  isLoading,
  keepSkeletonVisible,
  onRefresh,
  networkId,
  symbol,
  provider,
  vault,
}: {
  detailInfo: IStakeEarnDetail | undefined;
  tokenInfo?: IEarnTokenInfo;
  isLoading: boolean;
  keepSkeletonVisible: boolean;
  onRefresh: () => void;
  networkId: string;
  symbol: string;
  provider: string;
  vault?: string;
}) => {
  const now = useMemo(() => Date.now(), []);
  const { gtMd } = useMedia();

  return (
    <YStack flex={6} gap="$5" px="$5">
      <PageFrame
        LoadingSkeleton={OverviewSkeleton}
        loading={
          isLoadingState({ result: detailInfo, isLoading }) ||
          keepSkeletonVisible
        }
        error={isErrorState({ result: detailInfo, isLoading })}
        onRefresh={onRefresh}
      >
        {detailInfo ? (
          <YStack gap="$8">
            <ChartSection
              networkId={networkId}
              symbol={symbol}
              provider={provider}
              vault={vault}
              apyDetail={detailInfo.apyDetail}
              tokenInfo={tokenInfo}
            />
            <Divider />
            <IntroSection intro={detailInfo.intro} />
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
            <AlertSection alerts={detailInfo.alertsV2} />
            <PeriodSection timeline={detailInfo.timeline} />
            <ProtectionSection protection={detailInfo.protection} />
            <PerformanceSection performance={detailInfo.performance} />
            <RiskSection risk={detailInfo.risk} />
            <FAQSection faqs={detailInfo.faqs} tokenInfo={tokenInfo} />
          </YStack>
        ) : null}
      </PageFrame>
    </YStack>
  );
};

const UsDeHoldingsPartSkeleton = () => (
  <YStack flex={4} px="$5">
    <YStack gap="$8">
      <YStack gap="$4">
        <Skeleton.BodyLg w="$24" />
        <XStack jc="space-between" ai="flex-end">
          <Skeleton w="$48" h="$12" />
          <XStack gap="$2">
            <Skeleton w="$20" h="$9" borderRadius="$2" />
            <Skeleton w="$20" h="$9" borderRadius="$2" />
          </XStack>
        </XStack>
        <Skeleton.BodyLg w="$32" />
      </YStack>
    </YStack>
  </YStack>
);

const UsDeHoldingsPart = ({
  networkId,
  subscriptionValue,
  detailInfo,
  earnAccount,
  isLoading,
}: {
  networkId: string;
  subscriptionValue: IStakeEarnDetail['subscriptionValue'];
  detailInfo: IStakeEarnDetail | undefined;
  earnAccount:
    | Awaited<
        ReturnType<typeof backgroundApiProxy.serviceStaking.getEarnAccount>
      >
    | undefined;
  isLoading?: boolean;
}) => {
  const intl = useIntl();
  const appNavigation = useAppNavigation();
  const { handleSwap } = useHandleSwap();
  const { gtMd } = useMedia();

  const handleReceive = useCallback(() => {
    if (!subscriptionValue?.token?.info || !earnAccount) return;
    appNavigation.pushModal(EModalRoutes.ReceiveModal, {
      screen: EModalReceiveRoutes.ReceiveToken,
      params: {
        networkId,
        accountId: earnAccount.accountId,
        walletId: earnAccount.walletId,
        token: subscriptionValue.token.info,
      },
    });
  }, [appNavigation, networkId, earnAccount, subscriptionValue?.token?.info]);

  const handleTrade = useCallback(async () => {
    if (!subscriptionValue?.token?.info) return;
    await handleSwap({
      token: subscriptionValue.token.info,
      networkId,
    });
  }, [handleSwap, networkId, subscriptionValue?.token?.info]);

  const receiveAction = useMemo(
    () =>
      detailInfo?.actions?.find((a) => a.type === EStakingActionType.Receive),
    [detailInfo?.actions],
  );
  const tradeAction = useMemo(
    () => detailInfo?.actions?.find((a) => a.type === EStakingActionType.Trade),
    [detailInfo?.actions],
  );

  const renderActionButtons = useCallback(() => {
    if (!gtMd) {
      return null;
    }
    return (
      <XStack gap="$2">
        {receiveAction ? (
          <Button onPress={handleReceive}>
            {intl.formatMessage({ id: ETranslations.global_receive })}
          </Button>
        ) : null}
        {tradeAction ? (
          <Button variant="primary" onPress={handleTrade}>
            {intl.formatMessage({ id: ETranslations.global_trade })}
          </Button>
        ) : null}
      </XStack>
    );
  }, [gtMd, receiveAction, tradeAction, handleReceive, handleTrade, intl]);

  if (isLoading) {
    return <UsDeHoldingsPartSkeleton />;
  }

  if (!subscriptionValue) {
    return null;
  }

  return (
    <YStack flex={4} px="$5">
      <YStack gap="$8">
        <YStack>
          <XStack ai="center" gap="$2" pt="$2">
            <EarnText text={subscriptionValue.title} size="$headingLg" />
          </XStack>
          <XStack gap="$2" pt="$2" pb="$1" jc="space-between">
            <EarnText
              text={{ text: subscriptionValue.fiatValue }}
              size="$heading4xl"
            />
            {renderActionButtons()}
          </XStack>
          <EarnText
            text={{
              text: `${subscriptionValue.formattedValue || 0} ${
                subscriptionValue?.token?.info?.symbol || ''
              }`,
            }}
            size="$bodyLgMedium"
            color="$textSubdued"
          />
        </YStack>
      </YStack>
    </YStack>
  );
};

const ManagePositionPart = ({
  networkId,
  symbol,
  provider,
  vault,
  managers,
  onCreateAddress,
}: {
  networkId: string;
  symbol: string;
  provider: string;
  vault?: string;
  managers: IStakeEarnDetail['managers'] | undefined;
  onCreateAddress?: () => Promise<void>;
}) => {
  const intl = useIntl();
  const appNavigation = useAppNavigation();
  const { activeAccount } = useActiveAccount({ num: 0 });
  const { account, indexedAccount } = activeAccount;

  const {
    isLoading,
    tokenInfo,
    earnAccount,
    protocolInfo,
    managePageData,
    depositDisabled,
    withdrawDisabled,
    alerts,
    refreshAccount: refreshManageAccount,
    run: refreshManageData,
  } = useManagePage({
    accountId: account?.id || '',
    networkId,
    indexedAccountId: indexedAccount?.id,
    symbol: symbol as ISupportedSymbol,
    provider,
    vault,
  });

  const handleCreateAddress = useCallback(async () => {
    if (onCreateAddress) {
      await onCreateAddress();
    }
    await refreshManageAccount();
    await refreshManageData();
  }, [onCreateAddress, refreshManageAccount, refreshManageData]);

  const historyAction = useMemo(
    () => managePageData?.history,
    [managePageData?.history],
  );

  const onHistory = useMemo(() => {
    if (historyAction?.disabled || !earnAccount?.accountId) return undefined;
    return (params?: { filterType?: string }) => {
      appNavigation.pushModal(EModalRoutes.StakingModal, {
        screen: EModalStakingRoutes.HistoryList,
        params: {
          accountId: earnAccount?.accountId,
          networkId,
          symbol,
          provider,
          stakeTag: protocolInfo?.stakeTag || '',
          protocolVault: vault,
          filterType: params?.filterType,
        },
      });
    };
  }, [
    historyAction?.disabled,
    appNavigation,
    earnAccount?.accountId,
    networkId,
    protocolInfo?.stakeTag,
    provider,
    symbol,
    vault,
  ]);

  const [selectedTabIndex, setSelectedTabIndex] = useState(0);
  const tabData = useMemo(
    () => [
      {
        title: intl.formatMessage({ id: ETranslations.earn_deposit }),
        type: EStakingActionType.Deposit,
      },
      {
        title: intl.formatMessage({ id: ETranslations.global_withdraw }),
        type: EStakingActionType.Withdraw,
      },
    ],
    [intl],
  );

  const TabNames = useMemo(() => tabData.map((item) => item.title), [tabData]);
  const focusedTab = useSharedValue(TabNames[0]);

  const handleTabChange = useCallback(
    (name: string) => {
      const index = tabData.findIndex((item) => item.title === name);
      if (index !== -1) {
        focusedTab.value = name;
        setSelectedTabIndex(index);
      }
    },
    [focusedTab, tabData],
  );

  const hasNoAccount = !account?.id && !indexedAccount?.id;
  const hasNoAddress = !earnAccount?.accountAddress;
  const shouldShowSkeleton = isLoading && !hasNoAccount;

  return (
    <YStack flex={4}>
      {shouldShowSkeleton ? (
        <YStack gap="$6" px="$5">
          <XStack gap="$2">
            <Skeleton w="$20" h="$9" borderRadius="$2" />
            <Skeleton w="$20" h="$9" borderRadius="$2" />
          </XStack>
          <YStack gap="$4">
            <YStack gap="$3" p="$4" bg="$bgSubdued" borderRadius="$3">
              <XStack jc="space-between" ai="center">
                <Skeleton.BodyMd w="$20" />
                <Skeleton.BodySm w="$24" />
              </XStack>
              <XStack jc="space-between" ai="center">
                <Skeleton w="$32" h="$12" />
                <XStack gap="$2" ai="center">
                  <Skeleton w="$10" h="$10" borderRadius="$full" />
                  <Skeleton.BodyLg w="$16" />
                </XStack>
              </XStack>
            </YStack>
            <Skeleton w="100%" h="$11" borderRadius="$3" />
          </YStack>
        </YStack>
      ) : (
        <YStack gap="$1.5" flex={1}>
          <XStack jc="space-between" px="$5">
            <Tabs.TabBar
              divider={false}
              onTabPress={handleTabChange}
              tabNames={TabNames}
              focusedTab={focusedTab}
              renderItem={({ name, isFocused, onPress }) => (
                <XStack
                  px="$2"
                  py="$1.5"
                  mr="$1"
                  bg={isFocused ? '$bgActive' : '$bg'}
                  borderRadius="$2"
                  borderCurve="continuous"
                  onPress={() => onPress(name)}
                >
                  <SizableText
                    size="$bodyMdMedium"
                    color={isFocused ? '$text' : '$textSubdued'}
                    letterSpacing={-0.15}
                  >
                    {name}
                  </SizableText>
                </XStack>
              )}
            />
            <HeaderRight historyAction={historyAction} onHistory={onHistory} />
          </XStack>
          {selectedTabIndex === 0 ? (
            <YStack>
              <StakeSection
                accountId={earnAccount?.account?.id || ''}
                networkId={networkId}
                tokenInfo={tokenInfo}
                protocolInfo={protocolInfo}
                isDisabled={depositDisabled || hasNoAccount || hasNoAddress}
              />
              {hasNoAccount || hasNoAddress ? (
                <Stack px="$5">
                  <NoAddressWarning
                    accountId={account?.id || ''}
                    networkId={networkId}
                    indexedAccountId={indexedAccount?.id}
                    onCreateAddress={handleCreateAddress}
                  />
                </Stack>
              ) : null}
            </YStack>
          ) : null}
          {selectedTabIndex === 1 ? (
            <YStack>
              <WithdrawSection
                accountId={earnAccount?.account?.id || ''}
                networkId={networkId}
                tokenInfo={tokenInfo}
                protocolInfo={protocolInfo}
                isDisabled={withdrawDisabled || hasNoAccount || hasNoAddress}
              />
              {hasNoAccount || hasNoAddress ? (
                <Stack px="$5">
                  <NoAddressWarning
                    accountId={account?.id || ''}
                    networkId={networkId}
                    indexedAccountId={indexedAccount?.id}
                    onCreateAddress={handleCreateAddress}
                  />
                </Stack>
              ) : null}
            </YStack>
          ) : null}
          <EarnAlert alerts={alerts} />
        </YStack>
      )}
    </YStack>
  );
};

const EarnProtocolDetailsPage = () => {
  const route = useAppRoute<
    ITabEarnParamList,
    ETabEarnRoutes.EarnProtocolDetails | ETabEarnRoutes.EarnProtocolDetailsShare
  >();
  const intl = useIntl();
  const appNavigation = useAppNavigation();
  const { gtMd } = useMedia();
  const { activeAccount } = useActiveAccount({ num: 0 });
  const { account, indexedAccount } = activeAccount;
  const [stakeLoading, setStakeLoading] = useState(false);
  const [keepSkeletonVisible, setKeepSkeletonVisible] = useState(false);

  // Parse route params, support both normal and share link routes
  const resolvedParams = useMemo<{
    accountId: string;
    indexedAccountId: string | undefined;
    networkId: string;
    symbol: ISupportedSymbol;
    provider: string;
    vault: string | undefined;
    isFromShareLink: boolean;
  }>(() => {
    const routeParams = route.params as any;

    // Check if it is the new share link format
    if ('network' in routeParams) {
      // New format: /earn/:network/:symbol/:provider
      const {
        network,
        symbol: symbolParam,
        provider: providerParam,
        vault,
      } = routeParams;
      const networkId = EarnNetworkUtils.getNetworkIdByName(network);
      const symbol = normalizeToEarnSymbol(symbolParam);
      const provider = normalizeToEarnProvider(providerParam);

      if (!networkId) {
        throw new OneKeyLocalError(`Unknown network: ${String(network)}`);
      }
      if (!symbol) {
        throw new OneKeyLocalError(`Unknown symbol: ${String(symbolParam)}`);
      }
      if (!provider) {
        throw new OneKeyLocalError(
          `Unknown provider: ${String(providerParam)}`,
        );
      }

      return {
        accountId: activeAccount.account?.id || '',
        indexedAccountId: activeAccount.indexedAccount?.id,
        networkId,
        symbol,
        provider,
        vault,
        isFromShareLink: true,
      };
    }

    // Old format: normal navigation
    const {
      accountId: routeAccountId,
      indexedAccountId: routeIndexedAccountId,
      networkId,
      symbol,
      provider,
      vault,
    } = routeParams;

    return {
      accountId: routeAccountId || activeAccount.account?.id || '',
      indexedAccountId:
        routeIndexedAccountId || activeAccount.indexedAccount?.id,
      networkId,
      symbol,
      provider,
      vault,
      isFromShareLink: false,
    };
  }, [route.params, activeAccount]);

  const { accountId, networkId, indexedAccountId, symbol, provider, vault } =
    resolvedParams;

  const {
    earnAccount,
    detailInfo,
    tokenInfo,
    protocolInfo,
    isLoading,
    refreshData,
    refreshAccount,
  } = useProtocolDetailData({
    accountId,
    networkId,
    indexedAccountId: indexedAccount?.id,
    symbol,
    provider,
    vault,
  });

  useUnsupportedProtocol({
    detailInfo,
    appNavigation,
    setKeepSkeletonVisible,
  });

  useCheckEthenaKycStatus({
    provider,
    refreshEarnDetailData: refreshData,
  });

  const hasNoAccount = !account?.id && !indexedAccount?.id;
  const hasNoAddress = !earnAccount?.accountAddress;

  const onCreateAddress = useCallback(async () => {
    await refreshAccount();
    await refreshData();
  }, [refreshAccount, refreshData]);

  // Use custom hook for breadcrumb management
  const { breadcrumbProps } = useProtocolDetailBreadcrumb({
    accountId: account?.id,
    indexedAccountId: indexedAccount?.id,
    symbol,
    provider,
    tokenInfo,
  });

  const pageTitle = useMemo(
    () => (
      <XStack gap="$3" ai="center">
        <SizableText size="$headingXl" numberOfLines={1} flexShrink={1}>
          {symbol}
        </SizableText>
      </XStack>
    ),
    [symbol],
  );

  const handleNavigateToManagePosition = useCallback(
    (tab?: 'deposit' | 'withdraw') => {
      appNavigation.pushModal(EModalRoutes.StakingModal, {
        screen: EModalStakingRoutes.ManagePosition,
        params: {
          networkId,
          symbol,
          provider,
          vault,
          tab,
        },
      });
    },
    [appNavigation, networkId, symbol, provider, vault],
  );

  const { handleSwap } = useHandleSwap();

  const handleReceiveUSDe = useCallback(() => {
    if (!detailInfo?.subscriptionValue?.token?.info || !earnAccount) return;
    appNavigation.pushModal(EModalRoutes.ReceiveModal, {
      screen: EModalReceiveRoutes.ReceiveToken,
      params: {
        networkId,
        accountId: earnAccount.accountId,
        walletId: earnAccount.walletId,
        token: detailInfo.subscriptionValue.token.info,
      },
    });
  }, [
    appNavigation,
    networkId,
    earnAccount,
    detailInfo?.subscriptionValue?.token?.info,
  ]);

  const handleTradeUSDe = useCallback(async () => {
    if (!detailInfo?.subscriptionValue?.token?.info) return;
    await handleSwap({
      token: detailInfo.subscriptionValue.token.info,
      networkId,
    });
  }, [handleSwap, networkId, detailInfo?.subscriptionValue?.token?.info]);

  const pageFooter = useMemo(() => {
    if (gtMd) {
      return null;
    }

    const shouldDisableButtons = isLoading || hasNoAccount || hasNoAddress;

    // USDe: show Receive/Trade buttons
    if (symbol === 'USDe') {
      const receiveAction = detailInfo?.actions?.find(
        (a) => a.type === EStakingActionType.Receive,
      );
      const tradeAction = detailInfo?.actions?.find(
        (a) => a.type === EStakingActionType.Trade,
      );

      if (!receiveAction && !tradeAction) {
        return null;
      }

      return (
        <Page.Footer
          onCancelText={
            receiveAction
              ? intl.formatMessage({ id: ETranslations.global_receive })
              : undefined
          }
          cancelButtonProps={
            receiveAction
              ? {
                  onPress: handleReceiveUSDe,
                  disabled: shouldDisableButtons || receiveAction.disabled,
                }
              : undefined
          }
          onConfirmText={
            tradeAction
              ? intl.formatMessage({ id: ETranslations.global_trade })
              : undefined
          }
          confirmButtonProps={
            tradeAction
              ? {
                  variant: 'primary',
                  onPress: handleTradeUSDe,
                  disabled: shouldDisableButtons || tradeAction.disabled,
                }
              : undefined
          }
        />
      );
    }

    // Normal assets: show Deposit/Withdraw buttons
    return (
      <Page.Footer
        onCancelText={intl.formatMessage({ id: ETranslations.global_withdraw })}
        cancelButtonProps={{
          onPress: () => handleNavigateToManagePosition('withdraw'),
          disabled: shouldDisableButtons,
        }}
        onConfirmText={intl.formatMessage({ id: ETranslations.earn_deposit })}
        confirmButtonProps={{
          variant: 'primary',
          onPress: () => handleNavigateToManagePosition('deposit'),
          disabled: shouldDisableButtons,
        }}
      />
    );
  }, [
    gtMd,
    intl,
    handleNavigateToManagePosition,
    symbol,
    detailInfo?.actions,
    handleReceiveUSDe,
    handleTradeUSDe,
    hasNoAccount,
    hasNoAddress,
    isLoading,
  ]);

  return (
    <EarnPageContainer
      pageTitle={pageTitle}
      breadcrumbProps={breadcrumbProps}
      sceneName={EAccountSelectorSceneName.home}
      tabRoute={ETabRoutes.Earn}
      showBackButton
      header={
        <XStack ml={gtMd ? 'auto' : '0'}>
          <ManagersSection managers={detailInfo?.managers} noPadding />
        </XStack>
      }
      footer={pageFooter}
    >
      <XStack $gtMd={{ flexDirection: 'row' }} flexDirection="column">
        <Stack w="100%" $gtMd={{ width: '65%' }}>
          <DetailsPart
            detailInfo={detailInfo}
            tokenInfo={tokenInfo}
            isLoading={isLoading ?? false}
            keepSkeletonVisible={keepSkeletonVisible}
            onRefresh={refreshData}
            networkId={networkId}
            symbol={symbol}
            provider={provider}
            vault={vault}
          />
          {!gtMd && (hasNoAccount || hasNoAddress) && !isLoading ? (
            <Stack px="$5" pt="$5">
              <NoAddressWarning
                accountId={account?.id || ''}
                networkId={networkId}
                indexedAccountId={indexedAccount?.id}
                onCreateAddress={onCreateAddress}
              />
            </Stack>
          ) : null}
        </Stack>
        {gtMd ? (
          <Stack $gtMd={{ width: '35%' }}>
            {symbol === 'USDe' ? (
              <UsDeHoldingsPart
                networkId={networkId}
                subscriptionValue={detailInfo?.subscriptionValue}
                detailInfo={detailInfo}
                earnAccount={earnAccount}
                isLoading={isLoading ?? false}
              />
            ) : (
              <ManagePositionPart
                networkId={networkId}
                symbol={symbol}
                provider={provider}
                vault={vault}
                managers={detailInfo?.managers}
                onCreateAddress={onCreateAddress}
              />
            )}
          </Stack>
        ) : null}
      </XStack>
    </EarnPageContainer>
  );
};

function EarnProtocolDetailsPageWithProvider() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <EarnProviderMirror storeName={EJotaiContextStoreNames.earn}>
        <DiscoveryBrowserProviderMirror>
          <EarnProtocolDetailsPage />
        </DiscoveryBrowserProviderMirror>
      </EarnProviderMirror>
    </AccountSelectorProviderMirror>
  );
}

export default EarnProtocolDetailsPageWithProvider;
