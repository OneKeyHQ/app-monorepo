import { memo, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Divider,
  ESwitchSize,
  Popover,
  SizableText,
  Stack,
  Switch,
  XStack,
  YStack,
  usePopoverContext,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  TRADING_VIEW_NATIVE_MULTI_CHART_PRESETS,
  TRADING_VIEW_NATIVE_MULTI_CHART_SYNC_OPTIONS,
} from '@onekeyhq/shared/types/tradingViewNative';
import type {
  ITradingViewNativeMultiChartPreset,
  ITradingViewNativeMultiChartSyncOption,
} from '@onekeyhq/shared/types/tradingViewNative';

import { getTradingViewNativeMultiChartEqualRects } from './multiChartLayout';

const GLYPH_WIDTH = 18;
const GLYPH_HEIGHT = 14;
const GLYPH_GAP = 2;
const EDGE_EPSILON = 1e-6;

// Drawn from the preset's own cells, so a new preset needs no icon asset.
function LayoutGlyph({
  color,
  preset,
}: {
  color: '$icon' | '$iconSubdued';
  preset: ITradingViewNativeMultiChartPreset;
}) {
  const rects = useMemo(
    () => getTradingViewNativeMultiChartEqualRects(preset),
    [preset],
  );
  return (
    <Stack width={GLYPH_WIDTH} height={GLYPH_HEIGHT} position="relative">
      {rects.map((rect, index) => {
        const right = rect.left + rect.width;
        const bottom = rect.top + rect.height;
        const left =
          rect.left * GLYPH_WIDTH +
          (rect.left > EDGE_EPSILON ? GLYPH_GAP / 2 : 0);
        const top =
          rect.top * GLYPH_HEIGHT +
          (rect.top > EDGE_EPSILON ? GLYPH_GAP / 2 : 0);
        return (
          <Stack
            // The cells of a preset never reorder.
            // eslint-disable-next-line react/no-array-index-key
            key={index}
            position="absolute"
            left={left}
            top={top}
            width={
              right * GLYPH_WIDTH -
              (right < 1 - EDGE_EPSILON ? GLYPH_GAP / 2 : 0) -
              left
            }
            height={
              bottom * GLYPH_HEIGHT -
              (bottom < 1 - EDGE_EPSILON ? GLYPH_GAP / 2 : 0) -
              top
            }
            borderWidth={1.5}
            borderColor={color}
            borderRadius={2}
          />
        );
      })}
    </Stack>
  );
}

const SYNC_OPTION_LABELS: Record<
  ITradingViewNativeMultiChartSyncOption,
  ETranslations
> = {
  symbol: ETranslations.global_asset,
  interval: ETranslations.market_intervals,
  crosshair: ETranslations.market_chart_settings__crosshair,
  time: ETranslations.global_time,
  dateRange: ETranslations.export_history_date_range__title,
};

interface ILayoutSelectProps {
  onChange: (preset: ITradingViewNativeMultiChartPreset) => void;
  preset: ITradingViewNativeMultiChartPreset;
  sync: Record<ITradingViewNativeMultiChartSyncOption, boolean>;
  onSyncChange: (
    option: ITradingViewNativeMultiChartSyncOption,
    isSynced: boolean,
  ) => void;
}

function LayoutOptions({
  onChange,
  onSyncChange,
  preset,
  sync,
  title,
}: ILayoutSelectProps & { title: string }) {
  const intl = useIntl();
  const { closePopover } = usePopoverContext();
  return (
    <YStack p="$2" gap="$2">
      <XStack gap="$1" testID="trading-view-multi-chart-layout-options">
        {TRADING_VIEW_NATIVE_MULTI_CHART_PRESETS.map((item) => {
          const isActive = item === preset;
          return (
            <Stack
              key={item}
              testID={`trading-view-multi-chart-layout-${item}`}
              role="button"
              aria-label={`${title} ${item}`}
              aria-pressed={isActive}
              width={40}
              height={36}
              alignItems="center"
              justifyContent="center"
              borderRadius="$2"
              bg={isActive ? '$bgActive' : '$transparent'}
              hoverStyle={{ bg: isActive ? '$bgActive' : '$bgHover' }}
              pressStyle={{ bg: '$bgActive' }}
              cursor="pointer"
              userSelect="none"
              onPress={() => {
                if (!isActive) onChange(item);
                void closePopover?.();
              }}
            >
              <LayoutGlyph
                preset={item}
                color={isActive ? '$icon' : '$iconSubdued'}
              />
            </Stack>
          );
        })}
      </XStack>
      <Divider />
      <YStack
        px="$1"
        pb="$1"
        gap="$2"
        testID="trading-view-multi-chart-sync-options"
      >
        <SizableText size="$bodySm" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.global_synced })}
        </SizableText>
        {TRADING_VIEW_NATIVE_MULTI_CHART_SYNC_OPTIONS.map((option) => {
          const label = intl.formatMessage({ id: SYNC_OPTION_LABELS[option] });
          return (
            <XStack
              key={option}
              gap="$3"
              alignItems="center"
              justifyContent="space-between"
            >
              <SizableText size="$bodyMd" flexShrink={1}>
                {label}
              </SizableText>
              <Switch
                testID={`trading-view-multi-chart-sync-${option}`}
                accessibilityLabel={label}
                size={ESwitchSize.small}
                value={sync[option]}
                onChange={(checked) => onSyncChange(option, Boolean(checked))}
              />
            </XStack>
          );
        })}
      </YStack>
    </YStack>
  );
}

export const TradingViewNativeMultiChartLayoutSelect = memo(
  ({ onChange, onSyncChange, preset, sync }: ILayoutSelectProps) => {
    const intl = useIntl();
    const title = intl.formatMessage({
      id: ETranslations.perps_layout_settings__title,
    });
    return (
      <Popover
        title={title}
        showHeader={false}
        placement="bottom-end"
        floatingPanelProps={{ width: 'auto' }}
        renderTrigger={
          <Stack
            testID="trading-view-multi-chart-layout-trigger"
            role="button"
            aria-label={title}
            width={28}
            height={28}
            flexShrink={0}
            alignItems="center"
            justifyContent="center"
            borderRadius="$2"
            hoverStyle={{ bg: '$bgHover' }}
            cursor="pointer"
            userSelect="none"
          >
            <LayoutGlyph preset={preset} color="$iconSubdued" />
          </Stack>
        }
        renderContent={
          <LayoutOptions
            preset={preset}
            title={title}
            onChange={onChange}
            sync={sync}
            onSyncChange={onSyncChange}
          />
        }
      />
    );
  },
);

TradingViewNativeMultiChartLayoutSelect.displayName =
  'TradingViewNativeMultiChartLayoutSelect';
