import type { ComponentProps, FC } from 'react';
import { useState } from 'react';

import Pressable from '../Pressable';

import type { IRadioValue } from 'native-base';

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
  let bgColor = 'transparent';
  if (isChecked) {
    if (isDisabled) {
      brColor = 'action-primary-activate-disabled';
    } else {
      brColor = 'action-primary-default';
    }
    bgColor = 'surface-selected';
  } else if (isDisabled) {
    bgColor = 'surface-disabled';
    brColor = 'border-disabled';
  } else {
    brColor = 'border-default';
  }

  return (
    <Pressable
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      _hover={{
        bg: isFocused ? 'surface-hovered' : 'action-secondary-hovered',
        borderColor: isFocused ? 'interactive-default' : brColor,
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
      py={4}
      px={{ base: 4, md: 6 }}
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
