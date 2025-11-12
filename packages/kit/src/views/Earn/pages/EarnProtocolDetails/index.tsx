import { Fragment, useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';
import { useSharedValue } from 'react-native-reanimated';

import {
  Divider,
  Image,
  SizableText,
  Skeleton,
  Stack,
  Tabs,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { CountDownCalendarAlert } from '@onekeyhq/kit/src/components/CountDownCalendarAlert';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  ETabEarnRoutes,
  ITabEarnParamList,
} from '@onekeyhq/shared/src/routes';
import {
  EModalRoutes,
  EModalStakingRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { ISupportedSymbol } from '@onekeyhq/shared/types/earn';
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
import { PeriodSection } from '../../../Staking/components/ProtocolDetails/PeriodSectionV2';
import { ProtectionSection } from '../../../Staking/components/ProtocolDetails/ProtectionSectionV2';
import { OverviewSkeleton } from '../../../Staking/components/StakingSkeleton';
import { useCheckEthenaKycStatus } from '../../../Staking/hooks/useCheckEthenaKycStatus';
import { useUnsupportedProtocol } from '../../../Staking/hooks/useUnsupportedProtocol';
import { HeaderRight } from '../../../Staking/pages/ManagePosition/components/HeaderRight';
import { StakeSection } from '../../../Staking/pages/ManagePosition/components/StakeSection';
import { WithdrawSection } from '../../../Staking/pages/ManagePosition/components/WithdrawSection';
import { useManagePage } from '../../../Staking/pages/ManagePosition/hooks/useManagePage';
import { FAQSection } from '../../../Staking/pages/ProtocolDetailsV2/FAQSection';
import { EarnPageContainer } from '../../components/EarnPageContainer';
import { EarnProviderMirror } from '../../EarnProviderMirror';

import { ApyChart } from './components/ApyChart';
import { useProtocolDetailData } from './hooks/useProtocolDetailData';

function ManagersSection({
  managers,
}: {
  managers: IStakeEarnDetail['managers'] | undefined;
}) {
  return managers?.items?.length ? (
    <XStack gap="$1" alignItems="center" px="$5">
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
}: {
  networkId: string;
  symbol: string;
  provider: string;
  vault?: string;
  apyDetail: IStakeEarnDetail['apyDetail'];
}) {
  return (
    <ApyChart
      networkId={networkId}
      symbol={symbol}
      provider={provider}
      vault={vault}
      apyDetail={apyDetail}
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
          <XStack flexWrap="wrap" gap="$3">
            {intro.items.map((cell) => (
              <GridItem
                key={cell.title.text}
                title={cell.title}
                description={cell.description}
                descriptionComponent={
                  cell?.items ? (
                    <YStack>
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
            />
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
            <ProviderSection provider={detailInfo.provider} />
            <RiskSection risk={detailInfo.risk} />
            <FAQSection faqs={detailInfo.faqs} tokenInfo={tokenInfo} />
          </YStack>
        ) : null}
      </PageFrame>
    </YStack>
  );
};

const ManagePositionPart = ({
  networkId,
  symbol,
  provider,
  vault,
  managers,
}: {
  networkId: string;
  symbol: string;
  provider: string;
  vault?: string;
  managers: IStakeEarnDetail['managers'] | undefined;
}) => {
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
  } = useManagePage({
    accountId: account?.id || '',
    networkId,
    indexedAccountId: indexedAccount?.id,
    symbol: symbol as ISupportedSymbol,
    provider,
    vault,
  });

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
      { title: 'Deposit', type: EStakingActionType.Deposit },
      { title: 'Withdraw', type: EStakingActionType.Withdraw },
    ],
    [],
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

  return (
    <YStack flex={4}>
      {!tokenInfo || isLoading ? (
        <YStack gap="$6">
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
        <YStack gap="$5" flex={1}>
          <ManagersSection managers={managers} />
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
          <YStack flex={1} position="relative">
            <YStack
              display={selectedTabIndex === 0 ? 'flex' : 'none'}
              position="absolute"
              top={0}
              left={0}
              right={0}
            >
              <StakeSection
                accountId={earnAccount?.account?.id || ''}
                networkId={networkId}
                tokenInfo={tokenInfo}
                protocolInfo={protocolInfo}
                isDisabled={depositDisabled}
              />
            </YStack>
            <YStack
              display={selectedTabIndex === 1 ? 'flex' : 'none'}
              position="absolute"
              top={0}
              left={0}
              right={0}
            >
              <WithdrawSection
                accountId={earnAccount?.account?.id || ''}
                networkId={networkId}
                tokenInfo={tokenInfo}
                protocolInfo={protocolInfo}
                isDisabled={withdrawDisabled}
              />
            </YStack>
          </YStack>
          <EarnAlert alerts={alerts} />
        </YStack>
      )}
    </YStack>
  );
};

const EarnProtocolDetailsPage = () => {
  const route = useAppRoute<
    ITabEarnParamList,
    ETabEarnRoutes.EarnProtocolDetails
  >();
  const intl = useIntl();
  const appNavigation = useAppNavigation();
  const { activeAccount } = useActiveAccount({ num: 0 });
  const { account, indexedAccount } = activeAccount;
  const { networkId, symbol, provider, vault } = route.params;
  const [stakeLoading, setStakeLoading] = useState(false);
  const [keepSkeletonVisible, setKeepSkeletonVisible] = useState(false);

  const accountId = account?.id || '';

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
    symbol: symbol as ISupportedSymbol,
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

  const onCreateAddress = useCallback(async () => {
    await refreshAccount();
    void refreshData();
  }, [refreshAccount, refreshData]);

  const breadcrumbProps = useMemo(
    () => ({
      items: [
        { label: intl.formatMessage({ id: ETranslations.global_earn }) },
        { label: symbol },
      ],
    }),
    [intl, symbol],
  );

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

  return (
    <EarnPageContainer
      pageTitle={pageTitle}
      breadcrumbProps={breadcrumbProps}
      sceneName={EAccountSelectorSceneName.home}
      tabRoute={ETabRoutes.Earn}
      showBackButton
    >
      <XStack $gtMd={{ flexDirection: 'row' }} flexDirection="column">
        <Stack w="65%">
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
        </Stack>
        <Stack w="35%">
          <ManagePositionPart
            networkId={networkId}
            symbol={symbol}
            provider={provider}
            vault={vault}
            managers={detailInfo?.managers}
          />
        </Stack>
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
