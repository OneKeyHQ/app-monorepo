import React, { ComponentProps, FC, useState } from 'react';

import { IRadioValue } from 'native-base';

import Pressable from '../Pressable';

export type RadioBoxProps = {
  /**
   * 是否选中
   */
  isChecked?: boolean;
  /**
   * 按钮代表的数值
   */
  value: IRadioValue;
  /**
   * 禁用按钮
   */
  isDisabled?: boolean;
  /**
   * 点击修改状态
   */
  onChange?: (value: IRadioValue) => void;
} & ComponentProps<typeof Pressable>;

const RadioBox: FC<RadioBoxProps> = ({
  value,
  size,
  isChecked,
  isDisabled,
  onChange,
  ...props
}) => {
  const [isFocused, setFocused] = useState(false);

  let brColor = 'border-default';
  if (isChecked) {
    if (isDisabled) {
      brColor = 'action-primary-activate-disabled';
    } else {
      brColor = 'action-primary-default';
    }
  } else if (isDisabled) {
    brColor = 'border-disabled';
  } else {
    brColor = 'border-default';
  }

  let bgColor = 'action-secondary-default';
  if (isDisabled) {
    bgColor = 'action-secondary-disabled';
  } else {
    bgColor = 'action-secondary-default';
  }

  return (
    <Pressable
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      _hover={{
        bg: isFocused ? 'surface-hovered' : 'action-secondary-hovered',
        borderColor: isFocused
          ? 'action-primary-focus'
          : 'action-secondary-hovered',
      }}
      _focus={{
        bg: 'surface-hovered',
        borderColor: 'focused-default',
      }}
      _focusVisible={{
        bg: 'surface-hovered',
        borderColor: 'action-primary-focus',
      }}
      _pressed={{
        bg: 'surface-selected',
        borderColor: isDisabled
          ? 'action-secondary-disabled'
          : 'action-primary-default',
      }}
      _disabled={{
        bg: 'action-secondary-disabled',
        borderColor: 'action-primary-disabled',
      }}
      disabled={isDisabled}
      borderRadius="12px"
      borderWidth="1px"
      borderColor={brColor}
      bg={bgColor}
      p={4}
      mt="1.5"
      mb="1.5"
      onPress={() => {
        if (onChange) onChange(value);
      }}
      {...props}
    >
      {props.children}
    </Pressable>
  );
};

export default RadioBox;
