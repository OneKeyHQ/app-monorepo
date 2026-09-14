import { useIntl } from 'react-intl';
import { useWindowDimensions } from 'react-native';

import {
  Button,
  Divider,
  IconButton,
  ScrollView,
  SizableText,
  Stack,
  XStack,
  YStack,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { TRADING_VIEW_NATIVE_THEME_COLORS } from '@onekeyhq/shared/types/tradingViewNative';

import {
  TradingViewIndicatorLineRow,
  TradingViewIndicatorOpacitySlider,
  TradingViewIndicatorParameterRow,
  groupTradingViewIndicatorParameters,
} from './TradingViewIndicatorFields';
import {
  TradingViewIndicatorScopeTabs,
  TradingViewIndicatorSidebar,
} from './TradingViewIndicatorNavigation';
import { SettingsGroup } from './TradingViewSettingsPrimitives';

import type {
  ITradingViewIndicatorSettingsValue,
  ITradingViewSettingsMockColorRole,
  ITradingViewSettingsMockIndicator,
  ITradingViewSettingsMockIndicatorScope,
  ITradingViewSettingsMockLineStyle,
} from './TradingViewSettingsMockState';

// The frame mirrors the chart settings dialog (TradingViewChartSettings.tsx):
// same width cap, height rule, header, navigation column and footer, so the
// two dialogs read as one set.
const TRADING_VIEW_INDICATOR_SETTINGS_MAX_WIDTH = 640;
const TRADING_VIEW_INDICATOR_HEADER_MIN_HEIGHT = 64;
const TRADING_VIEW_INDICATOR_FOOTER_MIN_HEIGHT = 72;
const TRADING_VIEW_INDICATOR_SIDEBAR_WIDTH = 192;
// Focused mode lives in a mobile sheet and keeps its own body budget.
const TRADING_VIEW_INDICATOR_FOCUSED_BODY_HEIGHT = 418;
const TRADING_VIEW_INDICATOR_FOCUSED_SETTINGS_PREFERRED_HEIGHT =
  TRADING_VIEW_INDICATOR_HEADER_MIN_HEIGHT +
  TRADING_VIEW_INDICATOR_FOCUSED_BODY_HEIGHT +
  TRADING_VIEW_INDICATOR_FOOTER_MIN_HEIGHT;
const TRADING_VIEW_INDICATOR_FOCUSED_SETTINGS_VERTICAL_MARGIN = 16;

function getIndicatorDialogHeight(windowHeight: number) {
  return Math.min(600, Math.max(windowHeight - 32, 420));
}

function TradingViewIndicatorContent({
  mobileLayout = false,
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
  mobileLayout?: boolean;
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

  const parameterRows = groupTradingViewIndicatorParameters(
    indicator.parameters,
  );

  return (
    <ScrollView
      testID="trading-view-indicator-settings-content"
      flex={1}
      minHeight={0}
      contentContainerStyle={{ pb: '$5' }}
    >
      {/* The mobile settings page prints the indicator name in its own
          header, so the group only carries the title on desktop. */}
      <SettingsGroup title={mobileLayout ? undefined : indicator.title}>
        {parameterRows.map((parameters) => (
          <TradingViewIndicatorParameterRow
            key={parameters[0]?.rowId ?? parameters[0]?.id}
            parameters={parameters}
            onChange={onParameterChange}
          />
        ))}
        {mobileLayout && parameterRows.length ? <Divider my="$4" /> : null}
        {indicator.lines.map((line) => (
          <TradingViewIndicatorLineRow
            key={line.id}
            line={line}
            onToggleLine={onToggleLine}
            onPeriodChange={onLinePeriodChange}
            onStyleChange={onLineStyleChange}
            onSecondaryStyleChange={onLineSecondaryStyleChange}
            onColorChange={onLineColorChange}
          />
        ))}
      </SettingsGroup>
      {indicator.showOpacity !== false ? (
        <SettingsGroup>
          <TradingViewIndicatorOpacitySlider
            value={indicator.opacity}
            label={intl.formatMessage({
              id: ETranslations.market_chart_indicator_transparency__label,
            })}
            upColor={
              indicator.opacityColors?.upColor ??
              TRADING_VIEW_NATIVE_THEME_COLORS.positive
            }
            downColor={
              indicator.opacityColors?.downColor ??
              TRADING_VIEW_NATIVE_THEME_COLORS.negative
            }
            onChange={(value) => onOpacityChange(indicator.id, value)}
            onColorChange={(role, color) =>
              onOpacityColorChange(indicator.id, role, color)
            }
          />
        </SettingsGroup>
      ) : null}
      {indicator.description ? (
        <SettingsGroup
          title={intl.formatMessage({ id: ETranslations.global_description })}
          showDivider={false}
        >
          <SizableText px="$5" size="$bodyMd" color="$textSubdued">
            {indicator.description}
          </SizableText>
        </SettingsGroup>
      ) : null}
    </ScrollView>
  );
}

export function TradingViewIndicatorSettingsDialog({
  displayMode,
  mobileLayout = false,
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
  displayMode: 'focused' | 'full';
  mobileLayout?: boolean;
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
  const isFocused = displayMode === 'focused';
  const { height: windowHeight } = useWindowDimensions();
  const { bottom: safeAreaBottom, top: safeAreaTop } = useSafeAreaInsets();
  const focusedMaxHeight = Math.max(
    windowHeight -
      safeAreaTop -
      safeAreaBottom -
      TRADING_VIEW_INDICATOR_FOCUSED_SETTINGS_VERTICAL_MARGIN,
    0,
  );
  const dialogHeight = isFocused
    ? Math.min(
        TRADING_VIEW_INDICATOR_FOCUSED_SETTINGS_PREFERRED_HEIGHT,
        focusedMaxHeight,
      )
    : getIndicatorDialogHeight(windowHeight);
  const cancelLabel = intl.formatMessage({ id: ETranslations.global_cancel });

  if (mobileLayout) {
    const mobileMaxHeight = Math.max(focusedMaxHeight - 160, 160);
    return (
      <YStack
        testID="trading-view-mobile-indicator-settings"
        h={Math.min(
          TRADING_VIEW_INDICATOR_FOCUSED_BODY_HEIGHT +
            TRADING_VIEW_INDICATOR_FOOTER_MIN_HEIGHT,
          mobileMaxHeight,
        )}
        maxHeight={mobileMaxHeight}
        gap="$4"
      >
        <Stack
          testID="trading-view-mobile-indicator-settings-body"
          flex={1}
          minHeight={0}
          pointerEvents={isSubmitting ? 'none' : 'auto'}
        >
          <TradingViewIndicatorContent
            mobileLayout
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
        <XStack
          testID="trading-view-mobile-indicator-settings-footer"
          gap="$3"
          flexShrink={0}
        >
          <Button
            testID="trading-view-indicator-settings-mock-reset"
            flex={1}
            size="large"
            disabled={isSubmitting}
            onPress={onReset}
          >
            {intl.formatMessage({ id: ETranslations.global_reset })}
          </Button>
          <Button
            testID="trading-view-indicator-settings-mock-confirm"
            flex={1}
            size="large"
            variant="primary"
            disabled={isSubmitting}
            loading={isSubmitting}
            onPress={onConfirm}
          >
            {intl.formatMessage({ id: ETranslations.global_confirm })}
          </Button>
        </XStack>
      </YStack>
    );
  }

  return (
    <YStack
      testID="trading-view-indicator-settings-dialog"
      width="100%"
      maxWidth={isFocused ? '100%' : TRADING_VIEW_INDICATOR_SETTINGS_MAX_WIDTH}
      height={dialogHeight}
      maxHeight={isFocused ? focusedMaxHeight : '100%'}
      overflow="hidden"
      borderWidth={isFocused ? 0 : '$px'}
      borderColor="$borderSubdued"
      borderRadius={isFocused ? 0 : '$5'}
      borderCurve="continuous"
      bg="$bgApp"
    >
      <XStack
        testID="trading-view-indicator-settings-header"
        minHeight={TRADING_VIEW_INDICATOR_HEADER_MIN_HEIGHT}
        flexShrink={0}
        px={isFocused ? '$4' : '$6'}
        alignItems="center"
        justifyContent="space-between"
      >
        <SizableText size="$headingLg">
          {intl.formatMessage({ id: ETranslations.market_indicators })}
        </SizableText>
        <IconButton
          testID="trading-view-indicator-settings-close"
          title={cancelLabel}
          icon="CrossedSmallOutline"
          variant="tertiary"
          disabled={isSubmitting}
          onPress={onClose}
        />
      </XStack>
      <YStack
        flex={1}
        minHeight={0}
        pointerEvents={isSubmitting ? 'none' : 'auto'}
      >
        {isFocused ? null : (
          <TradingViewIndicatorScopeTabs
            value={selectedIndicatorScope}
            indicators={value.indicators}
            maxActiveSubIndicatorCount={maxActiveSubIndicatorCount}
            onChange={onScopeChange}
          />
        )}
        <XStack
          testID="trading-view-indicator-settings-body"
          flex={1}
          minHeight={0}
        >
          {isFocused ? null : (
            <YStack
              width={TRADING_VIEW_INDICATOR_SIDEBAR_WIDTH}
              flexShrink={0}
              minHeight={0}
              borderRightWidth="$px"
              borderRightColor="$neutral3"
            >
              <TradingViewIndicatorSidebar
                indicators={visibleIndicators}
                selectedIndicatorId={selectedIndicatorId}
                onSelect={onSelectIndicator}
                onToggle={onToggleIndicator}
              />
            </YStack>
          )}
          <YStack flex={1} minWidth={0} minHeight={0}>
            <TradingViewIndicatorContent
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
          </YStack>
        </XStack>
      </YStack>
      <XStack
        testID="trading-view-indicator-settings-footer"
        minHeight={TRADING_VIEW_INDICATOR_FOOTER_MIN_HEIGHT}
        flexShrink={0}
        px={isFocused ? '$4' : '$6'}
        py="$3"
        gap="$3"
        alignItems="center"
        justifyContent="space-between"
        bg="$bgApp"
      >
        <Button
          testID="trading-view-indicator-settings-mock-reset"
          size="medium"
          icon="RotateCounterclockwiseOutline"
          variant="tertiary"
          disabled={isSubmitting}
          onPress={onReset}
        >
          {intl.formatMessage({ id: ETranslations.global_reset })}
        </Button>
        <XStack gap="$3">
          <Button
            testID="trading-view-indicator-settings-mock-cancel"
            size="medium"
            variant="secondary"
            disabled={isSubmitting}
            onPress={onClose}
          >
            {cancelLabel}
          </Button>
          <Button
            testID="trading-view-indicator-settings-mock-confirm"
            size="medium"
            variant="primary"
            loading={isSubmitting}
            disabled={isSubmitting}
            onPress={onConfirm}
          >
            {intl.formatMessage({ id: ETranslations.global_confirm })}
          </Button>
        </XStack>
      </XStack>
    </YStack>
  );
}
