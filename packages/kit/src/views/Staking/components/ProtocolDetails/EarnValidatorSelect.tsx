import { useCallback, useMemo } from 'react';

import {
  Icon,
  Select,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { ISelectItem } from '@onekeyhq/components/src/forms/Select/type';
import type { IEarnSelectField } from '@onekeyhq/shared/types/staking';

import { EarnText } from './EarnText';
import { EarnTooltip } from './EarnTooltip';

interface IEarnValidatorSelectProps {
  field: IEarnSelectField;
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
}

export function EarnValidatorSelect({
  field,
  value,
  onChange,
  disabled,
}: IEarnValidatorSelectProps) {
  const { title, tooltip, select } = field;

  const items: ISelectItem[] = useMemo(
    () =>
      select.options.map((option) => ({
        value: option.value,
        label: option.label.text,
        description: option.description?.text,
        disabled: option.disabled,
      })),
    [select.options],
  );

  const selectedValue = useMemo(
    () => value ?? select.defaultValue,
    [value, select.defaultValue],
  );

  const handleChange = useCallback(
    (newValue: string | number | boolean | undefined | ISelectItem) => {
      if (typeof newValue === 'string') {
        onChange?.(newValue);
      }
    },
    [onChange],
  );

  const selectedLabel = useMemo(() => {
    const selectedOption = select.options.find(
      (opt) => opt.value === selectedValue,
    );
    return selectedOption?.label.text ?? '';
  }, [select.options, selectedValue]);

  return (
    <YStack gap="$1">
      <XStack jc="space-between" ai="center">
        <XStack ai="center" gap="$1">
          {title ? (
            <EarnText text={title} size="$bodyMd" color="$textSubdued" />
          ) : null}
          <EarnTooltip tooltip={tooltip} />
        </XStack>
        <Select
          title={select.title?.text ?? ''}
          items={items}
          value={selectedValue}
          onChange={handleChange}
          disabled={disabled}
          renderTrigger={({ onPress }) => (
            <XStack
              ai="center"
              gap="$1"
              onPress={disabled ? undefined : onPress}
              cursor={disabled ? 'not-allowed' : 'pointer'}
              opacity={disabled ? 0.5 : 1}
              hoverStyle={disabled ? undefined : { opacity: 0.8 }}
            >
              <SizableText size="$bodyMdMedium">{selectedLabel}</SizableText>
              <Icon
                name="ChevronRightSmallOutline"
                size="$5"
                color="$iconSubdued"
              />
            </XStack>
          )}
        />
      </XStack>
    </YStack>
  );
}
