import { memo, useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Checkbox,
  SegmentControl,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import {
  ANIMATE_ONLY_OPACITY,
  ANIMATE_ONLY_OPACITY_TRANSFORM,
} from '@onekeyhq/components/src/utils/animationConstants';
import {
  APY_PRICE_SCALE_MARGINS,
  LightweightChart,
} from '@onekeyhq/kit/src/components/LightweightChart';
import { useDeviceTimeZone } from '@onekeyhq/kit/src/hooks/useDeviceTimeZone';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { buildChartHistory, getLatestTimestamp } from './ApyChart.utils';

import type {
  IApyChartHistoryItem,
  IApyChartTimePeriod,
} from './ApyChart.utils';
import type { UTCTimestamp } from 'lightweight-charts';

interface IApyChartProps {
  apyHistory?: IApyChartHistoryItem[] | null;
  underlyingApyHistory?: IApyChartHistoryItem[] | null;
  showChartControls?: boolean;
  showUnderlyingApyToggle?: boolean;
  primaryApyLabel?: string;
  secondaryApyLabel?: string;
  /** The phone layout puts the range selector under the chart and
   * left-aligned, per the design. Wide layouts keep it above and right-aligned,
   * so Pendle's desktop page is unchanged. */
  controlsPlacement?: 'top' | 'bottom';
  /** Hex for the second line. Pendle's underlying APY keeps the default blue;
   * the campaign line is orange. Literal hex because the chart library takes
   * colors, not theme tokens — same as the two lines already here. */
  secondaryLineColor?: string;
}

const APY_CHART_HEIGHT = 200;

const ApyChartComponent = ({
  apyHistory,
  underlyingApyHistory,
  showChartControls,
  showUnderlyingApyToggle,
  primaryApyLabel,
  secondaryApyLabel,
  secondaryLineColor = '#0177E5',
  controlsPlacement = 'top',
}: IApyChartProps) => {
  const intl = useIntl();
  const timeZone = useDeviceTimeZone();

  const resolvedPrimaryLabel =
    primaryApyLabel || intl.formatMessage({ id: ETranslations.global_apy });
  const resolvedSecondaryLabel =
    secondaryApyLabel || intl.formatMessage({ id: ETranslations.global_apy });

  const [timePeriod, setTimePeriod] = useState<IApyChartTimePeriod>(
    showChartControls ? '1h' : 'max',
  );
  const [showUnderlyingApy, setShowUnderlyingApy] = useState(false);

  // Hover state for popover
  const [hoverData, setHoverData] = useState<{
    time: number;
    apy: number;
    secondaryApy?: number;
    x: number;
    y: number;
  } | null>(null);

  const [containerWidth, setContainerWidth] = useState<number>(0);

  useEffect(() => {
    if (!showUnderlyingApyToggle) {
      setShowUnderlyingApy(false);
    }
  }, [showUnderlyingApyToggle]);

  const handleHover = useCallback(
    ({
      time,
      price,
      secondaryPrice,
      x,
      y,
    }: {
      time?: number;
      price?: number;
      secondaryPrice?: number;
      x?: number;
      y?: number;
    }) => {
      if (time && price && x !== undefined && y !== undefined) {
        setHoverData({
          time,
          apy: price,
          secondaryApy: secondaryPrice,
          x,
          y,
        });
      } else {
        setHoverData(null);
      }
    },
    [],
  );

  // Calculate popover position - switch side at midpoint
  const popoverPosition = useMemo(() => {
    if (!hoverData || !containerWidth) return null;

    const POPOVER_WIDTH = 144;
    const OFFSET = 10;
    const EDGE_PADDING = 16;
    const isLeftHalf = hoverData.x < containerWidth / 2;

    const translateXValue = isLeftHalf ? 0 : -POPOVER_WIDTH;
    const desiredLeft = isLeftHalf
      ? hoverData.x + OFFSET
      : hoverData.x - OFFSET;
    const minLeft = EDGE_PADDING;
    const maxLeft = Math.max(
      minLeft,
      containerWidth - POPOVER_WIDTH - EDGE_PADDING,
    );
    const actualLeft = desiredLeft + translateXValue;
    const clampedActualLeft = Math.min(Math.max(actualLeft, minLeft), maxLeft);

    return {
      left: clampedActualLeft - translateXValue,
      translateXValue,
      top: Math.max(10, hoverData.y - 70),
    };
  }, [hoverData, containerWidth]);

  const formatPopoverDate = useCallback(
    (timestamp: number) => {
      const date = new Date(timestamp * 1000);
      const dateString = intl.formatDate(date, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      const timeString = intl.formatTime(date, {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      return `${dateString} ${timeString}`;
    },
    [intl],
  );

  const filteredApyHistory = useMemo(
    () => buildChartHistory(apyHistory, timePeriod),
    [apyHistory, timePeriod],
  );

  // The second line is cut from the primary line's newest point so both lines
  // cover the same days; see buildChartHistory.
  const primaryLatestTimestamp = useMemo(
    () => getLatestTimestamp(apyHistory),
    [apyHistory],
  );

  const filteredUnderlyingApyHistory = useMemo(
    () =>
      buildChartHistory(
        underlyingApyHistory,
        timePeriod,
        primaryLatestTimestamp,
      ),
    [underlyingApyHistory, timePeriod, primaryLatestTimestamp],
  );

  const chartData = useMemo(() => {
    if (!filteredApyHistory.length) {
      return null;
    }

    const marketChartData: [UTCTimestamp, number][] = filteredApyHistory.map(
      (item) => [Math.floor(item.timestamp / 1000) as UTCTimestamp, item.apy],
    );

    const secondaryLineData: [UTCTimestamp, number][] =
      filteredUnderlyingApyHistory.map((item) => [
        Math.floor(item.timestamp / 1000) as UTCTimestamp,
        item.apy,
      ]);

    return {
      marketChartData,
      secondaryLineData,
    };
  }, [filteredApyHistory, filteredUnderlyingApyHistory]);

  // Pendle puts the second line behind a checkbox; every other provider draws
  // it whenever the server sent one, so the campaign / reward line needs no
  // extra interaction.
  const hasSecondaryData = Boolean(chartData?.secondaryLineData.length);
  const isSecondaryVisible = showUnderlyingApyToggle
    ? showUnderlyingApy && hasSecondaryData
    : hasSecondaryData;

  const isLoading = apyHistory === undefined;

  const timePeriodOptions = useMemo(
    () => [
      {
        label: intl.formatMessage({ id: ETranslations.market_1h }),
        value: '1h' as IApyChartTimePeriod,
      },
      {
        label: intl.formatMessage({ id: ETranslations.market_1d }),
        value: '1d' as IApyChartTimePeriod,
      },
      {
        label: intl.formatMessage({ id: ETranslations.market_1w }),
        value: '1w' as IApyChartTimePeriod,
      },
      {
        label: intl.formatMessage({ id: ETranslations.dexmarket_max }),
        value: 'max' as IApyChartTimePeriod,
      },
    ],
    [intl],
  );

  const isControlsAtBottom = controlsPlacement === 'bottom';
  const controls = showChartControls ? (
    <YStack gap="$2">
      <XStack ai="center" gap="$3" minHeight={44}>
        {isControlsAtBottom ? null : <XStack flex={1} />}

        <SegmentControl
          // Bottom placement spans the chart width with evenly sized segments,
          // the way the design spaces them; the wide layout keeps the compact
          // content-sized control it ships today.
          fullWidth={isControlsAtBottom}
          value={timePeriod}
          options={timePeriodOptions}
          onChange={(nextValue) =>
            setTimePeriod(nextValue as IApyChartTimePeriod)
          }
          slotBackgroundColor="$bg"
          activeBackgroundColor="$bgActive"
          activeTextColor="$text"
        />
      </XStack>

      {showUnderlyingApyToggle ? (
        <Checkbox
          testID="earn-checkbox"
          value={showUnderlyingApy}
          onChange={(value) => setShowUnderlyingApy(Boolean(value))}
          label={intl.formatMessage({
            id: ETranslations.defi_show_underlying_apy,
          })}
          containerProps={{
            ai: 'center',
          }}
          labelContainerProps={{
            py: '$0',
            my: '$0',
            justifyContent: 'center',
          }}
          labelProps={{
            variant: '$bodyMd',
          }}
        />
      ) : null}
    </YStack>
  ) : null;

  return (
    <YStack gap="$2">
      {isControlsAtBottom ? null : controls}

      {isLoading && !chartData ? (
        <Stack
          height={APY_CHART_HEIGHT}
          position="relative"
          overflow="hidden"
          transition="quick"
          animateOnly={ANIMATE_ONLY_OPACITY}
          enterStyle={{ opacity: 0 }}
        >
          <Skeleton w="100%" h="100%" borderRadius="$2" />
          <Stack
            position="absolute"
            bottom={0}
            left={0}
            right={0}
            height="60%"
            opacity={0.3}
          >
            <Skeleton w="100%" h="100%" borderRadius="$2" />
          </Stack>
        </Stack>
      ) : null}

      {chartData && !isLoading ? (
        <YStack
          position="relative"
          transition="quick"
          animateOnly={ANIMATE_ONLY_OPACITY_TRANSFORM}
          enterStyle={{ opacity: 0, scale: 0.98 }}
          exitStyle={{ opacity: 0, scale: 0.98 }}
          onLayout={(e) => {
            const width = e.nativeEvent.layout.width;
            if (width !== containerWidth) {
              setContainerWidth(width);
            }
          }}
        >
          {hoverData && popoverPosition ? (
            <YStack
              position="absolute"
              top={popoverPosition.top}
              left={popoverPosition.left}
              transform={[{ translateX: popoverPosition.translateXValue }]}
              bg="$bg"
              borderRadius="$2"
              borderWidth={1}
              borderColor="$borderSubdued"
              px="$3"
              py="$2"
              shadowColor="$shadowDefault"
              shadowOffset={{ width: 0, height: 2 }}
              shadowOpacity={0.1}
              shadowRadius={8}
              zIndex={9999}
              pointerEvents="none"
              width={144}
              overflow="hidden"
            >
              <YStack gap="$2" width="100%">
                <SizableText
                  size="$bodySm"
                  color="$textSubdued"
                  numberOfLines={1}
                >
                  {formatPopoverDate(hoverData.time)}
                </SizableText>
                <XStack jc="space-between" ai="center" width="100%">
                  <SizableText size="$bodySmMedium" color="$textSubdued">
                    {resolvedPrimaryLabel}
                  </SizableText>
                  <SizableText size="$bodySmMedium" color="$text">
                    {hoverData.apy.toFixed(2)}%
                  </SizableText>
                </XStack>
                {isSecondaryVisible && hoverData.secondaryApy !== undefined ? (
                  <XStack jc="space-between" ai="center" width="100%">
                    <SizableText size="$bodySmMedium" color="$textSubdued">
                      {resolvedSecondaryLabel}
                    </SizableText>
                    <SizableText size="$bodySmMedium" color="$text">
                      {hoverData.secondaryApy.toFixed(2)}%
                    </SizableText>
                  </XStack>
                ) : null}
              </YStack>
            </YStack>
          ) : null}

          <LightweightChart
            data={chartData.marketChartData}
            secondaryLineData={
              isSecondaryVisible ? chartData.secondaryLineData : undefined
            }
            secondaryLineColor={secondaryLineColor}
            secondaryLineWidth={2}
            height={APY_CHART_HEIGHT}
            onHover={handleHover}
            lineColor="#008347D6"
            topColor="#00834726"
            bottomColor="#00834700"
            lineWidth={2}
            showPriceScale
            priceScaleEntireTextOnly
            priceScaleMargins={APY_PRICE_SCALE_MARGINS}
            showHorzGridLines
            // The wrapper only localizes the time axis when both are given;
            // otherwise lightweight-charts labels it in the system language,
            // not the app language (OK-63219).
            timeZone={timeZone}
            locale={intl.locale}
          />
        </YStack>
      ) : null}

      {isControlsAtBottom ? controls : null}
    </YStack>
  );
};

export const ApyChart = memo(ApyChartComponent);
