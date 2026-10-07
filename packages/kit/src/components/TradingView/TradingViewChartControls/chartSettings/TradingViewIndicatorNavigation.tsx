import { useIntl } from 'react-intl';

import {
  Checkbox,
  Icon,
  ScrollView,
  SizableText,
  Tabs,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import type {
  ITradingViewSettingsMockIndicator,
  ITradingViewSettingsMockIndicatorScope,
} from './TradingViewSettingsMockState';

export function TradingViewIndicatorScopeTabs({
  value,
  indicators,
  maxActiveSubIndicatorCount,
  onChange,
}: {
  value: ITradingViewSettingsMockIndicatorScope;
  indicators: ITradingViewSettingsMockIndicator[];
  maxActiveSubIndicatorCount: number | null;
  onChange: (value: ITradingViewSettingsMockIndicatorScope) => void;
}) {
  const intl = useIntl();
  const activeSubIndicatorCount = indicators.filter(
    (indicator) => indicator.scope === 'sub' && indicator.active,
  ).length;
  const subIndicatorCountLabel =
    maxActiveSubIndicatorCount === null
      ? `${activeSubIndicatorCount}`
      : `${activeSubIndicatorCount}/${maxActiveSubIndicatorCount}`;
  const tabs = [
    {
      label: intl.formatMessage({
        id: ETranslations.market_main_chart_indicators,
      }),
      value: 'main' as const,
    },
    {
      label: `${intl.formatMessage({
        id: ETranslations.market_sub_chart_indicators,
      })} (${subIndicatorCountLabel})`,
      value: 'sub' as const,
    },
  ];

  return (
    // Figma 26652:31723: underline tabs with no rule below the row.
    <XStack
      testID="trading-view-indicator-scope-tabs"
      flexShrink={0}
      px="$5"
      gap="$5"
      mb="$2"
    >
      {tabs.map((tab, index) => (
        <Tabs.TabBarItem
          key={tab.value}
          testID={`trading-view-indicator-scope-${tab.value}`}
          name={tab.value}
          label={tab.label}
          index={index}
          isFocused={value === tab.value}
          textSize="$bodyMdMedium"
          // Drop the item's page-padding offset (the row sets its own inset) and
          // keep the arrow cursor and unselectable label the full TabBar
          // container gives its items.
          tabItemStyle={{ ml: '$0', cursor: 'default', userSelect: 'none' }}
          onPress={() => onChange(tab.value)}
        />
      ))}
    </XStack>
  );
}

export function TradingViewIndicatorSidebar({
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
  return (
    <ScrollView
      testID="trading-view-indicator-sidebar"
      flex={1}
      minHeight={0}
      contentContainerStyle={{ px: '$3', py: '$4', gap: '$1' }}
    >
      {indicators.map((indicator, index) => {
        const selected = indicator.id === selectedIndicatorId;
        const previousIndicator = indicators[index - 1];
        const showGroupLabel =
          indicator.groupLabel &&
          indicator.groupLabel !== previousIndicator?.groupLabel;
        return (
          <YStack key={indicator.id} gap="$1">
            {showGroupLabel ? (
              <SizableText
                px="$2"
                pt={index === 0 ? '$0' : '$3'}
                pb="$1"
                size="$bodySm"
                color="$textSubdued"
              >
                {indicator.groupLabel}
              </SizableText>
            ) : null}
            {/* Mirrors DesktopTabItem, which the chart settings navigation
                column is built from, with the checkbox in the icon slot. */}
            <XStack
              testID={`trading-view-indicator-sidebar-${indicator.id}`}
              px="$2"
              py="$2"
              gap="$2"
              alignItems="center"
              borderRadius="$2"
              bg={selected ? '$bgActive' : undefined}
              hoverStyle={{ bg: selected ? '$bgActive' : '$bgHover' }}
              pressStyle={{ bg: '$bgActive' }}
              cursor="pointer"
              userSelect="none"
              onPress={() => onSelect(indicator.id)}
            >
              <Checkbox
                testID={`trading-view-indicator-sidebar-toggle-${indicator.id}`}
                value={indicator.active}
                containerProps={{ py: '$0', alignItems: 'center' }}
                onChange={(checked) => onToggle(indicator.id, Boolean(checked))}
              />
              <SizableText
                flex={1}
                numberOfLines={1}
                size="$bodyMd"
                color="$text"
              >
                {indicator.label}
              </SizableText>
              <Icon
                name="ChevronRightSmallOutline"
                size="$4.5"
                color="$iconSubdued"
                flexShrink={0}
              />
            </XStack>
          </YStack>
        );
      })}
    </ScrollView>
  );
}
