// cspell:ignore heikin Ashi
import { useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';

import {
  ESwitchSize,
  Icon,
  Select,
  SizableText,
  Switch,
  XStack,
  YStack,
  useDialogInstance,
} from '@onekeyhq/components';
import type { ISelectRenderTriggerProps } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  ITradingViewNativeChartSettingsOptions,
  ITradingViewNativeChartTypePreference,
} from '@onekeyhq/shared/types/tradingViewNative';

import {
  type ITradingViewChartMode,
  TradingViewChartModeSelect,
} from '../TradingViewChartControls';

import { normalizeTradingViewNativeChartSettings } from './chartSettingsAdapter';
import { useTradingViewNativeChartSettings } from './useTradingViewNativeSettings';

import type { ITradingViewNativeStorageNamespace } from './types';

type IQuickSettingOptions = Pick<
  ITradingViewNativeChartSettingsOptions,
  'previousClose' | 'yAxis'
>;

const QUICK_SETTING_OPTIONS: Array<keyof IQuickSettingOptions> = [
  'yAxis',
  'previousClose',
];

const OPTION_TRANSLATION_IDS: Record<
  keyof IQuickSettingOptions,
  ETranslations
> = {
  yAxis: ETranslations.market_chart_settings__y_axis,
  previousClose: ETranslations.market_prev_close,
};

const CHART_STYLE_OPTIONS = [
  'auto',
  'candlestick',
  'heikinAshi',
  'bars',
  'line',
  'area',
] as const satisfies readonly ITradingViewNativeChartTypePreference[];

const CHART_STYLE_TRANSLATION_IDS: Record<
  ITradingViewNativeChartTypePreference,
  ETranslations
> = {
  auto: ETranslations.global_auto,
  candlestick: ETranslations.market_candle,
  heikinAshi: ETranslations.market_heikin_ashi,
  bars: ETranslations.market_bars,
  line: ETranslations.market_line,
  area: ETranslations.market_area,
};

const CHART_STYLE_FLOATING_PANEL_PROPS = { width: 180 };

const ROW_MIN_HEIGHT = 44;

function SettingsListRow({
  label,
  testID,
  children,
}: {
  label: string;
  testID?: string;
  children: ReactNode;
}) {
  return (
    <XStack
      testID={testID}
      minHeight={ROW_MIN_HEIGHT}
      gap="$3"
      alignItems="center"
      justifyContent="space-between"
    >
      <SizableText
        size="$bodyMdMedium"
        color="$text"
        flexShrink={1}
        numberOfLines={1}
      >
        {label}
      </SizableText>
      {children}
    </XStack>
  );
}

function SettingsEntry({ onPress }: { onPress: () => void }) {
  const intl = useIntl();

  return (
    <XStack
      testID="trading-view-native-chart-settings-dialog-open-settings"
      minHeight={ROW_MIN_HEIGHT}
      gap="$3"
      alignItems="center"
      cursor="pointer"
      onPress={onPress}
    >
      <Icon name="SettingsOutline" size="$5" color="$iconSubdued" />
      <SizableText
        flex={1}
        size="$bodyMdMedium"
        color="$text"
        numberOfLines={1}
      >
        {intl.formatMessage({ id: ETranslations.market_chart_settings })}
      </SizableText>
      <Icon name="ChevronRightOutline" size="$4.5" color="$iconSubdued" />
    </XStack>
  );
}

// Text trigger matching the chart mode select; the negative margin offsets
// its inner padding so the chevron lines up with the row's right edge.
function SelectValueTrigger({
  testID,
  label,
  disabled,
  onPress,
}: ISelectRenderTriggerProps & { testID: string }) {
  return (
    <XStack
      testID={testID}
      h={30}
      px="$3"
      mr="$-3"
      gap="$1.5"
      alignItems="center"
      borderRadius="$full"
      borderCurve="continuous"
      opacity={disabled ? 0.5 : 1}
      hoverStyle={disabled ? undefined : { bg: '$bgHover' }}
      pressStyle={disabled ? undefined : { bg: '$bgActive' }}
      cursor={disabled ? 'not-allowed' : 'pointer'}
      userSelect="none"
      onPress={disabled ? undefined : onPress}
    >
      <SizableText size="$bodyMdMedium" color="$textSubdued" numberOfLines={1}>
        {label}
      </SizableText>
      <Icon name="ChevronDownSmallOutline" size="$4" color="$iconSubdued" />
    </XStack>
  );
}

