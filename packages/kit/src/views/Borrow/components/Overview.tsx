import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Icon,
  IconButton,
  SizableText,
  Skeleton,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IBorrowEModeStatus } from '@onekeyhq/shared/types/staking';

import { EarnActionIcon } from '../../Staking/components/ProtocolDetails/EarnActionIcon';
import { EarnText } from '../../Staking/components/ProtocolDetails/EarnText';
import { PendingIndicator } from '../../Staking/components/StakingActivityIndicator';
import { getBorrowEarnAccountId } from '../borrowEarnAccount';
import { useBorrowContext } from '../BorrowProvider';
import { BorrowNavigation } from '../borrowUtils';
import { useBorrowPlaceholderAmountText } from '../hooks/useBorrowPlaceholderAmountText';
import { BorrowTestIDs } from '../testIDs';

import { BorrowBonusMetric } from './BorrowBonusMetric';
import { BorrowEModeMetric } from './BorrowEModeMetric';
import { BorrowHealthFactorSummary } from './BorrowHealthFactorSummary';
import { withNetApySignColor } from './borrowOverview.utils';
import { BorrowRewardsMetric } from './BorrowRewardsMetric';
import { Markets } from './Markets';
import { OverviewMetric } from './OverviewMetric';

import type { IBorrowOverviewData } from '../hooks/useBorrowOverviewData';

/**
 * Top of the Borrow home. Desktop keeps the net worth hero with the whole
 * metric strip under it; phones drop the hero and show net worth, health factor
 * and net APY as three equal metrics, with the rest of the strip moved to the
 * summary below the positions.
 */
