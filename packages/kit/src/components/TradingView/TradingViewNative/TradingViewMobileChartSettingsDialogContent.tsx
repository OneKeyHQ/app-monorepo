import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Checkbox,
  Divider,
  Icon,
  SizableText,
  XStack,
  YStack,
  useDialogInstance,
} from '@onekeyhq/components';
import { useMarketTradingViewChartSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  ITradingViewNativeChartSettingsOptions,
  ITradingViewNativeChartTypePreference,
} from '@onekeyhq/shared/types/tradingViewNative';

import { TRADING_VIEW_PREVIOUS_CLOSE_LABEL } from '../constants';
import {
  type ITradingViewChartMode,
  TradingViewChartModeSelect,
} from '../TradingViewChartControls';
import { TradingViewChartTypeSettingsRow } from '../TradingViewChartControls/chartSettings';

import { normalizeTradingViewNativeChartSettings } from './chartSettingsAdapter';

type IQuickSettingOptions = Pick<
  ITradingViewNativeChartSettingsOptions,
  'previousClose' | 'yAxis'
>;

const QUICK_SETTING_OPTIONS: Array<keyof IQuickSettingOptions> = [
  'yAxis',
  'previousClose',
];

const OPTION_TRANSLATION_IDS: Record<
  Exclude<keyof IQuickSettingOptions, 'previousClose'>,
  ETranslations
> = {
  yAxis: ETranslations.market_chart_settings__y_axis,
};

function SettingsEntry({ onPress }: { onPress: () => void }) {
  const intl = useIntl();

  return (
    <XStack
      testID="trading-view-native-chart-settings-dialog-open-settings"
      width="100%"
      minHeight={48}
      gap="$3"
      alignItems="center"
      cursor="pointer"
      onPress={onPress}
    >
      <Icon name="SettingsOutline" size="$5" color="$iconSubdued" />
      <SizableText size="$bodyMdMedium" color="$text">
        {intl.formatMessage({ id: ETranslations.market_chart_settings })}
      </SizableText>
      <XStack flex={1} />
      <Icon name="ChevronRightOutline" size="$4.5" color="$iconSubdued" />
    </XStack>
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
    <XStack width="50%" minHeight={40} pr="$2" alignItems="center">
      <Checkbox
        testID={`trading-view-native-chart-settings-dialog-option-${option}`}
        label={label}
        value={value}
        labelProps={{ variant: '$bodyMdMedium' }}
        containerProps={{ alignItems: 'center' }}
        labelContainerProps={{ py: '$0', my: '$0', justifyContent: 'center' }}
        onChange={(checked) => onChange(Boolean(checked))}
      />
    </XStack>
  );
}

export function TradingViewMobileChartSettingsDialogContent({
  chartMode,
  isChartSwitchDisabled = false,
  onChartSwitch,
  onOpenSettings,
}: {
  chartMode?: ITradingViewChartMode;
  isChartSwitchDisabled?: boolean;
  onChartSwitch?: () => void;
  onOpenSettings: () => void;
}) {
  const intl = useIntl();
  const dialog = useDialogInstance();
  const [settings, setSettings] =
    useMarketTradingViewChartSettingsPersistAtom();
  const normalizedSettings = useMemo(
    () => normalizeTradingViewNativeChartSettings(settings),
    [settings],
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
    <YStack gap="$4" pb="$6">
      <SettingsEntry onPress={() => void handleOpenSettings()} />
      <Divider />

      {chartMode && onChartSwitch ? (
        <>
          <YStack gap="$3" pt="$1">
            <SizableText size="$bodyMd" color="$textSubdued">
              {intl.formatMessage({ id: ETranslations.market_chart })}
            </SizableText>
            <TradingViewChartModeSelect
              chartMode={chartMode}
              isDisabled={isChartSwitchDisabled}
              onChartSwitch={() => void handleChartSwitch()}
            />
          </YStack>
          {chartMode === 'native' ? <Divider /> : null}
        </>
      ) : null}

      {chartMode !== 'tradingView' ? (
        <YStack gap="$3" pt="$1">
          <SizableText size="$bodyMd" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.market_chart_settings__chart_display,
            })}
          </SizableText>
          <TradingViewChartTypeSettingsRow
            value={normalizedSettings.chartType}
            onChange={handleChartTypeChange}
          />
          <XStack flexWrap="wrap" rowGap="$1">
            {QUICK_SETTING_OPTIONS.map((option) => (
              <QuickSettingOption
                key={option}
                option={option}
                label={
                  option === 'previousClose'
                    ? TRADING_VIEW_PREVIOUS_CLOSE_LABEL
                    : intl.formatMessage({
                        id: OPTION_TRANSLATION_IDS[option],
                      })
                }
                value={normalizedSettings.options[option]}
                onChange={(value) => handleOptionChange(option, value)}
              />
            ))}
          </XStack>
        </YStack>
      ) : null}
    </YStack>
  );
}
