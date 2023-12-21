import { useCallback, useMemo, useState } from 'react';

import { Checkbox as TMCheckbox, withStaticProperties } from 'tamagui';

import { Divider } from '../../content';
import { ListView } from '../../layouts';
import { Icon, Label, XStack, YStack } from '../../primitives';

import type { ILabelProps } from '../../primitives';
import type { ViewStyle } from 'react-native';
import type {
  CheckedState,
  StackProps,
  CheckboxProps as TMCheckboxProps,
} from 'tamagui';

export type ICheckedState = CheckedState;

export type ICheckboxProps = Omit<
  TMCheckboxProps,
  'size' | 'onCheckedChange' | 'checked' | 'value'
> & {
  label?: string;
  labelProps?: ILabelProps;
  value?: ICheckedState;
  onChange?: (checked: ICheckedState) => void;
  containerProps?: StackProps;
};

function RawCheckbox({
  label,
  labelProps,
  onChange,
  value,
  containerProps,
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
      // alignItems="center"
      py="$2"
      opacity={checkboxProps.disabled ? 0.5 : 1}
      {...containerProps}
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
          hitSlop: { top: 8, left: 8, right: 8, bottom: 8 },
        }}
        {...checkboxProps}
      >
        {Indicator}
      </TMCheckbox>
      {label && (
        <Label
          htmlFor={id}
          variant="$bodyLgMedium"
          pl="$2"
          py="$2"
          my="$-2"
          {...labelProps}
        >
          {label}
        </Label>
      )}
    </XStack>
  );
}

interface ICheckboxGroupProps {
  label?: string;
  value: ICheckedState[];
  disabled?: boolean;
  onChange: (value: ICheckedState[]) => void;
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
  value: ICheckedState;
  index: number;
  onChange: (index: number, value: ICheckedState) => void;
}) {
  const handleOnChange = useCallback(
    (v: ICheckedState) => {
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
    (index: number, v: ICheckedState) => {
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
        estimatedItemSize="$10"
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
