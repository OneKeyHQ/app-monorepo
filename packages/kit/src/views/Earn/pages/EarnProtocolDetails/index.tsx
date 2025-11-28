import { Fragment, memo, useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Divider,
  IconButton,
  Image,
  Page,
  SizableText,
  Stack,
  XStack,
  YStack,
  useMedia,
  useShare,
} from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { CountDownCalendarAlert } from '@onekeyhq/kit/src/components/CountDownCalendarAlert';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  EJotaiContextStoreNames,
  useDevSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
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
import {
  normalizeToEarnProvider,
  normalizeToEarnSymbol,
} from '@onekeyhq/shared/types/earn/earnProvider.constants';
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
import { ManagePositionContent } from '../../../Staking/pages/ManagePosition/components/ManagePositionContent';
import { FAQSection } from '../../../Staking/pages/ProtocolDetailsV2/FAQSection';
import { EarnPageContainer } from '../../components/EarnPageContainer';
import { EarnProviderMirror } from '../../EarnProviderMirror';
import { EarnNavigation, EarnNetworkUtils } from '../../earnUtils';

import { ApyChart } from './components/ApyChart';
import { useProtocolDetailBreadcrumb } from './hooks/useProtocolDetailBreadcrumb';
import { useProtocolDetailData } from './hooks/useProtocolDetailData';

import type { RouteProp } from '@react-navigation/core';

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
  onShare,
}: {
  networkId: string;
  symbol: string;
  provider: string;
  vault?: string;
  apyDetail: IStakeEarnDetail['apyDetail'];
  tokenInfo?: IEarnTokenInfo;
  onShare?: () => void;
}) {
  return (
    <ApyChart
      networkId={networkId}
      symbol={symbol}
      provider={provider}
      vault={vault}
      apyDetail={apyDetail}
      tokenInfo={tokenInfo}
      onShare={onShare}
    />
  );
}

