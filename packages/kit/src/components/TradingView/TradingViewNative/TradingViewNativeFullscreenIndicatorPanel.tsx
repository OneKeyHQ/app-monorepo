import { useCallback, useEffect, useRef, useState } from 'react';

import { chunk } from 'lodash';
import { useIntl } from 'react-intl';
import { useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import {
  Icon,
  IconButton,
  Keyboard,
  ScrollView,
  SizableText,
  Stack,
  XStack,
  YStack,
  useBackHandler,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  TradingViewMobileIndicatorEditorActions,
  TradingViewMobileIndicatorEditorFields,
  useTradingViewMobileIndicatorEditor,
} from './TradingViewMobileIndicatorEditor';
import { TradingViewMobileIndicatorList } from './TradingViewMobileIndicatorList';

import type { ITradingViewMobileIndicatorEditorProps } from './TradingViewMobileIndicatorEditor';
import type { ITradingViewNativeAnyIndicator } from './utils/chartIndicators';
import type {
  ITradingViewIndicatorSettingsItem,
  ITradingViewIndicatorSettingsValue,
} from '../TradingViewChartControls/chartSettings';
import type { ITradingViewIndicatorOption } from '../TradingViewChartControls/types';

// Landscape exchange charts slide a side panel over a bit more than half of
// the window and keep the chart visible on the left.
const PANEL_WIDTH_RATIO = 0.58;
const PANEL_MIN_WIDTH = 360;
const PANEL_MAX_WIDTH = 480;
const CHIP_COLUMNS = 4;
const CHIP_HEIGHT = 36;
const CHIP_BADGE_SIZE = 16;
const OPEN_TIMING = { duration: 240, easing: Easing.out(Easing.cubic) };
const CLOSE_TIMING = { duration: 200, easing: Easing.in(Easing.cubic) };
const BACKDROP_STYLE = {
  position: 'absolute',
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
} as const;
const PANEL_STYLE = {
  position: 'absolute',
  top: 0,
  right: 0,
  bottom: 0,
} as const;

export const TRADING_VIEW_NATIVE_FULLSCREEN_INDICATOR_PANEL_TEST_ID =
  'trading-view-native-fullscreen-indicator-panel';
const TEST_ID = TRADING_VIEW_NATIVE_FULLSCREEN_INDICATOR_PANEL_TEST_ID;

export function getTradingViewNativeFullscreenIndicatorPanelWidth(
  windowWidth: number,
) {
  return Math.min(
    Math.max(
      windowWidth * PANEL_WIDTH_RATIO,
      Math.min(PANEL_MIN_WIDTH, windowWidth),
    ),
    PANEL_MAX_WIDTH,
  );
}

function buildChipTestID(value: string) {
  return `${TEST_ID}-chip-${value.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80)}`;
}

function IndicatorChip({
  indicator,
  isActive,
  isDisabled,
  onPress,
}: {
  indicator: ITradingViewIndicatorOption;
  isActive: boolean;
  isDisabled: boolean;
  onPress: () => void;
}) {
  return (
    <Stack
      flex={1}
      minWidth={0}
      h={CHIP_HEIGHT}
      px="$1"
      alignItems="center"
      justifyContent="center"
      borderRadius="$2"
      borderWidth={isActive ? 2 : 1}
      borderColor={isActive ? '$borderActive' : '$borderSubdued'}
      overflow="hidden"
      opacity={isDisabled ? 0.45 : 1}
      accessibilityRole="button"
      accessibilityLabel={indicator.label}
      accessibilityState={{ selected: isActive, disabled: isDisabled }}
      pressStyle={isDisabled ? undefined : { bg: '$bgActive' }}
      onPress={isDisabled ? undefined : onPress}
      testID={buildChipTestID(indicator.value)}
    >
      <SizableText
        size={isActive ? '$bodyMdMedium' : '$bodyMd'}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
      >
        {indicator.label}
      </SizableText>
      {isActive ? (
        <Stack
          position="absolute"
          top={0}
          right={0}
          w={CHIP_BADGE_SIZE}
          h={CHIP_BADGE_SIZE}
          alignItems="center"
          justifyContent="center"
          bg="$borderActive"
          borderBottomLeftRadius="$2"
          pointerEvents="none"
        >
          <Icon name="CheckLargeOutline" size="$3" color="$iconInverse" />
        </Stack>
      ) : null}
    </Stack>
  );
}

function IndicatorChipSection({
  title,
  indicators,
  activeIndicatorValues,
  canToggleIndicatorOn,
  onIndicatorToggle,
}: {
  title: string;
  indicators: ITradingViewIndicatorOption[];
  activeIndicatorValues: ReadonlySet<string>;
  canToggleIndicatorOn: (indicatorValue: string) => boolean;
  onIndicatorToggle: (indicator: ITradingViewIndicatorOption) => void;
}) {
  if (!indicators.length) {
    return null;
  }
  return (
    <YStack gap="$3">
      <SizableText size="$bodyMd" color="$textSubdued">
        {title}
      </SizableText>
      <YStack gap="$2.5">
        {chunk(indicators, CHIP_COLUMNS).map((row, rowIndex) => (
          <XStack key={rowIndex} gap="$2.5">
            {row.map((indicator) => (
              <IndicatorChip
                key={indicator.value}
                indicator={indicator}
                isActive={activeIndicatorValues.has(indicator.value)}
                isDisabled={!canToggleIndicatorOn(indicator.value)}
                onPress={() => onIndicatorToggle(indicator)}
              />
            ))}
            {Array.from({ length: CHIP_COLUMNS - row.length }, (_, index) => (
              <Stack key={`spacer-${index}`} flex={1} />
            ))}
          </XStack>
        ))}
      </YStack>
    </YStack>
  );
}

function PanelIndicatorEditor(props: ITradingViewMobileIndicatorEditorProps) {
  const editor = useTradingViewMobileIndicatorEditor(props);
  return (
    <>
      <ScrollView
        flex={1}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{ px: '$4', pt: '$2', pb: '$6' }}
        testID={`${TEST_ID}-editor-${props.indicator.id}`}
      >
        <TradingViewMobileIndicatorEditorFields editor={editor} />
      </ScrollView>
      <TradingViewMobileIndicatorEditorActions
        editor={editor}
        buttonSize="medium"
        px="$4"
        py="$3"
      />
    </>
  );
}

