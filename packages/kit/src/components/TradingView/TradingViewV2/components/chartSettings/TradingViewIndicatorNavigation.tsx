import { useState } from 'react';

import {
  Icon,
  ScrollView,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';

import {
  OKX_CHART_BG,
  OKX_CHART_DIVIDER,
  OKX_CHART_SIDE_ACTIVE_BG,
  OKX_CHART_TEXT,
  OKX_CHART_TEXT_SUBDUED,
  OkxChartCheckbox,
} from './TradingViewSettingsShared';

import type {
  ITradingViewSettingsMockIndicator,
  ITradingViewSettingsMockIndicatorScope,
} from './TradingViewSettingsMockState';

const OKX_INDICATOR_TABS_HEIGHT = 41;
const OKX_INDICATOR_BODY_HEIGHT = 418;
const OKX_INDICATOR_SIDEBAR_WIDTH = 184;
const OKX_INDICATOR_SIDEBAR_ROW_PADDING_X = 16;
const OKX_INDICATOR_SIDEBAR_LABEL_WIDTH = 86;

export function OkxIndicatorScopeTabs({
  value,
  indicators,
  maxActiveSubIndicators,
  onChange,
}: {
  value: ITradingViewSettingsMockIndicatorScope;
  indicators: ITradingViewSettingsMockIndicator[];
  maxActiveSubIndicators: number;
  onChange: (value: ITradingViewSettingsMockIndicatorScope) => void;
}) {
  const activeSubIndicatorCount = indicators.filter(
    (indicator) => indicator.scope === 'sub' && indicator.active,
  ).length;
  const tabs = [
    { label: '主图指标', value: 'main' as const },
    {
      label: `副图指标 (${Math.min(
        activeSubIndicatorCount,
        maxActiveSubIndicators,
      )}/${maxActiveSubIndicators})`,
      value: 'sub' as const,
    },
  ];

  return (
    <XStack
      h={OKX_INDICATOR_TABS_HEIGHT}
      px={24}
      gap={24}
      alignItems="flex-end"
      borderBottomWidth={1}
      borderBottomColor={OKX_CHART_DIVIDER}
      bg={OKX_CHART_BG}
    >
      {tabs.map((tab) => {
        const selected = value === tab.value;
        return (
          <YStack
            key={tab.value}
            h={OKX_INDICATOR_TABS_HEIGHT}
            justifyContent="center"
            cursor="pointer"
            onPress={() => onChange(tab.value)}
          >
            <SizableText
              fontSize={14}
              lineHeight={18}
              fontWeight={selected ? '700' : '400'}
              color={selected ? OKX_CHART_TEXT : OKX_CHART_TEXT_SUBDUED}
            >
              {tab.label}
            </SizableText>
            <Stack
              position="absolute"
              left={0}
              right={0}
              bottom={0}
              h={2}
              bg={selected ? '$text' : 'transparent'}
            />
          </YStack>
        );
      })}
    </XStack>
  );
}

export function OkxIndicatorSidebar({
  indicators,
  selectedIndicatorId,
  onSelect,
  onToggle,
}: {
  indicators: ITradingViewSettingsMockIndicator[];
  selectedIndicatorId: string;
  onSelect: (indicatorId: string) => void;
  onToggle: (indicatorId: string, active: boolean) => void;
}) {
  const [scrollMetrics, setScrollMetrics] = useState({
    contentHeight: OKX_INDICATOR_BODY_HEIGHT,
    viewportHeight: OKX_INDICATOR_BODY_HEIGHT,
    scrollY: 0,
  });
  const hasScrollableContent =
    scrollMetrics.contentHeight > scrollMetrics.viewportHeight;
  const scrollbarThumbHeight = hasScrollableContent
    ? Math.max(
        34,
        (scrollMetrics.viewportHeight / scrollMetrics.contentHeight) *
          scrollMetrics.viewportHeight,
      )
    : 0;
  const scrollbarThumbTop = hasScrollableContent
    ? Math.min(
        scrollMetrics.viewportHeight - scrollbarThumbHeight,
        (scrollMetrics.scrollY /
          (scrollMetrics.contentHeight - scrollMetrics.viewportHeight)) *
          (scrollMetrics.viewportHeight - scrollbarThumbHeight),
      )
    : 0;

  return (
    <Stack
      w={OKX_INDICATOR_SIDEBAR_WIDTH}
      h={OKX_INDICATOR_BODY_HEIGHT}
      position="relative"
      overflow="hidden"
    >
      <ScrollView
        w={OKX_INDICATOR_SIDEBAR_WIDTH}
        h={OKX_INDICATOR_BODY_HEIGHT}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onContentSizeChange={(_, contentHeight) =>
          setScrollMetrics((current) => ({ ...current, contentHeight }))
        }
        onLayout={(event) =>
          setScrollMetrics((current) => ({
            ...current,
            viewportHeight: event.nativeEvent.layout.height,
          }))
        }
        onScroll={(event) =>
          setScrollMetrics((current) => ({
            ...current,
            scrollY: event.nativeEvent.contentOffset.y,
          }))
        }
      >
        <YStack pt={15} pb={24} bg={OKX_CHART_BG}>
          {indicators.map((indicator, index) => {
            const selected = indicator.id === selectedIndicatorId;
            const previousIndicator = indicators[index - 1];
            const showGroupLabel =
              indicator.groupLabel &&
              indicator.groupLabel !== previousIndicator?.groupLabel;
            return (
              <YStack key={indicator.id} w="100%">
                {showGroupLabel ? (
                  <SizableText
                    mt={index === 0 ? 0 : 19}
                    mb={12}
                    px={OKX_INDICATOR_SIDEBAR_ROW_PADDING_X}
                    fontSize={12}
                    lineHeight={14}
                    color={OKX_CHART_TEXT_SUBDUED}
                  >
                    {indicator.groupLabel}
                  </SizableText>
                ) : null}
                <XStack
                  testID={`trading-view-indicator-sidebar-${indicator.id}`}
                  w="100%"
                  h={41}
                  px={OKX_INDICATOR_SIDEBAR_ROW_PADDING_X}
                  gap={8}
                  alignItems="center"
                  bg={selected ? OKX_CHART_SIDE_ACTIVE_BG : OKX_CHART_BG}
                  hoverStyle={{
                    bg: selected ? OKX_CHART_SIDE_ACTIVE_BG : '$bgHover',
                  }}
                  cursor="pointer"
                  onPress={() => onSelect(indicator.id)}
                >
                  <OkxChartCheckbox
                    checked={indicator.active}
                    onChange={(checked) => onToggle(indicator.id, checked)}
                  />
                  <Stack
                    w={OKX_INDICATOR_SIDEBAR_LABEL_WIDTH}
                    maxWidth={OKX_INDICATOR_SIDEBAR_LABEL_WIDTH}
                    flexShrink={0}
                    overflow="hidden"
                  >
                    <SizableText
                      fontSize={14}
                      lineHeight={18}
                      color={OKX_CHART_TEXT}
                      numberOfLines={1}
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {indicator.label}
                    </SizableText>
                  </Stack>
                  <Icon
                    name="ChevronRightSmallOutline"
                    size="$4"
                    color="$icon"
                    flexShrink={0}
                  />
                </XStack>
              </YStack>
            );
          })}
        </YStack>
      </ScrollView>
      {hasScrollableContent ? (
        <Stack
          position="absolute"
          top={scrollbarThumbTop}
          right={1}
          w={3}
          h={scrollbarThumbHeight}
          borderRadius={2}
          bg="$iconSubdued"
          pointerEvents="none"
        />
      ) : null}
    </Stack>
  );
}
