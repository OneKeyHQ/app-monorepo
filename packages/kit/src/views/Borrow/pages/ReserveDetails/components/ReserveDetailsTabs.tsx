import { memo, useCallback, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet, View } from 'react-native';
import { CollapsiblePagerView, NativeScroller } from 'react-native-pager-view';

import { XStack, YStack } from '@onekeyhq/components';
import { TabBar } from '@onekeyhq/components/src/composite/TabBar';
import { useAppPagerController } from '@onekeyhq/kit/src/components/AppPager/useAppPagerController';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IBorrowReserveDetail } from '@onekeyhq/shared/types/staking';

import {
  useApyChartColors,
  useApyLabels,
  useBorrowApyHistory,
  useBorrowBadges,
  useTimePeriodOptions,
} from '../hooks/useBorrowChartData';

import { ApyChartSection } from './ApyChartSection';
import { BorrowFAQSection } from './BorrowFAQSection';
import { DailyCapsSection } from './DailyCapsSection';
import { InterestRateModelSection } from './InterestRateModelSection';
import { RiskSection } from './RiskSection';

import type { ITimePeriod } from '../hooks/useBorrowChartData';
import type { LayoutChangeEvent } from 'react-native';

interface IReserveDetailsTabsProps {
  networkId: string;
  provider: string;
  marketAddress: string;
  reserveAddress: string;
  details?: IBorrowReserveDetail;
  header: React.ReactNode;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  measuredContent: { position: 'absolute', top: 0, left: 0, right: 0 },
});