type IPanelView =
  | { kind: 'indicators' }
  | { kind: 'settings' }
  | { kind: 'editor'; indicatorId: ITradingViewNativeAnyIndicator };

export interface ITradingViewNativeFullscreenIndicatorPanelProps {
  // Opens the editor directly; closing or saving it then closes the panel.
  initialIndicatorId?: ITradingViewNativeAnyIndicator;
  mainIndicators: ITradingViewIndicatorOption[];
  subIndicators: ITradingViewIndicatorOption[];
  activeIndicatorValues: ReadonlySet<string>;
  canToggleIndicatorOn: (indicatorValue: string) => boolean;
  onIndicatorToggle: (indicator: ITradingViewIndicatorOption) => void;
  value: ITradingViewIndicatorSettingsValue;
  defaultValue: ITradingViewIndicatorSettingsValue;
  onSave: (
    indicator: ITradingViewIndicatorSettingsItem,
  ) => void | Promise<unknown>;
  // Called once the panel has slid out.
  onClose: () => void;
}

// Indicator panel inside the fullscreen chart layer, laid out like landscape
// exchange charts: indicator chips toggle on tap, and the settings entry edits
// parameters in place. Opening a modal route from fullscreen either leaves
// fullscreen (Android) or rotates a portrait modal over the landscape page
// (iOS); this panel keeps the chart session.
export function TradingViewNativeFullscreenIndicatorPanel({
  initialIndicatorId,
  mainIndicators,
  subIndicators,
  activeIndicatorValues,
  canToggleIndicatorOn,
  onIndicatorToggle,
  value,
  defaultValue,
  onSave,
  onClose,
}: ITradingViewNativeFullscreenIndicatorPanelProps) {
  const intl = useIntl();
  const { width: windowWidth } = useWindowDimensions();
  const panelWidth =
    getTradingViewNativeFullscreenIndicatorPanelWidth(windowWidth);
  const [views, setViews] = useState<IPanelView[]>(() => [
    initialIndicatorId
      ? { kind: 'editor', indicatorId: initialIndicatorId }
      : { kind: 'indicators' },
  ]);
  const view = views[views.length - 1];
  const editingId = view.kind === 'editor' ? view.indicatorId : undefined;
  const editing = value.indicators.find(({ id }) => id === editingId);
  const defaultEditing = defaultValue.indicators.find(
    ({ id }) => id === editingId,
  );
  const canGoBack = views.length > 1;

  const progress = useSharedValue(0);
  const closingRef = useRef(false);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    progress.value = withTiming(1, OPEN_TIMING);
  }, [progress]);
  const finishClose = useCallback(() => {
    onCloseRef.current();
  }, []);
  const requestClose = useCallback(() => {
    if (closingRef.current) {
      return;
    }
    closingRef.current = true;
    Keyboard.dismiss();
    progress.value = withTiming(0, CLOSE_TIMING, (finished) => {
      if (finished) {
        runOnJS(finishClose)();
      }
    });
  }, [finishClose, progress]);
  const pushView = useCallback((next: IPanelView) => {
    setViews((current) => [...current, next]);
  }, []);
  const handleBack = useCallback(() => {
    if (!canGoBack) {
      requestClose();
      return;
    }
    Keyboard.dismiss();
    setViews((current) => current.slice(0, -1));
  }, [canGoBack, requestClose]);
  // Hardware back steps back inside the panel before it reaches the page,
  // which would leave fullscreen.
  const handleHardwareBack = useCallback(() => {
    handleBack();
    return true;
  }, [handleBack]);
  useBackHandler(handleHardwareBack);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));
  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (1 - progress.value) * panelWidth }],
  }));

  let title = intl.formatMessage({ id: ETranslations.market_indicators });
  if (view.kind === 'settings') {
    title = intl.formatMessage({ id: ETranslations.global_settings });
  } else if (editing) {
    title = editing.label;
  }

  let content = null;
  if (view.kind === 'indicators') {
    content = (
      <ScrollView flex={1} testID={`${TEST_ID}-indicators`}>
        <YStack px="$4" pt="$1" pb="$5" gap="$6">
          <IndicatorChipSection
            title={intl.formatMessage({
              id: ETranslations.market_main_chart_indicators,
            })}
            indicators={mainIndicators}
            activeIndicatorValues={activeIndicatorValues}
            canToggleIndicatorOn={canToggleIndicatorOn}
            onIndicatorToggle={onIndicatorToggle}
          />
          <IndicatorChipSection
            title={intl.formatMessage({
              id: ETranslations.market_sub_chart_indicators,
            })}
            indicators={subIndicators}
            activeIndicatorValues={activeIndicatorValues}
            canToggleIndicatorOn={canToggleIndicatorOn}
            onIndicatorToggle={onIndicatorToggle}
          />
        </YStack>
      </ScrollView>
    );
  } else if (view.kind === 'settings') {
    content = (
      <ScrollView flex={1} testID={`${TEST_ID}-settings`}>
        <TradingViewMobileIndicatorList
          px="$4"
          pb="$4"
          indicators={value.indicators}
          onSelect={(indicatorId) => pushView({ kind: 'editor', indicatorId })}
        />
      </ScrollView>
    );
  } else if (editing && defaultEditing) {
    content = (
      <PanelIndicatorEditor
        key={editing.id}
        indicator={editing}
        defaultIndicator={defaultEditing}
        onSave={onSave}
        onClose={handleBack}
      />
    );
  }

  return (
    <Stack
      position="absolute"
      top={0}
      right={0}
      bottom={0}
      left={0}
      // Above the chart toolbar and quick bar, which raise themselves to 3.
      zIndex={10}
      overflow="hidden"
      testID={`${TEST_ID}-layer`}
    >
      <Animated.View style={[BACKDROP_STYLE, backdropStyle]}>
        <Stack
          flex={1}
          bg="$bgBackdrop"
          accessibilityRole="button"
          accessibilityLabel={intl.formatMessage({
            id: ETranslations.global_close,
          })}
          onPress={requestClose}
          testID={`${TEST_ID}-backdrop`}
        />
      </Animated.View>
      <Animated.View
        style={[PANEL_STYLE, { width: panelWidth }, panelStyle]}
        accessibilityViewIsModal
      >
        <YStack flex={1} bg="$bgApp" testID={TEST_ID}>
          <XStack
            minHeight={56}
            pl={canGoBack ? '$2' : '$4'}
            pr="$2"
            gap="$1"
            alignItems="center"
          >
            {canGoBack ? (
              <IconButton
                icon="ChevronLeftOutline"
                variant="tertiary"
                accessibilityLabel={intl.formatMessage({
                  id: ETranslations.global_back,
                })}
                onPress={handleBack}
                testID={`${TEST_ID}-back`}
              />
            ) : null}
            <SizableText flex={1} size="$headingXl" numberOfLines={1}>
              {title}
            </SizableText>
            {view.kind === 'indicators' ? (
              <IconButton
                icon="SettingsOutline"
                variant="tertiary"
                accessibilityLabel={intl.formatMessage({
                  id: ETranslations.global_settings,
                })}
                onPress={() => pushView({ kind: 'settings' })}
                testID={`${TEST_ID}-settings-trigger`}
              />
            ) : null}
          </XStack>
          {content}
        </YStack>
      </Animated.View>
    </Stack>
  );
}
