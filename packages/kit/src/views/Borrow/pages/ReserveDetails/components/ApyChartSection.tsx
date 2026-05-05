import { memo } from 'react';

import { useIntl } from 'react-intl';

import { SizableText, XStack, YStack, useMedia } from '@onekeyhq/components';
import { ApyChartBase } from '@onekeyhq/kit/src/views/Staking/components/ApyChartBase';
import { GridItem } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/GridItemV2';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  IApyHistoryItem,
  IBorrowReserveDetail,
  IEarnText,
  IEarnTooltip,
} from '@onekeyhq/shared/types/staking';

import { CapUsageChart } from '../../../components/CapUsageChart';

import { ApyChartTimePeriodSelector } from './ApyChartTimePeriodSelector';

import type { ITimePeriod } from '../hooks/useBorrowChartData';

interface IApyChartSectionProps {
  // APY data
  apyValue: string;
  apyLabel: string;
  history: IApyHistoryItem[];
  isLoading: boolean;

  // Time period selector
  timePeriod: ITimePeriod;
  timePeriodOptions: Array<{ label: string; value: ITimePeriod }>;
  onTimePeriodChange: (period: ITimePeriod) => void;

  // Chart styling
  lineColor: string;
  topColor: string;
  bottomColor: string;
  lineWidth?: number;
  showDivider?: boolean;

  // Optional: Cap usage
  capUsage?: IBorrowReserveDetail['supply']['usage'];
  capUsageLabel?: string;

  // Optional: Supply metrics (only for supply tab)
  metrics?: {
    maxLtv?: { text: IEarnText; tooltip?: IEarnTooltip };
    liquidationLtv?: { text: IEarnText; tooltip?: IEarnTooltip };
    softLiquidation?: { text: IEarnText; tooltip?: IEarnTooltip };
  };

  // Optional: Tooltip label for hover
  tooltipLabel?: string;
}

function ApyChartSectionComponent({
  apyValue,
  apyLabel,
  history,
  isLoading,
  timePeriod,
  timePeriodOptions,
  onTimePeriodChange,
  lineColor,
  topColor,
  bottomColor,
  lineWidth = 2,
  showDivider = true,
  capUsage,
  capUsageLabel,
  metrics,
  tooltipLabel,
}: IApyChartSectionProps) {
  const intl = useIntl();
  const media = useMedia();

  return (
    <YStack gap="$6">
      {/* Cap Usage Chart */}
      {capUsage ? (
        <CapUsageChart
          percentage={capUsage.percentage}
          label={capUsageLabel ?? ''}
          title={capUsage.title}
          description={capUsage.description}
          tooltip={capUsage.tooltip}
        />
      ) : null}

      {/* APY Chart */}
      <YStack gap="$3">
        <XStack jc="space-between" ai="center">
          <SizableText size="$headingXl">
            {Number(apyValue).toFixed(2)}% {apyLabel}
          </SizableText>
          {media.gtSm ? (
            <ApyChartTimePeriodSelector
              value={timePeriod}
              options={timePeriodOptions}
              onChange={(value) => onTimePeriodChange(value)}
            />
          ) : null}
        </XStack>
        <ApyChartBase
          data={history}
          isLoading={isLoading}
          lineColor={lineColor}
          topColor={topColor}
          bottomColor={bottomColor}
          lineWidth={lineWidth}
          showHorzGridLines
          showPriceScale
          showDivider={showDivider}
          tooltipLabel={tooltipLabel}
        />
        {!media.gtSm ? (
          <ApyChartTimePeriodSelector
            value={timePeriod}
            options={timePeriodOptions}
            onChange={(value) => onTimePeriodChange(value)}
            fullWidth
            jc="space-between"
            flex={1}
            mt="$5"
          />
        ) : null}

        {/* Supply Metrics (optional) */}
        {metrics ? (
          <XStack flexWrap="wrap" mt="$6">
            {metrics.maxLtv ? (
              <GridItem
                title={{
                  text: intl.formatMessage({
                    id: ETranslations.defi_max_ltv,
                  }),
                }}
                description={metrics.maxLtv.text}
                tooltip={metrics.maxLtv.tooltip}
              />
            ) : null}
            {metrics.liquidationLtv ? (
              <GridItem
                title={{
                  text: intl.formatMessage({
                    id: ETranslations.defi_liquidation_ltv,
                  }),
                }}
                description={metrics.liquidationLtv.text}
                tooltip={metrics.liquidationLtv.tooltip}
              />
            ) : null}
            {metrics.softLiquidation ? (
              <GridItem
                title={{
                  text: intl.formatMessage({
                    id: ETranslations.defi_soft_liquidations,
                  }),
                }}
                description={metrics.softLiquidation.text}
                tooltip={metrics.softLiquidation.tooltip}
              />
            ) : null}
          </XStack>
        ) : null}
      </YStack>
    </YStack>
  );
}

export const ApyChartSection = memo(ApyChartSectionComponent);
