import { useCallback, useMemo } from 'react';

import {
  Input,
  Radio,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import {
  EIntervalMode,
  type IIntervalSettings,
} from '@onekeyhq/shared/types/bulkSend';

function IntervalRangeInputs({
  minSeconds,
  maxSeconds,
  onMinChange,
  onMaxChange,
}: {
  minSeconds: string;
  maxSeconds: string;
  onMinChange: (value: string) => void;
  onMaxChange: (value: string) => void;
}) {
  const filterIntegerInput = useCallback((value: string) => {
    // Allow only digits
    return value.replace(/[^0-9]/g, '');
  }, []);

  return (
    <XStack gap="$2" alignItems="center" mt="$3">
      <Input
        flex={1}
        value={minSeconds}
        onChangeText={(v) => onMinChange(filterIntegerInput(v))}
        placeholder="0"
        keyboardType="number-pad"
        size="medium"
      />
      <SizableText size="$bodyMd" color="$textSubdued">
        -
      </SizableText>
      <Input
        flex={1}
        value={maxSeconds}
        onChangeText={(v) => onMaxChange(filterIntegerInput(v))}
        placeholder="Max (sec)"
        keyboardType="number-pad"
        size="medium"
      />
    </XStack>
  );
}

function IntervalSettingsContent({
  value,
  onChange,
}: {
  value: IIntervalSettings;
  onChange: (settings: IIntervalSettings) => void;
}) {
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
        label: 'Specified range',
        description: 'Set an interval between 0 and 600 seconds.',
        value: EIntervalMode.Specified,
        children:
          value.mode === EIntervalMode.Specified ? (
            <IntervalRangeInputs
              minSeconds={value.minSeconds}
              maxSeconds={value.maxSeconds}
              onMinChange={handleMinChange}
              onMaxChange={handleMaxChange}
            />
          ) : null,
      },
      {
        label: 'No interval',
        description: 'Send all transactions at the same time.',
        value: EIntervalMode.None,
      },
    ],
    [
      value.mode,
      value.minSeconds,
      value.maxSeconds,
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
