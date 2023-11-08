import { useCallback, useMemo, useState } from 'react';

import { Checkbox as TMCheckbox, withStaticProperties } from 'tamagui';

import { Divider } from '../Divider';
import { Icon } from '../Icon';
import { Label } from '../Label';
import { ListView } from '../ListView';
import { XStack, YStack } from '../Stack';

import type { ViewStyle } from 'react-native';
import type { CheckedState, CheckboxProps as TMCheckboxProps } from 'tamagui';

export type ICheckboxProps = Omit<
  TMCheckboxProps,
  'size' | 'onCheckedChange' | 'checked' | 'value'
> & {
  label?: string;
  value?: CheckedState;
  onChange?: (checked: CheckedState) => void;
};

export type ICheckedState = CheckedState;

function RawCheckbox({
  label,
  onChange,
  value,
  ...checkboxProps
}: ICheckboxProps) {
  const id = useMemo(() => Math.random().toString(), []);

  const Indicator = useMemo(() => {
    if (value) {
      return (
        <Icon
          name={
            value === 'indeterminate'
              ? 'CheckboxIndeterminateCustom'
              : 'CheckboxCheckedCustom'
          }
          color="$iconInverse"
          size="$4"
        />
      );
    }
    return null;
  }, [value]);

  return (
    <XStack
      alignItems="center"
      py="$2"
      opacity={checkboxProps.disabled ? 0.5 : 1}
    >
      <TMCheckbox
        id={id}
        checked={value}
        onCheckedChange={onChange}
        unstyled
        p="$0"
        my="$0.5"
        bg={value ? '$bgPrimary' : 'transparent'}
        borderWidth="$0.5"
        borderColor={value ? '$transparent' : '$borderStrong'}
        borderRadius="$1"
        alignItems="center"
        justifyContent="center"
        focusStyle={{
          outlineOffset: 2,
          outlineColor: '$focusRing',
        }}
        $platform-native={{
          hitSlop: 8,
        }}
        {...checkboxProps}
      >
        {Indicator}
      </TMCheckbox>
      {label && (
        <Label htmlFor={id} variant="$bodyLgMedium" pl="$2" py="$2" my="$-2">
          {label}
        </Label>
      )}
    </XStack>
  );
}

interface ICheckboxGroupProps {
  label?: string;
  value: CheckedState[];
  disabled?: boolean;
  onChange: (value: CheckedState[]) => void;
  listStyle?: ViewStyle;
  options: {
    disabled?: boolean;
    label: string;
  }[];
}

function CheckboxGroupItem({
  disabled,
  label,
  value,
  index,
  onChange,
}: {
  disabled: boolean;
  label: string;
  value: CheckedState;
  index: number;
  onChange: (index: number, value: CheckedState) => void;
}) {
  const handleOnChange = useCallback(
    (v: CheckedState) => {
      onChange(index, v);
    },
    [index, onChange],
  );
  return (
    <RawCheckbox
      label={label}
      value={value}
      disabled={disabled}
      onChange={handleOnChange}
    />
  );
}

function CheckboxGroup({
  label,
  options,
  onChange,
  disabled,
  value,
  listStyle,
}: ICheckboxGroupProps) {
  const [isAll, setAll] = useState(
    value.length === options.length && !value.find((v) => !v),
  );
  const handleSelectAll = useCallback(() => {
    setAll(!isAll);
    onChange(options.map(() => !isAll));
  }, [isAll, onChange, options]);
  const onChangeHandler = useCallback(
    (index: number, v: CheckedState) => {
      value[index] = v;
      onChange([...value]);
    },
    [onChange, value],
  );
  return (
    <YStack>
      <RawCheckbox
        disabled={disabled}
        label={label}
        value={isAll}
        onChange={handleSelectAll}
      />
      <Divider />
      <ListView
        removeClippedSubviews
        style={listStyle}
        data={options}
        renderItem={({
          item: { label: labelText, disabled: disabledElement },
          index,
        }) => (
          <CheckboxGroupItem
            key={label}
            label={labelText}
            value={value[index]}
            index={index}
            disabled={disabled || !!disabledElement}
            onChange={onChangeHandler}
          />
        )}
      />
    </YStack>
  );
}

export const Checkbox = withStaticProperties(RawCheckbox, {
  Group: CheckboxGroup,
});
