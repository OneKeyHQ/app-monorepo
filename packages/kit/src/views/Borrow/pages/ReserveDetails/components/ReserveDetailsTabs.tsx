import { memo, useCallback, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import type {
  ITabContainerProps,
  ITabContainerRef,
} from '@onekeyhq/components';
import {
  Tabs,
  XStack,
  YStack,
  useTabContainerWidth,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IBorrowReserveDetail } from '@onekeyhq/shared/types/staking';

import {
  APY_CHART_COLORS,
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
import type { TabBarProps } from 'react-native-collapsible-tab-view';

interface IReserveDetailsTabsProps {
  networkId: string;
  provider: string;
  marketAddress: string;
  reserveAddress: string;
  details?: IBorrowReserveDetail;
  containerProps?: ITabContainerProps;
}

const ReserveDetailsTabsComponent = ({
  networkId,
  provider,
  marketAddress,
  reserveAddress,
  details,
  containerProps,
}: IReserveDetailsTabsProps) => {
  const intl = useIntl();
  const tabsRef = useRef<ITabContainerRef>(null);
  const [supplyTimePeriod, setSupplyTimePeriod] = useState<ITimePeriod>('week');
  const [borrowTimePeriod, setBorrowTimePeriod] = useState<ITimePeriod>('week');

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

  const renderTabBar = useCallback((tabBarProps: TabBarProps<string>) => {
    const handleTabPress = (name: string) => {
      tabBarProps.onTabPress?.(name);
    };
    return <Tabs.TabBar {...tabBarProps} onTabPress={handleTabPress} />;
  }, []);

  const tabContainerWidth = useTabContainerWidth();

  const tabsContainerProps: ITabContainerProps & { ref: typeof tabsRef } = {
    width: platformEnv.isNative ? (tabContainerWidth as number) : undefined,
    ref: tabsRef,
    renderTabBar,
    initialTabName: tabNames.supply,
    ...containerProps,
  };

  return (
    <Tabs.Container
      {...(tabsContainerProps as Parameters<typeof Tabs.Container>[0])}
    >
      {/* Supply Info Tab */}
      <Tabs.Tab name={tabNames.supply}>
        <Tabs.ScrollView>
          <YStack px="$5" pt="$6" pb="$6" gap="$6">
            {supplyBadge ? <XStack>{supplyBadge}</XStack> : null}

            <ApyChartSection
              apyValue={supplyData.latestApy}
              apyLabel={supplyApyLabel}
              history={supplyData.history}
              isLoading={supplyData.isLoading ?? false}
              timePeriod={supplyTimePeriod}
              timePeriodOptions={timePeriodOptions}
              onTimePeriodChange={setSupplyTimePeriod}
              lineColor={APY_CHART_COLORS.supply.line}
              topColor={APY_CHART_COLORS.supply.top}
              bottomColor={APY_CHART_COLORS.supply.bottom}
              lineWidth={APY_CHART_COLORS.lineWidth}
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
        </Tabs.ScrollView>
      </Tabs.Tab>

      {/* Borrow Info Tab */}
      <Tabs.Tab name={tabNames.borrow}>
        <Tabs.ScrollView>
          <YStack px="$5" pt="$6" pb="$6" gap="$6">
            {borrowBadge ? <XStack>{borrowBadge}</XStack> : null}

            <ApyChartSection
              apyValue={borrowData.latestApy}
              apyLabel={borrowApyLabel}
              history={borrowData.history}
              isLoading={borrowData.isLoading ?? false}
              timePeriod={borrowTimePeriod}
              timePeriodOptions={timePeriodOptions}
              onTimePeriodChange={setBorrowTimePeriod}
              lineColor={APY_CHART_COLORS.borrow.line}
              topColor={APY_CHART_COLORS.borrow.top}
              bottomColor={APY_CHART_COLORS.borrow.bottom}
              lineWidth={APY_CHART_COLORS.lineWidth}
              showDivider={false}
              capUsage={details?.borrow.usage}
              capUsageLabel={intl.formatMessage({
                id: ETranslations.defi_borrow_cap_usage,
              })}
              tooltipLabel={borrowApyLabel}
            />
          </YStack>
        </Tabs.ScrollView>
      </Tabs.Tab>

      {/* More Tab */}
      <Tabs.Tab name={tabNames.more}>
        <Tabs.ScrollView>
          <YStack px="$5" pt="$6" pb="$6" gap="$8">
            <InterestRateModelSection
              networkId={networkId}
              provider={provider}
              marketAddress={marketAddress}
              reserveAddress={reserveAddress}
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
        </Tabs.ScrollView>
      </Tabs.Tab>
    </Tabs.Container>
  );
};

export const ReserveDetailsTabs = memo(ReserveDetailsTabsComponent);
