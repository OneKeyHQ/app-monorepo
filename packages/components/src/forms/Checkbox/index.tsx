import { memo, useCallback, useLayoutEffect, useMemo, useRef } from 'react';

import { withStaticProperties } from 'tamagui';

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
  const onPress = useCallback(() => onChange?.(!value), [value, onChange]);
  return (
    <XStack
      // alignItems="center"
      py="$2"
      opacity={checkboxProps.disabled ? 0.5 : 1}
      {...containerProps}
    >
      <YStack
        onPress={onPress}
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
        <Icon
          name={
            value === 'indeterminate'
              ? 'CheckboxIndeterminateCustom'
              : 'CheckboxCheckedCustom'
          }
          color="$iconInverse"
          size="$4"
        />
      </YStack>
      {label && (
        <Label variant="$bodyLgMedium" pl="$2" py="$2" my="$-2" {...labelProps}>
          {label}
        </Label>
      )}
    </XStack>
  );
}

const MemoRawCheckbox = memo(
  RawCheckbox,
  (prev, next) =>
    prev.value === next.value &&
    prev.disabled === next.disabled &&
    prev.label === next.label,
);

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
    <MemoRawCheckbox
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
  const innerValueRef = useRef(value);
  useLayoutEffect(() => {
    innerValueRef.current = value;
  }, [value]);

  const isAll = useMemo(
    () => value.length === options.length && value.findIndex((v) => !v) === -1,
    [value, options],
  );
  const handleSelectAll = useCallback(() => {
    onChange(options.map(() => !isAll));
  }, [onChange, isAll, options]);

  const onChangeHandler = useCallback(
    (index: number, v: ICheckedState) => {
      innerValueRef.current[index] = v;
      onChange([...innerValueRef.current]);
    },
    [onChange],
  );

  const renderItem = useCallback(
    ({
      item: { label: labelText, disabled: disabledElement },
      index,
    }: {
      item: { label: string; disabled?: boolean };
      index: number;
    }) => (
      <CheckboxGroupItem
        key={label}
        label={labelText}
        value={value[index]}
        index={index}
        disabled={disabled || !!disabledElement}
        onChange={onChangeHandler}
      />
    ),
    [value, disabled, label, onChangeHandler],
  );
  return (
    <YStack>
      <MemoRawCheckbox
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
        renderItem={renderItem}
      />
    </YStack>
  );
}

export const Checkbox = withStaticProperties(RawCheckbox, {
  Group: CheckboxGroup,
});