const ReserveDetailsTabsComponent = ({
  networkId,
  provider,
  marketAddress,
  reserveAddress,
  details,
  header,
}: IReserveDetailsTabsProps) => {
  const intl = useIntl();
  const pagerRef = useRef<CollapsiblePagerView>(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [stickyHeaderHeight, setStickyHeaderHeight] = useState(0);
  const [supplyTimePeriod, setSupplyTimePeriod] = useState<ITimePeriod>('week');
  const [borrowTimePeriod, setBorrowTimePeriod] = useState<ITimePeriod>('week');

  const apyChartColors = useApyChartColors();
  const tabNames = useMemo(
    () => ({
      supply: intl.formatMessage({ id: ETranslations.defi_supply_info }),
      borrow: intl.formatMessage({ id: ETranslations.defi_borrow_info }),
      more: intl.formatMessage({ id: ETranslations.global_more }),
    }),
    [intl],
  );

  const timePeriodOptions = useTimePeriodOptions();
  const { supplyApyLabel, borrowApyLabel } = useApyLabels();
  const { supplyBadge, borrowBadge } = useBorrowBadges(details);

  const supplyData = useBorrowApyHistory({
    networkId,
    provider,
    marketAddress,
    reserveAddress,
    action: 'supply',
    timePeriod: supplyTimePeriod,
  });

  const borrowData = useBorrowApyHistory({
    networkId,
    provider,
    marketAddress,
    reserveAddress,
    action: 'borrow',
    timePeriod: borrowTimePeriod,
  });

  const pages = useMemo(
    () =>
      (['supply', 'borrow', 'more'] as const).map((key) => ({
        key,
        name: tabNames[key],
      })),
    [tabNames],
  );
  const controller = useAppPagerController({
    pages,
    initialTabName: tabNames.supply,
    pagerRef,
    animationEnabled: platformEnv.isNative,
  });
  const handleHeaderLayout = useCallback((event: LayoutChangeEvent) => {
    setHeaderHeight(Math.ceil(event.nativeEvent.layout.height));
  }, []);
  const handleStickyHeaderLayout = useCallback((event: LayoutChangeEvent) => {
    setStickyHeaderHeight(Math.ceil(event.nativeEvent.layout.height));
  }, []);

  return (
    <CollapsiblePagerView
      ref={pagerRef}
      style={styles.fill}
      initialPage={controller.initialIndex}
      headerHeight={headerHeight}
      stickyHeaderHeight={stickyHeaderHeight}
      nestedScrollEnabled
      nativeSmoothHeaderScrollEnabled={
        headerHeight > 0 && stickyHeaderHeight > 0
      }
      pageRetentionDistance={2}
      offscreenPageLimit={platformEnv.isNativeAndroid ? 2 : undefined}
      scrollEnabled={platformEnv.isNative}
      header={
        <View style={styles.measuredContent} onLayout={handleHeaderLayout}>
          {header}
        </View>
      }
      stickyHeader={
        <View
          style={styles.measuredContent}
          onLayout={handleStickyHeaderLayout}
        >
          <TabBar
            tabNames={pages.map((page) => page.name)}
            focusedTab={controller.focusedTab}
            indexDecimal={
              platformEnv.isNative ? controller.indexDecimal : undefined
            }
            onTabPress={controller.jumpToTab}
            scrollable={platformEnv.isNative}
            keepFocusedTabVisible={platformEnv.isNative}
          />
        </View>
      }
      onPageScroll={({ nativeEvent }) => {
        controller.indexDecimal.value =
          nativeEvent.position + nativeEvent.offset;
      }}
      onPageSelected={({ nativeEvent }) =>
        controller.selectIndex(nativeEvent.position)
      }
    >
      {/* Supply Info Tab */}
      <View key="supply" style={styles.fill} collapsable={false}>
        <NativeScroller
          pagerScrollKey="supply"
          style={styles.fill}
          showsVerticalScrollIndicator={false}
        >
          <YStack px="$5" pt="$6" pb="$6" gap="$6">
            {supplyBadge ? <XStack>{supplyBadge}</XStack> : null}

            <ApyChartSection
              apyValue={details?.supply.apyDetail.apy ?? '0'}
              apyLabel={supplyApyLabel}
              history={supplyData.history}
              isLoading={supplyData.isLoading ?? false}
              timePeriod={supplyTimePeriod}
              timePeriodOptions={timePeriodOptions}
              onTimePeriodChange={setSupplyTimePeriod}
              lineColor={apyChartColors.supply.line}
              topColor={apyChartColors.supply.top}
              bottomColor={apyChartColors.supply.bottom}
              lineWidth={apyChartColors.lineWidth}
              showDivider={false}
              capUsage={details?.supply.usage}
              capUsageLabel={intl.formatMessage({
                id: ETranslations.defi_supply_cap_usage,
              })}
              metrics={
                details
                  ? {
                      maxLtv: details.supply.maxLtv,
                      liquidationLtv: details.supply.liquidationLtv,
                      softLiquidation: details.supply.softLiquidation,
                    }
                  : undefined
              }
              tooltipLabel={supplyApyLabel}
            />
          </YStack>
        </NativeScroller>
      </View>

      {/* Borrow Info Tab */}
      <View key="borrow" style={styles.fill} collapsable={false}>
        <NativeScroller
          pagerScrollKey="borrow"
          style={styles.fill}
          showsVerticalScrollIndicator={false}
        >
          <YStack px="$5" pt="$6" pb="$6" gap="$6">
            {borrowBadge ? <XStack>{borrowBadge}</XStack> : null}

            <ApyChartSection
              apyValue={details?.borrow.apyDetail.apy ?? '0'}
              apyLabel={borrowApyLabel}
              history={borrowData.history}
              isLoading={borrowData.isLoading ?? false}
              timePeriod={borrowTimePeriod}
              timePeriodOptions={timePeriodOptions}
              onTimePeriodChange={setBorrowTimePeriod}
              lineColor={apyChartColors.borrow.line}
              topColor={apyChartColors.borrow.top}
              bottomColor={apyChartColors.borrow.bottom}
              lineWidth={apyChartColors.lineWidth}
              showDivider={false}
              capUsage={details?.borrow.usage}
              capUsageLabel={intl.formatMessage({
                id: ETranslations.defi_borrow_cap_usage,
              })}
              tooltipLabel={borrowApyLabel}
            />
          </YStack>
        </NativeScroller>
      </View>

      {/* More Tab */}
      <View key="more" style={styles.fill} collapsable={false}>
        <NativeScroller
          pagerScrollKey="more"
          style={styles.fill}
          showsVerticalScrollIndicator={false}
        >
          <YStack px="$5" pt="$6" pb="$6" gap="$8">
            <InterestRateModelSection
              networkId={networkId}
              provider={provider}
              marketAddress={marketAddress}
              reserveAddress={details?.borrow.reserveAddress || reserveAddress}
              utilizationRatio={details?.utilizationRatio}
            />
            <DailyCapsSection details={details} />
            <RiskSection risk={details?.risk} />
            <BorrowFAQSection
              networkId={networkId}
              provider={provider}
              marketAddress={marketAddress}
              reserveAddress={reserveAddress}
            />
          </YStack>
        </NativeScroller>
      </View>
    </CollapsiblePagerView>
  );
};

export const ReserveDetailsTabs = memo(ReserveDetailsTabsComponent);
