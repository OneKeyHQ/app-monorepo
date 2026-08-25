import { useIntl } from 'react-intl';

import {
  Icon,
  ScrollView,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  OkxIndicatorLineRow,
  OkxIndicatorOpacitySlider,
  OkxIndicatorParameterRow,
  groupOkxIndicatorParameters,
} from './TradingViewIndicatorFields';
import {
  OkxIndicatorScopeTabs,
  OkxIndicatorSidebar,
} from './TradingViewIndicatorNavigation';
import {
  OKX_CHART_BG,
  OKX_CHART_BORDER,
  OKX_CHART_DIVIDER,
  OKX_CHART_DOWN,
  OKX_CHART_TEXT,
  OKX_CHART_TEXT_SUBDUED,
  OKX_CHART_UP,
} from './TradingViewSettingsShared';

import type {
  ITradingViewIndicatorSettingsValue,
  ITradingViewSettingsMockColorRole,
  ITradingViewSettingsMockIndicator,
  ITradingViewSettingsMockIndicatorScope,
  ITradingViewSettingsMockLineStyle,
} from './TradingViewSettingsMockState';

const OKX_INDICATOR_SETTINGS_WIDTH = 690;
const OKX_INDICATOR_SETTINGS_HEIGHT = 570;
const OKX_INDICATOR_HEADER_HEIGHT = 49;
const OKX_INDICATOR_BODY_HEIGHT = 418;
const OKX_INDICATOR_FOOTER_HEIGHT = 62;
const OKX_INDICATOR_SIDEBAR_WIDTH = 184;

function OkxIndicatorContent({
  indicator,
  onToggleLine,
  onLinePeriodChange,
  onLineStyleChange,
  onLineSecondaryStyleChange,
  onLineColorChange,
  onOpacityChange,
  onOpacityColorChange,
  onParameterChange,
}: {
  indicator: ITradingViewSettingsMockIndicator | undefined;
  onToggleLine: (lineId: string, enabled: boolean) => void;
  onLinePeriodChange: (lineId: string, period: number) => void;
  onLineStyleChange: (
    lineId: string,
    style: ITradingViewSettingsMockLineStyle,
  ) => void;
  onLineSecondaryStyleChange: (
    lineId: string,
    style: ITradingViewSettingsMockLineStyle,
  ) => void;
  onLineColorChange: (lineId: string, color: string) => void;
  onOpacityChange: (indicatorId: string, opacity: number) => void;
  onOpacityColorChange: (
    indicatorId: string,
    role: ITradingViewSettingsMockColorRole,
    color: string,
  ) => void;
  onParameterChange: (parameterId: string, value: number) => void;
}) {
  const intl = useIntl();

  if (!indicator) {
    return null;
  }

  const parameterRows = groupOkxIndicatorParameters(indicator.parameters);

  return (
    <ScrollView h={OKX_INDICATOR_BODY_HEIGHT} showsVerticalScrollIndicator>
      <YStack pt={31} pb={34} pl={31} pr={33} bg={OKX_CHART_BG}>
        <SizableText
          mb={22}
          fontSize={16}
          lineHeight={20}
          fontWeight="700"
          color={OKX_CHART_TEXT}
        >
          {indicator.title}
        </SizableText>
        {parameterRows.map((parameters) => (
          <OkxIndicatorParameterRow
            key={parameters[0]?.rowId ?? parameters[0]?.id}
            parameters={parameters}
            onChange={onParameterChange}
          />
        ))}
        {indicator.lines.map((line, index) => (
          <OkxIndicatorLineRow
            key={line.id}
            line={line}
            colorPickerPlacement={
              parameterRows.length + index <= 2 ? 'bottom' : 'top'
            }
            onToggleLine={onToggleLine}
            onPeriodChange={onLinePeriodChange}
            onStyleChange={onLineStyleChange}
            onSecondaryStyleChange={onLineSecondaryStyleChange}
            onColorChange={onLineColorChange}
          />
        ))}
        {indicator.showOpacity !== false ? (
          <OkxIndicatorOpacitySlider
            value={indicator.opacity}
            label={intl.formatMessage({
              id: ETranslations.market_chart_indicator_transparency__label,
            })}
            upColor={indicator.opacityColors?.upColor ?? OKX_CHART_UP}
            downColor={indicator.opacityColors?.downColor ?? OKX_CHART_DOWN}
            onChange={(value) => onOpacityChange(indicator.id, value)}
            onColorChange={(role, color) =>
              onOpacityColorChange(indicator.id, role, color)
            }
          />
        ) : null}
        {indicator.description ? (
          <YStack mt={30} gap={10}>
            <SizableText fontSize={14} lineHeight={18} color={OKX_CHART_TEXT}>
              {intl.formatMessage({ id: ETranslations.global_description })}
            </SizableText>
            <SizableText
              maxWidth={440}
              fontSize={13}
              lineHeight={20}
              color={OKX_CHART_TEXT_SUBDUED}
            >
              {indicator.description}
            </SizableText>
          </YStack>
        ) : null}
      </YStack>
    </ScrollView>
  );
}

