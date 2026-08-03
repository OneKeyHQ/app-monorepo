import { useCallback, useState } from 'react';

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
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { createTradingViewChartSettingsValue } from '../TradingViewChartControls/chartSettings';

import type { ITradingViewChartSettingsOptions } from '../TradingViewChartControls/chartSettings/TradingViewSettingsMockState';

type IQuickSettingOptions = Pick<
  ITradingViewChartSettingsOptions,
  'countdown' | 'futureEvents' | 'pastEvents'
> & {
  yAxis: boolean;
};

const QUICK_SETTING_OPTIONS: Array<keyof IQuickSettingOptions> = [
  'yAxis',
  'countdown',
  'futureEvents',
  'pastEvents',
];

const OPTION_TRANSLATION_IDS: Record<
  keyof IQuickSettingOptions,
  ETranslations
> = {
  yAxis: ETranslations.market_chart_settings__y_axis,
  countdown: ETranslations.market_chart_settings__countdown,
  futureEvents: ETranslations.market_chart_settings__upcoming_events,
  pastEvents: ETranslations.market_chart_settings__past_events,
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
  onOpenSettings,
}: {
  onOpenSettings: () => void;
}) {
  const intl = useIntl();
  const dialog = useDialogInstance();
  const [options, setOptions] = useState<IQuickSettingOptions>(() => {
    const defaultOptions = createTradingViewChartSettingsValue().options;
    return {
      yAxis: true,
      countdown: defaultOptions.countdown,
      futureEvents: defaultOptions.futureEvents,
      pastEvents: defaultOptions.pastEvents,
    };
  });

  const handleOpenSettings = useCallback(async () => {
    await dialog.close();
    onOpenSettings();
  }, [dialog, onOpenSettings]);

  const handleOptionChange = useCallback(
    (key: keyof IQuickSettingOptions, value: boolean) => {
      setOptions((currentOptions) => ({
        ...currentOptions,
        [key]: value,
      }));
    },
    [],
  );

  return (
    <YStack gap="$4" pb="$6">
      <SettingsEntry onPress={() => void handleOpenSettings()} />
      <Divider />

      <YStack gap="$3" pt="$1">
        <SizableText size="$bodyMd" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.market_chart_settings__chart_display,
          })}
        </SizableText>
        <XStack flexWrap="wrap" rowGap="$1">
          {QUICK_SETTING_OPTIONS.map((option) => (
            <QuickSettingOption
              key={option}
              option={option}
              label={intl.formatMessage({
                id: OPTION_TRANSLATION_IDS[option],
              })}
              value={options[option]}
              onChange={(value) => handleOptionChange(option, value)}
            />
          ))}
        </XStack>
      </YStack>
    </YStack>
  );
}