function GridSection({
  data,
}: {
  data?:
    | IStakeEarnDetail['intro']
    | IStakeEarnDetail['rules']
    | IStakeEarnDetail['performance'];
}) {
  if (!data) {
    return null;
  }

  return (
    <>
      {data.items?.length ? (
        <YStack gap="$6">
          <EarnText text={data.title} size="$headingLg" />
          <XStack flexWrap="wrap" m="$-5" p="$2">
            {data.items.map((cell) => (
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

const DetailsPartComponent = ({
  detailInfo,
  tokenInfo,
  isLoading,
  keepSkeletonVisible,
  onRefresh,
  networkId,
  symbol,
  provider,
  vault,
  onShare,
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
  onShare?: () => void;
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
              tokenInfo={tokenInfo}
              onShare={onShare}
            />
            <Divider />
            <GridSection data={detailInfo.intro} />
            <GridSection data={detailInfo.rules} />
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
            <GridSection data={detailInfo.performance} />
            <ProtectionSection protection={detailInfo.protection} />
            <RiskSection risk={detailInfo.risk} />
            <FAQSection faqs={detailInfo.faqs} tokenInfo={tokenInfo} />
          </YStack>
        ) : null}
      </PageFrame>
    </YStack>
  );
};

const DetailsPart = memo(DetailsPartComponent);

const ManagePositionPart = ({
  networkId,
  symbol,
  provider,
  vault,
  tokenImageUri,
  accountId,
  indexedAccountId,
  onCreateAddress,
  onStakeWithdrawSuccess,
}: {
  networkId: string;
  symbol: string;
  provider: string;
  vault?: string;
  tokenImageUri?: string;
  accountId: string;
  indexedAccountId?: string;
  onCreateAddress?: () => Promise<void>;
  onStakeWithdrawSuccess?: () => void;
}) => {
  return (
    <YStack flex={4}>
      <YStack gap="$1.5" flex={1}>
        <ManagePositionContent
          showApyDetail={false}
          networkId={networkId}
          symbol={symbol}
          provider={provider}
          vault={vault}
          accountId={accountId}
          indexedAccountId={indexedAccountId}
          fallbackTokenImageUri={tokenImageUri}
          onCreateAddress={onCreateAddress}
          onStakeWithdrawSuccess={onStakeWithdrawSuccess}
        />
      </YStack>
    </YStack>
  );
};

const EarnProtocolDetailsPage = ({ route }: { route: IRouteProps }) => {
  const intl = useIntl();
  const appNavigation = useAppNavigation();
  const { gtMd } = useMedia();
  const { shareText } = useShare();
  const [devSettings] = useDevSettingsPersistAtom();
  const { activeAccount } = useActiveAccount({ num: 0 });
  const { account, indexedAccount } = activeAccount;
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
        accountId: account?.id || '',
        indexedAccountId: indexedAccount?.id,
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
      accountId: routeAccountId || account?.id || '',
      indexedAccountId: routeIndexedAccountId || indexedAccount?.id,
      networkId,
      symbol,
      provider,
      vault,
      isFromShareLink: false,
    };
  }, [route.params, account?.id, indexedAccount?.id]);

  const { accountId, indexedAccountId, networkId, symbol, provider, vault } =
    resolvedParams;

  const { detailInfo, tokenInfo, isLoading, refreshData, refreshAccount } =
    useProtocolDetailData({
      accountId,
      networkId,
      indexedAccountId,
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

  const onCreateAddress = useCallback(async () => {
    await refreshAccount();
    await refreshData();
  }, [refreshAccount, refreshData]);

  const handleStakeWithdrawSuccess = useCallback(() => {
    void refreshData();
  }, [refreshData]);

  // Use custom hook for breadcrumb management
  const { breadcrumbProps } = useProtocolDetailBreadcrumb({
    symbol,
    provider,
    tokenInfo,
  });

  const pageTitle = useMemo(
    () => (
      <XStack gap="$3" ai="center">
        <Token size="md" source={tokenInfo?.token?.logoURI} />
        <SizableText size="$headingXl" numberOfLines={1} flexShrink={1}>
          {symbol}
        </SizableText>
      </XStack>
    ),
    [symbol, tokenInfo?.token?.logoURI],
  );

  const handleOpenManageModal = useCallback(
    (tab?: 'deposit') => {
      appNavigation.pushModal(EModalRoutes.StakingModal, {
        screen: EModalStakingRoutes.ManagePosition,
        params: {
          networkId,
          symbol,
          provider,
          vault,
          tab,
          tokenImageUri: tokenInfo?.token?.logoURI,
        },
      });
    },
    [
      appNavigation,
      networkId,
      symbol,
      provider,
      vault,
      tokenInfo?.token?.logoURI,
    ],
  );

  // Generate share URL
  const shareUrl = useMemo(() => {
    if (!symbol || !provider || !networkId) return undefined;
    const shareLink = EarnNavigation.generateEarnShareLink({
      networkId,
      symbol,
      provider,
      vault,
      isDevMode: devSettings.enabled,
    });
    return shareLink;
  }, [symbol, provider, networkId, vault, devSettings.enabled]);

  const handleShare = useCallback(() => {
    if (!shareUrl) return;
    void shareText(shareUrl);
  }, [shareUrl, shareText]);

  // Header right - show share button only on mobile
  const headerRight = useMemo(() => {
    if (gtMd || !shareUrl) return null;
    return (
      <IconButton
        icon="ShareOutline"
        variant="tertiary"
        onPress={handleShare}
      />
    );
  }, [gtMd, shareUrl, handleShare]);

  const isCustomProtocol = useMemo(() => {
    if (symbol.toUpperCase() === 'USDE') {
      return true;
    }

    return false;
  }, [symbol]);

  const pageFooter = useMemo(() => {
    if (gtMd) {
      return null;
    }

    const isManageOnly = isCustomProtocol;
    const buttonText = isManageOnly
      ? intl.formatMessage({ id: ETranslations.global_manage })
      : intl.formatMessage({ id: ETranslations.earn_deposit });
    const onPress = isManageOnly
      ? () => handleOpenManageModal()
      : () => handleOpenManageModal('deposit');

    return (
      <Page.Footer
        onConfirmText={buttonText}
        confirmButtonProps={{
          variant: 'primary',
          onPress,
        }}
      />
    );
  }, [gtMd, intl, handleOpenManageModal, isCustomProtocol]);

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
      customHeaderRightItems={headerRight}
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
            onShare={gtMd ? handleShare : undefined}
          />
        </Stack>
        {gtMd ? (
          <Stack $gtMd={{ width: '35%' }}>
            <ManagePositionPart
              networkId={networkId}
              symbol={symbol}
              provider={provider}
              vault={vault}
              tokenImageUri={tokenInfo?.token?.logoURI}
              accountId={accountId}
              indexedAccountId={indexedAccountId}
              onCreateAddress={onCreateAddress}
              onStakeWithdrawSuccess={handleStakeWithdrawSuccess}
            />
          </Stack>
        ) : null}
      </XStack>
    </EarnPageContainer>
  );
};

type IRouteProps = RouteProp<
  ITabEarnParamList,
  ETabEarnRoutes.EarnProtocolDetails | ETabEarnRoutes.EarnProtocolDetailsShare
>;

function EarnProtocolDetailsPageWithProvider(props: { route: IRouteProps }) {
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
          <EarnProtocolDetailsPage {...props} />
        </DiscoveryBrowserProviderMirror>
      </EarnProviderMirror>
    </AccountSelectorProviderMirror>
  );
}

export default EarnProtocolDetailsPageWithProvider;
