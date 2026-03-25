import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Input,
  Radio,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EIntervalMode,
  type IIntervalSettings,
} from '@onekeyhq/shared/types/bulkSend';

import {
  BULK_SEND_INTERVAL_MAX_SECONDS,
  formatIntervalSecondsRange,
} from '../utils';

function IntervalRangeInputs({
  minSeconds,
  maxSeconds,
  maxPlaceholder,
  error,
  onMinChange,
  onMaxChange,
}: {
  minSeconds: string;
  maxSeconds: string;
  maxPlaceholder: string;
  error?: string;
  onMinChange: (value: string) => void;
  onMaxChange: (value: string) => void;
}) {
  const filterIntegerInput = useCallback((value: string) => {
    // Allow only digits
    return value.replace(/[^0-9]/g, '');
  }, []);

  return (
    <YStack mt="$3" w="100%" minWidth={0} gap="$2">
      <XStack gap="$2" alignItems="center" w="100%" minWidth={0}>
        <Input
          containerProps={{ flex: 1, minWidth: 0 }}
          value={minSeconds}
          onChangeText={(v) => onMinChange(filterIntegerInput(v))}
          placeholder="0"
          keyboardType="number-pad"
          size="medium"
          error={Boolean(error)}
        />
        <SizableText size="$bodyMd" color="$textSubdued">
          -
        </SizableText>
        <Input
          containerProps={{ flex: 1, minWidth: 0 }}
          value={maxSeconds}
          onChangeText={(v) => onMaxChange(filterIntegerInput(v))}
          placeholder={maxPlaceholder}
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
  const intl = useIntl();

  const handleModeChange = useCallback(
    (mode: string) => {
      onChange({
        ...value,
        mode: mode as EIntervalMode,
      });
    },
    [onChange, value],
  );

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

  const options = useMemo(
    () => [
      {
        label: intl.formatMessage({
          id: ETranslations.global_bulk_copy_addresses_tabs_set_range,
        }),
        description: formatIntervalSecondsRange({
          minSeconds: '0',
          maxSeconds: String(BULK_SEND_INTERVAL_MAX_SECONDS),
        }),
        value: EIntervalMode.Specified,
        children:
          value.mode === EIntervalMode.Specified ? (
            <IntervalRangeInputs
              minSeconds={value.minSeconds}
              maxSeconds={value.maxSeconds}
              maxPlaceholder={intl.formatMessage({
                id: ETranslations.wallet_bulk_send_placeholder_max,
              })}
              error={error}
              onMinChange={handleMinChange}
              onMaxChange={handleMaxChange}
            />
          ) : null,
      },
      {
        label: intl.formatMessage({
          id: ETranslations.wallet_bulk_send_interval_none,
        }),
        value: EIntervalMode.None,
      },
    ],
    [
      intl,
      value.mode,
      value.minSeconds,
      value.maxSeconds,
      error,
      handleMinChange,
      handleMaxChange,
    ],
  );

  return (
    <YStack>
      <Radio value={value.mode} onChange={handleModeChange} options={options} />
    </YStack>
  );
}

export { IntervalSettingsContent };
