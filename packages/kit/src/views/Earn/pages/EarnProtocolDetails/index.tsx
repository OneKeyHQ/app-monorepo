import { Fragment, memo, useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Badge,
  Dialog,
  Divider,
  Icon,
  IconButton,
  Image,
  Page,
  Popover,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
  useMedia,
  useScrollContentTabBarOffset,
  useShare,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { CountDownCalendarAlert } from '@onekeyhq/kit/src/components/CountDownCalendarAlert';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  useActiveAccount,
  useSelectedAccount,
} from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  EJotaiContextStoreNames,
  useDevSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  ETabEarnRoutes,
  ITabEarnParamList,
} from '@onekeyhq/shared/src/routes';
import {
  EModalRoutes,
  EModalStakingRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import {
  normalizeToEarnProvider,
  normalizeToEarnSymbol,
} from '@onekeyhq/shared/types/earn/earnProvider.constants';
import type {
  IEarnAlert,
  IEarnPopupActionIcon,
  IEarnText,
  IEarnTextTooltip,
  IEarnTokenInfo,
  IProtocolInfo,
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
import { EarnPlatformBonusSection } from '../../../Staking/components/ProtocolDetails/EarnPlatformBonusSection';
import { EarnText } from '../../../Staking/components/ProtocolDetails/EarnText';
import { GridItem } from '../../../Staking/components/ProtocolDetails/GridItemV2';
import { PendleRulesSection } from '../../../Staking/components/ProtocolDetails/PendleRulesSection';
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

import { ActivityBanner } from './components/ActivityBanner';
import { ApyChart } from './components/ApyChart';
import { ProtocolIntroSection } from './components/ProtocolIntroSection';
import { ProtocolTipsSection } from './components/ProtocolTipsSection';
import { YieldBreakdownSheet } from './components/YieldBreakdownSheet';
import { useProtocolDetailBreadcrumb } from './hooks/useProtocolDetailBreadcrumb';
import { useProtocolDetailData } from './hooks/useProtocolDetailData';
import { MobileDetailTabs } from './mobile/MobileDetailTabs';
import { PortfolioTab } from './mobile/PortfolioTab';
import {
  pickProtocolInfoDisplayName,
  resolveProviderSubtitle,
} from './mobile/providerSubtitle.utils';
import { useMobileDetailLayout } from './mobile/useMobileDetailLayout';
import {
  buildHeadlineApyParts,
  isYieldSheetAvailable,
} from './mobile/yieldSegments.utils';

import type { RouteProp } from '@react-navigation/core';

function ManagersSection({
  managers,
  noPadding,
}: {
  managers: IStakeEarnDetail['managers'] | undefined;
  noPadding?: boolean;
}) {
  return managers?.items?.length ? (
    <XStack gap="$1" alignItems="center" px={noPadding ? '$0' : '$pagePadding'}>
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

const ProtocolHeader = ({
  symbol,
  apyDetail,
  tokenInfo,
  maturity,
  maturityText,
  onShare,
  providerSubtitle,
  yieldSheetData,
}: {
  symbol: string;
  apyDetail: IStakeEarnDetail['apyDetail'];
  tokenInfo?: IEarnTokenInfo;
  maturity?: IStakeEarnDetail['maturity'];
  maturityText?: IEarnText;
  onShare?: () => void;
  // Phone layout replaces the managers row with the provider name under the
  // token symbol; wide layouts keep passing undefined and render as before.
  providerSubtitle?: string;
  // Present only when the phone layout is active and the server sent a fully
  // classified breakdown; otherwise the existing popup icon renders instead.
  yieldSheetData?: IEarnPopupActionIcon['data'];
}) => {
  const intl = useIntl();
  const navigation = useAppNavigation();

  const handleMyPortfolio = useCallback(() => {
    if (platformEnv.isNative) {
      EarnNavigation.pushToEarnPositions(navigation);
      return;
    }
    void EarnNavigation.popToEarnHome(navigation, { tab: 'portfolio' });
  }, [navigation]);

  const formattedMaturityDate = useMemo(() => {
    if (maturityText?.text) {
      return maturityText.text;
    }
    if (!maturity?.date) return undefined;
    try {
      const date = new Date(maturity.date);
      if (Number.isNaN(date.getTime())) return maturity.date;
      return intl.formatDate(date, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return maturity.date;
    }
  }, [maturity?.date, maturityText?.text, intl]);

  // Green base + bonus in the campaign color, split from the same kind/rate
  // fields the Yield sheet's bar uses so the two can never disagree. Falls back
  // to the single string the server rendered when the breakdown is missing.
  const headlineApyParts = useMemo(
    () => buildHeadlineApyParts(yieldSheetData?.items),
    [yieldSheetData?.items],
  );

  return (
    <YStack gap="$2.5">
      <XStack jc="space-between" ai="center">
        {/* Vault symbols can be as long as
            "Morpho-cbBTC-USDC-wrapper". The name group used to be
            flexShrink={0} with no truncation on its text, so it pushed the
            divider and the maturity date off the right edge. The date is
            short and load-bearing, so it and the divider hold their size and
            the name truncates into whatever is left. */}
        <XStack gap="$3" ai="center" minWidth={0} flex={1}>
          <XStack gap="$2" ai="center" flexShrink={1} minWidth={0}>
            <Token size="xs" tokenImageUri={tokenInfo?.token.logoURI} />
            {providerSubtitle ? (
              <YStack flexShrink={1} minWidth={0}>
                <SizableText
                  size="$bodyLgMedium"
                  numberOfLines={1}
                  flexShrink={1}
                >
                  {tokenInfo?.token.symbol || symbol}
                </SizableText>
                <SizableText
                  size="$bodySm"
                  color="$textSubdued"
                  numberOfLines={1}
                  flexShrink={1}
                >
                  {providerSubtitle}
                </SizableText>
              </YStack>
            ) : (
              <SizableText
                size="$bodyLgMedium"
                numberOfLines={1}
                flexShrink={1}
              >
                {tokenInfo?.token.symbol || symbol}
              </SizableText>
            )}
          </XStack>
          {formattedMaturityDate ? (
            <>
              <Divider vertical h="$6" flexShrink={0} />
              <SizableText
                size="$bodyLgMedium"
                numberOfLines={1}
                flexShrink={0}
              >
                {formattedMaturityDate}
              </SizableText>
            </>
          ) : null}
        </XStack>
      </XStack>

      <XStack gap="$2" ai="center">
        {yieldSheetData ? (
          // Phone layout: the whole APY figure is the trigger, matching the
          // design. Wide layouts keep the small icon button below.
          <Popover
            title={yieldSheetData.title?.text ?? ''}
            renderTrigger={
              // The whole figure is the trigger, marked by a dotted rule rather
              // than an icon — the affordance the design uses.
              <XStack
                ai="baseline"
                alignSelf="flex-start"
                cursor="pointer"
                // borderStyle applies to all four edges, and an edge with no
                // explicit width falls back to the CSS initial `medium` — which
                // drew a dotted box instead of a rule. The other three widths
                // have to be zeroed, same as DeFiPositionHealthFactorRow.
                borderBottomWidth="$px"
                borderTopWidth={0}
                borderLeftWidth={0}
                borderRightWidth={0}
                borderBottomColor="$borderSubdued"
                borderStyle="dotted"
                pb="$1"
              >
                {headlineApyParts ? (
                  <>
                    <SizableText size="$heading2xl" color="$textSuccess">
                      {headlineApyParts.base}
                    </SizableText>
                    {headlineApyParts.bonus ? (
                      <SizableText
                        size="$heading2xl"
                        color={headlineApyParts.bonusColor}
                      >
                        {headlineApyParts.bonus}
                      </SizableText>
                    ) : null}
                  </>
                ) : (
                  <EarnText
                    text={
                      apyDetail?.description || {
                        text: intl.formatMessage({
                          id: ETranslations.earn_earn_points,
                        }),
                        color: '$textDisabled',
                      }
                    }
                    size="$heading2xl"
                  />
                )}
              </XStack>
            }
            renderContent={<YieldBreakdownSheet data={yieldSheetData} />}
            floatingPanelProps={{ w: 360 }}
            placement="bottom-start"
          />
        ) : (
          <>
            <EarnText
              text={
                apyDetail?.description || {
                  text: intl.formatMessage({
                    id: ETranslations.earn_earn_points,
                  }),
                  color: '$textDisabled',
                }
              }
              size="$heading3xl"
            />
            <EarnActionIcon
              title={apyDetail?.title?.text}
              actionIcon={apyDetail?.button}
            />
          </>
        )}
        {onShare ? (
          <IconButton
            testID="earn-icon-btn"
            icon="ShareOutline"
            size="small"
            variant="tertiary"
            iconColor="$iconSubdued"
            onPress={onShare}
          />
        ) : null}
        <XStack
          ml="auto"
          cursor="pointer"
          ai="center"
          onPress={handleMyPortfolio}
        >
          <SizableText size="$bodyMdMedium" color="$textSubdued">
            {intl.formatMessage({ id: ETranslations.earn_positions })}
          </SizableText>
          <Icon
            size="$bodySmMedium"
            name="ChevronRightSmallOutline"
            color="$iconSubdued"
          />
        </XStack>
      </XStack>
    </YStack>
  );
};

function ChartSection({
  networkId,
  symbol,
  provider,
  vault,
  showTimeRangeControls,
}: {
  networkId: string;
  symbol: string;
  provider: string;
  vault?: string;
  // Phone layout shows 1H/1D/1W/Max for every provider. ApyChart already
  // filters to whatever data falls in the window, so a sparse history simply
  // draws fewer points rather than needing its own guard.
  showTimeRangeControls?: boolean;
}) {
  const intl = useIntl();
  const { gtMd } = useMedia();
  const isPendleProvider = useMemo(
    () => earnUtils.isPendleProvider({ providerName: provider }),
    [provider],
  );

  // Fetch chart data to get high/low values
  const { result: chartData } = usePromiseResult(async () => {
    if (isPendleProvider) {
      // underlying-history returns both impliedApy and underlyingApy, single request suffices
      const underlyingApyHistoryData =
        await backgroundApiProxy.serviceStaking.getUnderlyingApyHistory({
          networkId,
          symbol,
          provider,
          vault,
        });

      const impliedApyHistory = underlyingApyHistoryData.results.map(
        (item) => ({
          timestamp: item.timestamp,
          apy: item.impliedApy,
        }),
      );

      const underlyingApyHistory = underlyingApyHistoryData.results.map(
        (item) => ({
          timestamp: item.timestamp,
          apy: item.underlyingApy,
        }),
      );

      return {
        impliedApyHistory,
        underlyingApyHistory,
        hasNonZeroUnderlyingApy:
          underlyingApyHistoryData.hasNonZeroUnderlyingApy,
      };
    }

    const impliedApyHistory =
      await backgroundApiProxy.serviceStaking.getApyHistory({
        networkId,
        symbol,
        provider,
        vault,
      });

    // Second line = campaign boost + protocol reward APYs, summed by the
    // server. Only points that actually carry one are kept, so a history that
    // predates the campaign simply starts the line later instead of dropping
    // to zero.
    const extraApyHistory = impliedApyHistory
      .filter((item) => item.extraApy !== undefined)
      .map((item) => ({
        timestamp: item.timestamp,
        apy: item.extraApy as string,
      }));
    const extraApyKind = impliedApyHistory.find(
      (item) => item.extraApyKind,
    )?.extraApyKind;

    return {
      impliedApyHistory,
      extraApyHistory,
      extraApyKind,
    };
  }, [networkId, symbol, provider, vault, isPendleProvider]);

  const {
    impliedApyHistory,
    underlyingApyHistory,
    hasNonZeroUnderlyingApy,
    extraApyHistory,
    extraApyKind,
  } = chartData ?? {};

  // Pendle keeps its own toggled underlying-APY line; every other provider
  // draws the campaign / reward line the server computed.
  const secondaryHistory = isPendleProvider
    ? underlyingApyHistory
    : extraApyHistory;
  const secondaryLineColor = isPendleProvider
    ? undefined
    : // Campaign orange vs protocol-reward blue, matching the Yield sheet's
      // segment colors. TODO(design): confirm the exact orange against Figma.
      (extraApyKind === 'reward' && '#0177E5') || '#DD7B22';

  // Calculate high and low APY
  const { high, low } = useMemo(() => {
    if (!impliedApyHistory || impliedApyHistory.length === 0) {
      return { high: null, low: null };
    }
    const apyValues = impliedApyHistory.map((item) => Number(item.apy));
    return {
      high: Math.max(...apyValues),
      low: Math.min(...apyValues),
    };
  }, [impliedApyHistory]);

  const showUnderlyingApyToggle = Boolean(
    isPendleProvider &&
    hasNonZeroUnderlyingApy &&
    underlyingApyHistory &&
    underlyingApyHistory.length > 0,
  );

  return (
    <YStack gap="$3">
      {/* High and Low values */}
      {gtMd && !isPendleProvider && high !== null && low !== null ? (
        <XStack gap="$4" pt="$6">
          <YStack>
            <SizableText size="$bodySm" color="$textSubdued">
              {intl.formatMessage({ id: ETranslations.market_high })}
            </SizableText>
            <SizableText size="$bodyMd" color="$text">
              {high.toFixed(2)}%
            </SizableText>
          </YStack>
          <YStack>
            <SizableText size="$bodySm" color="$textSubdued">
              {intl.formatMessage({ id: ETranslations.market_low })}
            </SizableText>
            <SizableText size="$bodyMd" color="$text">
              {low.toFixed(2)}%
            </SizableText>
          </YStack>
        </XStack>
      ) : null}
      {/* Chart component */}
      <ApyChart
        apyHistory={impliedApyHistory}
        underlyingApyHistory={secondaryHistory}
        secondaryLineColor={secondaryLineColor}
        controlsPlacement={showTimeRangeControls ? 'bottom' : 'top'}
        showChartControls={isPendleProvider || Boolean(showTimeRangeControls)}
        showUnderlyingApyToggle={showUnderlyingApyToggle}
        primaryApyLabel={
          isPendleProvider
            ? intl.formatMessage({ id: ETranslations.earn_fixed_income })
            : undefined
        }
        secondaryApyLabel={
          isPendleProvider
            ? intl.formatMessage({ id: ETranslations.defi_underlying_apy })
            : undefined
        }
      />
    </YStack>
  );
}

const MARKET_INFO_DIALOG_CONTENT_MAX_HEIGHT = 512;

function MarketInfoDialogContent({ tooltip }: { tooltip: IEarnTextTooltip }) {
  return (
    <Dialog.ScrollView
      maxHeight={MARKET_INFO_DIALOG_CONTENT_MAX_HEIGHT}
      nestedScrollEnabled
    >
      <YStack px="$5" pb="$5" gap="$5">
        {tooltip.data.description ? (
          <EarnText text={tooltip.data.description} size="$bodyMd" />
        ) : null}
        {tooltip.data.items?.map((item, index) => (
          <YStack key={`${item.title.text}-${index}`} gap="$1">
            <EarnText
              text={item.title}
              size="$bodySm"
              color={item.title.color ?? '$textSubdued'}
            />
            <EarnText
              text={item.description}
              size="$bodyMd"
              color={item.description.color ?? '$text'}
            />
          </YStack>
        ))}
      </YStack>
    </Dialog.ScrollView>
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
  const intl = useIntl();
  const marketInfoTooltip =
    data && 'tooltip' in data && data.tooltip?.type === 'text'
      ? data.tooltip
      : undefined;
  const handleShowMarketInfo = useCallback(() => {
    if (!marketInfoTooltip) {
      return;
    }

    Dialog.show({
      title: marketInfoTooltip.data.title?.text ?? 'Market info',
      disableDrag: true,
      contentContainerProps: {
        px: '$0',
        pb: '$0',
      },
      floatingPanelProps: {
        width: 400,
      },
      renderContent: <MarketInfoDialogContent tooltip={marketInfoTooltip} />,
      onConfirmText: intl.formatMessage({ id: ETranslations.global_got_it }),
      confirmButtonProps: {
        variant: 'secondary',
      },
      showCancelButton: false,
    });
  }, [intl, marketInfoTooltip]);

  if (!data) {
    return null;
  }

  return (
    <>
      {data.items?.length ? (
        <YStack gap="$6">
          <XStack alignItems="center" gap="$3">
            <EarnText text={data.title} size="$headingLg" />
            {marketInfoTooltip ? (
              <Badge
                badgeSize="lg"
                badgeType="default"
                gap="$1"
                cursor="pointer"
                onPress={handleShowMarketInfo}
              >
                <Badge.Text>
                  {marketInfoTooltip.data.title?.text ?? 'Market info'}
                </Badge.Text>
                <Icon
                  name="InfoCircleOutline"
                  size="$3.5"
                  color="$iconSubdued"
                />
              </Badge>
            ) : null}
          </XStack>
          <XStack flexWrap="wrap" m="$-5" p="$2">
            {data.items.map((cell, cellIndex) => (
              <GridItem
                key={
                  cell.title?.text ||
                  cell.description?.text ||
                  `grid-cell-${cellIndex}`
                }
                title={cell.title}
                description={cell.description}
                descriptionComponent={
                  cell?.items ? (
                    <YStack gap="$2">
                      {(cell?.items ?? []).map((item, itemIndex) => (
                        <XStack
                          key={
                            item.title?.text ||
                            item.logoURI ||
                            `grid-item-${cellIndex}-${itemIndex}`
                          }
                          ai="center"
                          gap="$1.5"
                        >
                          <Token
                            size="xs"
                            borderRadius="$2"
                            mr="$0.5"
                            tokenImageUri={item.logoURI}
                          />
                          {item.title?.text ? (
                            <EarnText text={item.title} size="$bodyLgMedium" />
                          ) : null}
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
  protocolInfo,
  isLoading,
  keepSkeletonVisible,
  onRefresh,
  networkId,
  symbol,
  provider,
  vault,
  onShare,
  isMobileLayout,
  providerSubtitle,
  hasPortfolio,
}: {
  detailInfo: IStakeEarnDetail | undefined;
  tokenInfo?: IEarnTokenInfo;
  protocolInfo?: IProtocolInfo;
  isLoading: boolean;
  keepSkeletonVisible: boolean;
  onRefresh: () => void;
  networkId: string;
  symbol: string;
  provider: string;
  vault?: string;
  onShare?: () => void;
  isMobileLayout?: boolean;
  providerSubtitle?: string;
  hasPortfolio?: boolean;
}) => {
  const now = useMemo(() => Date.now(), []);

  // The sheet replaces the icon-button popup only when the server sent a
  // complete breakdown; otherwise the existing popup renders untouched.
  const popupData =
    detailInfo?.apyDetail?.button?.type === 'popup'
      ? detailInfo.apyDetail.button.data
      : undefined;
  const yieldSheetData =
    isMobileLayout && isYieldSheetAvailable(popupData) ? popupData : undefined;

  const countDownAlert =
    detailInfo?.countDownAlert?.startTime &&
    detailInfo?.countDownAlert?.endTime &&
    now > detailInfo.countDownAlert.startTime &&
    detailInfo.countDownAlert.endTime > now ? (
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
    ) : null;

  if (isMobileLayout) {
    return (
      <YStack flex={6} gap="$5" px="$pagePadding">
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
              {detailInfo.activityBanner ? (
                <ActivityBanner banner={detailInfo.activityBanner} />
              ) : null}
              <EarnPlatformBonusSection
                appearance="alert"
                platformBonus={detailInfo.platformBonus}
                protocolInfo={protocolInfo}
                tokenInfo={tokenInfo}
              />
              <YStack>
                <ProtocolHeader
                  symbol={symbol}
                  apyDetail={detailInfo.apyDetail}
                  tokenInfo={tokenInfo}
                  maturity={detailInfo.maturity}
                  maturityText={detailInfo.nums?.maturity}
                  providerSubtitle={providerSubtitle}
                  yieldSheetData={yieldSheetData}
                />
                <ChartSection
                  networkId={networkId}
                  symbol={symbol}
                  provider={provider}
                  vault={vault}
                  showTimeRangeControls
                />
                <ProtocolTipsSection protocolTips={detailInfo.protocolTips} />
              </YStack>
              {countDownAlert}
              <AlertSection alerts={detailInfo.alertsV2} />
              <MobileDetailTabs
                hasPortfolio={Boolean(hasPortfolio)}
                portfolioContent={
                  detailInfo.mobilePortfolio?.groups?.length ? (
                    <PortfolioTab
                      portfolio={detailInfo.mobilePortfolio}
                      networkId={networkId}
                      symbol={symbol}
                      provider={provider}
                      protocolInfo={protocolInfo}
                      tokenInfo={tokenInfo}
                    />
                  ) : null
                }
                infoContent={
                  <YStack gap="$8">
                    {/* mobileInfo is the phone-only copy of intro (Vault cell
                        swapped for Protocol) plus the new Token info block.
                        Falls back to intro when the server predates it. */}
                    <GridSection
                      data={
                        detailInfo.mobileInfo?.productInfo ?? detailInfo.intro
                      }
                    />
                    <GridSection data={detailInfo.mobileInfo?.tokenInfo} />
                    {earnUtils.isPendleProvider({ providerName: provider }) ? (
                      <PendleRulesSection data={detailInfo.rules} />
                    ) : (
                      <GridSection data={detailInfo.rules} />
                    )}
                    <PeriodSection timeline={detailInfo.timeline} />
                    <GridSection data={detailInfo.performance} />
                    <ProtectionSection protection={detailInfo.protection} />
                    <RiskSection risk={detailInfo.risk} />
                  </YStack>
                }
                protocolContent={
                  <ProtocolIntroSection
                    protocolInfo={detailInfo.protocolInfo}
                  />
                }
              />
              <FAQSection faqs={detailInfo.faqs} tokenInfo={tokenInfo} />
            </YStack>
          ) : null}
        </PageFrame>
      </YStack>
    );
  }

  return (
    <YStack flex={6} gap="$5" px="$pagePadding">
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
            <YStack>
              <ProtocolHeader
                symbol={symbol}
                apyDetail={detailInfo.apyDetail}
                tokenInfo={tokenInfo}
                maturity={detailInfo.maturity}
                maturityText={detailInfo.nums?.maturity}
                onShare={onShare}
              />
              <ChartSection
                networkId={networkId}
                symbol={symbol}
                provider={provider}
                vault={vault}
              />
              {/* Protocol Tips (OK-58972)：图表下方浅灰卡片，dashboard 配置 */}
              <ProtocolTipsSection protocolTips={detailInfo.protocolTips} />
            </YStack>
            <EarnPlatformBonusSection
              appearance="alert"
              platformBonus={detailInfo.platformBonus}
              protocolInfo={protocolInfo}
              tokenInfo={tokenInfo}
            />
            <GridSection data={detailInfo.intro} />
            <ProtocolIntroSection protocolInfo={detailInfo.protocolInfo} />
            {earnUtils.isPendleProvider({
              providerName: provider,
            }) ? (
              <PendleRulesSection data={detailInfo.rules} />
            ) : (
              <GridSection data={detailInfo.rules} />
            )}
            {countDownAlert}
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
  suppressPlatformBonus,
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
  suppressPlatformBonus?: boolean;
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
          suppressPlatformBonus={suppressPlatformBonus}
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
  const { gtMd, gtSm } = useMedia();
  const isMobileLayout = useMobileDetailLayout();
  const { shareText } = useShare();
  const [devSettings] = useDevSettingsPersistAtom();
  const { activeAccount } = useActiveAccount({ num: 0 });
  const { indexedAccount } = activeAccount;
  const { selectedAccount } = useSelectedAccount({ num: 0 });
  const [keepSkeletonVisible, setKeepSkeletonVisible] = useState(false);

  // Parse route params, support both normal and share link routes
  const resolvedParams = useMemo<{
    networkId: string;
    symbol: string;
    provider: string;
    vault: string | undefined;
    logoURI?: string;
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
      // Only use normalizeToEarnProvider for validation, keep provider lowercase for API calls
      const normalizedProvider = normalizeToEarnProvider(providerParam);

      if (!networkId) {
        throw new OneKeyLocalError(`Unknown network: ${String(network)}`);
      }
      if (!normalizedProvider) {
        throw new OneKeyLocalError(
          `Unknown provider: ${String(providerParam)}`,
        );
      }

      return {
        networkId,
        symbol,
        provider: normalizedProvider.toLowerCase(), // Keep lowercase for API consistency
        vault,
      };
    }

    // Old format: normal navigation
    const { networkId, symbol, provider, vault, logoURI } = routeParams;

    return {
      networkId,
      symbol,
      provider,
      vault,
      logoURI,
    };
  }, [route.params]);

  // For cross-network: only use othersWalletAccountId (external wallets),
  // NEVER account?.id which is network-specific and will mismatch.
  const accountId = selectedAccount.othersWalletAccountId || '';
  const indexedAccountId =
    selectedAccount.indexedAccountId || indexedAccount?.id;
  const { networkId, symbol, provider, vault, logoURI } = resolvedParams;

  const {
    detailInfo,
    tokenInfo,
    protocolInfo,
    isLoading,
    refreshData,
    refreshAccount,
  } = useProtocolDetailData({
    accountId,
    networkId,
    indexedAccountId,
    symbol,
    provider,
    vault,
    includeAccountContext: isMobileLayout,
  });

  const providerSubtitle = useMemo(
    () =>
      isMobileLayout
        ? resolveProviderSubtitle({
            title: tokenInfo?.token?.symbol || symbol,
            providerDetailName: detailInfo?.protocol?.providerDetail?.name,
            protocolInfoDisplayName: pickProtocolInfoDisplayName(
              detailInfo?.protocolInfo,
            ),
            provider,
          })
        : undefined,
    [
      isMobileLayout,
      tokenInfo?.token?.symbol,
      symbol,
      detailInfo?.protocol?.providerDetail?.name,
      detailInfo?.protocolInfo,
      provider,
    ],
  );

  // The portfolio tab needs the account-scoped response, so it stays hidden
  // until the server says there is something to show. Falls back to the balance
  // when the server predates the mobile read model.
  const hasPortfolio = useMemo(() => {
    if (detailInfo?.mobilePortfolio) {
      return detailInfo.mobilePortfolio.hasPosition;
    }
    const balance = Number(tokenInfo?.balanceParsed ?? '0');
    return Number.isFinite(balance) && balance > 0;
  }, [detailInfo?.mobilePortfolio, tokenInfo?.balanceParsed]);

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
    accountReady: activeAccount.ready,
    accountId,
    indexedAccountId,
    networkId,
    symbol,
    provider,
    tokenInfo,
  });

  // OK-59304: `tokenInfo` only exists once getProtocolDetailsV2 resolves, so
  // without the logo the entry list handed over the header would render the
  // placeholder icon on every entry and swap to the real logo on response.
  const headerTokenLogoURI = tokenInfo?.token?.logoURI ?? logoURI;
  // OK-59961: entries that carry no logoURI route param (a banner deep link)
  // have nothing to draw until getProtocolDetailsV2 resolves, so the header
  // rendered Token's placeholder coin and swapped in the real logo a beat
  // later. Skeleton it instead while the request is still in flight — gated on
  // isLoading rather than on the URI alone, so a token that genuinely has no
  // logo still falls back to the placeholder instead of pulsing forever.
  const isHeaderTokenLogoPending = !headerTokenLogoURI && isLoading;

  const pageTitle = useMemo(
    () => (
      <XStack gap="$3" ai="center">
        {isHeaderTokenLogoPending ? (
          // Matches Token size="md" (tokenImageSize $8) so nothing shifts
          <Skeleton w="$8" h="$8" radius="round" />
        ) : (
          <Token size="md" tokenImageUri={headerTokenLogoURI} />
        )}
        <SizableText size="$headingXl" numberOfLines={1} flexShrink={1}>
          {symbol}
        </SizableText>
      </XStack>
    ),
    [symbol, headerTokenLogoURI, isHeaderTokenLogoPending],
  );

  const handleOpenManageModal = useCallback(
    (tab?: 'deposit') => {
      const protocolVault = detailInfo?.protocol?.vault ?? vault;
      appNavigation.pushModal(EModalRoutes.StakingModal, {
        screen: EModalStakingRoutes.ManagePosition,
        params: {
          networkId,
          symbol,
          provider,
          vault: protocolVault,
          tab,
          tokenImageUri: tokenInfo?.token?.logoURI,
        },
      });
    },
    [
      appNavigation,
      detailInfo?.protocol?.vault,
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
        testID="earn-header-right-icon-btn"
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

  const tabBarHeight = useScrollContentTabBarOffset();

  // Redeem is only offered when the server says this protocol supports it for
  // this account — never derived from the balance alone.
  const canRedeem = Boolean(detailInfo?.mobilePortfolio?.capabilities.redeem);

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

    // With a position the phone layout gains a Redeem button beside the primary
    // action; without one the footer stays single-button as before.
    const showRedeem = isMobileLayout && canRedeem;

    return (
      <Page.Footer
        onConfirmText={buttonText}
        confirmButtonProps={{
          variant: 'primary',
          onPress,
          mb: tabBarHeight,
        }}
        {...(showRedeem
          ? {
              onCancelText: intl.formatMessage({
                id: ETranslations.earn_redeem,
              }),
              cancelButtonProps: {
                variant: 'secondary',
                onPress: () => handleOpenManageModal(),
                mb: tabBarHeight,
              },
            }
          : {})}
      />
    );
  }, [
    gtMd,
    intl,
    handleOpenManageModal,
    tabBarHeight,
    isCustomProtocol,
    isMobileLayout,
    canRedeem,
  ]);

  return (
    <EarnPageContainer
      pageTitle={pageTitle}
      breadcrumbProps={breadcrumbProps}
      sceneName={EAccountSelectorSceneName.home}
      tabRoute={ETabRoutes.Earn}
      showBackButton
      header={
        // The phone layout carries the provider name in the token header
        // instead, and lists every manager in the Protocol tab.
        isMobileLayout ? null : (
          <XStack ml={gtSm ? 'auto' : '0'} pr="$2" pt={gtSm ? undefined : '$4'}>
            <ManagersSection managers={detailInfo?.managers} noPadding />
          </XStack>
        )
      }
      customHeaderRightItems={headerRight}
      footer={pageFooter}
    >
      <XStack flexDirection={gtMd ? 'row' : 'column'}>
        <Stack w="100%" width={gtMd ? '65%' : undefined}>
          <DetailsPart
            detailInfo={detailInfo}
            tokenInfo={tokenInfo}
            protocolInfo={protocolInfo}
            isLoading={isLoading ?? false}
            keepSkeletonVisible={keepSkeletonVisible}
            onRefresh={refreshData}
            networkId={networkId}
            symbol={symbol}
            provider={provider}
            vault={vault}
            onShare={gtMd ? handleShare : undefined}
            isMobileLayout={isMobileLayout}
            providerSubtitle={providerSubtitle}
            hasPortfolio={hasPortfolio}
          />
        </Stack>
        {gtMd ? (
          <Stack width={gtMd ? '35%' : undefined}>
            <ManagePositionPart
              networkId={networkId}
              symbol={symbol}
              provider={provider}
              vault={vault}
              tokenImageUri={headerTokenLogoURI}
              accountId={accountId}
              indexedAccountId={indexedAccountId}
              suppressPlatformBonus={Boolean(detailInfo?.platformBonus)}
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