export const Overview = ({
  eModeStatus,
  isEModeError = false,
  isEModeLoading = false,
  overviewData,
  showBottomSpacing = true,
}: {
  eModeStatus: IBorrowEModeStatus | null;
  isEModeError?: boolean;
  isEModeLoading?: boolean;
  overviewData: IBorrowOverviewData;
  showBottomSpacing?: boolean;
}) => {
  const { reserves, market, earnAccount, pendingTxs } = useBorrowContext();
  const intl = useIntl();
  const { gtMd } = useMedia();
  const placeholderAmountText = useBorrowPlaceholderAmountText();
  const navigation = useAppNavigation();

  const {
    healthFactorData,
    isHealthFactorLoading,
    borrowRewards,
    isRewardsLoading,
    isManualRefreshing,
    requestRefresh,
  } = overviewData;

  const provider = market?.provider;
  const networkId = market?.networkId;
  const marketAddress = market?.marketAddress;
  const earnAccountId = getBorrowEarnAccountId(earnAccount.data);

  const historyLabel = useMemo(
    () => intl.formatMessage({ id: ETranslations.global_history }),
    [intl],
  );
  const labels = useMemo(
    () => ({
      netWorth: intl.formatMessage({ id: ETranslations.defi_net_worth }),
      netApy: intl.formatMessage({ id: ETranslations.defi_net_apy }),
    }),
    [intl],
  );

  const handleHistoryPress = useCallback(() => {
    if (!provider || !networkId || !marketAddress || !earnAccountId) return;
    BorrowNavigation.pushToBorrowHistory(navigation, {
      accountId: earnAccountId,
      networkId,
      provider,
      marketAddress,
      title: historyLabel,
    });
  }, [
    navigation,
    provider,
    networkId,
    marketAddress,
    earnAccountId,
    historyLabel,
  ]);

  const handleRefreshPress = useCallback(() => {
    void requestRefresh();
  }, [requestRefresh]);

  const netWorthText =
    reserves.data?.overview?.netWorth ?? placeholderAmountText;
  const netApyText = withNetApySignColor(reserves.data?.overview?.netApy) ?? {
    text: '-',
    color: '$textSubdued',
  };
  const isNetApyLoading = reserves.loading && !reserves.data?.overview;
  const healthFactorDetail =
    healthFactorData?.healthFactor?.button?.data.healthFactorDetail;
  const healthSummaryProps = {
    detail: healthFactorDetail,
    fallbackText: healthFactorData?.healthFactor?.text,
    isLoading: isHealthFactorLoading && !healthFactorData,
  };

  const pendingCount = pendingTxs.length;
  const historyAction = reserves.data?.overview?.history;
  const historyVisible = !historyAction?.disabled && pendingCount === 0;

  /* Both tools act on the numbers rather than on the market, so they travel
     with net worth instead of sitting up on the market's line. */
  const tools = (
    <XStack ai="center" gap="$3" flexShrink={0}>
      {pendingCount > 0 ? (
        <PendingIndicator num={pendingCount} onPress={handleHistoryPress} />
      ) : null}
      {historyVisible ? (
        <XStack testID={BorrowTestIDs.overviewHistoryBtn} ai="center">
          {historyAction ? (
            <EarnActionIcon
              actionIcon={historyAction}
              onHistory={handleHistoryPress}
            />
          ) : (
            <XStack
              ai="center"
              gap="$1"
              cursor="pointer"
              onPress={handleHistoryPress}
            >
              <Icon
                name="ClockTimeHistoryOutline"
                size="$4"
                color="$iconSubdued"
              />
              {gtMd ? (
                <SizableText size="$bodyMd" color="$textSubdued">
                  {historyLabel}
                </SizableText>
              ) : null}
            </XStack>
          )}
        </XStack>
      ) : null}
      <IconButton
        testID={BorrowTestIDs.overviewRefreshBtn}
        icon="RefreshCcwOutline"
        variant="tertiary"
        loading={reserves.loading || isManualRefreshing}
        onPress={handleRefreshPress}
      />
    </XStack>
  );

  return (
    <YStack
      mt="$2"
      mb={showBottomSpacing ? '$5' : undefined}
      gap="$5"
      $gtLg={{ mb: showBottomSpacing ? '$10' : undefined }}
    >
      {/* The market scopes every number below it, so it gets the whole line to
          itself. A column parent is what lets the picker's own trigger stretch
          to this width on phones; from $gtMd the bar hugs its label instead. */}
      <Markets />

      {gtMd ? (
        <YStack gap="$5" pl="$5">
          {/* Net worth hero, label above value like the Earn overview */}
          <YStack gap="$1.5">
            <SizableText size="$bodyLgMedium" numberOfLines={1}>
              {labels.netWorth}
            </SizableText>
            <XStack ai="center" jc="space-between" gap="$3">
              <EarnText
                text={netWorthText}
                size="$heading5xl"
                fontWeight={400}
                color="$text"
                numberOfLines={1}
                flexShrink={1}
              />
              {tools}
            </XStack>
            <XStack
              testID={BorrowTestIDs.overviewNetApy}
              ai="center"
              gap="$1.5"
            >
              {isNetApyLoading ? (
                <XStack testID={`${BorrowTestIDs.overviewNetApy}-loading`}>
                  <Skeleton w={72} h="$6" borderRadius="$1" />
                </XStack>
              ) : (
                <EarnText
                  text={netApyText}
                  size="$bodyLgMedium"
                  color="$text"
                />
              )}
              <SizableText size="$bodyLgMedium" color="$textSubdued">
                {labels.netApy}
              </SizableText>
            </XStack>
          </YStack>

          {/* Metric strip: columns that hug their content so the handful of
              metrics stays packed to the left instead of spreading edge to edge
              on wide windows. */}
          <XStack flexWrap="wrap" mx="$-3">
            <BorrowHealthFactorSummary {...healthSummaryProps} />
            <BorrowEModeMetric
              eModeStatus={eModeStatus}
              isError={isEModeError}
              isLoading={isEModeLoading}
            />
            <BorrowBonusMetric />
            <BorrowRewardsMetric
              borrowRewards={borrowRewards}
              isLoading={isRewardsLoading}
              onClaimed={requestRefresh}
            />
          </XStack>
        </YStack>
      ) : (
        /* Phones give the three headline numbers the same weight on one row,
           wrapping onto a second only when they stop fitting, with the tools
           pinned to the right of that first row. Top-aligned rather than
           centred so they stay on the net worth line once the numbers wrap. */
        <XStack ai="flex-start" gap="$2">
          <XStack flex={1} flexWrap="wrap" ml="$-3" pl="$4">
            <OverviewMetric
              title={{ text: labels.netWorth }}
              text={netWorthText}
              widthMode="hug"
            />
            <BorrowHealthFactorSummary
              {...healthSummaryProps}
              widthMode="hug"
            />
            <OverviewMetric
              testID={BorrowTestIDs.overviewNetApy}
              title={{ text: labels.netApy }}
              text={netApyText}
              isLoading={isNetApyLoading}
              widthMode="hug"
            />
          </XStack>
          {/* Clears the metric cells' own $3 of top padding */}
          <XStack pt="$3">{tools}</XStack>
        </XStack>
      )}
    </YStack>
  );
};