function ChartStyleSelect({
  value,
  onChange,
}: {
  value: ITradingViewNativeChartTypePreference;
  onChange: (value: ITradingViewNativeChartTypePreference) => void;
}) {
  const intl = useIntl();
  const title = intl.formatMessage({ id: ETranslations.market_chart_style });
  const items = useMemo(
    () =>
      CHART_STYLE_OPTIONS.map((option) => ({
        value: option,
        label: intl.formatMessage({ id: CHART_STYLE_TRANSLATION_IDS[option] }),
      })),
    [intl],
  );
  const renderTrigger = useCallback(
    (props: ISelectRenderTriggerProps) => (
      <SelectValueTrigger
        {...props}
        testID="trading-view-native-chart-settings-dialog-chart-style-trigger"
      />
    ),
    [],
  );

  return (
    <SettingsListRow
      label={title}
      testID="trading-view-native-chart-settings-dialog-chart-style"
    >
      <Select
        testID="trading-view-native-chart-settings-dialog-chart-style-select"
        title={title}
        items={items}
        value={value}
        onChange={onChange}
        placement="bottom-end"
        floatingPanelProps={CHART_STYLE_FLOATING_PANEL_PROPS}
        renderTrigger={renderTrigger}
      />
    </SettingsListRow>
  );
}

function QuickSettingOption({
  option,
  label,
  value,
  onChange,
}: {
  option: keyof IQuickSettingOptions;
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <SettingsListRow label={label}>
      <Switch
        testID={`trading-view-native-chart-settings-dialog-option-${option}`}
        size={ESwitchSize.small}
        value={value}
        onChange={(checked) => onChange(Boolean(checked))}
      />
    </SettingsListRow>
  );
}

type IChartSettingsDialogProps = {
  storageNamespace?: ITradingViewNativeStorageNamespace;
  chartMode?: ITradingViewChartMode;
  isChartSwitchDisabled?: boolean;
  showPreviousClose?: boolean;
  onChartSwitch?: () => void;
  onOpenSettings: () => void;
};

export function TradingViewMobileChartSettingsDialogContent(
  props: IChartSettingsDialogProps,
) {
  const settingsState = useTradingViewNativeChartSettings(
    props.storageNamespace,
  );
  return (
    <ChartSettingsDialogContent {...props} settingsState={settingsState} />
  );
}

function ChartSettingsDialogContent({
  settingsState,
  chartMode,
  isChartSwitchDisabled = false,
  showPreviousClose = false,
  onChartSwitch,
  onOpenSettings,
}: IChartSettingsDialogProps & {
  settingsState: ReturnType<typeof useTradingViewNativeChartSettings>;
}) {
  const intl = useIntl();
  const dialog = useDialogInstance();
  const [settings, setSettings] = settingsState;
  const normalizedSettings = useMemo(
    () => normalizeTradingViewNativeChartSettings(settings),
    [settings],
  );
  const quickSettingOptions = useMemo(
    () =>
      QUICK_SETTING_OPTIONS.filter(
        (option) => option !== 'previousClose' || showPreviousClose,
      ),
    [showPreviousClose],
  );

  const handleOpenSettings = useCallback(async () => {
    await dialog.close();
    onOpenSettings();
  }, [dialog, onOpenSettings]);
  const handleChartSwitch = useCallback(async () => {
    await dialog.close();
    onChartSwitch?.();
  }, [dialog, onChartSwitch]);

  const handleOptionChange = useCallback(
    (key: keyof IQuickSettingOptions, value: boolean) => {
      setSettings((currentSettings) => {
        const normalizedCurrentSettings =
          normalizeTradingViewNativeChartSettings(currentSettings);
        return {
          ...normalizedCurrentSettings,
          options: {
            ...normalizedCurrentSettings.options,
            [key]: value,
          },
        };
      });
    },
    [setSettings],
  );
  const handleChartTypeChange = useCallback(
    (chartType: ITradingViewNativeChartTypePreference) => {
      void setSettings((currentSettings) => ({
        ...normalizeTradingViewNativeChartSettings(currentSettings),
        chartType,
      }));
    },
    [setSettings],
  );

  return (
    <YStack pb="$2">
      <SettingsEntry onPress={() => void handleOpenSettings()} />

      {chartMode && onChartSwitch ? (
        <SettingsListRow
          label={intl.formatMessage({ id: ETranslations.market_chart })}
        >
          {/* Offset the trigger's inner padding to align with the right edge. */}
          <XStack mr="$-3">
            <TradingViewChartModeSelect
              chartMode={chartMode}
              isDisabled={isChartSwitchDisabled}
              onChartSwitch={() => void handleChartSwitch()}
            />
          </XStack>
        </SettingsListRow>
      ) : null}

      {chartMode !== 'tradingView' ? (
        <>
          <ChartStyleSelect
            value={normalizedSettings.chartType}
            onChange={handleChartTypeChange}
          />
          {quickSettingOptions.map((option) => (
            <QuickSettingOption
              key={option}
              option={option}
              label={intl.formatMessage({
                id: OPTION_TRANSLATION_IDS[option],
              })}
              value={normalizedSettings.options[option]}
              onChange={(value) => handleOptionChange(option, value)}
            />
          ))}
        </>
      ) : null}
    </YStack>
  );
}
