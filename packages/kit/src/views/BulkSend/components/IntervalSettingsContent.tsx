import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Input, SizableText, XStack, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import {
  EIntervalMode,
  type IIntervalSettings,
} from '@onekeyhq/shared/types/bulkSend';

import { BULK_SEND_INTERVAL_MAX_SECONDS } from '../utils';

export const INTERVAL_SETTINGS_TITLE = appLocale.intl.formatMessage({
  id: ETranslations.wallet_bulk_send_interval_title,
});
export const INTERVAL_SETTINGS_NONE_LABEL = appLocale.intl.formatMessage({
  id: ETranslations.wallet_bulk_send_interval_none,
});
export const INTERVAL_SETTINGS_CANCEL_TEXT = appLocale.intl.formatMessage({
  id: ETranslations.wallet_bulk_send_btn_cancel,
});
export const INTERVAL_SETTINGS_CONFIRM_TEXT = appLocale.intl.formatMessage({
  id: ETranslations.wallet_bulk_send_btn_confirm,
});
export const INTERVAL_SETTINGS_REVIEW_TEXT = appLocale.intl.formatMessage({
  id: ETranslations.wallet_bulk_send_btn_review,
});

function useIntervalLabels() {
  const intl = useIntl();
  return {
    specifiedLabel: intl.formatMessage({
      id: ETranslations.wallet_bulk_send_interval_specified_range,
    }),
    specifiedDesc: intl.formatMessage(
      { id: ETranslations.wallet_bulk_send_interval_specified_desc },
      { maxSeconds: BULK_SEND_INTERVAL_MAX_SECONDS },
    ),
    noneDesc: intl.formatMessage({
      id: ETranslations.wallet_bulk_send_interval_none_desc,
    }),
    noneLabel: intl.formatMessage({
      id: ETranslations.wallet_bulk_send_interval_none,
    }),
    maxSecPlaceholder: intl.formatMessage({
      id: ETranslations.wallet_bulk_send_interval_max_sec_placeholder,
    }),
  };
}

function IntervalOptionIndicator({ selected }: { selected: boolean }) {
  return (
    <YStack
      mt="$0.5"
      w="$5"
      h="$5"
      alignItems="center"
      justifyContent="center"
      borderRadius="$full"
      borderWidth="$0.5"
      borderColor={selected ? '$bgPrimary' : '$border'}
      bg={selected ? '$bgPrimary' : '$transparent'}
      flexShrink={0}
    >
      {selected ? (
        <YStack w="$2.5" h="$2.5" borderRadius="$full" bg="$bg" />
      ) : null}
    </YStack>
  );
}

function IntervalOptionCard({
  title,
  description,
  selected,
  onPress,
  children,
}: {
  title: string;
  description: string;
  selected: boolean;
  onPress: () => void;
  children?: React.ReactNode;
}) {
  return (
    <YStack
      w="100%"
      minWidth={0}
      borderWidth="$0.5"
      borderColor={selected ? '$borderActive' : '$border'}
      borderRadius="$5"
      bg="$bg"
      p="$5"
      gap="$3"
      cursor="pointer"
      pressStyle={{ opacity: 0.8 }}
      onPress={onPress}
    >
      <XStack gap="$3" alignItems="flex-start" w="100%" minWidth={0}>
        <IntervalOptionIndicator selected={selected} />
        <YStack flex={1} minWidth={0} gap="$1.5">
          <SizableText size="$bodyLgMedium">{title}</SizableText>
          <SizableText size="$bodyLg" color="$textSubdued">
            {description}
          </SizableText>
          {children}
        </YStack>
      </XStack>
    </YStack>
  );
}

function IntervalRangeInputs({
  minSeconds,
  maxSeconds,
  error,
  maxSecPlaceholder,
  onMinChange,
  onMaxChange,
}: {
  minSeconds: string;
  maxSeconds: string;
  error?: string;
  maxSecPlaceholder: string;
  onMinChange: (value: string) => void;
  onMaxChange: (value: string) => void;
}) {
  const filterIntegerInput = useCallback((value: string) => {
    return value.replace(/[^0-9]/g, '');
  }, []);

  return (
    <YStack mt="$2" w="100%" minWidth={0} gap="$2">
      <XStack gap="$3" alignItems="center" w="100%" minWidth={0}>
        <Input
          containerProps={{ flex: 1, minWidth: 0 }}
          value={minSeconds}
          onChangeText={(v) => onMinChange(filterIntegerInput(v))}
          placeholder="0"
          keyboardType="number-pad"
          size="medium"
          error={Boolean(error)}
        />
        <SizableText size="$bodyLg" color="$textSubdued">
          -
        </SizableText>
        <Input
          containerProps={{ flex: 1, minWidth: 0 }}
          value={maxSeconds}
          onChangeText={(v) => onMaxChange(filterIntegerInput(v))}
          placeholder={maxSecPlaceholder}
          keyboardType="number-pad"
          size="medium"
          error={Boolean(error)}
        />
      </XStack>
      {error ? (
        <SizableText size="$bodyMd" color="$textCritical">
          {error}
        </SizableText>
      ) : null}
    </YStack>
  );
}

function IntervalSettingsContent({
  value,
  error,
  onChange,
}: {
  value: IIntervalSettings;
  error?: string;
  onChange: (settings: IIntervalSettings) => void;
}) {
  const {
    specifiedLabel,
    specifiedDesc,
    noneDesc,
    noneLabel,
    maxSecPlaceholder,
  } = useIntervalLabels();

  const handleSpecifiedModePress = useCallback(() => {
    onChange({
      ...value,
      mode: EIntervalMode.Specified,
    });
  }, [onChange, value]);

  const handleNoneModePress = useCallback(() => {
    onChange({
      ...value,
      mode: EIntervalMode.None,
    });
  }, [onChange, value]);

  const handleMinChange = useCallback(
    (minSeconds: string) => {
      onChange({ ...value, minSeconds });
    },
    [onChange, value],
  );

  const handleMaxChange = useCallback(
    (maxSeconds: string) => {
      onChange({ ...value, maxSeconds });
    },
    [onChange, value],
  );

  return (
    <YStack w="100%" minWidth={0} gap="$4">
      <IntervalOptionCard
        title={specifiedLabel}
        description={specifiedDesc}
        selected={value.mode === EIntervalMode.Specified}
        onPress={handleSpecifiedModePress}
      >
        {value.mode === EIntervalMode.Specified ? (
          <IntervalRangeInputs
            minSeconds={value.minSeconds}
            maxSeconds={value.maxSeconds}
            error={error}
            maxSecPlaceholder={maxSecPlaceholder}
            onMinChange={handleMinChange}
            onMaxChange={handleMaxChange}
          />
        ) : null}
      </IntervalOptionCard>
      <IntervalOptionCard
        title={noneLabel}
        description={noneDesc}
        selected={value.mode === EIntervalMode.None}
        onPress={handleNoneModePress}
      />
    </YStack>
  );
}

export { IntervalSettingsContent };
