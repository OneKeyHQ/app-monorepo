import { Fragment, useCallback, useMemo, useState } from 'react';

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
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
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
import { ManagePositionContent } from '../../../Staking/pages/ManagePosition/components/ManagePositionContent';
import { FAQSection } from '../../../Staking/pages/ProtocolDetailsV2/FAQSection';
import { EarnPageContainer } from '../../components/EarnPageContainer';
import { EarnProviderMirror } from '../../EarnProviderMirror';
import { EarnNavigation, EarnNetworkUtils } from '../../earnUtils';

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
            <PeriodSection timeline={detailInfo.timeline} />
            <PerformanceSection performance={detailInfo.performance} />
            <ProtectionSection protection={detailInfo.protection} />
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
  onCreateAddress,
  onStakeWithdrawSuccess,
}: {
  networkId: string;
  symbol: string;
  provider: string;
  vault?: string;
  onCreateAddress?: () => Promise<void>;
  onStakeWithdrawSuccess?: () => void;
}) => {
  const { activeAccount } = useActiveAccount({ num: 0 });
  const { account, indexedAccount } = activeAccount;

  return (
    <YStack flex={4}>
      <YStack gap="$1.5" flex={1}>
        <ManagePositionContent
          showApyDetail={false}
          networkId={networkId}
          symbol={symbol}
          provider={provider}
          vault={vault}
          accountId={account?.id || ''}
          indexedAccountId={indexedAccount?.id}
          onCreateAddress={onCreateAddress}
          onStakeWithdrawSuccess={onStakeWithdrawSuccess}
        />
      </YStack>
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

  const handleStakeWithdrawSuccess = useCallback(() => {
    void refreshData();
  }, [refreshData]);

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
        <Token size="md" source={tokenInfo?.token?.logoURI} />
        <SizableText size="$headingXl" numberOfLines={1} flexShrink={1}>
          {symbol}
        </SizableText>
      </XStack>
    ),
    [symbol, tokenInfo?.token?.logoURI],
  );

  const handleNavigateToManagePosition = useCallback(
    (tab?: 'deposit' | 'withdraw') => {
      // Check if withdraw is WithdrawOrder type
      if (tab === 'withdraw') {
        const withdrawAction = detailInfo?.actions?.find(
          (a) =>
            a.type === EStakingActionType.Withdraw ||
            a.type === EStakingActionType.WithdrawOrder,
        );

        if (withdrawAction?.type === EStakingActionType.WithdrawOrder) {
          // Directly open WithdrawOptions modal
          appNavigation.pushModal(EModalRoutes.StakingModal, {
            screen: EModalStakingRoutes.WithdrawOptions,
            params: {
              accountId: earnAccount?.accountId || '',
              networkId,
              protocolInfo,
              tokenInfo,
              symbol,
              provider,
            },
          });
          return;
        }
      }

      // Default: open ManagePosition
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
    [
      appNavigation,
      networkId,
      symbol,
      provider,
      vault,
      detailInfo,
      earnAccount,
      protocolInfo,
      tokenInfo,
    ],
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
            <ManagePositionPart
              networkId={networkId}
              symbol={symbol}
              provider={provider}
              vault={vault}
              onCreateAddress={onCreateAddress}
              onStakeWithdrawSuccess={handleStakeWithdrawSuccess}
            />
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
