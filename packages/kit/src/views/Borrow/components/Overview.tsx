import { useCallback, useEffect, useMemo } from 'react';

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
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IBorrowEModeStatus } from '@onekeyhq/shared/types/staking';

import { EarnActionIcon } from '../../Staking/components/ProtocolDetails/EarnActionIcon';
import { EarnText } from '../../Staking/components/ProtocolDetails/EarnText';
import { PendingIndicator } from '../../Staking/components/StakingActivityIndicator';
import { getBorrowEarnAccountId } from '../borrowEarnAccount';
import { useBorrowContext } from '../BorrowProvider';
import { BorrowNavigation } from '../borrowUtils';
import { useBorrowPlaceholderAmountText } from '../hooks/useBorrowPlaceholderAmountText';
import { useLoadedOnce } from '../hooks/useLoadedOnce';
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
 * and net APY as three equal metrics followed by the E-Mode row, with the rest
 * of the strip moved to the summary below the positions.
 */
export const Overview = ({
  eModeStatus,
  isEModeError = false,
  isEModeLoading = false,
  overviewData,
  showBottomSpacing = true,
  onBorrowHistoryActionChange,
}: {
  eModeStatus: IBorrowEModeStatus | null;
  isEModeError?: boolean;
  isEModeLoading?: boolean;
  overviewData: IBorrowOverviewData;
  showBottomSpacing?: boolean;
  onBorrowHistoryActionChange?: (
    handler: (() => void) | null,
    visible: boolean,
  ) => void;
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
  const isNetWorthLoading = reserves.loading && !reserves.data?.overview;
  const isNetApyLoading = reserves.loading && !reserves.data?.overview;
  const hasLoadedHealthFactorOnce = useLoadedOnce(Boolean(healthFactorData));
  const healthFactorDetail =
    healthFactorData?.healthFactor?.button?.data.healthFactorDetail;
  const healthSummaryProps = {
    detail: healthFactorDetail,
    fallbackText: healthFactorData?.healthFactor?.text,
    isLoading: isHealthFactorLoading && !hasLoadedHealthFactorOnce,
  };

  const pendingCount = pendingTxs.length;
  const historyAction = reserves.data?.overview?.history;
  const historyVisible = !historyAction?.disabled && pendingCount === 0;
  const hasHistoryAction = pendingCount > 0 || !historyAction?.disabled;
  // Narrow layouts drop the inline entry and let the host hoist it into the
  // title bar — but only the native BorrowHomePage passes
  // onBorrowHistoryActionChange, so on web / WebDapp / a narrow desktop window
  // that left no way at all to reach history or see the pending count. Keep the
  // inline entry wherever nothing can hoist it.
  const showMobileHeaderHistoryAction = Boolean(
    !gtMd && platformEnv.isNative && hasHistoryAction,
  );
  const showInlineHistoryTools = gtMd || !platformEnv.isNative;

  useEffect(() => {
    if (!onBorrowHistoryActionChange) {
      return undefined;
    }

    onBorrowHistoryActionChange(
      showMobileHeaderHistoryAction ? handleHistoryPress : null,
      showMobileHeaderHistoryAction,
    );
    return () => {
      onBorrowHistoryActionChange(null, false);
    };
  }, [
    handleHistoryPress,
    onBorrowHistoryActionChange,
    showMobileHeaderHistoryAction,
  ]);

  const refreshButton = (
    <IconButton
      testID={BorrowTestIDs.overviewRefreshBtn}
      icon="RefreshCcwOutline"
      variant="tertiary"
      loading={reserves.loading || isManualRefreshing}
      onPress={handleRefreshPress}
    />
  );

  const historyTools = (
    <XStack ai="center" gap="$3" flexShrink={0}>
      {showInlineHistoryTools && pendingCount > 0 ? (
        <PendingIndicator num={pendingCount} onPress={handleHistoryPress} />
      ) : null}
      {showInlineHistoryTools && historyVisible ? (
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
              <XStack minHeight={48} ai="center" gap="$3" flexShrink={1}>
                {isNetWorthLoading ? (
                  <Skeleton w={160} h={48} borderRadius="$2" />
                ) : (
                  <EarnText
                    text={netWorthText}
                    size="$heading5xl"
                    fontWeight={400}
                    color="$text"
                    numberOfLines={1}
                    flexShrink={1}
                  />
                )}
                {refreshButton}
              </XStack>
              {historyTools}
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
        /* Phones keep the three headline numbers in equal-width columns so
           staggered loading results cannot move the later metrics. The tools
           stay pinned to the right and top-aligned with that row. */
        <>
          <XStack ai="flex-start" gap="$2">
            <XStack flex={1} flexWrap="wrap" ml="$-3" pl="$4">
              <OverviewMetric
                title={{ text: labels.netWorth }}
                text={netWorthText}
                isLoading={isNetWorthLoading}
                widthMode="equal"
              />
              <BorrowHealthFactorSummary
                {...healthSummaryProps}
                widthMode="equal"
              />
              <OverviewMetric
                testID={BorrowTestIDs.overviewNetApy}
                title={{ text: labels.netApy }}
                text={netApyText}
                isLoading={isNetApyLoading}
                widthMode="equal"
              />
            </XStack>
            {/* Clears the metric cells' own $3 of top padding */}
            <XStack pt="$3">{refreshButton}</XStack>
          </XStack>
          {/* E-Mode scopes the very numbers above it, so on phones it follows
              them as a full-width row rather than trailing the summary below
              the positions. Its $4 inset lands its label on the same left edge
              as the metric labels, which carry $3 of cell padding on top of the
              grid's $4. */}
          <BorrowEModeMetric
            eModeStatus={eModeStatus}
            isError={isEModeError}
            isLoading={isEModeLoading}
            variant="bar"
          />
        </>
      )}
    </YStack>
  );
};