export function OkxIndicatorSettingsDialog({
  value,
  maxActiveSubIndicatorCount,
  selectedIndicatorScope,
  selectedIndicatorId,
  visibleIndicators,
  selectedIndicator,
  onScopeChange,
  onSelectIndicator,
  onToggleIndicator,
  onToggleLine,
  onLinePeriodChange,
  onLineStyleChange,
  onLineSecondaryStyleChange,
  onLineColorChange,
  onOpacityChange,
  onOpacityColorChange,
  onParameterChange,
  onReset,
  onConfirm,
  onClose,
  isSubmitting = false,
}: {
  value: ITradingViewIndicatorSettingsValue;
  maxActiveSubIndicatorCount: number | null;
  selectedIndicatorScope: ITradingViewSettingsMockIndicatorScope;
  selectedIndicatorId: string;
  visibleIndicators: ITradingViewSettingsMockIndicator[];
  selectedIndicator: ITradingViewSettingsMockIndicator | undefined;
  onScopeChange: (scope: ITradingViewSettingsMockIndicatorScope) => void;
  onSelectIndicator: (indicatorId: string) => void;
  onToggleIndicator: (indicatorId: string, active: boolean) => void;
  onToggleLine: (lineId: string, enabled: boolean) => void;
  onLinePeriodChange: (lineId: string, period: number) => void;
  onLineStyleChange: (
    lineId: string,
    style: ITradingViewSettingsMockLineStyle,
  ) => void;
  onLineSecondaryStyleChange: (
    lineId: string,
    style: ITradingViewSettingsMockLineStyle,
  ) => void;
  onLineColorChange: (lineId: string, color: string) => void;
  onOpacityChange: (indicatorId: string, opacity: number) => void;
  onOpacityColorChange: (
    indicatorId: string,
    role: ITradingViewSettingsMockColorRole,
    color: string,
  ) => void;
  onParameterChange: (parameterId: string, value: number) => void;
  onReset: () => void;
  onConfirm?: () => void;
  onClose?: () => void;
  isSubmitting?: boolean;
}) {
  const intl = useIntl();

  return (
    <YStack
      testID="trading-view-indicator-settings-okx-dialog"
      w={OKX_INDICATOR_SETTINGS_WIDTH}
      h={OKX_INDICATOR_SETTINGS_HEIGHT}
      overflow="hidden"
      borderWidth={1}
      borderColor={OKX_CHART_BORDER}
      borderRadius={6}
      bg={OKX_CHART_BG}
    >
      <XStack
        h={OKX_INDICATOR_HEADER_HEIGHT}
        px={24}
        alignItems="center"
        justifyContent="space-between"
        borderBottomWidth={1}
        borderBottomColor={OKX_CHART_BORDER}
      >
        <SizableText
          fontSize={16}
          lineHeight={22}
          fontWeight="700"
          color={OKX_CHART_TEXT}
        >
          {intl.formatMessage({ id: ETranslations.market_indicators })}
        </SizableText>
        <Stack
          w={28}
          h={28}
          alignItems="center"
          justifyContent="center"
          cursor={onClose && !isSubmitting ? 'pointer' : 'default'}
          opacity={isSubmitting ? 0.5 : 1}
          pointerEvents={isSubmitting ? 'none' : 'auto'}
          onPress={onClose}
        >
          <Icon name="CrossedSmallOutline" size="$5" color="$icon" />
        </Stack>
      </XStack>
      <YStack pointerEvents={isSubmitting ? 'none' : 'auto'}>
        <OkxIndicatorScopeTabs
          value={selectedIndicatorScope}
          indicators={value.indicators}
          maxActiveSubIndicatorCount={maxActiveSubIndicatorCount}
          onChange={onScopeChange}
        />
        <XStack h={OKX_INDICATOR_BODY_HEIGHT} minHeight={0}>
          <Stack
            w={OKX_INDICATOR_SIDEBAR_WIDTH}
            minWidth={OKX_INDICATOR_SIDEBAR_WIDTH}
            maxWidth={OKX_INDICATOR_SIDEBAR_WIDTH}
            flexShrink={0}
            position="relative"
            zIndex={1}
            bg={OKX_CHART_BG}
          >
            <OkxIndicatorSidebar
              indicators={visibleIndicators}
              selectedIndicatorId={selectedIndicatorId}
              onSelect={onSelectIndicator}
              onToggle={onToggleIndicator}
            />
            <Stack
              position="absolute"
              top={0}
              right={0}
              bottom={0}
              w={1}
              zIndex={2}
              bg={OKX_CHART_DIVIDER}
              pointerEvents="none"
            />
          </Stack>
          <Stack
            flex={1}
            minWidth={0}
            position="relative"
            zIndex={2}
            overflow="visible"
            bg={OKX_CHART_BG}
          >
            <OkxIndicatorContent
              indicator={selectedIndicator}
              onToggleLine={onToggleLine}
              onLinePeriodChange={onLinePeriodChange}
              onLineStyleChange={onLineStyleChange}
              onLineSecondaryStyleChange={onLineSecondaryStyleChange}
              onLineColorChange={onLineColorChange}
              onOpacityChange={onOpacityChange}
              onOpacityColorChange={onOpacityColorChange}
              onParameterChange={onParameterChange}
            />
          </Stack>
        </XStack>
      </YStack>
      <XStack
        h={OKX_INDICATOR_FOOTER_HEIGHT}
        alignItems="center"
        justifyContent="flex-end"
        gap={12}
        pr={28}
        borderTopWidth={1}
        borderTopColor={OKX_CHART_BORDER}
        bg={OKX_CHART_BG}
      >
        <XStack
          testID="trading-view-indicator-settings-mock-reset"
          w={84}
          h={36}
          alignItems="center"
          justifyContent="center"
          borderRadius={18}
          borderWidth={1}
          borderColor="$borderStrong"
          bg={OKX_CHART_BG}
          cursor={isSubmitting ? 'default' : 'pointer'}
          opacity={isSubmitting ? 0.5 : 1}
          pointerEvents={isSubmitting ? 'none' : 'auto'}
          hoverStyle={{ bg: '$bgHover' }}
          pressStyle={{ bg: '$bgActive' }}
          onPress={onReset}
        >
          <SizableText fontSize={14} lineHeight={18} color={OKX_CHART_TEXT}>
            {intl.formatMessage({ id: ETranslations.global_reset })}
          </SizableText>
        </XStack>
        <XStack
          testID="trading-view-indicator-settings-mock-confirm"
          w={84}
          h={36}
          alignItems="center"
          justifyContent="center"
          borderRadius={18}
          bg="$bgInverse"
          cursor={isSubmitting ? 'default' : 'pointer'}
          opacity={isSubmitting ? 0.5 : 1}
          pointerEvents={isSubmitting ? 'none' : 'auto'}
          hoverStyle={{ opacity: 0.86 }}
          pressStyle={{ opacity: 0.72 }}
          onPress={onConfirm}
        >
          <SizableText
            fontSize={14}
            lineHeight={18}
            fontWeight="700"
            color="$textInverse"
          >
            {intl.formatMessage({ id: ETranslations.global_confirm })}
          </SizableText>
        </XStack>
      </XStack>
    </YStack>
  );
}
