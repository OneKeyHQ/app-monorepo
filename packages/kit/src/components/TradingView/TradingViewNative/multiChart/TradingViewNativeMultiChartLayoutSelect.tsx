import { memo, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Popover,
  Stack,
  XStack,
  usePopoverContext,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { TRADING_VIEW_NATIVE_MULTI_CHART_PRESETS } from '@onekeyhq/shared/types/tradingViewNative';
import type { ITradingViewNativeMultiChartPreset } from '@onekeyhq/shared/types/tradingViewNative';

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

function LayoutOptions({
  onChange,
  preset,
  title,
}: {
  onChange: (preset: ITradingViewNativeMultiChartPreset) => void;
  preset: ITradingViewNativeMultiChartPreset;
  title: string;
}) {
  const { closePopover } = usePopoverContext();
  return (
    <XStack p="$2" gap="$1" testID="trading-view-multi-chart-layout-options">
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
  );
}

export const TradingViewNativeMultiChartLayoutSelect = memo(
  ({
    onChange,
    preset,
  }: {
    onChange: (preset: ITradingViewNativeMultiChartPreset) => void;
    preset: ITradingViewNativeMultiChartPreset;
  }) => {
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
          <LayoutOptions preset={preset} title={title} onChange={onChange} />
        }
      />
    );
  },
);

TradingViewNativeMultiChartLayoutSelect.displayName =
  'TradingViewNativeMultiChartLayoutSelect';
