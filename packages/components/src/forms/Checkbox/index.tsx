import { memo, useCallback, useMemo, useRef, useState } from 'react';

import { withStaticProperties } from 'tamagui';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { Divider } from '../../content';
import { ListView } from '../../layouts';
import { Icon, Label, SizableText, XStack, YStack } from '../../primitives';
import { NATIVE_HIT_SLOP } from '../../utils';

import type { ILabelProps, IXStackProps, IYStackProps } from '../../primitives';
import type { IFormFieldProps } from '../types';
import type { GestureResponderEvent, ViewStyle } from 'react-native';
import type { CheckedState, CheckboxProps as TMCheckboxProps } from 'tamagui';

export type ICheckedState = CheckedState;

export type ICheckboxProps = IFormFieldProps<
  ICheckedState,
  Omit<TMCheckboxProps, 'size' | 'onCheckedChange' | 'checked' | 'value'> & {
    label?: string;
    description?: string;
    labelProps?: ILabelProps;
    containerProps?: IXStackProps;
    labelContainerProps?: IYStackProps;
  }
> & {
  isUncontrolled?: boolean;
  shouldStopPropagation?: boolean;
};

function RawCheckbox({
  label,
  description,
  labelProps,
  onChange,
  onChangeForDisabled,
  value,
  containerProps,
  labelContainerProps,
  defaultChecked,
  isUncontrolled,
  shouldStopPropagation,
  ...checkboxProps
}: ICheckboxProps) {
  const [innerValue, setInnerValue] = useState(defaultChecked);
  const usedValue = isUncontrolled ? innerValue : value;
  const onPress = useCallback(
    (event: GestureResponderEvent) => {
      if (shouldStopPropagation) {
        event.stopPropagation();
        event.preventDefault();
      }
      if (checkboxProps.disabled) {
        onChangeForDisabled?.(!usedValue);
        return;
      }
      if (isUncontrolled) {
        setInnerValue(!usedValue);
      }
      onChange?.(!usedValue);
    },
    [
      shouldStopPropagation,
      checkboxProps.disabled,
      isUncontrolled,
      onChange,
      usedValue,
      onChangeForDisabled,
    ],
  );
  return (
    <XStack
      py="$2"
      opacity={checkboxProps.disabled ? 0.5 : 1}
      userSelect="none"
      onPress={onPress}
      ai="flex-start"
      flexShrink={1}
      {...containerProps}
    >
      <YStack
        // Warning: Received `true` for a non-boolean attribute `unstyled`.
        // @ts-ignore
        unstyled="true"
        p="$0"
        my="$0.5"
        bg={usedValue ? '$bgPrimary' : '$iconInverse'}
        borderWidth="$0.5"
        borderColor={usedValue ? '$transparent' : '$borderStrong'}
        borderRadius="$1"
        alignItems="center"
        justifyContent="center"
        focusVisibleStyle={
          {
            outlineOffset: 2,
            outlineColor: '$focusRing',
          } as any
        }
        hitSlop={NATIVE_HIT_SLOP}
        maxHeight="$5"
        {...(checkboxProps as IYStackProps)}
      >
        <Icon
          name={
            usedValue === 'indeterminate'
              ? 'CheckboxIndeterminateCustom'
              : 'CheckboxCheckedCustom'
          }
          color="$iconInverse"
          size="$4"
        />
      </YStack>

      {label || description ? (
        <YStack
          pl="$2"
          py="$2"
          my="$-2"
          flex={platformEnv.isNative ? undefined : 1}
          {...labelContainerProps}
        >
          {label ? (
            <Label
              pointerEvents="none"
              variant="$bodyLgMedium"
              onPress={platformEnv.isNativeAndroid ? onPress : undefined}
              userSelect="none"
              {...labelProps}
            >
              {label}
            </Label>
          ) : null}
          {description ? (
            <SizableText size="$bodyMd" color="$textSubdued" pt="$0.5">
              {description}
            </SizableText>
          ) : null}
        </YStack>
      ) : null}
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
  innerValueRef.current = value;

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
